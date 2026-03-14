import type WebSocket from 'ws';
import { v4 as uuid } from 'uuid';
import Redis from 'ioredis';
import { createChildLogger } from './logger.js';
import type { WsMessage, WsConnectionMeta, OperationsManifest } from './ws-types.js';
import {
  WS_CLOSE_CODES,
  WS_PING_INTERVAL_MS,
  WS_PONG_TIMEOUT_MS,
  WS_OFFLINE_QUEUE_LIMIT,
  GW_REDIS_KEYS,
  isValidUpstreamType,
} from './ws-types.js';
import { verifyWsSignature, isWsTimestampFresh, validateWsMessage } from '../security/message-signer.js';
import { SECURITY_REDIS_KEYS } from '../security/types.js';

const log = createChildLogger('ws-gateway');

interface LocalConnection {
  ws: WebSocket;
  meta: WsConnectionMeta;
  alive: boolean;
}

/**
 * WebSocket Gateway Instance (MDC §Gateway Cluster Pattern).
 *
 * Each gateway instance:
 *  - Holds only its LOCAL WebSocket connections (~50-100K max)
 *  - Registers agent→gateway mapping in Redis Hash
 *  - Subscribes to `internal:gw:{gatewayId}` for targeted commands
 *  - Subscribes to `ops:broadcast` for broadcast commands
 *  - On reconnect: drains offline queue from Redis List, sends ops:latest checkpoint
 *  - Pushes upstream agent events to Redis Stream
 *  - Enforces message direction rules (agents can only send ACK/events)
 *  - Verifies HMAC signatures on downstream messages from master
 *
 * The Master Agent NEVER holds WebSocket connections directly.
 */
export class WsGateway {
  readonly gatewayId: string;

  private connections = new Map<string, LocalConnection>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  private redisPub: Redis;
  private redisSub: Redis;

  private masterSigningKey: string | null = null;

  constructor(private redisUrl: string) {
    this.gatewayId = `gw-${uuid().slice(0, 8)}`;
    this.redisPub = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.redisSub = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
  }

  // ═══════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════

  async start(): Promise<void> {
    await this.loadMasterKey();

    await this.redisSub.subscribe(
      GW_REDIS_KEYS.gatewayChannel(this.gatewayId),
      GW_REDIS_KEYS.broadcastChannel,
      GW_REDIS_KEYS.manifestUpdate,
      GW_REDIS_KEYS.hotConfigUpdate,
      GW_REDIS_KEYS.strategyParamsUpdate,
    );

    this.redisSub.on('message', (channel, data) => {
      this.handleRedisMessage(channel, data);
    });

    this.pingTimer = setInterval(() => this.pingAll(), WS_PING_INTERVAL_MS);
    log.info({ gatewayId: this.gatewayId }, 'Gateway started');
  }

  async stop(): Promise<void> {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    for (const [, conn] of this.connections) {
      conn.ws.close(WS_CLOSE_CODES.HUB_SHUTDOWN, 'Gateway shutting down');
    }
    this.connections.clear();

    this.redisSub.disconnect();
    this.redisPub.disconnect();
    log.info({ gatewayId: this.gatewayId }, 'Gateway stopped');
  }

  /**
   * Load the master agent's HMAC signing key from Redis so we can
   * verify all downstream commands before forwarding to agents.
   */
  private async loadMasterKey(): Promise<void> {
    const key = await this.redisPub.get(SECURITY_REDIS_KEYS.agentKey('master-agent'));
    if (key) {
      this.masterSigningKey = key;
      log.info('Master signing key loaded for downstream verification');
    } else {
      log.warn('Master signing key not found in Redis — downstream signature verification disabled');
    }
  }

  // ═══════════════════════════════════════════════
  // Connection Management
  // ═══════════════════════════════════════════════

