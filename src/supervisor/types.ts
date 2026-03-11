import type { Chain, StrategyType, StrategyConfig, RiskSettings, RiskLevel } from '../core/types.js';

// ===== Agent Lifecycle =====

export type AgentLifecycleState =
  | 'creating'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'error'
  | 'destroying';

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
  | 'heartbeat-request';

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
  | 'command-rejected';

export interface AgentEvent {
  id: string;
  type: AgentEventType;
  agentId: string;
  userId: string;
  payload: Record<string, unknown>;
  timestamp: number;
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

export const REDIS_STREAMS = {
  SUPERVISOR_COMMANDS: 'stream:supervisor:commands',
  AGENT_EVENTS: 'stream:agent:events',
  AGENT_HEARTBEATS: 'stream:agent:heartbeats',
  agentCommands: (id: string) => `stream:agent:${id}:commands`,
} as const;

export const REDIS_CHANNELS = {
  EMERGENCY: 'channel:emergency',
  POLICY_UPDATE: 'channel:policy:update',
  STRATEGY_UPDATE: 'channel:strategy:update',
} as const;
