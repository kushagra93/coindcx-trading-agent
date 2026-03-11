import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import { createChildLogger } from '../core/logger.js';
import { audit } from '../audit/audit-logger.js';
import { emergencyHalt, resumeTrading, isGlobalHalt } from '../risk/circuit-breaker.js';
import type { Chain, RiskSettings, StrategyType, RiskLevel } from '../core/types.js';
import { AgentRegistry } from './agent-registry.js';
import { CommandBus } from './command-bus.js';
import { EventCollector } from './event-collector.js';
import { HeartbeatMonitor } from './heartbeat-monitor.js';
import { PolicyEngine } from './policy-engine.js';
import type { ManagedAgent, SupervisorStats, GlobalPolicy } from './types.js';

const log = createChildLogger('supervisor');

/**
 * The Master Supervisor Agent — controlled by the CoinDCX team.
 * Manages all user agent lifecycles, enforces global policies,
 * and provides monitoring/override capabilities.
 */
export class Supervisor {
  readonly registry: AgentRegistry;
  readonly commandBus: CommandBus;
  readonly policyEngine: PolicyEngine;
  private eventCollector: EventCollector;
  private heartbeatMonitor: HeartbeatMonitor;
  private redis: Redis;
  private recentEvents: Array<{ type: string; agentId: string; timestamp: number; payload: Record<string, unknown> }> = [];

  constructor(redisUrl: string, deadTimeoutMs = 60_000) {
    this.redis = new Redis(redisUrl);
    this.registry = new AgentRegistry(this.redis);
    this.commandBus = new CommandBus(this.redis);
    this.policyEngine = new PolicyEngine(this.redis);
    this.eventCollector = new EventCollector(this.redis, this.registry, async (event) => {
      // Keep last 500 events in memory for the UI
      this.recentEvents.unshift({
        type: event.type,
        agentId: event.agentId,
        timestamp: event.timestamp,
        payload: event.payload,
      });
      if (this.recentEvents.length > 500) this.recentEvents.length = 500;
    });
    this.heartbeatMonitor = new HeartbeatMonitor(this.redis, this.registry, deadTimeoutMs);
  }

  // ═══════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════

  async start(): Promise<void> {
    log.info('Supervisor starting...');

    // Start subsystems (non-blocking — they run their own loops)
    this.eventCollector.start().catch(err => log.error({ err }, 'Event collector crashed'));
    this.heartbeatMonitor.start().catch(err => log.error({ err }, 'Heartbeat monitor crashed'));

    // Handle dead agents
    this.heartbeatMonitor.onDeadAgent((agentId) => {
      log.warn({ agentId }, 'Dead agent detected — marking as error');
      audit({
        actor: 'supervisor',
        actorTier: 'admin',
        action: 'dead-agent-detected',
        resource: agentId,
        success: true,
      });
    });

    log.info('Supervisor started');
  }

  async stop(): Promise<void> {
    log.info('Supervisor stopping...');
    await this.eventCollector.stop();
    await this.heartbeatMonitor.stop();
    this.redis.disconnect();
    log.info('Supervisor stopped');
  }

  // ═══════════════════════════════════════════════
  // Agent Management
  // ═══════════════════════════════════════════════

  /** Create a new user agent */
  async createAgent(
    userId: string,
    opts: { strategy: string; strategyType?: StrategyType; chain: Chain; riskLevel?: RiskLevel },
    issuedBy: string,
  ): Promise<ManagedAgent> {
    // Policy checks
    const userCount = await this.registry.countByUser(userId);
    const totalCount = await this.registry.count();
    const check = await this.policyEngine.canCreateAgent(userId, userCount, totalCount);
    if (!check.allowed) {
      throw new Error(`Policy violation: ${check.reason}`);
    }

    if (!(await this.policyEngine.isChainAllowed(opts.chain))) {
      throw new Error(`Chain '${opts.chain}' is not allowed by policy`);
    }

    const agentId = `agt_${uuid().slice(0, 8)}`;
    const agent: ManagedAgent = {
      agentId,
      userId,
      state: 'creating',
      strategy: opts.strategy,
      chain: opts.chain,
      riskLevel: opts.riskLevel ?? 'moderate',
      riskOverrides: null,
      createdAt: Date.now(),
      startedAt: null,
      stoppedAt: null,
      lastHeartbeat: null,
      lastCommandId: null,
      metrics: {
        tradesExecuted: 0, volumeUsd: 0, pnlUsd: 0,
        winCount: 0, lossCount: 0, openPositions: 0,
        highWaterMarkUsd: 0, maxDrawdownPct: 0,
      },
    };

    await this.registry.register(agent);

    audit({
      actor: issuedBy,
      actorTier: 'admin',
      action: 'create-agent',
      resource: agentId,
      details: { userId, strategy: opts.strategy, chain: opts.chain },
      success: true,
    });

    log.info({ agentId, userId, strategy: opts.strategy, chain: opts.chain }, 'Agent created');
    return agent;
  }

