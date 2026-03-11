// ===== Chain & Network =====

export type Chain = 'solana' | 'ethereum' | 'polygon' | 'base' | 'arbitrum' | 'hyperliquid';

export type ChainFamily = 'solana' | 'evm' | 'hyperliquid';

export function getChainFamily(chain: Chain): ChainFamily {
  if (chain === 'solana') return 'solana';
  if (chain === 'hyperliquid') return 'hyperliquid';
  return 'evm';
}

export const EVM_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  base: 8453,
  arbitrum: 42161,
};

// ===== User & Auth =====

export interface User {
  id: string;
  hostAppUserId: string;
  walletAddresses: Record<Chain, string>;
  hostAppWalletAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PermissionTier = 'admin' | 'ops' | 'user';

export interface AuthContext {
  userId: string;
  tier: PermissionTier;
  hostApp: string;
}

export interface KYCStatus {
  verified: boolean;
  level: number;
  expiresAt?: Date;
}

export interface TradeLimits {
  maxTradeUsd: number;
  dailyVolumeUsd: number;
  remainingDailyUsd: number;
}

// ===== Trading =====

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type TradeVenue = 'jupiter' | '1inch' | '0x' | 'hyperliquid';

export interface TradeIntent {
  id: string;
  userId: string;
  chain: Chain;
  venue: TradeVenue;
  side: OrderSide;
  orderType: OrderType;
  inputToken: string;
  outputToken: string;
  amountIn: string;
  minAmountOut?: string;
  maxSlippageBps: number;
  strategyId: string;
  idempotencyKey: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export type TradeState =
  | 'SIGNAL_GENERATED'
  | 'FEE_RESERVED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_FAILED'
  | 'FEE_REFUNDED'
  | 'POSITION_UPDATED';

export interface TradeRecord {
  id: string;
  userId: string;
  intentId: string;
  state: TradeState;
  chain: Chain;
  venue: TradeVenue;
  side: OrderSide;
  inputToken: string;
  outputToken: string;
  amountIn: string;
  amountOut?: string;
  feeAmount?: string;
  feeToken?: string;
  txHash?: string;
  error?: string;
  idempotencyKey: string;
  strategyId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  amountOut?: string;
  priceImpactBps?: number;
  gasUsed?: string;
  error?: string;
}

export interface Quote {
  venue: TradeVenue;
  inputToken: string;
  outputToken: string;
  amountIn: string;
  amountOut: string;
  priceImpactBps: number;
  route?: unknown;
  expiresAt: Date;
}

export interface QuoteParams {
  chain: Chain;
  inputToken: string;
  outputToken: string;
  amountIn: string;
  slippageBps: number;
}

// ===== Position =====

export interface Position {
  id: string;
  userId: string;
  chain: Chain;
  token: string;
  tokenSymbol: string;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  highWaterMark: number;
  status: 'open' | 'closing' | 'closed';
  strategyId: string;
  openedAt: Date;
  closedAt?: Date;
}

// ===== Strategy =====

export type StrategyType = 'dca' | 'momentum' | 'mean-reversion' | 'grid' | 'copy-trade' | 'custom';
export type RiskLevel = 'conservative' | 'moderate' | 'aggressive';

export interface StrategyConfig {
  id: string;
  userId: string;
  type: StrategyType;
  name: string;
  chain: Chain;
  tokens: string[];
  budgetUsd: number;
  riskLevel: RiskLevel;
  maxPerTradePct: number;
  params: Record<string, unknown>;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ===== Fee =====

export interface FeeReservation {
  id: string;
  userId: string;
  tradeId: string;
  amount: string;
  token: string;
  chain: Chain;
  status: 'reserved' | 'settled' | 'refunded';
  createdAt: Date;
  settledAt?: Date;
}

// ===== Risk =====

export interface RiskSettings {
  riskLevel: RiskLevel;
  dailyLossLimitUsd: number;
  maxPerTradePct: number;
}

// ===== Events =====

export type EventType =
  | 'price_update'
  | 'wallet_activity'
  | 'trade_intent'
  | 'trade_result'
  | 'admin_broadcast'
  | 'emergency_halt';

export interface StreamEvent {
  type: EventType;
  payload: unknown;
  timestamp: number;
}

export interface PriceUpdate {
  token: string;
  chain: Chain;
  priceUsd: number;
  volume24h?: number;
  change24hPct?: number;
  timestamp: number;
}

export interface WalletActivity {
  walletAddress: string;
  chain: Chain;
  txHash: string;
  type: 'swap' | 'transfer';
  tokenIn?: string;
  tokenOut?: string;
  amountIn?: string;
  amountOut?: string;
  timestamp: number;
}

// ===== Policy =====

export interface PolicyResult {
  allowed: boolean;
  reason?: string;
  restrictions?: {
    maxAmountUsd?: number;
    blockedTokens?: string[];
  };
}

export interface SignedTransaction {
  chain: Chain;
  rawTx: Uint8Array;
  txHash: string;
}

export interface TxResult {
  success: boolean;
  txHash: string;
  blockNumber?: number;
  error?: string;
}

export interface AuthResult {
  authenticated: boolean;
  userId?: string;
  tier?: PermissionTier;
  error?: string;
}

// ===== Lead Trader =====

export interface LeadTrader {
  id: string;
  name: string;
  walletAddresses: Record<Chain, string>;
  pnl30d: number;
  pnl90d: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  copiersCount: number;
  aumUsd: number;
  trackRecordDays: number;
  verified: boolean;
}

export interface CopyConfig {
  userId: string;
  leadTraderId: string;
  budgetUsd: number;
  maxPerTradePct: number;
  enabled: boolean;
  createdAt: Date;
}