  async registerConnection(ws: WebSocket, meta: WsConnectionMeta): Promise<void> {
    const existing = this.connections.get(meta.agentId);
    if (existing) {
      existing.ws.close(WS_CLOSE_CODES.DUPLICATE_AGENT, 'Replaced by new connection');
      await this.cleanupConnection(meta.agentId);
    }

    const conn: LocalConnection = { ws, meta, alive: true };
    this.connections.set(meta.agentId, conn);

    await this.redisPub.set(
      GW_REDIS_KEYS.agentGateway(meta.agentId),
      this.gatewayId,
    );

    ws.on('message', (data: unknown) => this.handleAgentMessage(meta, data));
    ws.on('close', () => this.handleClose(meta.agentId));
    ws.on('error', (err: Error) => log.error({ err, agentId: meta.agentId }, 'WS error'));
    ws.on('pong', () => {
      const c = this.connections.get(meta.agentId);
      if (c) c.alive = true;
    });

    await this.drainOfflineQueue(meta.agentId, ws);
    await this.sendLatestCheckpoints(ws);

    log.info({
      agentId: meta.agentId, tier: meta.tier, gateway: this.gatewayId,
    }, 'Agent connected to gateway');
  }

  // ═══════════════════════════════════════════════
  // Incoming agent messages → direction enforcement + upstream
  // ═══════════════════════════════════════════════

  private handleAgentMessage(meta: WsConnectionMeta, raw: unknown): void {
    let message: WsMessage;
    try {
      message = JSON.parse(String(raw)) as WsMessage;
    } catch {
      log.error({ agentId: meta.agentId }, 'Unparseable message from agent');
      return;
    }

    if (!isValidUpstreamType(message.type)) {
      log.warn({
        agentId: meta.agentId, type: message.type,
      }, 'Direction violation — agents cannot send this message type');
      const conn = this.connections.get(meta.agentId);
      conn?.ws.close(WS_CLOSE_CODES.DIRECTION_VIOLATION, `Type '${message.type}' not allowed upstream`);
      return;
    }

    if (message.from !== meta.agentId) {
      log.warn({
        agentId: meta.agentId, claimedFrom: message.from,
      }, 'Agent claimed different identity — rejecting');
      return;
    }

    if (message.type === 'ack' && message.corrId) {
      void this.redisPub.lpush(
        GW_REDIS_KEYS.ackQueue(message.corrId),
        JSON.stringify(message),
      );
      void this.redisPub.expire(GW_REDIS_KEYS.ackQueue(message.corrId), 120);
      return;
    }

    void this.redisPub.xadd(
      GW_REDIS_KEYS.upstreamEvents,
      '*',
      'agentId', meta.agentId,
      'userId', meta.userId,
      'tier', meta.tier,
      'type', message.type,
      'data', JSON.stringify(message),
    );
  }

  // ═══════════════════════════════════════════════
  // Redis Pub/Sub → verify signature + forward to local connections
  // ═══════════════════════════════════════════════

  private handleRedisMessage(channel: string, data: string): void {
    if (channel === GW_REDIS_KEYS.broadcastChannel) {
      this.verifyAndForwardAll(data);
      return;
    }

    if (channel === GW_REDIS_KEYS.gatewayChannel(this.gatewayId)) {
      this.verifyAndForwardTargeted(data);
      return;
    }

    if (
      channel === GW_REDIS_KEYS.manifestUpdate ||
      channel === GW_REDIS_KEYS.hotConfigUpdate ||
      channel === GW_REDIS_KEYS.strategyParamsUpdate
    ) {
      this.forwardToAll(data);
      return;
    }
  }

  /**
   * Verify downstream master message signature before broadcast-forwarding.
   * If the master key is available and the message carries a signature,
   * we reject messages that fail verification. Unsigned messages from
   * master are logged as warnings but still forwarded (graceful degradation
   * during key rotation / startup race).
   */
  private verifyAndForwardAll(serialized: string): void {
    if (!this.verifyDownstream(serialized)) return;
    this.forwardToAll(serialized);
  }

  private verifyAndForwardTargeted(serialized: string): void {
    if (!this.verifyDownstream(serialized)) return;
    this.forwardTargeted(serialized);
  }

  private verifyDownstream(serialized: string): boolean {
    if (!this.masterSigningKey) return true;

    let msg: WsMessage;
    try {
      msg = JSON.parse(serialized) as WsMessage;
    } catch {
      log.error('Unparseable downstream message — dropping');
      return false;
    }

    if (msg.from !== 'master-agent') {
      log.warn({ from: msg.from }, 'Downstream message not from master-agent — dropping');
      return false;
    }

    if (!isWsTimestampFresh(msg.timestamp)) {
      log.warn({ type: msg.type, age: Date.now() - msg.timestamp }, 'Downstream message expired — dropping');
      return false;
    }

    if (msg.signature && msg.nonce) {
      if (!verifyWsSignature(msg, this.masterSigningKey)) {
        log.warn({ type: msg.type, to: msg.to }, 'Invalid downstream signature — dropping');
        return false;
      }
    } else {
      log.debug({ type: msg.type }, 'Downstream message unsigned — forwarding (graceful)');
    }

    return true;
  }

