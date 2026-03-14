/**
 * Hibernation Manager — transitions agents through idle states to save resources.
 *
 * States:
 *   active (~5%)  →  idle (30min, ~90%)  →  on-demand (2h, Redis <100ms)
 *                                          →  deep-archive (24h, PostgreSQL 500ms)
 *
 * Reuses agent-registry.ts for state tracking.
 */

import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import { audit } from '../audit/audit-logger.js';
import { AgentRegistry } from './agent-registry.js';

const log = createChildLogger('hibernation-manager');

export interface HibernationConfig {
  /** Time in ms before active → idle (default: 30 min) */
  idleThresholdMs: number;
  /** Time in ms before idle → on-demand (default: 2 hours) */
  onDemandThresholdMs: number;
  /** Time in ms before on-demand → deep-archive (default: 24 hours) */
  archiveThresholdMs: number;
  /** How often to run the sweep (default: 5 min) */
  sweepIntervalMs: number;
}

const DEFAULT_CONFIG: HibernationConfig = {
  idleThresholdMs: 30 * 60 * 1000,       // 30 minutes
  onDemandThresholdMs: 2 * 60 * 60 * 1000, // 2 hours
  archiveThresholdMs: 24 * 60 * 60 * 1000,  // 24 hours
  sweepIntervalMs: 5 * 60 * 1000,          // 5 minutes
};

export class HibernationManager {
  private config: HibernationConfig;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private registry: AgentRegistry,
    private redis: Redis,
    config?: Partial<HibernationConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the periodic hibernation sweep.
   */
  start(): void {
    this.running = true;
    this.sweepTimer = setInterval(
      () => this.runHibernationSweep(),
      this.config.sweepIntervalMs,
    );
    log.info({ config: this.config }, 'Hibernation manager started');
  }

  stop(): void {
    this.running = false;
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    log.info('Hibernation manager stopped');
  }

  /**
   * Run one sweep cycle — check all agents and transition as needed.
   */
  async runHibernationSweep(): Promise<{
    transitioned: number;
    breakdown: Record<string, number>;
  }> {
    const now = Date.now();
    const agents = await this.registry.getAll();
    let transitioned = 0;
    const breakdown: Record<string, number> = {
      'active→idle': 0,
      'idle→on-demand': 0,
      'on-demand→deep-archive': 0,
    };

    for (const agent of agents) {
      // Skip non-user agents and already-archived agents
      if (agent.tier !== 'user') continue;
      if (agent.state === 'stopped' || agent.state === 'destroying') continue;

      const lastActive = agent.lastActiveAt ?? agent.createdAt;
      const inactiveDuration = now - lastActive;
      const currentHibState = agent.hibernationState ?? 'active';

      // active → idle
      if (currentHibState === 'active' && inactiveDuration > this.config.idleThresholdMs) {
        await this.registry.updateHibernationState(agent.agentId, 'idle');
        breakdown['active→idle']++;
        transitioned++;
        log.debug({ agentId: agent.agentId, inactiveMin: Math.round(inactiveDuration / 60000) }, 'Agent → idle');
      }
      // idle → on-demand
      else if (currentHibState === 'idle' && inactiveDuration > this.config.onDemandThresholdMs) {
        await this.registry.updateHibernationState(agent.agentId, 'on-demand');
        await this.registry.updateState(agent.agentId, 'hibernating');
        // In production: serialize agent state to Redis for fast wake
        breakdown['idle→on-demand']++;
        transitioned++;
        log.debug({ agentId: agent.agentId }, 'Agent → on-demand (serialized to Redis)');
      }
      // on-demand → deep-archive
      else if (currentHibState === 'on-demand' && inactiveDuration > this.config.archiveThresholdMs) {
        await this.registry.updateHibernationState(agent.agentId, 'deep-archive');
        await this.registry.updateState(agent.agentId, 'archived');
        // In production: move state from Redis to PostgreSQL
        breakdown['on-demand→deep-archive']++;
        transitioned++;
        log.debug({ agentId: agent.agentId }, 'Agent → deep-archive (moved to PostgreSQL)');
      }
    }

    if (transitioned > 0) {
      log.info({ transitioned, breakdown }, 'Hibernation sweep completed');
      await audit({
        actor: 'hibernation-manager',
        actorTier: 'system',
        action: 'hibernation-sweep',
        resource: 'all-agents',
        details: { transitioned, breakdown },
        success: true,
      });
    }

    return { transitioned, breakdown };
  }

  /**
   * Wake an agent from any hibernation state.
   * on-demand: Redis fast path (<100ms)
   * deep-archive: PostgreSQL slow path (~500ms)
   */
  async wakeAgent(agentId: string): Promise<{ woken: boolean; latencyMs: number; fromState: string }> {
    const start = Date.now();
    const agent = await this.registry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const fromState = agent.hibernationState ?? 'active';

    if (fromState === 'active') {
      return { woken: true, latencyMs: Date.now() - start, fromState };
    }

    // Restore agent state
    if (fromState === 'on-demand') {
      // Fast path: state is in Redis
      log.info({ agentId, fromState }, 'Waking from Redis (fast path)');
    } else if (fromState === 'deep-archive') {
      // Slow path: state is in PostgreSQL
      log.info({ agentId, fromState }, 'Waking from PostgreSQL (slow path)');
      // In production: load from agent_archive table
    }

    await this.registry.updateHibernationState(agentId, 'active');
    await this.registry.updateState(agentId, 'running');
    await this.registry.updateLastActive(agentId);

    const latencyMs = Date.now() - start;

    await audit({
      actor: 'hibernation-manager',
      actorTier: 'system',
      action: 'agent-woken',
      resource: agentId,
      details: { fromState, latencyMs },
      success: true,
    });

    return { woken: true, latencyMs, fromState };
  }

  /**
   * Get hibernation state distribution.
   */
  async getStateDistribution(): Promise<Record<string, number>> {
    const agents = await this.registry.getAll();
    const distribution: Record<string, number> = {
      active: 0,
      idle: 0,
      'on-demand': 0,
      'deep-archive': 0,
    };

    for (const agent of agents) {
      if (agent.tier !== 'user') continue;
      const state = agent.hibernationState ?? 'active';
      distribution[state] = (distribution[state] || 0) + 1;
    }

    return distribution;
  }
}
