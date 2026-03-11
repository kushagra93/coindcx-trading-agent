import type Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import { createChildLogger } from '../core/logger.js';
import type { AgentEventType, AgentHeartbeat, AgentLifecycleState } from '../supervisor/types.js';
import { REDIS_STREAMS } from '../supervisor/types.js';

const log = createChildLogger('agent-reporter');

/**
 * Publishes events and heartbeats from a user agent to the supervisor
 * via Redis Streams.
 */
export class AgentReporter {
  constructor(
    private redis: Redis,
    private agentId: string,
    private userId: string,
  ) {}

  /** Send a generic event to the supervisor */
  async sendEvent(type: AgentEventType, payload: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.redis.xadd(
        REDIS_STREAMS.AGENT_EVENTS, '*',
        'id', uuid(),
        'type', type,
        'agentId', this.agentId,
        'userId', this.userId,
        'payload', JSON.stringify(payload),
        'timestamp', Date.now().toString(),
      );
      log.debug({ type, agentId: this.agentId }, 'Event published');
    } catch (err) {
      log.error({ err, type }, 'Failed to publish event');
    }
  }

  /** Send a heartbeat to the supervisor */
  async sendHeartbeat(data: {
    state: AgentLifecycleState;
    cycleCount: number;
    lastTradeAt: number | null;
    openPositions: number;
    unrealizedPnlUsd: number;
    uptimeMs: number;
  }): Promise<void> {
    try {
      const memUsage = process.memoryUsage();
      await this.redis.xadd(
        REDIS_STREAMS.AGENT_HEARTBEATS, '*',
        'agentId', this.agentId,
        'userId', this.userId,
        'state', data.state,
        'cycleCount', data.cycleCount.toString(),
        'lastTradeAt', (data.lastTradeAt ?? '').toString(),
        'openPositions', data.openPositions.toString(),
        'unrealizedPnlUsd', data.unrealizedPnlUsd.toString(),
        'memoryUsageMb', (memUsage.heapUsed / 1024 / 1024).toFixed(1),
        'uptimeMs', data.uptimeMs.toString(),
        'timestamp', Date.now().toString(),
      );
    } catch (err) {
      log.error({ err }, 'Failed to send heartbeat');
    }
  }

  // ── Convenience methods ──

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
