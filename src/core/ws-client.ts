import WebSocket from 'ws';
import { createChildLogger } from './logger.js';
import type { WsMessage, OperationsManifest } from './ws-types.js';
import {
  WS_CLOSE_CODES,
  WS_PING_INTERVAL_MS,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_MAX_MS,
  WS_OFFLINE_QUEUE_LIMIT,
} from './ws-types.js';

const log = createChildLogger('ws-client');

type MessageHandler = (message: WsMessage) => void;
type ManifestHandler = (manifest: OperationsManifest) => void;
type ConfigHandler = (config: Record<string, unknown>) => void;

/**
 * Auto-reconnecting WebSocket client used by all non-master agents
 * (Broker, User, Helper) to connect to the Gateway Cluster.
 *
 * MDC changes:
 *  - Authenticates via JWT token (passed as query param at handshake)
 *  - Processes manifest updates from gateway
 *  - Processes hot config / strategy param updates
 *  - Only sends ACK/event types upstream (direction enforcement)
 */
export class WsClient {
  private ws: WebSocket | null = null;
  private messageHandlers: MessageHandler[] = [];
  private manifestHandlers: ManifestHandler[] = [];
  private configHandlers: ConfigHandler[] = [];
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingQueue: WsMessage[] = [];
  private intentionalClose = false;
  private _connected = false;

  constructor(
    private gatewayUrl: string,
    private jwtToken: string,
    private agentId: string,
    private tier: string,
    private helperType?: string,
  ) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.intentionalClose = false;

      const url = new URL(this.gatewayUrl);
      url.searchParams.set('token', this.jwtToken);

      this.ws = new WebSocket(url.toString());

      this.ws.on('open', () => {
        this._connected = true;
        this.reconnectAttempt = 0;
        this.flushPendingQueue();
        log.info({ agentId: this.agentId, gatewayUrl: this.gatewayUrl }, 'Connected to gateway');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const raw = JSON.parse(data.toString());

          if (raw.version !== undefined && raw.operations !== undefined) {
            for (const handler of this.manifestHandlers) {
              handler(raw as OperationsManifest);
            }
            return;
          }

          if (raw._hotConfig) {
            for (const handler of this.configHandlers) {
              handler(raw as Record<string, unknown>);
            }
            return;
          }

          const message = raw as WsMessage;
          for (const handler of this.messageHandlers) {
            handler(message);
          }
        } catch (err) {
          log.error({ err }, 'Failed to parse message from gateway');
        }
      });

      this.ws.on('close', (code, reason) => {
        this._connected = false;

        if (this.intentionalClose) {
          log.info({ agentId: this.agentId, code }, 'Connection closed intentionally');
          return;
        }

        log.warn({ agentId: this.agentId, code, reason: reason.toString() }, 'Connection lost — scheduling reconnect');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        log.error({ err, agentId: this.agentId }, 'WS error');
        if (!this._connected) reject(err);
      });

      this.ws.on('ping', () => {
        this.ws?.pong();
      });
    });
  }

  send(message: WsMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }
    if (this.pendingQueue.length < WS_OFFLINE_QUEUE_LIMIT) {
      this.pendingQueue.push(message);
    }
  }

  sendAck(corrId: string, payload: Record<string, unknown> = {}): void {
    this.send({
      type: 'ack',
      from: this.agentId,
      to: 'master-agent',
      payload,
      timestamp: Date.now(),
      corrId,
    });
  }

  sendEvent(eventType: string, payload: Record<string, unknown> = {}): void {
    this.send({
      type: 'event',
      from: this.agentId,
      to: 'master-agent',
      payload: { type: eventType, ...payload },
      timestamp: Date.now(),
    });
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onManifestUpdate(handler: ManifestHandler): void {
    this.manifestHandlers.push(handler);
  }

  onConfigUpdate(handler: ConfigHandler): void {
    this.configHandlers.push(handler);
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(WS_CLOSE_CODES.NORMAL, 'Client disconnect');
      this.ws = null;
    }
    this._connected = false;
  }

  get connected(): boolean {
    return this._connected;
  }

  private flushPendingQueue(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    for (const msg of this.pendingQueue) {
      this.ws.send(JSON.stringify(msg));
    }
    if (this.pendingQueue.length > 0) {
      log.debug({ agentId: this.agentId, flushed: this.pendingQueue.length }, 'Pending queue flushed');
    }
    this.pendingQueue = [];
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      WS_RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
      WS_RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;

    log.info({ agentId: this.agentId, delay, attempt: this.reconnectAttempt }, 'Reconnecting...');

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch {
        // connect() failure triggers another close event which reschedules
      }
    }, delay);
  }
}
