import {
  pgTable,
  text,
  varchar,
  timestamp,
  boolean,
  numeric,
  integer,
  real,
  jsonb,
  serial,
  bigserial,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ===== Trades =====

export const trades = pgTable('trades', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  intentId: varchar('intent_id', { length: 64 }).notNull(),
  state: varchar('state', { length: 32 }).notNull(),
  chain: varchar('chain', { length: 32 }).notNull(),
  venue: varchar('venue', { length: 32 }).notNull(),
  side: varchar('side', { length: 8 }).notNull(),
  inputToken: varchar('input_token', { length: 128 }).notNull(),
  outputToken: varchar('output_token', { length: 128 }).notNull(),
  amountIn: varchar('amount_in', { length: 64 }).notNull(),
  amountOut: varchar('amount_out', { length: 64 }),
  feeAmount: varchar('fee_amount', { length: 64 }),
  feeToken: varchar('fee_token', { length: 128 }),
  txHash: varchar('tx_hash', { length: 128 }),
  error: text('error'),
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  strategyId: varchar('strategy_id', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('trades_user_id_idx').on(table.userId),
  index('trades_state_idx').on(table.state),
  uniqueIndex('trades_idempotency_key_idx').on(table.idempotencyKey),
  index('trades_created_at_idx').on(table.createdAt),
]);

// ===== Positions =====

export const positions = pgTable('positions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  chain: varchar('chain', { length: 32 }).notNull(),
  token: varchar('token', { length: 128 }).notNull(),
  tokenSymbol: varchar('token_symbol', { length: 32 }).notNull(),
  entryPrice: real('entry_price').notNull(),
  currentPrice: real('current_price').notNull(),
  amount: real('amount').notNull(),
  costBasis: real('cost_basis').notNull(),
  unrealizedPnl: real('unrealized_pnl').notNull().default(0),
  unrealizedPnlPct: real('unrealized_pnl_pct').notNull().default(0),
  highWaterMark: real('high_water_mark').notNull(),
  status: varchar('status', { length: 16 }).notNull().default('open'),
  strategyId: varchar('strategy_id', { length: 64 }).notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, (table) => [
  index('positions_user_id_idx').on(table.userId),
  index('positions_status_idx').on(table.status),
  index('positions_user_status_idx').on(table.userId, table.status),
]);

// ===== User Stats =====

export const userStats = pgTable('user_stats', {
  userId: varchar('user_id', { length: 64 }).primaryKey(),
  totalPnl: real('total_pnl').notNull().default(0),
  totalTrades: integer('total_trades').notNull().default(0),
  winCount: integer('win_count').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ===== Audit Log (append-only, hash-chained) =====

export const auditLog = pgTable('audit_log', {
  id: varchar('id', { length: 64 }).primaryKey(),
  sequence: bigserial('sequence', { mode: 'number' }).notNull(),
  timestamp: varchar('timestamp', { length: 64 }).notNull(),
  actor: varchar('actor', { length: 128 }).notNull(),
  actorTier: varchar('actor_tier', { length: 16 }).notNull(),
  action: varchar('action', { length: 128 }).notNull(),
  resource: varchar('resource', { length: 256 }).notNull(),
  details: jsonb('details').notNull().default({}),
  success: boolean('success').notNull().default(true),
  error: text('error'),
  previousHash: varchar('previous_hash', { length: 128 }).notNull(),
  entryHash: varchar('entry_hash', { length: 128 }).notNull(),
  corrId: varchar('corr_id', { length: 128 }),
}, (table) => [
  index('audit_log_actor_idx').on(table.actor),
  index('audit_log_action_idx').on(table.action),
  index('audit_log_corr_id_idx').on(table.corrId),
  index('audit_log_sequence_idx').on(table.sequence),
]);

// ===== Fee Ledger (append-only) =====

export const feeLedger = pgTable('fee_ledger', {
  id: varchar('id', { length: 64 }).primaryKey(),
  sequence: bigserial('sequence', { mode: 'number' }).notNull(),
  timestamp: varchar('timestamp', { length: 64 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  agentId: varchar('agent_id', { length: 128 }).notNull(),
  brokerId: varchar('broker_id', { length: 128 }).notNull(),
  tradeId: varchar('trade_id', { length: 64 }).notNull(),
  amountUsd: real('amount_usd').notNull(),
  amountToken: varchar('amount_token', { length: 64 }).notNull(),
  feeToken: varchar('fee_token', { length: 128 }).notNull(),
  chain: varchar('chain', { length: 32 }).notNull(),
  feeRate: real('fee_rate').notNull(),
  corrId: varchar('corr_id', { length: 128 }).notNull(),
  metadata: jsonb('metadata'),
}, (table) => [
  index('fee_ledger_user_id_idx').on(table.userId),
  index('fee_ledger_broker_id_idx').on(table.brokerId),
  index('fee_ledger_type_idx').on(table.type),
  index('fee_ledger_corr_id_idx').on(table.corrId),
]);

// ===== Fee Reservations =====

export const feeReservations = pgTable('fee_reservations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  tradeId: varchar('trade_id', { length: 64 }).notNull(),
  amount: varchar('amount', { length: 64 }).notNull(),
  token: varchar('token', { length: 128 }).notNull(),
  chain: varchar('chain', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('reserved'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
}, (table) => [
  index('fee_reservations_user_id_idx').on(table.userId),
  index('fee_reservations_status_idx').on(table.status),
  index('fee_reservations_chain_token_idx').on(table.chain, table.token),
]);

// ===== Builder Fees =====

export const builderFees = pgTable('builder_fees', {
  id: serial('id').primaryKey(),
  tradeId: varchar('trade_id', { length: 64 }).notNull(),
  volumeUsd: real('volume_usd').notNull(),
  feeBps: real('fee_bps').notNull(),
  feeUsd: real('fee_usd').notNull(),
  builderCode: varchar('builder_code', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ===== Circuit Breaker Losses =====

export const circuitBreakerLosses = pgTable('circuit_breaker_losses', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  amount: real('amount').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('cb_losses_user_id_idx').on(table.userId),
  index('cb_losses_recorded_at_idx').on(table.recordedAt),
]);

export const circuitBreakerTrips = pgTable('circuit_breaker_trips', {
  userId: varchar('user_id', { length: 64 }).primaryKey(),
  trippedAt: timestamp('tripped_at', { withTimezone: true }).defaultNow().notNull(),
  reason: text('reason'),
});

// ===== Global Settings (circuit breaker halt, etc.) =====

export const globalSettings = pgTable('global_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ===== Strategies =====

export const strategies = pgTable('strategies', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  chain: varchar('chain', { length: 32 }).notNull(),
  tokens: jsonb('tokens').notNull().default([]),
  budgetUsd: real('budget_usd').notNull(),
  riskLevel: varchar('risk_level', { length: 16 }).notNull(),
  maxPerTradePct: real('max_per_trade_pct').notNull(),
  params: jsonb('params').notNull().default({}),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('strategies_user_id_idx').on(table.userId),
]);

// ===== Chat Conversations =====

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  role: varchar('role', { length: 16 }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('chat_messages_user_id_idx').on(table.userId),
  index('chat_messages_created_at_idx').on(table.createdAt),
]);

// ===== Agent Instances =====

export const agentInstances = pgTable('agent_instances', {
  agentId: varchar('agent_id', { length: 128 }).primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  tier: varchar('tier', { length: 16 }).notNull(),
  brokerId: varchar('broker_id', { length: 128 }),
  running: boolean('running').notNull().default(true),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  stoppedAt: timestamp('stopped_at', { withTimezone: true }),
  metadata: jsonb('metadata'),
}, (table) => [
  index('agent_instances_user_id_idx').on(table.userId),
  index('agent_instances_running_idx').on(table.running),
]);

// ===== Risk Settings =====

export const riskSettings = pgTable('risk_settings', {
  userId: varchar('user_id', { length: 64 }).primaryKey(),
  riskLevel: varchar('risk_level', { length: 16 }).notNull().default('moderate'),
  dailyLossLimitUsd: real('daily_loss_limit_usd').notNull().default(1000),
  maxPerTradePct: real('max_per_trade_pct').notNull().default(25),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ===== Lead Traders =====

export const leadTraders = pgTable('lead_traders', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  walletAddresses: jsonb('wallet_addresses').notNull().default({}),
  pnl30d: real('pnl_30d').notNull().default(0),
  pnl90d: real('pnl_90d').notNull().default(0),
  winRate: real('win_rate').notNull().default(0),
  maxDrawdown: real('max_drawdown').notNull().default(0),
  sharpeRatio: real('sharpe_ratio').notNull().default(0),
  copiersCount: integer('copiers_count').notNull().default(0),
  aumUsd: real('aum_usd').notNull().default(0),
  trackRecordDays: integer('track_record_days').notNull().default(0),
  verified: boolean('verified').notNull().default(false),
});

// ===== Copy Configs =====

export const copyConfigs = pgTable('copy_configs', {
  id: serial('id').primaryKey(),
  userId: varchar('user_id', { length: 64 }).notNull(),
  leadTraderId: varchar('lead_trader_id', { length: 64 }).notNull(),
  budgetUsd: real('budget_usd').notNull(),
  maxPerTradePct: real('max_per_trade_pct').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('copy_configs_user_leader_idx').on(table.userId, table.leadTraderId),
]);
