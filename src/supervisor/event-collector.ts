import { createChildLogger } from '../core/logger.js';
import type { AgentRegistry } from './agent-registry.js';
import type { AgentEvent } from './types.js';

const log = createChildLogger('event-collector');

/**
 * Processes agent events received via WebSocket.
 * No longer runs a Redis Stream consumer loop — events are pushed
 * directly by the WsHub message router in supervisor.ts.
 */
export class EventCollector {
  constructor(
    private registry: AgentRegistry,
    private onEvent?: (event: AgentEvent) => Promise<void>,
  ) {}

  /** Handle an agent event pushed from the WsHub message router */
  async handleEvent(event: AgentEvent): Promise<void> {
    log.debug({ type: event.type, agentId: event.agentId }, 'Processing agent event');

    await this.processEvent(event);
    if (this.onEvent) await this.onEvent(event);
  }

  private async processEvent(event: AgentEvent): Promise<void> {
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
}
