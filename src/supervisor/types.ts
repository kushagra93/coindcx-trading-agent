import type { Chain, StrategyType, StrategyConfig, RiskSettings, RiskLevel } from '../core/types.js';
import type { AgentTier, Jurisdiction } from '../security/types.js';

// ===== Agent Lifecycle =====

export type AgentLifecycleState =
  | 'creating'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'destroying'
  | 'hibernating'
  | 'archived';

// ===== Supervisor → Agent Commands =====

export type SupervisorCommandType =
  | 'start'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'destroy'
  | 'update-config'
  | 'update-risk'
  | 'force-close-positions'
  | 'strategy-update'
  | 'heartbeat-request'
  | 'approve-trade'
  | 'reject-trade'
  | 'hibernate'
  | 'wake'
  | 'rotate-keys'
  | 'compliance-check';

export interface SupervisorCommand {
  id: string;
  type: SupervisorCommandType;
  agentId: string;          // Target agent ('*' for broadcast)
  issuedBy: string;         // Admin userId who issued the command
  payload: Record<string, unknown>;
  timestamp: number;
  priority: 'normal' | 'high' | 'emergency';
}

// ===== Agent → Supervisor Events =====

export type AgentEventType =
  | 'started'
  | 'stopped'
  | 'paused'
  | 'resumed'
  | 'error'
  | 'trade-executed'
  | 'position-opened'
  | 'position-closed'
  | 'circuit-breaker-tripped'
  | 'config-updated'
  | 'command-ack'
  | 'command-rejected'
  | 'trade-approved'
  | 'trade-rejected'
  | 'fee-recorded'
  | 'compliance-passed'
  | 'compliance-failed'
  | 'agent-hibernated'
  | 'agent-woken';

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  agentId: string;
  userId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  corr_id?: string;
}

// ===== Heartbeat =====

export interface AgentHeartbeat {
  agentId: string;
  userId: string;
  state: AgentLifecycleState;
  cycleCount: number;
  lastTradeAt: number | null;
  openPositions: number;
  unrealizedPnlUsd: number;
  memoryUsageMb: number;
  uptimeMs: number;
  timestamp: number;
}

// ===== Global Policy =====

export interface GlobalPolicy {
  maxAgentsPerUser: number;
  maxTotalAgents: number;
  allowedChains: Chain[];
  allowedStrategies: StrategyType[];
  globalMaxPositionSizePct: number;
  globalMaxDailyLossUsd: number;
  globalMaxLeverage: number;
  maintenanceMode: boolean;
  minHeartbeatIntervalMs: number;
  deadAgentTimeoutMs: number;
  allowedTokenWhitelist: string[];   // Empty = all allowed
  blockedTokenBlacklist: string[];   // Always blocked
}

export const DEFAULT_POLICY: GlobalPolicy = {
  maxAgentsPerUser: 5,
  maxTotalAgents: 10_000,
  allowedChains: ['solana', 'ethereum', 'polygon', 'base', 'arbitrum', 'hyperliquid'],
  allowedStrategies: ['dca', 'momentum', 'mean-reversion', 'grid', 'copy-trade', 'custom'],
  globalMaxPositionSizePct: 25,
  globalMaxDailyLossUsd: 10_000,
  globalMaxLeverage: 10,
  maintenanceMode: false,
  minHeartbeatIntervalMs: 15_000,
  deadAgentTimeoutMs: 60_000,
  allowedTokenWhitelist: [],
  blockedTokenBlacklist: [],
};

// ===== Managed Agent Record =====

export interface AgentMetrics {
  tradesExecuted: number;
  volumeUsd: number;
  pnlUsd: number;
  winCount: number;
  lossCount: number;
  openPositions: number;
  highWaterMarkUsd: number;
  maxDrawdownPct: number;
}

export interface ManagedAgent {
  agentId: string;
  userId: string;
  state: AgentLifecycleState;
  strategy: string;         // Strategy name/type
  strategyConfig?: Partial<StrategyConfig>;
  chain: Chain;
  riskLevel: RiskLevel;
  riskOverrides: Partial<RiskSettings> | null;
  createdAt: number;
  startedAt: number | null;
  stoppedAt: number | null;
  lastHeartbeat: number | null;
  lastCommandId: string | null;
  metrics: AgentMetrics;
  /** Agent tier in the multi-tier hierarchy */
  tier?: AgentTier;
  /** Jurisdiction for broker agents */
  jurisdiction?: Jurisdiction;
  /** Trust chain certificate ID */
  certificateId?: string;
  /** Hibernation state tracking */
  hibernationState?: 'active' | 'idle' | 'on-demand' | 'deep-archive';
  /** Last activity timestamp (for hibernation sweep) */
  lastActiveAt?: number;
  /** Parent agent ID in the hierarchy */
  parentAgentId?: string;
}

// ===== Aggregate Stats =====

export interface SupervisorStats {
  totalAgents: number;
  running: number;
  paused: number;
  stopped: number;
  error: number;
  totalVolume: number;
  totalPnl: number;
  totalTrades: number;
  byChain: Record<string, number>;
  byStrategy: Record<string, number>;
}

// ===== Redis Key Constants =====

export const REDIS_KEYS = {
  REGISTRY_SET: 'supervisor:registry',
  POLICIES_HASH: 'supervisor:policies',
  agentState: (id: string) => `agent:${id}:state`,
  agentConfig: (id: string) => `agent:${id}:config`,
  agentMetrics: (id: string) => `agent:${id}:metrics`,
  userAgents: (userId: string) => `user:${userId}:agents`,
} as const;

// Redis Streams and Pub/Sub channels have been replaced by WebSocket communication.
// See src/core/ws-hub.ts and src/core/ws-types.ts for the new messaging layer.
