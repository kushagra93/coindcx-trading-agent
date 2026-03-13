import { v4 as uuid } from 'uuid';
import { createChildLogger } from '../core/logger.js';
import type { WsClient } from '../core/ws-client.js';
import type { WsMessage } from '../core/ws-types.js';
import type { AgentEventType, AgentLifecycleState } from '../supervisor/types.js';

const log = createChildLogger('agent-reporter');

/**
 * Publishes events and heartbeats from a user agent to the Master Agent
 * via WebSocket.
 */
export class AgentReporter {
  constructor(
    private wsClient: WsClient,
    private agentId: string,
    private userId: string,
  ) {}

  /** Send a generic event to the master */
  async sendEvent(type: AgentEventType, payload: Record<string, unknown> = {}): Promise<void> {
    const message: WsMessage = {
      type: 'event',
      from: this.agentId,
      to: 'master-agent',
      payload: {
        id: uuid(),
        type,
        userId: this.userId,
        data: payload,
      },
      timestamp: Date.now(),
    };

    try {
      this.wsClient.send(message);
      log.debug({ type, agentId: this.agentId }, 'Event published');
    } catch (err) {
      log.error({ err, type }, 'Failed to publish event');
    }
  }

  /** Send a heartbeat to the master */
  async sendHeartbeat(data: {
    state: AgentLifecycleState;
    cycleCount: number;
    lastTradeAt: number | null;
    openPositions: number;
    unrealizedPnlUsd: number;
    uptimeMs: number;
  }): Promise<void> {
    const memUsage = process.memoryUsage();
    const message: WsMessage = {
      type: 'heartbeat',
      from: this.agentId,
      to: 'master-agent',
      payload: {
        state: data.state,
        cycleCount: data.cycleCount,
        lastTradeAt: data.lastTradeAt,
        openPositions: data.openPositions,
        unrealizedPnlUsd: data.unrealizedPnlUsd,
        memoryUsageMb: parseFloat((memUsage.heapUsed / 1024 / 1024).toFixed(1)),
        uptimeMs: data.uptimeMs,
      },
      timestamp: Date.now(),
    };

    try {
      this.wsClient.send(message);
    } catch (err) {
      log.error({ err }, 'Failed to send heartbeat');
    }
  }

  async reportTradeExecuted(details: { token: string; side: string; volumeUsd: number; pnlUsd: number }): Promise<void> {
    await this.sendEvent('trade-executed', details);
  }

  async reportPositionOpened(details: { token: string; chain: string; amountUsd: number }): Promise<void> {
    await this.sendEvent('position-opened', details);
  }

  async reportPositionClosed(details: { token: string; chain: string; pnlUsd: number }): Promise<void> {
    await this.sendEvent('position-closed', details);
  }

  async reportError(error: Error): Promise<void> {
    await this.sendEvent('error', { message: error.message, stack: error.stack });
  }

  async reportCircuitBreakerTripped(): Promise<void> {
    await this.sendEvent('circuit-breaker-tripped', {});
  }

  async reportCommandAck(commandId: string): Promise<void> {
    await this.sendEvent('command-ack', { commandId });
  }

  async reportCommandRejected(commandId: string, reason: string): Promise<void> {
    await this.sendEvent('command-rejected', { commandId, reason });
  }
}
