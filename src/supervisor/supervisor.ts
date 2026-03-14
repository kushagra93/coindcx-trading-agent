import Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import { createChildLogger } from '../core/logger.js';
import { audit } from '../audit/audit-logger.js';
import { emergencyHalt, resumeTrading, isGlobalHalt } from '../risk/circuit-breaker.js';
import type { Chain, RiskSettings, StrategyType, RiskLevel } from '../core/types.js';
import { WsHub } from '../core/ws-hub.js';
import type { WsMessage, OperationsManifest } from '../core/ws-types.js';
import { AgentRegistry } from './agent-registry.js';
import { CommandBus } from './command-bus.js';
import { EventCollector } from './event-collector.js';
import { PolicyEngine } from './policy-engine.js';
import { ApprovalEngine } from './approval-engine.js';
import type { ManagedAgent, SupervisorStats, GlobalPolicy, AgentEventType } from './types.js';
import type { TradeApprovalRequest } from '../security/types.js';
import { createRootCertificate, storeCertificate, storeAgentKey } from '../security/trust-chain.js';
import { recordFee, getFeeSummary, reconcileFees, generateRegulatoryReport } from './fee-ledger.js';
import type { FeeType } from './fee-ledger.js';

const log = createChildLogger('master-agent');

/**
 * The Master Agent — top of the 4-tier hierarchy.
 *
 * Per the MDC architecture, the Master Agent:
 *   - NEVER holds WebSocket connections directly (gateways do this)
 *   - Publishes commands via Redis Pub/Sub → Gateway Cluster → Agents
 *   - Consumes upstream agent events from Redis Stream
 *   - Stores broadcast checkpoints in ops:latest for reconnecting agents
 *   - Manages operations manifest and hot config via Redis
 */
