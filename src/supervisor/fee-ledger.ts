/**
 * Immutable Fee Ledger — append-only fee records maintained by the Master Agent.
 *
 * All fee calculations reuse the existing fee-manager.ts:
 *   - getFeeRate() for tiered rates (0.15-0.25% by AUM)
 *   - calculateFee() for per-trade fee computation
 *   - calculateProfitShare() for copy-trade 10% profit share
 *
 * This ledger adds:
 *   - Append-only storage (no updates, no deletes)
 *   - Per-broker aggregation and reconciliation
 *   - Builder fee tracking (Hyperliquid referrals)
 *   - Regulatory reporting summaries
 *
 * Production: PostgreSQL `fee_ledger` table with INSERT-only grants.
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../core/logger.js';
import { audit } from '../audit/audit-logger.js';

const log = createChildLogger('fee-ledger');

// ===== Fee Entry Types =====

export type FeeType =
  | 'trade-fee'          // Standard per-trade fee (0.15-0.25%)
  | 'copy-trade-share'   // 10% of copy-trade profits
  | 'builder-fee'        // Hyperliquid builder/referral fee
  | 'withdrawal-fee'     // Withdrawal processing fee
  | 'platform-fee';      // General platform fee

export interface FeeEntry {
  /** Unique entry ID */
  id: string;
  /** Monotonic sequence number */
  sequence: number;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Fee type classification */
  type: FeeType;
  /** User who paid the fee */
  userId: string;
  /** Agent that initiated the trade */
  agentId: string;
  /** Broker that aggregated the fee */
  brokerId: string;
  /** Trade/transaction this fee relates to */
  tradeId: string;
  /** Fee amount in USD */
  amountUsd: number;
  /** Fee amount in the token paid */
  amountToken: string;
  /** Token used for fee payment */
  feeToken: string;
  /** Chain where the fee was collected */
  chain: string;
  /** Fee rate applied (e.g., 0.0020 for 0.20%) */
  feeRate: number;
  /** Correlation ID for trade lifecycle tracing */
  corr_id: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface FeeSummary {
  totalFeesUsd: number;
  totalEntries: number;
  byType: Record<FeeType, number>;
  byBroker: Record<string, number>;
  byChain: Record<string, number>;
  period: { from: string; to: string };
}

export interface BrokerReconciliation {
  brokerId: string;
  totalFeesUsd: number;
  entryCount: number;
  entries: FeeEntry[];
  reconciledAt: string;
}

// ===== Fee Ledger Implementation =====

/** In-memory append-only ledger (production: PostgreSQL) */
const ledger: FeeEntry[] = [];
let sequenceCounter = 0;

/**
 * Record a fee in the immutable ledger.
 * This is INSERT-only — entries can never be modified or deleted.
 */
export function recordFee(params: {
  type: FeeType;
  userId: string;
  agentId: string;
  brokerId: string;
  tradeId: string;
  amountUsd: number;
  amountToken: string;
  feeToken: string;
  chain: string;
  feeRate: number;
  corr_id: string;
  metadata?: Record<string, unknown>;
}): FeeEntry {
  const entry: FeeEntry = {
    id: `fee_${randomUUID()}`,
    sequence: ++sequenceCounter,
    timestamp: new Date().toISOString(),
    ...params,
  };

  // Append-only: never modify existing entries
  ledger.push(entry);

  audit({
    actor: 'master-agent',
    actorTier: 'admin',
    action: 'fee-recorded',
    resource: entry.id,
    details: {
      type: entry.type,
      userId: entry.userId,
      brokerId: entry.brokerId,
      amountUsd: entry.amountUsd,
      chain: entry.chain,
    },
    success: true,
    corr_id: entry.corr_id,
  });

  log.info({
    feeId: entry.id,
    type: entry.type,
    userId: entry.userId,
    amountUsd: entry.amountUsd,
    brokerId: entry.brokerId,
    corrId: entry.corr_id,
  }, 'Fee recorded in ledger');

  return entry;
}

/**
 * Get a summary of fees over a time range.
 */
