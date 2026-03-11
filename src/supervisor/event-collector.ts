import type Redis from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { AgentRegistry } from './agent-registry.js';
import type { AgentEvent } from './types.js';
import { REDIS_STREAMS } from './types.js';

const log = createChildLogger('event-collector');

const CONSUMER_GROUP = 'supervisor-group';
const CONSUMER_NAME = 'supervisor-0';

/**
 * Consumes events from agents via Redis Streams using consumer groups
 * for reliable at-least-once delivery.
 */
export class EventCollector {
  private running = false;

  constructor(
    private redis: Redis,
    private registry: AgentRegistry,
    private onEvent?: (event: AgentEvent) => Promise<void>,
  ) {}

  /** Start consuming events from the agent events stream */
  async start(): Promise<void> {
    // Create consumer group (ignore if already exists)
    try {
      await this.redis.xgroup(
        'CREATE', REDIS_STREAMS.AGENT_EVENTS, CONSUMER_GROUP, '$', 'MKSTREAM',
      );
      log.info('Created consumer group for agent events');
    } catch (err: any) {
      if (!err.message?.includes('BUSYGROUP')) throw err;
    }

    this.running = true;
    log.info('Event collector started');

    while (this.running) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
          'COUNT', '100',
          'BLOCK', '5000',
          'STREAMS', REDIS_STREAMS.AGENT_EVENTS, '>',
        ) as [string, [string, string[]][]][] | null;

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [messageId, fields] of messages) {
            const event = this.parseEvent(fields);
            if (event) {
              await this.processEvent(event);
              if (this.onEvent) await this.onEvent(event);
            }
            // Acknowledge the message
            await this.redis.xack(REDIS_STREAMS.AGENT_EVENTS, CONSUMER_GROUP, messageId);
          }
        }
      } catch (err) {
        if (this.running) {
          log.error({ err }, 'Error reading agent events');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  /** Stop consuming events */
  async stop(): Promise<void> {
    this.running = false;
    log.info('Event collector stopped');
  }

  /** Process a single agent event — update registry, log */
  private async processEvent(event: AgentEvent): Promise<void> {
    log.debug({ type: event.type, agentId: event.agentId }, 'Processing agent event');

    switch (event.type) {
      case 'started':
        await this.registry.updateState(event.agentId, 'running');
        break;

      case 'stopped':
        await this.registry.updateState(event.agentId, 'stopped');
        break;

      case 'paused':
        await this.registry.updateState(event.agentId, 'paused');
        break;

      case 'resumed':
        await this.registry.updateState(event.agentId, 'running');
        break;

      case 'error':
        await this.registry.updateState(event.agentId, 'error');
        break;

      case 'trade-executed': {
        const volume = (event.payload.volumeUsd as number) || 0;
        const pnl = (event.payload.pnlUsd as number) || 0;
        const isWin = pnl > 0;
        const agent = await this.registry.get(event.agentId);
        if (agent) {
          await this.registry.updateMetrics(event.agentId, {
            tradesExecuted: agent.metrics.tradesExecuted + 1,
            volumeUsd: agent.metrics.volumeUsd + volume,
            pnlUsd: agent.metrics.pnlUsd + pnl,
            winCount: agent.metrics.winCount + (isWin ? 1 : 0),
            lossCount: agent.metrics.lossCount + (isWin ? 0 : 1),
          });
        }
        break;
      }

      case 'position-opened': {
        const agent = await this.registry.get(event.agentId);
        if (agent) {
          await this.registry.updateMetrics(event.agentId, {
            openPositions: agent.metrics.openPositions + 1,
          });
        }
        break;
      }

      case 'position-closed': {
        const agent = await this.registry.get(event.agentId);
        if (agent) {
          await this.registry.updateMetrics(event.agentId, {
            openPositions: Math.max(0, agent.metrics.openPositions - 1),
          });
        }
        break;
      }

      case 'circuit-breaker-tripped':
        log.warn({ agentId: event.agentId }, 'Circuit breaker tripped on agent');
        break;

      case 'command-ack':
        log.debug({ agentId: event.agentId, commandId: event.payload.commandId }, 'Command acknowledged');
        break;

      case 'command-rejected':
        log.warn({ agentId: event.agentId, commandId: event.payload.commandId, reason: event.payload.reason }, 'Command rejected');
        break;
    }
  }

  /** Parse raw Redis stream fields into AgentEvent */
  private parseEvent(fields: string[]): AgentEvent | null {
    try {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }
      return {
        id: data.id,
        type: data.type as AgentEvent['type'],
        agentId: data.agentId,
        userId: data.userId,
        payload: data.payload ? JSON.parse(data.payload) : {},
        timestamp: parseInt(data.timestamp) || Date.now(),
      };
    } catch {
      log.error('Failed to parse agent event');
      return null;
    }
  }
}