  private forwardToAll(serialized: string): void {
    for (const [, conn] of this.connections) {
      if (conn.ws.readyState === 1) {
        conn.ws.send(serialized);
      }
    }
  }

  private forwardTargeted(serialized: string): void {
    let parsed: { to?: string };
    try {
      parsed = JSON.parse(serialized);
    } catch {
      log.error('Unparseable targeted message from Redis');
      return;
    }

    const targetId = parsed.to;
    if (!targetId) {
      log.warn('Targeted message missing "to" field');
      return;
    }

    const conn = this.connections.get(targetId);
    if (conn && conn.ws.readyState === 1) {
      conn.ws.send(serialized);
    } else {
      log.warn({ agentId: targetId }, 'Targeted agent not on this gateway — should not happen');
    }
  }

  // ═══════════════════════════════════════════════
  // Offline Queue (Redis List)
  // ═══════════════════════════════════════════════

  private async drainOfflineQueue(agentId: string, ws: WebSocket): Promise<void> {
    const key = GW_REDIS_KEYS.offlineQueue(agentId);
    let drained = 0;

    while (true) {
      const msg = await this.redisPub.rpop(key);
      if (!msg) break;
      if (ws.readyState === 1) {
        ws.send(msg);
        drained++;
      }
    }

    if (drained > 0) {
      log.debug({ agentId, drained }, 'Offline queue drained');
    }
  }

  // ═══════════════════════════════════════════════
  // Broadcast checkpoint (ops:latest)
  // ═══════════════════════════════════════════════

  private async sendLatestCheckpoints(ws: WebSocket): Promise<void> {
    const all = await this.redisPub.hgetall(GW_REDIS_KEYS.latestCheckpoint);
    for (const [, serialized] of Object.entries(all)) {
      if (ws.readyState === 1) {
        ws.send(serialized);
      }
    }
  }

  // ═══════════════════════════════════════════════
  // Ping/Pong liveness (replaces heartbeat stream)
  // ═══════════════════════════════════════════════

  private pingAll(): void {
    for (const [agentId, conn] of this.connections) {
      if (!conn.alive) {
        log.warn({ agentId }, 'Pong timeout — terminating connection');
        conn.ws.terminate();
        continue;
      }
      conn.alive = false;
      conn.ws.ping();
    }
  }

  // ═══════════════════════════════════════════════
  // Disconnect cleanup
  // ═══════════════════════════════════════════════

  private async handleClose(agentId: string): Promise<void> {
    // Notify master about disconnect via upstream event
    void this.redisPub.xadd(
      GW_REDIS_KEYS.upstreamEvents,
      '*',
      'agentId', agentId,
      'userId', '',
      'tier', '',
      'type', 'agent-disconnect',
      'data', JSON.stringify({ type: 'agent-disconnect', from: agentId, timestamp: Date.now() }),
    );

    await this.cleanupConnection(agentId);
    log.info({ agentId, gateway: this.gatewayId }, 'Agent disconnected');
  }

  private async cleanupConnection(agentId: string): Promise<void> {
    this.connections.delete(agentId);

    const currentGw = await this.redisPub.get(GW_REDIS_KEYS.agentGateway(agentId));
    if (currentGw === this.gatewayId) {
      await this.redisPub.del(GW_REDIS_KEYS.agentGateway(agentId));
    }
  }

  // ═══════════════════════════════════════════════
  // Query helpers (local only)
  // ═══════════════════════════════════════════════

  getLocalConnectionCount(): number {
    return this.connections.size;
  }

  isLocallyConnected(agentId: string): boolean {
    const conn = this.connections.get(agentId);
    return !!conn && conn.ws.readyState === 1;
  }

  getLocalAgentIds(): string[] {
    return [...this.connections.keys()];
  }
}