export function getFeeSummary(
  from?: string,
  to?: string,
): FeeSummary {
  const fromDate = from ? new Date(from) : new Date(0);
  const toDate = to ? new Date(to) : new Date();

  const filtered = ledger.filter(e => {
    const ts = new Date(e.timestamp);
    return ts >= fromDate && ts <= toDate;
  });

  const summary: FeeSummary = {
    totalFeesUsd: 0,
    totalEntries: filtered.length,
    byType: {} as Record<FeeType, number>,
    byBroker: {},
    byChain: {},
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
  };

  for (const entry of filtered) {
    summary.totalFeesUsd += entry.amountUsd;
    summary.byType[entry.type] = (summary.byType[entry.type] || 0) + entry.amountUsd;
    summary.byBroker[entry.brokerId] = (summary.byBroker[entry.brokerId] || 0) + entry.amountUsd;
    summary.byChain[entry.chain] = (summary.byChain[entry.chain] || 0) + entry.amountUsd;
  }

  return summary;
}

/**
 * Reconcile fees for a specific broker.
 * Returns all fee entries attributed to the broker for verification.
 */
export function reconcileFees(
  brokerId: string,
  from?: string,
  to?: string,
): BrokerReconciliation {
  const fromDate = from ? new Date(from) : new Date(0);
  const toDate = to ? new Date(to) : new Date();

  const entries = ledger.filter(e => {
    const ts = new Date(e.timestamp);
    return e.brokerId === brokerId && ts >= fromDate && ts <= toDate;
  });

  const totalFeesUsd = entries.reduce((sum, e) => sum + e.amountUsd, 0);

  log.info({
    brokerId,
    totalFeesUsd,
    entryCount: entries.length,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  }, 'Fee reconciliation generated');

  return {
    brokerId,
    totalFeesUsd,
    entryCount: entries.length,
    entries,
    reconciledAt: new Date().toISOString(),
  };
}

/**
 * Get all fee entries (with optional filters).
 */
export function getFeeEntries(filters?: {
  userId?: string;
  brokerId?: string;
  type?: FeeType;
  chain?: string;
  corr_id?: string;
  limit?: number;
}): FeeEntry[] {
  let entries = [...ledger];

  if (filters?.userId) {
    entries = entries.filter(e => e.userId === filters.userId);
  }
  if (filters?.brokerId) {
    entries = entries.filter(e => e.brokerId === filters.brokerId);
  }
  if (filters?.type) {
    entries = entries.filter(e => e.type === filters.type);
  }
  if (filters?.chain) {
    entries = entries.filter(e => e.chain === filters.chain);
  }
  if (filters?.corr_id) {
    entries = entries.filter(e => e.corr_id === filters.corr_id);
  }

  const limit = filters?.limit ?? 100;
  return entries.slice(-limit);
}

/**
 * Generate a regulatory report summary.
 * Groups fees by jurisdiction (broker) and type for compliance reporting.
 */
export function generateRegulatoryReport(
  from: string,
  to: string,
): {
  period: { from: string; to: string };
  totalFeesUsd: number;
  totalTransactions: number;
  byBroker: Record<string, {
    totalFeesUsd: number;
    transactionCount: number;
    byType: Record<string, number>;
  }>;
} {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const filtered = ledger.filter(e => {
    const ts = new Date(e.timestamp);
    return ts >= fromDate && ts <= toDate;
  });

  const byBroker: Record<string, {
    totalFeesUsd: number;
    transactionCount: number;
    byType: Record<string, number>;
  }> = {};

  for (const entry of filtered) {
    if (!byBroker[entry.brokerId]) {
      byBroker[entry.brokerId] = { totalFeesUsd: 0, transactionCount: 0, byType: {} };
    }
    const broker = byBroker[entry.brokerId];
    broker.totalFeesUsd += entry.amountUsd;
    broker.transactionCount++;
    broker.byType[entry.type] = (broker.byType[entry.type] || 0) + entry.amountUsd;
  }

  return {
    period: { from, to },
    totalFeesUsd: filtered.reduce((sum, e) => sum + e.amountUsd, 0),
    totalTransactions: filtered.length,
    byBroker,
  };
}