export class MasterAgent {
  readonly registry: AgentRegistry;
  readonly commandBus: CommandBus;
  readonly policyEngine: PolicyEngine;
  readonly wsHub: WsHub;
  private approvalEngine: ApprovalEngine | null = null;
  private eventCollector: EventCollector;
  private deadAgentCallbacks: ((agentId: string) => void)[] = [];
  private redis: Redis;
  private masterAgentId: string = 'master-agent';
  private masterPrivateKey: string | null = null;
  private recentEvents: Array<{ type: string; agentId: string; timestamp: number; payload: Record<string, unknown> }> = [];

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.wsHub = new WsHub(redisUrl);
    this.registry = new AgentRegistry(this.redis);
    this.commandBus = new CommandBus(this.wsHub);
    this.policyEngine = new PolicyEngine(this.redis);
    this.eventCollector = new EventCollector(this.registry, async (event) => {
      this.recentEvents.unshift({
        type: event.type,
        agentId: event.agentId,
        timestamp: event.timestamp,
        payload: event.payload,
      });
      if (this.recentEvents.length > 500) this.recentEvents.length = 500;
    });
  }

  // ═══════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════

  async start(): Promise<void> {
    log.info('Master Agent starting...');

    await this.initTrustChain();

    await this.wsHub.start();

    this.wsHub.onUpstream((agentId, userId, tier, message) => {
      if (message.type === 'event') {
        this.eventCollector.handleEvent({
          id: message.corrId ?? '',
          type: message.payload.type as AgentEventType,
          agentId,
          userId,
          payload: message.payload.data as Record<string, unknown> ?? message.payload,
          timestamp: message.timestamp,
          corr_id: message.corrId,
        });
      } else if (message.type === 'heartbeat') {
        void this.handleHeartbeatMetrics(agentId, message.payload);
      } else if (message.type === 'agent-disconnect') {
        void this.handleAgentDisconnect(agentId);
      }
    });

    await this.publishDefaultManifest();

    log.info('Master Agent started');
  }

  onDeadAgent(callback: (agentId: string) => void): void {
    this.deadAgentCallbacks.push(callback);
  }

  async stop(): Promise<void> {
    log.info('Master Agent stopping...');
    await this.wsHub.stop();
    this.redis.disconnect();
    log.info('Master Agent stopped');
  }

  // ═══════════════════════════════════════════════
  // Trust Chain Initialization
  // ═══════════════════════════════════════════════

  private async initTrustChain(): Promise<void> {
    const { certificate, keyPair } = createRootCertificate(this.masterAgentId, 365);
    await storeCertificate(certificate, this.redis);
    await storeAgentKey(this.masterAgentId, keyPair.privateKey, this.redis);

    this.masterPrivateKey = keyPair.privateKey;
    this.commandBus.enableSigning(this.masterAgentId, keyPair.privateKey);

    this.approvalEngine = new ApprovalEngine(
      this.redis,
      this.policyEngine,
      keyPair.privateKey,
    );

    log.info({ masterAgentId: this.masterAgentId }, 'Trust chain initialized (root CA)');
  }

  // ═══════════════════════════════════════════════
  // Operations Manifest
  // ═══════════════════════════════════════════════

  private async publishDefaultManifest(): Promise<void> {
    const manifest: OperationsManifest = {
      version: 1,
      updatedAt: new Date().toISOString(),
      operations: [
        {
          id: 'emergency-halt',
          channel: 'ops:broadcast',
          description: 'Halt all trading immediately',
          payloadSchema: { reason: 'string' },
          requiredAgentVersion: '1.0.0',
          appliesTo: ['user', 'broker', 'helper'],
        },
        {
          id: 'fee-update',
          channel: 'ops:broadcast',
          description: 'Update fee rates for all agents',
          payloadSchema: { feeRate: 'number' },
          requiredAgentVersion: '1.0.0',
          appliesTo: ['user', 'broker'],
        },
        {
          id: 'policy-change',
          channel: 'ops:broadcast',
          description: 'Update global trading policy',
          payloadSchema: { policy: 'object' },
          requiredAgentVersion: '1.0.0',
          appliesTo: ['user', 'broker', 'helper'],
        },
      ],
    };
    await this.wsHub.publishManifest(manifest);
  }

  // ═══════════════════════════════════════════════
  // Agent Management
  // ═══════════════════════════════════════════════

  async createAgent(
    userId: string,
    opts: { strategy: string; strategyType?: StrategyType; chain: Chain; riskLevel?: RiskLevel },
    issuedBy: string,
  ): Promise<ManagedAgent> {
    const userCount = await this.registry.countByUser(userId);
    const totalCount = await this.registry.count();
    const check = await this.policyEngine.canCreateAgent(userId, userCount, totalCount);
    if (!check.allowed) throw new Error(`Policy violation: ${check.reason}`);

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
      tier: 'user',
      hibernationState: 'active',
      lastActiveAt: Date.now(),
    };

    await this.registry.register(agent);

    await audit({
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

  async startAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    if (agent.state === 'running') throw new Error(`Agent ${agentId} already running`);

    await this.commandBus.sendCommand('start', agentId, issuedBy);
    await this.registry.updateState(agentId, 'running');
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'start-agent', resource: agentId, success: true });
  }

  async stopAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    await this.commandBus.sendCommand('stop', agentId, issuedBy);
    await this.registry.updateState(agentId, 'stopped');
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'stop-agent', resource: agentId, success: true });
  }

  async pauseAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    if (agent.state !== 'running') throw new Error(`Agent ${agentId} is not running`);

    await this.commandBus.sendCommand('pause', agentId, issuedBy);
    await this.registry.updateState(agentId, 'paused');
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'pause-agent', resource: agentId, success: true });
  }

  async resumeAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    if (agent.state !== 'paused') throw new Error(`Agent ${agentId} is not paused`);

    await this.commandBus.sendCommand('resume', agentId, issuedBy);
    await this.registry.updateState(agentId, 'running');
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'resume-agent', resource: agentId, success: true });
  }

  async destroyAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    await this.commandBus.sendCommand('destroy', agentId, issuedBy, {}, 'high');
    await this.registry.updateState(agentId, 'destroying');
    setTimeout(async () => { await this.registry.unregister(agentId); }, 5_000);
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'destroy-agent', resource: agentId, success: true });
  }

  // ═══════════════════════════════════════════════
  // Trade Approval
  // ═══════════════════════════════════════════════

  async approveTradeRequest(request: TradeApprovalRequest) {
    if (!this.approvalEngine) {
      throw new Error('Approval engine not initialized — Master Agent not started');
    }
    return this.approvalEngine.processTradeApproval(request);
  }

  // ═══════════════════════════════════════════════
  // Fee Ledger
  // ═══════════════════════════════════════════════

  recordFeeInLedger(params: {
    type: FeeType; userId: string; agentId: string; brokerId: string;
    tradeId: string; amountUsd: number; amountToken: string; feeToken: string;
    chain: string; feeRate: number; corr_id: string; metadata?: Record<string, unknown>;
  }) { return recordFee(params); }

  getFeeSummary(from?: string, to?: string) { return getFeeSummary(from, to); }
  reconcileBrokerFees(brokerId: string, from?: string, to?: string) { return reconcileFees(brokerId, from, to); }
  generateRegulatoryReport(from: string, to: string) { return generateRegulatoryReport(from, to); }

  // ═══════════════════════════════════════════════
  // Broker Management
  // ═══════════════════════════════════════════════

  async registerBroker(jurisdiction: string, issuedBy: string): Promise<ManagedAgent> {
    const agentId = `broker_${jurisdiction.toLowerCase()}_${uuid().slice(0, 6)}`;
    const agent: ManagedAgent = {
      agentId,
      userId: 'system',
      state: 'creating',
      strategy: 'broker-compliance',
      chain: 'ethereum',
      riskLevel: 'moderate',
      riskOverrides: null,
      createdAt: Date.now(),
      startedAt: null, stoppedAt: null, lastHeartbeat: null, lastCommandId: null,
      metrics: {
        tradesExecuted: 0, volumeUsd: 0, pnlUsd: 0,
        winCount: 0, lossCount: 0, openPositions: 0,
        highWaterMarkUsd: 0, maxDrawdownPct: 0,
      },
      tier: 'broker',
      jurisdiction: jurisdiction as ManagedAgent['jurisdiction'],
      hibernationState: 'active',
      lastActiveAt: Date.now(),
      parentAgentId: this.masterAgentId,
    };

    await this.registry.register(agent);
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'register-broker', resource: agentId, details: { jurisdiction }, success: true });
    log.info({ agentId, jurisdiction, issuedBy }, 'Broker agent registered');
    return agent;
  }

  async getBrokers() { return this.registry.getByTier('broker'); }

  // ═══════════════════════════════════════════════
  // Override Controls
  // ═══════════════════════════════════════════════

  async forceClosePositions(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    await this.commandBus.sendCommand('force-close-positions', agentId, issuedBy, {}, 'emergency');
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'force-close-positions', resource: agentId, success: true });
  }

  async overrideRiskSettings(agentId: string, overrides: Partial<RiskSettings>, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const currentData = await this.redis.hgetall(`agent:${agentId}:state`);
    currentData.riskOverrides = JSON.stringify(overrides);
    await this.redis.hmset(`agent:${agentId}:state`, currentData);
    await this.commandBus.sendCommand('update-risk', agentId, issuedBy, { overrides });
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'override-risk', resource: agentId, details: { overrides }, success: true });
  }

  async pushStrategyUpdate(agentId: string, strategyUpdate: Record<string, unknown>, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    await this.wsHub.updateStrategyParams(agentId, strategyUpdate);
    await this.commandBus.sendCommand('strategy-update', agentId, issuedBy, { strategy: strategyUpdate });
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'push-strategy-update', resource: agentId, details: { strategyUpdate }, success: true });
  }

  // ═══════════════════════════════════════════════
  // Hot Config
  // ═══════════════════════════════════════════════

  async updateHotConfig(config: Record<string, string>, issuedBy: string): Promise<void> {
    await this.wsHub.updateHotConfig(config);
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'update-hot-config', resource: 'ops:config', details: config, success: true });
  }

  // ═══════════════════════════════════════════════
  // Hibernation
  // ═══════════════════════════════════════════════

  async hibernateAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    await this.commandBus.sendCommand('hibernate', agentId, issuedBy);
    await this.registry.updateState(agentId, 'hibernating');
    await this.registry.updateHibernationState(agentId, 'on-demand');
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'hibernate-agent', resource: agentId, success: true });
  }

  async wakeAgent(agentId: string, issuedBy: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);
    await this.commandBus.sendCommand('wake', agentId, issuedBy);
    await this.registry.updateState(agentId, 'running');
    await this.registry.updateHibernationState(agentId, 'active');
    await this.registry.updateLastActive(agentId);
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'wake-agent', resource: agentId, success: true });
  }

  // ═══════════════════════════════════════════════
  // Global Operations
  // ═══════════════════════════════════════════════

  async emergencyHaltAll(issuedBy: string): Promise<void> {
    log.warn({ issuedBy }, 'EMERGENCY HALT — stopping all agents');
    await emergencyHalt();
    await this.commandBus.emergencyBroadcast({ issuedBy, reason: 'Emergency halt by admin' });
    await this.commandBus.broadcastCommand('stop', issuedBy, { emergency: true }, 'emergency');

    const running = await this.registry.getAllByState('running');
    const paused = await this.registry.getAllByState('paused');
    for (const agent of [...running, ...paused]) {
      await this.registry.updateState(agent.agentId, 'stopped');
    }
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'emergency-halt-all', resource: 'all-agents', details: { agentsStopped: running.length + paused.length }, success: true });
  }

  async resumeAll(issuedBy: string): Promise<void> {
    await resumeTrading();
    await this.commandBus.broadcastCommand('resume', issuedBy, { globalResume: true });
    const stopped = await this.registry.getAllByState('stopped');
    for (const agent of stopped) {
      await this.registry.updateState(agent.agentId, 'running');
    }
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'resume-all', resource: 'all-agents', details: { agentsResumed: stopped.length }, success: true });
  }

  async updateGlobalPolicies(updates: Partial<GlobalPolicy>, issuedBy: string): Promise<GlobalPolicy> {
    const policy = await this.policyEngine.updatePolicy(updates);
    await this.commandBus.policyBroadcast(policy);
    await audit({ actor: issuedBy, actorTier: 'admin', action: 'update-policies', resource: 'global-policies', details: { updates }, success: true });
    return policy;
  }

  // ═══════════════════════════════════════════════
  // Heartbeat Metrics (inlined from HeartbeatMonitor — MDC §No Heartbeat Stream)
  //
  // Gateway ping/pong handles liveness at the transport layer.
  // This only records metric payloads (cycle count, PnL, positions).
  // ═══════════════════════════════════════════════

  private async handleHeartbeatMetrics(agentId: string, payload: Record<string, unknown>): Promise<void> {
    await this.registry.updateHeartbeat(agentId, Date.now());

    log.trace({
      agentId,
      state: payload.state,
      cycleCount: payload.cycleCount,
      openPositions: payload.openPositions,
    }, 'Heartbeat metrics received');
  }

  async handleAgentDisconnect(agentId: string): Promise<void> {
    const agent = await this.registry.get(agentId);
    if (!agent) return;

    if (agent.state === 'running' || agent.state === 'paused') {
      log.warn({ agentId, previousState: agent.state }, 'Agent offline — marking as error');
      await this.registry.updateState(agentId, 'error');

      // Send stop command to halt any remaining trading activity
      await this.commandBus.sendCommand('stop', agentId, 'system', { reason: 'agent-offline' });

      for (const callback of this.deadAgentCallbacks) {
        try { callback(agentId); } catch (err) {
          log.error({ err, agentId }, 'Error in dead agent callback');
        }
      }
    }
  }

  async getHealthSummary(): Promise<{ healthy: number; unhealthy: number; dead: number }> {
    const agents = await this.registry.getAllByState('running');
    let healthy = 0;
    let dead = 0;

    for (const agent of agents) {
      const online = await this.wsHub.isConnected(agent.agentId);
      if (online) {
        healthy++;
      } else {
        dead++;
      }
    }

    return { healthy, unhealthy: 0, dead };
  }

  // ═══════════════════════════════════════════════
  // Monitoring
  // ═══════════════════════════════════════════════

  async getGlobalRiskSnapshot() {
    const agents = await this.registry.getAll();
    let runningAgents = 0, totalOpenPositions = 0, totalUnrealizedPnlUsd = 0, agentsInError = 0, agentsHibernated = 0;
    for (const agent of agents) {
      if (agent.state === 'running') runningAgents++;
      if (agent.state === 'error') agentsInError++;
      if (agent.state === 'hibernating') agentsHibernated++;
      totalOpenPositions += agent.metrics.openPositions;
      totalUnrealizedPnlUsd += agent.metrics.pnlUsd;
    }
    return { halted: await isGlobalHalt(), totalAgents: agents.length, runningAgents, totalOpenPositions, totalUnrealizedPnlUsd, agentsInError, agentsHibernated };
  }

  async getAggregateStats(): Promise<SupervisorStats> {
    const agents = await this.registry.getAll();
    const stats: SupervisorStats = {
      totalAgents: agents.length, running: 0, paused: 0, stopped: 0, error: 0,
      totalVolume: 0, totalPnl: 0, totalTrades: 0, byChain: {}, byStrategy: {},
    };
    for (const agent of agents) {
      if (agent.state === 'running') stats.running++;
      else if (agent.state === 'paused') stats.paused++;
      else if (agent.state === 'stopped') stats.stopped++;
      else if (agent.state === 'error') stats.error++;
      stats.totalVolume += agent.metrics.volumeUsd;
      stats.totalPnl += agent.metrics.pnlUsd;
      stats.totalTrades += agent.metrics.tradesExecuted;
      stats.byChain[agent.chain] = (stats.byChain[agent.chain] || 0) + 1;
      stats.byStrategy[agent.strategy] = (stats.byStrategy[agent.strategy] || 0) + 1;
    }
    return stats;
  }

  async getAgentDetails(agentId: string): Promise<ManagedAgent | null> { return this.registry.get(agentId); }

  async getAllAgents(filters?: {
    userId?: string; state?: string; chain?: string; strategy?: string; tier?: string; jurisdiction?: string;
  }): Promise<ManagedAgent[]> {
    let agents: ManagedAgent[];
    if (filters?.userId) agents = await this.registry.getByUser(filters.userId);
    else if (filters?.tier) agents = await this.registry.getByTier(filters.tier);
    else if (filters?.jurisdiction) agents = await this.registry.getByJurisdiction(filters.jurisdiction);
    else agents = await this.registry.getAll();

    if (filters?.state) agents = agents.filter(a => a.state === filters.state);
    if (filters?.chain) agents = agents.filter(a => a.chain === filters.chain);
    if (filters?.strategy) agents = agents.filter(a => a.strategy === filters.strategy);

    agents.sort((a, b) => {
      const stateOrder: Record<string, number> = { running: 0, paused: 1, creating: 2, error: 3, stopped: 4, hibernating: 5, archived: 6, destroying: 7 };
      const diff = (stateOrder[a.state] ?? 9) - (stateOrder[b.state] ?? 9);
      return diff !== 0 ? diff : b.createdAt - a.createdAt;
    });

    return agents;
  }

  getRecentEvents(limit = 50) { return this.recentEvents.slice(0, limit); }
  async isHalted(): Promise<boolean> { return isGlobalHalt(); }
}

/** @deprecated Use MasterAgent instead. Kept for backward compatibility. */
export const Supervisor = MasterAgent;
/** @deprecated Use MasterAgent instead. */
export type Supervisor = MasterAgent;