  /** Start an agent */
  async startAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    if (agent.state === 'running') throw new Error(`Agent ${agentId} already running`);

    const cmd = await this.commandBus.sendCommand('start', agentId, issuedBy);
    await this.registry.updateState(agentId, 'running');

    audit({ actor: issuedBy, actorTier: 'admin', action: 'start-agent', resource: agentId, success: true });
    log.info({ agentId, issuedBy }, 'Agent start command sent');
  }

  /** Stop an agent */
  async stopAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    await this.commandBus.sendCommand('stop', agentId, issuedBy);
    await this.registry.updateState(agentId, 'stopped');

    audit({ actor: issuedBy, actorTier: 'admin', action: 'stop-agent', resource: agentId, success: true });
    log.info({ agentId, issuedBy }, 'Agent stop command sent');
  }

  /** Pause an agent (loop continues but skips trading) */
  async pauseAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    if (agent.state !== 'running') throw new Error(`Agent ${agentId} is not running`);

    await this.commandBus.sendCommand('pause', agentId, issuedBy);
    await this.registry.updateState(agentId, 'paused');

    audit({ actor: issuedBy, actorTier: 'admin', action: 'pause-agent', resource: agentId, success: true });
    log.info({ agentId, issuedBy }, 'Agent paused');
  }

  /** Resume a paused agent */
  async resumeAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    if (agent.state !== 'paused') throw new Error(`Agent ${agentId} is not paused`);

    await this.commandBus.sendCommand('resume', agentId, issuedBy);
    await this.registry.updateState(agentId, 'running');

    audit({ actor: issuedBy, actorTier: 'admin', action: 'resume-agent', resource: agentId, success: true });
    log.info({ agentId, issuedBy }, 'Agent resumed');
  }

  /** Destroy an agent permanently */
  async destroyAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    await this.commandBus.sendCommand('destroy', agentId, issuedBy, {}, 'high');
    await this.registry.updateState(agentId, 'destroying');

    // Unregister after a short delay to allow cleanup
    setTimeout(async () => {
      await this.registry.unregister(agentId);
    }, 5_000);

    audit({ actor: issuedBy, actorTier: 'admin', action: 'destroy-agent', resource: agentId, success: true });
    log.info({ agentId, issuedBy }, 'Agent destroy command sent');
  }

  // ═══════════════════════════════════════════════
  // Override Controls
  // ═══════════════════════════════════════════════

  /** Force close all positions for an agent */
  async forceClosePositions(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    await this.commandBus.sendCommand('force-close-positions', agentId, issuedBy, {}, 'emergency');

    audit({
      actor: issuedBy, actorTier: 'admin',
      action: 'force-close-positions', resource: agentId,
      success: true,
    });
    log.warn({ agentId, issuedBy }, 'Force close positions command sent');
  }

  /** Override risk settings for a specific agent */
  async overrideRiskSettings(
    agentId: string,
    overrides: Partial<RiskSettings>,
    issuedBy: string,
  ): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    // Update the agent's risk overrides in registry
    const currentData = await this.redis.hgetall(`agent:${agentId}:state`);
    currentData.riskOverrides = JSON.stringify(overrides);
    await this.redis.hmset(`agent:${agentId}:state`, currentData);

    await this.commandBus.sendCommand('update-risk', agentId, issuedBy, { overrides });

    audit({
      actor: issuedBy, actorTier: 'admin',
      action: 'override-risk', resource: agentId,
      details: { overrides },
      success: true,
    });
    log.info({ agentId, issuedBy, overrides }, 'Risk override applied');
  }

  /** Push a strategy update to a running agent */
  async pushStrategyUpdate(
    agentId: string,
    strategyUpdate: Record<string, unknown>,
    issuedBy: string,
  ): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    await this.commandBus.sendCommand('strategy-update', agentId, issuedBy, { strategy: strategyUpdate });

    audit({
      actor: issuedBy, actorTier: 'admin',
      action: 'push-strategy-update', resource: agentId,
      details: { strategyUpdate },
      success: true,
    });
  }

  // ═══════════════════════════════════════════════
  // Global Operations
  // ═══════════════════════════════════════════════

  /** Emergency halt ALL agents immediately */
  async emergencyHaltAll(issuedBy: string): Promise<void> {
    log.warn({ issuedBy }, 'EMERGENCY HALT — stopping all agents');

    // 1. Trip the global circuit breaker
    emergencyHalt();

    // 2. Broadcast via Pub/Sub for instant delivery
    await this.commandBus.emergencyBroadcast({ issuedBy, reason: 'Emergency halt by admin' });

    // 3. Also broadcast via Streams for reliability
    await this.commandBus.broadcastCommand('stop', issuedBy, { emergency: true }, 'emergency');

    // 4. Mark all running agents as stopped in registry
    const running = await this.registry.getAllByState('running');
    const paused = await this.registry.getAllByState('paused');
    for (const agent of [...running, ...paused]) {
      await this.registry.updateState(agent.agentId, 'stopped');
    }

    audit({
      actor: issuedBy, actorTier: 'admin',
      action: 'emergency-halt-all', resource: 'all-agents',
      details: { agentsStopped: running.length + paused.length },
      success: true,
    });
  }

  /** Resume all agents after emergency halt */
  async resumeAll(issuedBy: string): Promise<void> {
    log.info({ issuedBy }, 'Resuming all agents');

    resumeTrading();

    await this.commandBus.broadcastCommand('resume', issuedBy, { globalResume: true });

    const stopped = await this.registry.getAllByState('stopped');
    for (const agent of stopped) {
      await this.registry.updateState(agent.agentId, 'running');
    }

    audit({
      actor: issuedBy, actorTier: 'admin',
      action: 'resume-all', resource: 'all-agents',
      details: { agentsResumed: stopped.length },
      success: true,
    });
  }

  /** Update global policies */
  async updateGlobalPolicies(
    updates: Partial<GlobalPolicy>,
    issuedBy: string,
  ): Promise<GlobalPolicy> {
    const policy = await this.policyEngine.updatePolicy(updates);

    // Broadcast to all agents
    await this.commandBus.policyBroadcast(policy);

    audit({
      actor: issuedBy, actorTier: 'admin',
      action: 'update-policies', resource: 'global-policies',
      details: { updates },
      success: true,
    });

    return policy;
  }

  // ═══════════════════════════════════════════════
  // Monitoring
  // ═══════════════════════════════════════════════

  /** Get aggregate statistics across all agents */
  async getAggregateStats(): Promise<SupervisorStats> {
    const agents = await this.registry.getAll();

    const stats: SupervisorStats = {
      totalAgents: agents.length,
      running: 0, paused: 0, stopped: 0, error: 0,
      totalVolume: 0, totalPnl: 0, totalTrades: 0,
      byChain: {}, byStrategy: {},
    };

    for (const agent of agents) {
      // Count by state
      if (agent.state === 'running') stats.running++;
      else if (agent.state === 'paused') stats.paused++;
      else if (agent.state === 'stopped') stats.stopped++;
      else if (agent.state === 'error') stats.error++;

      // Aggregate metrics
      stats.totalVolume += agent.metrics.volumeUsd;
      stats.totalPnl += agent.metrics.pnlUsd;
      stats.totalTrades += agent.metrics.tradesExecuted;

      // Count by chain
      stats.byChain[agent.chain] = (stats.byChain[agent.chain] || 0) + 1;

      // Count by strategy
      stats.byStrategy[agent.strategy] = (stats.byStrategy[agent.strategy] || 0) + 1;
    }

    return stats;
  }

  /** Get details for a specific agent */
  async getAgentDetails(agentId: string): Promise<ManagedAgent | null> {
    return this.registry.get(agentId);
  }

  /** Get all agents with optional filters */
  async getAllAgents(filters?: {
    userId?: string;
    state?: string;
    chain?: string;
    strategy?: string;
  }): Promise<ManagedAgent[]> {
    let agents: ManagedAgent[];

    if (filters?.userId) {
      agents = await this.registry.getByUser(filters.userId);
    } else {
      agents = await this.registry.getAll();
    }

    if (filters?.state) {
      agents = agents.filter(a => a.state === filters.state);
    }
    if (filters?.chain) {
      agents = agents.filter(a => a.chain === filters.chain);
    }
    if (filters?.strategy) {
      agents = agents.filter(a => a.strategy === filters.strategy);
    }

    // Sort: running first, then by createdAt desc
    agents.sort((a, b) => {
      const stateOrder: Record<string, number> = { running: 0, paused: 1, creating: 2, error: 3, stopped: 4, destroying: 5 };
      const aOrder = stateOrder[a.state] ?? 9;
      const bOrder = stateOrder[b.state] ?? 9;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return b.createdAt - a.createdAt;
    });

    return agents;
  }

  /** Get recent events (for the UI event log) */
  getRecentEvents(limit = 50): typeof this.recentEvents {
    return this.recentEvents.slice(0, limit);
  }

  /** Check if system is in global halt */
  isHalted(): boolean {
    return isGlobalHalt();
  }
}
