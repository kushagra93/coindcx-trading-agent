import Redis from 'ioredis';
import { createChildLogger } from './logger.js';
import type { WsMessage, OperationsManifest, OperationDefinition } from './ws-types.js';
import { GW_REDIS_KEYS, WS_OFFLINE_QUEUE_LIMIT } from './ws-types.js';
import type { AgentTier } from '../security/types.js';
import { verifyWsSignature, isWsTimestampFresh } from '../security/message-signer.js';
import { getAgentKey } from '../security/trust-chain.js';

const log = createChildLogger('ws-hub');

type UpstreamHandler = (agentId: string, userId: string, tier: string, message: WsMessage) => void;

/**
 * Master-side WsHub (MDC §Internal Backbone: Redis).
 *
 * The Master Agent uses this class to send commands to agents and
 * consume upstream events. It NEVER holds WebSocket connections
 * directly — all routing goes through Redis → Gateway instances.
 *
 * Targeted command flow:
 *   Master → redis.hget('agent-gw', agentId) → gatewayId
 *          → redis.publish('internal:gw:{gatewayId}', signedMsg)
 *          → if no gateway: redis.lpush('q:{agentId}', signedMsg)
 *
 * Broadcast flow:
 *   Master → redis.publish('ops:broadcast', signedMsg)
 *          → redis.hset('ops:latest', type, signedMsg)   // checkpoint
 */
