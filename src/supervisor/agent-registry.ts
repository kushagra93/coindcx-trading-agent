import type Redis from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { AgentLifecycleState, AgentMetrics, ManagedAgent } from './types.js';
import { REDIS_KEYS } from './types.js';

const log = createChildLogger('agent-registry');

/**
 * Redis-backed persistent agent registry.
 * Replaces the in-memory Map<string, AgentInstance> from admin.ts.
 */
export class AgentRegistry {
  constructor(private redis: Redis) {}

  /** Register a new managed agent */
  async register(agent: ManagedAgent): Promise<void> {
    const pipeline = this.redis.pipeline();

    pipeline.hset(
      REDIS_KEYS.agentState(agent.agentId),
      this.serializeAgent(agent),
    );
    pipeline.sadd(REDIS_KEYS.REGISTRY_SET, agent.agentId);
    pipeline.sadd(REDIS_KEYS.userAgents(agent.userId), agent.agentId);

    await pipeline.exec();
    log.info({ agentId: agent.agentId, userId: agent.userId }, 'Agent registered');
  }

  /** Remove agent from registry */
  async unregister(agentId: string): Promise<void> {
    const agent = await this.get(agentId);
    if (!agent) return;

    const pipeline = this.redis.pipeline();
    pipeline.del(REDIS_KEYS.agentState(agentId));
    pipeline.del(REDIS_KEYS.agentConfig(agentId));
    pipeline.del(REDIS_KEYS.agentMetrics(agentId));
    pipeline.srem(REDIS_KEYS.REGISTRY_SET, agentId);
    pipeline.srem(REDIS_KEYS.userAgents(agent.userId), agentId);

    await pipeline.exec();
    log.info({ agentId }, 'Agent unregistered');
  }

  /** Get a single agent by ID */
  async get(agentId: string): Promise<ManagedAgent | null> {
    const data = await this.redis.hgetall(REDIS_KEYS.agentState(agentId));
    if (!data || Object.keys(data).length === 0) return null;
    return this.deserializeAgent(data);
  }

  /** Get all agents for a user */
  async getByUser(userId: string): Promise<ManagedAgent[]> {
    const agentIds = await this.redis.smembers(REDIS_KEYS.userAgents(userId));
    const agents: ManagedAgent[] = [];
    for (const id of agentIds) {
      const agent = await this.get(id);
      if (agent) agents.push(agent);
    }
    return agents;
  }

  /** Get all agents in the registry */
  async getAll(): Promise<ManagedAgent[]> {
    const agentIds = await this.redis.smembers(REDIS_KEYS.REGISTRY_SET);
    const agents: ManagedAgent[] = [];
    for (const id of agentIds) {
      const agent = await this.get(id);
      if (agent) agents.push(agent);
    }
    return agents;
  }

  /** Get all agents with a specific state */
  async getAllByState(state: AgentLifecycleState): Promise<ManagedAgent[]> {
    const all = await this.getAll();
    return all.filter(a => a.state === state);
  }

  /** Update agent lifecycle state */
  async updateState(agentId: string, state: AgentLifecycleState): Promise<void> {
    await this.redis.hset(REDIS_KEYS.agentState(agentId), 'state', state);

    if (state === 'stopped' || state === 'error') {
      await this.redis.hset(REDIS_KEYS.agentState(agentId), 'stoppedAt', Date.now().toString());
    }
    if (state === 'running') {
      await this.redis.hset(REDIS_KEYS.agentState(agentId), 'startedAt', Date.now().toString());
    }

    log.debug({ agentId, state }, 'Agent state updated');
  }

  /** Update agent metrics */
  async updateMetrics(agentId: string, metrics: Partial<AgentMetrics>): Promise<void> {
    const current = await this.get(agentId);
    if (!current) return;

    const updated = { ...current.metrics, ...metrics };
    await this.redis.hset(
      REDIS_KEYS.agentState(agentId),
      'metrics', JSON.stringify(updated),
    );
  }

  /** Update last heartbeat timestamp */
  async updateHeartbeat(agentId: string, timestamp: number): Promise<void> {
    await this.redis.hset(
      REDIS_KEYS.agentState(agentId),
      'lastHeartbeat', timestamp.toString(),
    );
  }

  /** Total agent count */
  async count(): Promise<number> {
    return this.redis.scard(REDIS_KEYS.REGISTRY_SET);
  }

