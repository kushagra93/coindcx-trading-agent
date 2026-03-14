import type { AgentTier } from '../security/types.js';

// ═══════════════════════════════════════════════
// Message Types
// ═══════════════════════════════════════════════

export type WsMessageType =
  | 'command'
  | 'event'
  | 'ack'
  | 'heartbeat'
  | 'helper-task'
  | 'helper-result'
  | 'market-data'
  | 'emergency'
  | 'policy-update'
  | 'trade-approval'
  | 'compliance-result'
  | 'agent-disconnect';

export interface WsMessage {
  type: WsMessageType;
  from: string;
  to: string;
  payload: Record<string, unknown>;
  timestamp: number;
  corrId?: string;
  signature?: string;
  nonce?: string;
}

export interface WsConnectionMeta {
  agentId: string;
  userId: string;
  tier: AgentTier;
  helperType?: string;
  connectedAt: number;
}

// ═══════════════════════════════════════════════
// Direction enforcement rules (MDC §Message Signing)
// ═══════════════════════════════════════════════

const MASTER_ONLY_TYPES = new Set<WsMessageType>([
  'command', 'emergency', 'policy-update', 'trade-approval',
  'compliance-result', 'helper-task',
]);

const AGENT_ALLOWED_TYPES = new Set<WsMessageType>([
  'ack', 'event', 'heartbeat', 'helper-result',
]);

export function isValidDownstreamType(type: WsMessageType): boolean {
  return MASTER_ONLY_TYPES.has(type);
}

export function isValidUpstreamType(type: WsMessageType): boolean {
  return AGENT_ALLOWED_TYPES.has(type);
}

// ═══════════════════════════════════════════════
// WebSocket constants
// ═══════════════════════════════════════════════

export const WS_CLOSE_CODES = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  AUTH_FAILED: 4001,
  DUPLICATE_AGENT: 4002,
  HUB_SHUTDOWN: 4003,
  DIRECTION_VIOLATION: 4004,
} as const;

export const WS_PING_INTERVAL_MS = 30_000;
export const WS_PONG_TIMEOUT_MS = 10_000;
export const WS_RECONNECT_BASE_MS = 1_000;
export const WS_RECONNECT_MAX_MS = 30_000;
export const WS_OFFLINE_QUEUE_LIMIT = 200;

// ═══════════════════════════════════════════════
// Redis key constants for Gateway ↔ Master backbone
// ═══════════════════════════════════════════════

export const GW_REDIS_KEYS = {
  /** Hash: agentId → gatewayId */
  agentGateway: (agentId: string) => `agent-gw:${agentId}`,
  /** Pub/Sub channel: master → specific gateway */
  gatewayChannel: (gatewayId: string) => `internal:gw:${gatewayId}`,
  /** Pub/Sub channel: master → all gateways (broadcast) */
  broadcastChannel: 'ops:broadcast',
  /** List: durable offline queue per agent (LPUSH / RPOP) */
  offlineQueue: (agentId: string) => `q:${agentId}`,
  /** Hash: type → last broadcast message (reconnect checkpoint) */
  latestCheckpoint: 'ops:latest',
  /** Stream: agent events upstream → master (single consumer group) */
  upstreamEvents: 'stream:agent:events',
  /** Consumer group on the upstream events stream */
  upstreamGroup: 'master-consumers',
  /** List: ack messages keyed by correlation ID */
  ackQueue: (corrId: string) => `ack:${corrId}`,
  /** Hash: operations manifest */
  manifest: 'ops:manifest',
  /** Pub/Sub channel: manifest update notification */
  manifestUpdate: 'ops:manifest-update',
  /** Hash: hot config (fee %, thresholds) */
  hotConfig: 'ops:config',
  /** Pub/Sub: hot config update notification */
  hotConfigUpdate: 'ops:config-update',
  /** JSON: per-agent strategy params */
  strategyParams: (agentId: string) => `strategy:${agentId}`,
  /** Pub/Sub: strategy params update notification */
  strategyParamsUpdate: 'ops:strategy-update',
} as const;

// ═══════════════════════════════════════════════
// Operations Manifest (MDC §Dynamic Command Registry)
// ═══════════════════════════════════════════════

export interface OperationDefinition {
  id: string;
  channel: string;
  description: string;
  payloadSchema: Record<string, unknown>;
  requiredAgentVersion: string;
  appliesTo: ('user' | 'broker' | 'helper')[];
}

export interface OperationsManifest {
  version: number;
  updatedAt: string;
  operations: OperationDefinition[];
}

// ═══════════════════════════════════════════════
// Strategy Runner interface (MDC §Hot-Updating)
// ═══════════════════════════════════════════════

export interface CycleContext {
  agentId: string;
  userId: string;
  params: Record<string, unknown>;
  marketData: Record<string, unknown>;
}

export interface TradeSignal {
  action: 'buy' | 'sell' | 'hold';
  asset: string;
  amountUsd: number;
  confidence: number;
  reason: string;
}

export interface StrategyRunner {
  evaluate(context: CycleContext): Promise<TradeSignal | null>;
  onConfigUpdate(params: Record<string, unknown>): void;
  cleanup(): Promise<void>;
}