export class WsHub {
  private redis: Redis;
  private redisSub: Redis;
  private upstreamHandlers: UpstreamHandler[] = [];
  private eventPollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
    this.redisSub = new Redis(redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });
  }

  // ═══════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════

  async start(): Promise<void> {
    await this.ensureConsumerGroup();
    this.eventPollTimer = setInterval(() => void this.consumeUpstreamEvents(), 200);
    log.info('WsHub (master-side, Redis-backed) started');
  }

  async stop(): Promise<void> {
    if (this.eventPollTimer) {
      clearInterval(this.eventPollTimer);
      this.eventPollTimer = null;
    }
    this.redis.disconnect();
    this.redisSub.disconnect();
    log.info('WsHub stopped');
  }

  // ═══════════════════════════════════════════════
  // Send: targeted command
  // ═══════════════════════════════════════════════

  async sendTo(agentId: string, message: WsMessage): Promise<boolean> {
    const serialized = JSON.stringify(message);

    const gatewayId = await this.redis.get(GW_REDIS_KEYS.agentGateway(agentId));

    if (gatewayId) {
      await this.redis.publish(GW_REDIS_KEYS.gatewayChannel(gatewayId), serialized);
      return true;
    }

    await this.enqueueOffline(agentId, serialized);
    return false;
  }

  // ═══════════════════════════════════════════════
  // Send: broadcast (+ checkpoint in ops:latest)
  // ═══════════════════════════════════════════════

  async broadcast(message: WsMessage): Promise<void> {
    const serialized = JSON.stringify(message);
    await this.redis.publish(GW_REDIS_KEYS.broadcastChannel, serialized);
    await this.redis.hset(GW_REDIS_KEYS.latestCheckpoint, message.type, serialized);
  }

  async broadcastToTier(_tier: AgentTier, message: WsMessage): Promise<void> {
    const enriched = { ...message, payload: { ...message.payload, _targetTier: _tier } };
    await this.broadcast(enriched);
  }

  // ═══════════════════════════════════════════════
  // Send: helper round-robin (pick from Redis set)
  // ═══════════════════════════════════════════════

  async sendToHelper(helperType: string, message: WsMessage): Promise<boolean> {
    const pattern = `agent-gw:helper-${helperType}-*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length === 0) return false;

    const counterKey = `helper-rr:${helperType}`;
    const idx = await this.redis.incr(counterKey);
    const chosen = keys[(idx - 1) % keys.length];
    const agentId = chosen.replace('agent-gw:', '');
    return this.sendTo(agentId, { ...message, to: agentId });
  }

  // ═══════════════════════════════════════════════
  // Offline queue (Redis List, bounded)
  // ═══════════════════════════════════════════════

  private async enqueueOffline(agentId: string, serialized: string): Promise<void> {
    const key = GW_REDIS_KEYS.offlineQueue(agentId);
    await this.redis.lpush(key, serialized);
    await this.redis.ltrim(key, 0, WS_OFFLINE_QUEUE_LIMIT - 1);
    await this.redis.expire(key, 86_400);
    log.debug({ agentId }, 'Enqueued to offline queue');
  }

  // ═══════════════════════════════════════════════
  // Upstream events (Redis Stream consumer)
  // ═══════════════════════════════════════════════

  onUpstream(handler: UpstreamHandler): void {
    this.upstreamHandlers.push(handler);
  }

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup(
        'CREATE',
        GW_REDIS_KEYS.upstreamEvents,
        GW_REDIS_KEYS.upstreamGroup,
        '0',
        'MKSTREAM',
      );
    } catch (err: any) {
      if (!err.message?.includes('BUSYGROUP')) throw err;
    }
  }

  private async consumeUpstreamEvents(): Promise<void> {
    try {
      const results = await this.redis.xreadgroup(
        'GROUP', GW_REDIS_KEYS.upstreamGroup, 'master-0',
        'COUNT', '50',
        'BLOCK', '0',
        'STREAMS', GW_REDIS_KEYS.upstreamEvents, '>',
      ) as [string, [string, string[]][]][] | null;

      if (!results) return;

      for (const [, entries] of results) {
        for (const [id, fields] of entries) {
          const map = this.fieldsToMap(fields);
          const agentId = map.agentId ?? '';
          const userId = map.userId ?? '';
          const tier = map.tier ?? '';
          let message: WsMessage;
          try {
            message = JSON.parse(map.data ?? '{}') as WsMessage;
          } catch {
            log.error({ id }, 'Unparseable upstream event');
            await this.redis.xack(GW_REDIS_KEYS.upstreamEvents, GW_REDIS_KEYS.upstreamGroup, id);
            continue;
          }

          if (!this.verifyUpstreamMessage(agentId, message)) {
            await this.redis.xack(GW_REDIS_KEYS.upstreamEvents, GW_REDIS_KEYS.upstreamGroup, id);
            continue;
          }

          if (message.signature && message.nonce) {
            const agentKey = await getAgentKey(agentId, this.redis);
            if (agentKey) {
              if (!verifyWsSignature(message, agentKey)) {
                log.warn({ agentId, type: message.type }, 'Upstream signature verification failed — dropping');
                await this.redis.xack(GW_REDIS_KEYS.upstreamEvents, GW_REDIS_KEYS.upstreamGroup, id);
                continue;
              }
            }
          }

          for (const handler of this.upstreamHandlers) {
            try {
              handler(agentId, userId, tier, message);
            } catch (err) {
              log.error({ err, agentId }, 'Error in upstream handler');
            }
          }

          await this.redis.xack(GW_REDIS_KEYS.upstreamEvents, GW_REDIS_KEYS.upstreamGroup, id);
        }
      }
    } catch (err) {
      log.error({ err }, 'Error consuming upstream events');
    }
  }

  /**
   * Verify basic integrity of upstream messages:
   * 1. `from` must match the authenticated agentId (already enforced at gateway)
   * 2. Timestamp freshness (30s window)
   */
  private verifyUpstreamMessage(agentId: string, msg: WsMessage): boolean {
    if (msg.from !== agentId) {
      log.warn({ agentId, claimedFrom: msg.from }, 'Upstream message identity mismatch — dropping');
      return false;
    }

    if (!isWsTimestampFresh(msg.timestamp)) {
      log.warn({ agentId, age: Date.now() - msg.timestamp }, 'Upstream message expired — dropping');
      return false;
    }

    return true;
  }

  private fieldsToMap(fields: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      map[fields[i]] = fields[i + 1];
    }
    return map;
  }

  // ═══════════════════════════════════════════════
  // Operations Manifest (MDC §Dynamic Command Registry)
  // ═══════════════════════════════════════════════

  async publishManifest(manifest: OperationsManifest): Promise<void> {
    await this.redis.set(GW_REDIS_KEYS.manifest, JSON.stringify(manifest));
    await this.redis.publish(GW_REDIS_KEYS.manifestUpdate, JSON.stringify(manifest));
    log.info({ version: manifest.version }, 'Operations manifest published');
  }

  async getManifest(): Promise<OperationsManifest | null> {
    const raw = await this.redis.get(GW_REDIS_KEYS.manifest);
    return raw ? (JSON.parse(raw) as OperationsManifest) : null;
  }

  // ═══════════════════════════════════════════════
  // Hot Config (MDC §Hot-Updating — Layer 1: Config)
  // ═══════════════════════════════════════════════

  async updateHotConfig(config: Record<string, string>): Promise<void> {
    await this.redis.hmset(GW_REDIS_KEYS.hotConfig, config);
    await this.redis.publish(GW_REDIS_KEYS.hotConfigUpdate, JSON.stringify(config));
    log.info('Hot config pushed');
  }

  async getHotConfig(): Promise<Record<string, string>> {
    return this.redis.hgetall(GW_REDIS_KEYS.hotConfig);
  }

  // ═══════════════════════════════════════════════
  // Strategy Params (MDC §Hot-Updating — Layer 2)
  // ═══════════════════════════════════════════════

  async updateStrategyParams(agentId: string, params: Record<string, unknown>): Promise<void> {
    await this.redis.set(GW_REDIS_KEYS.strategyParams(agentId), JSON.stringify(params));
    await this.redis.publish(GW_REDIS_KEYS.strategyParamsUpdate, JSON.stringify({ agentId, params }));
    log.info({ agentId }, 'Strategy params pushed');
  }

  async getStrategyParams(agentId: string): Promise<Record<string, unknown> | null> {
    const raw = await this.redis.get(GW_REDIS_KEYS.strategyParams(agentId));
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }

  // ═══════════════════════════════════════════════
  // ACK reader (master polls acks by corrId)
  // ═══════════════════════════════════════════════

  async readAcks(corrId: string, count = 10): Promise<WsMessage[]> {
    const key = GW_REDIS_KEYS.ackQueue(corrId);
    const results: WsMessage[] = [];
    for (let i = 0; i < count; i++) {
      const raw = await this.redis.rpop(key);
      if (!raw) break;
      results.push(JSON.parse(raw) as WsMessage);
    }
    return results;
  }

  // ═══════════════════════════════════════════════
  // Query: is agent online? (check Redis mapping)
  // ═══════════════════════════════════════════════

  async isConnected(agentId: string): Promise<boolean> {
    const gw = await this.redis.get(GW_REDIS_KEYS.agentGateway(agentId));
    return !!gw;
  }

  async getConnectedAgents(): Promise<string[]> {
    const keys = await this.redis.keys('agent-gw:*');
    return keys.map((k) => k.replace('agent-gw:', ''));
  }

  async getConnectionCount(): Promise<number> {
    const keys = await this.redis.keys('agent-gw:*');
    return keys.length;
  }
}
