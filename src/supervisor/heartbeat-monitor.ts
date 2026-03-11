import type Redis from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { AgentRegistry } from './agent-registry.js';
import type { AgentHeartbeat } from './types.js';
import { REDIS_STREAMS } from './types.js';

const log = createChildLogger('heartbeat-monitor');

const CONSUMER_GROUP = 'supervisor-group';
const CONSUMER_NAME = 'heartbeat-0';
const CHECKER_INTERVAL_MS = 10_000; // Check for dead agents every 10s

/**
 * Monitors agent liveness by consuming heartbeats and detecting dead agents.
 */
export class HeartbeatMonitor {
  private running = false;
  private checkerTimer: ReturnType<typeof setInterval> | null = null;
  private deadAgentCallbacks: ((agentId: string) => void)[] = [];

  constructor(
    private redis: Redis,
    private registry: AgentRegistry,
    private deadTimeoutMs: number = 60_000,
  ) {}

  /** Start heartbeat consumer + dead agent checker */
  async start(): Promise<void> {
    // Create consumer group
    try {
      await this.redis.xgroup(
        'CREATE', REDIS_STREAMS.AGENT_HEARTBEATS, CONSUMER_GROUP, '$', 'MKSTREAM',
      );
    } catch (err: any) {
      if (!err.message?.includes('BUSYGROUP')) throw err;
    }

    this.running = true;
    log.info({ deadTimeoutMs: this.deadTimeoutMs }, 'Heartbeat monitor started');

    // Start dead agent checker loop
    this.checkerTimer = setInterval(() => this.checkForDeadAgents(), CHECKER_INTERVAL_MS);

    // Start heartbeat consumer loop
    while (this.running) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP', CONSUMER_GROUP, CONSUMER_NAME,
          'COUNT', '100',
          'BLOCK', '5000',
          'STREAMS', REDIS_STREAMS.AGENT_HEARTBEATS, '>',
        ) as [string, [string, string[]][]][] | null;

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [messageId, fields] of messages) {
            const heartbeat = this.parseHeartbeat(fields);
            if (heartbeat) {
              await this.registry.updateHeartbeat(heartbeat.agentId, heartbeat.timestamp);
              log.trace({ agentId: heartbeat.agentId, state: heartbeat.state }, 'Heartbeat received');
            }
            await this.redis.xack(REDIS_STREAMS.AGENT_HEARTBEATS, CONSUMER_GROUP, messageId);
          }
        }
      } catch (err) {
        if (this.running) {
          log.error({ err }, 'Error reading heartbeats');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  /** Stop the monitor */
  async stop(): Promise<void> {
    this.running = false;
    if (this.checkerTimer) {
      clearInterval(this.checkerTimer);
      this.checkerTimer = null;
    }
    log.info('Heartbeat monitor stopped');
  }

  /** Register callback for dead agent detection */
  onDeadAgent(callback: (agentId: string) => void): void {
    this.deadAgentCallbacks.push(callback);
  }

  /** Get health summary of all agents */
  async getHealthSummary(): Promise<{ healthy: number; unhealthy: number; dead: number }> {
    const agents = await this.registry.getAllByState('running');
    const now = Date.now();

    let healthy = 0;
    let unhealthy = 0;
    let dead = 0;

    for (const agent of agents) {
      if (!agent.lastHeartbeat) {
        dead++;
      } else if (now - agent.lastHeartbeat > this.deadTimeoutMs) {
        dead++;
      } else if (now - agent.lastHeartbeat > this.deadTimeoutMs / 2) {
        unhealthy++;
      } else {
        healthy++;
      }
    }

    return { healthy, unhealthy, dead };
  }

  /** Check for agents that haven't sent heartbeats within the timeout */
  private async checkForDeadAgents(): Promise<void> {
    try {
      const runningAgents = await this.registry.getAllByState('running');
      const now = Date.now();

      for (const agent of runningAgents) {
        if (!agent.lastHeartbeat) continue; // New agent, hasn't heartbeated yet

        const elapsed = now - agent.lastHeartbeat;
        if (elapsed > this.deadTimeoutMs) {
          log.warn({
            agentId: agent.agentId,
            lastHeartbeat: agent.lastHeartbeat,
            elapsedMs: elapsed,
          }, 'Dead agent detected');

          await this.registry.updateState(agent.agentId, 'error');

          for (const callback of this.deadAgentCallbacks) {
            try {
              callback(agent.agentId);
            } catch (err) {
              log.error({ err, agentId: agent.agentId }, 'Error in dead agent callback');
            }
          }
        }
      }
    } catch (err) {
      log.error({ err }, 'Error checking for dead agents');
    }
  }

  /** Parse raw Redis stream fields into AgentHeartbeat */
  private parseHeartbeat(fields: string[]): AgentHeartbeat | null {
    try {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }
      return {
        agentId: data.agentId,
        userId: data.userId,
        state: data.state as AgentHeartbeat['state'],
        cycleCount: parseInt(data.cycleCount) || 0,
        lastTradeAt: data.lastTradeAt ? parseInt(data.lastTradeAt) : null,
        openPositions: parseInt(data.openPositions) || 0,
        unrealizedPnlUsd: parseFloat(data.unrealizedPnlUsd) || 0,
        memoryUsageMb: parseFloat(data.memoryUsageMb) || 0,
        uptimeMs: parseInt(data.uptimeMs) || 0,
        timestamp: parseInt(data.timestamp) || Date.now(),
      };
    } catch {
      log.error('Failed to parse heartbeat');
      return null;
    }
  }
}