  /** Agent count for a specific user */
  async countByUser(userId: string): Promise<number> {
    return this.redis.scard(REDIS_KEYS.userAgents(userId));
  }

  /** Get all agents of a specific tier */
  async getByTier(tier: string): Promise<ManagedAgent[]> {
    const all = await this.getAll();
    return all.filter(a => a.tier === tier);
  }

  /** Get all agents for a specific jurisdiction */
  async getByJurisdiction(jurisdiction: string): Promise<ManagedAgent[]> {
    const all = await this.getAll();
    return all.filter(a => a.jurisdiction === jurisdiction);
  }

  /** Get all agents in a specific hibernation state */
  async getByHibernationState(hibernationState: string): Promise<ManagedAgent[]> {
    const all = await this.getAll();
    return all.filter(a => a.hibernationState === hibernationState);
  }

  /** Update hibernation state for an agent */
  async updateHibernationState(
    agentId: string,
    hibernationState: 'active' | 'idle' | 'on-demand' | 'deep-archive',
  ): Promise<void> {
    await this.redis.hset(
      REDIS_KEYS.agentState(agentId),
      'hibernationState', hibernationState,
    );
    log.debug({ agentId, hibernationState }, 'Agent hibernation state updated');
  }

  /** Update the last active timestamp for an agent */
  async updateLastActive(agentId: string, timestamp: number = Date.now()): Promise<void> {
    await this.redis.hset(
      REDIS_KEYS.agentState(agentId),
      'lastActiveAt', timestamp.toString(),
    );
  }

  // ── Serialization ──

  private serializeAgent(agent: ManagedAgent): Record<string, string> {
    return {
      agentId: agent.agentId,
      userId: agent.userId,
      state: agent.state,
      strategy: agent.strategy,
      strategyConfig: JSON.stringify(agent.strategyConfig ?? {}),
      chain: agent.chain,
      riskLevel: agent.riskLevel,
      riskOverrides: JSON.stringify(agent.riskOverrides ?? null),
      createdAt: agent.createdAt.toString(),
      startedAt: (agent.startedAt ?? '').toString(),
      stoppedAt: (agent.stoppedAt ?? '').toString(),
      lastHeartbeat: (agent.lastHeartbeat ?? '').toString(),
      lastCommandId: agent.lastCommandId ?? '',
      metrics: JSON.stringify(agent.metrics),
      tier: agent.tier ?? '',
      jurisdiction: agent.jurisdiction ?? '',
      certificateId: agent.certificateId ?? '',
      hibernationState: agent.hibernationState ?? '',
      lastActiveAt: (agent.lastActiveAt ?? '').toString(),
      parentAgentId: agent.parentAgentId ?? '',
    };
  }

  private deserializeAgent(data: Record<string, string>): ManagedAgent {
    return {
      agentId: data.agentId,
      userId: data.userId,
      state: data.state as AgentLifecycleState,
      strategy: data.strategy,
      strategyConfig: data.strategyConfig ? JSON.parse(data.strategyConfig) : undefined,
      chain: data.chain as ManagedAgent['chain'],
      riskLevel: (data.riskLevel || 'moderate') as ManagedAgent['riskLevel'],
      riskOverrides: data.riskOverrides ? JSON.parse(data.riskOverrides) : null,
      createdAt: parseInt(data.createdAt) || Date.now(),
      startedAt: data.startedAt ? parseInt(data.startedAt) || null : null,
      stoppedAt: data.stoppedAt ? parseInt(data.stoppedAt) || null : null,
      lastHeartbeat: data.lastHeartbeat ? parseInt(data.lastHeartbeat) || null : null,
      lastCommandId: data.lastCommandId || null,
      metrics: data.metrics ? JSON.parse(data.metrics) : {
        tradesExecuted: 0, volumeUsd: 0, pnlUsd: 0,
        winCount: 0, lossCount: 0, openPositions: 0,
        highWaterMarkUsd: 0, maxDrawdownPct: 0,
      },
      tier: (data.tier || undefined) as ManagedAgent['tier'],
      jurisdiction: (data.jurisdiction || undefined) as ManagedAgent['jurisdiction'],
      certificateId: data.certificateId || undefined,
      hibernationState: (data.hibernationState || undefined) as ManagedAgent['hibernationState'],
      lastActiveAt: data.lastActiveAt ? parseInt(data.lastActiveAt) || undefined : undefined,
      parentAgentId: data.parentAgentId || undefined,
    };
  }
}
