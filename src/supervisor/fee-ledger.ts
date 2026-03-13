/**
 * Immutable Fee Ledger — PostgreSQL-backed append-only fee records.
 *
 * All fee calculations reuse the existing fee-manager.ts:
 *   - getFeeRate() for tiered rates (0.15-0.25% by AUM)
 *   - calculateFee() for per-trade fee computation
 *   - calculateProfitShare() for copy-trade 10% profit share
 *
 * This ledger provides:
 *   - Append-only storage (no updates, no deletes)
 *   - Per-broker aggregation and reconciliation
 *   - Builder fee tracking (Hyperliquid referrals)
 *   - Regulatory reporting summaries
 */

import { randomUUID } from 'node:crypto';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { createChildLogger } from '../core/logger.js';
import { audit } from '../audit/audit-logger.js';
import { getDb } from '../db/index.js';
import { feeLedger as feeLedgerTable } from '../db/schema.js';

const log = createChildLogger('fee-ledger');

export type FeeType =
  | 'trade-fee'
  | 'copy-trade-share'
  | 'builder-fee'
  | 'withdrawal-fee'
  | 'platform-fee';

export interface FeeEntry {
  id: string;
  sequence: number;
  timestamp: string;
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

function rowToFeeEntry(row: typeof feeLedgerTable.$inferSelect): FeeEntry {
  return {
    id: row.id,
    sequence: row.sequence,
    timestamp: row.timestamp,
    type: row.type as FeeType,
    userId: row.userId,
    agentId: row.agentId,
    brokerId: row.brokerId,
    tradeId: row.tradeId,
    amountUsd: row.amountUsd,
    amountToken: row.amountToken,
    feeToken: row.feeToken,
    chain: row.chain,
    feeRate: row.feeRate,
    corr_id: row.corrId,
    metadata: (row.metadata ?? undefined) as Record<string, unknown> | undefined,
  };
}

export async function recordFee(params: {
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
}): Promise<FeeEntry> {
  const db = getDb();
  const id = `fee_${randomUUID()}`;
  const timestamp = new Date().toISOString();

  const [inserted] = await db
    .insert(feeLedgerTable)
    .values({
      id,
      timestamp,
      type: params.type,
      userId: params.userId,
      agentId: params.agentId,
      brokerId: params.brokerId,
      tradeId: params.tradeId,
      amountUsd: params.amountUsd,
      amountToken: params.amountToken,
      feeToken: params.feeToken,
      chain: params.chain,
      feeRate: params.feeRate,
      corrId: params.corr_id,
      metadata: params.metadata ?? null,
    })
    .returning();

  await audit({
    actor: 'master-agent',
    actorTier: 'admin',
    action: 'fee-recorded',
    resource: id,
    details: {
      type: params.type,
      userId: params.userId,
      brokerId: params.brokerId,
      amountUsd: params.amountUsd,
      chain: params.chain,
    },
    success: true,
    corr_id: params.corr_id,
  });

  log.info({
    feeId: id,
    type: params.type,
    userId: params.userId,
    amountUsd: params.amountUsd,
    brokerId: params.brokerId,
    corrId: params.corr_id,
  }, 'Fee recorded in ledger');

  return rowToFeeEntry(inserted);
}

export async function getFeeSummary(
  from?: string,
  to?: string,
): Promise<FeeSummary> {
  const db = getDb();
  const fromDate = from ?? new Date(0).toISOString();
  const toDate = to ?? new Date().toISOString();

  const rows = await db
    .select()
    .from(feeLedgerTable)
    .where(and(
      gte(feeLedgerTable.timestamp, fromDate),
      lte(feeLedgerTable.timestamp, toDate),
    ));

  const summary: FeeSummary = {
    totalFeesUsd: 0,
    totalEntries: rows.length,
    byType: {} as Record<FeeType, number>,
    byBroker: {},
    byChain: {},
    period: { from: fromDate, to: toDate },
  };

  for (const row of rows) {
    summary.totalFeesUsd += row.amountUsd;
    summary.byType[row.type as FeeType] = (summary.byType[row.type as FeeType] || 0) + row.amountUsd;
    summary.byBroker[row.brokerId] = (summary.byBroker[row.brokerId] || 0) + row.amountUsd;
    summary.byChain[row.chain] = (summary.byChain[row.chain] || 0) + row.amountUsd;
  }

  return summary;
}

export async function reconcileFees(
  brokerId: string,
  from?: string,
  to?: string,
): Promise<BrokerReconciliation> {
  const db = getDb();
  const fromDate = from ?? new Date(0).toISOString();
  const toDate = to ?? new Date().toISOString();

  const rows = await db
    .select()
    .from(feeLedgerTable)
    .where(and(
      eq(feeLedgerTable.brokerId, brokerId),
      gte(feeLedgerTable.timestamp, fromDate),
      lte(feeLedgerTable.timestamp, toDate),
    ));

  const entries = rows.map(rowToFeeEntry);
  const totalFeesUsd = entries.reduce((sum, e) => sum + e.amountUsd, 0);

  log.info({
    brokerId,
    totalFeesUsd,
    entryCount: entries.length,
    from: fromDate,
    to: toDate,
  }, 'Fee reconciliation generated');

  return {
    brokerId,
    totalFeesUsd,
    entryCount: entries.length,
    entries,
    reconciledAt: new Date().toISOString(),
  };
}

export async function getFeeEntries(filters?: {
  userId?: string;
  brokerId?: string;
  type?: FeeType;
  chain?: string;
  corr_id?: string;
  limit?: number;
}): Promise<FeeEntry[]> {
  const db = getDb();
  const conditions = [];

  if (filters?.userId) conditions.push(eq(feeLedgerTable.userId, filters.userId));
  if (filters?.brokerId) conditions.push(eq(feeLedgerTable.brokerId, filters.brokerId));
  if (filters?.type) conditions.push(eq(feeLedgerTable.type, filters.type));
  if (filters?.chain) conditions.push(eq(feeLedgerTable.chain, filters.chain));
  if (filters?.corr_id) conditions.push(eq(feeLedgerTable.corrId, filters.corr_id));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const limit = filters?.limit ?? 100;

  const rows = await db
    .select()
    .from(feeLedgerTable)
    .where(where)
    .orderBy(desc(feeLedgerTable.sequence))
    .limit(limit);

  return rows.map(rowToFeeEntry);
}

export async function generateRegulatoryReport(
  from: string,
  to: string,
): Promise<{
  period: { from: string; to: string };
  totalFeesUsd: number;
  totalTransactions: number;
  byBroker: Record<string, {
    totalFeesUsd: number;
    transactionCount: number;
    byType: Record<string, number>;
  }>;
}> {
  const db = getDb();

  const rows = await db
    .select()
    .from(feeLedgerTable)
    .where(and(
      gte(feeLedgerTable.timestamp, from),
      lte(feeLedgerTable.timestamp, to),
    ));

  const byBroker: Record<string, {
    totalFeesUsd: number;
    transactionCount: number;
    byType: Record<string, number>;
  }> = {};

  for (const row of rows) {
    if (!byBroker[row.brokerId]) {
      byBroker[row.brokerId] = { totalFeesUsd: 0, transactionCount: 0, byType: {} };
    }
    const broker = byBroker[row.brokerId];
    broker.totalFeesUsd += row.amountUsd;
    broker.transactionCount++;
    broker.byType[row.type] = (broker.byType[row.type] || 0) + row.amountUsd;
  }

  return {
    period: { from, to },
    totalFeesUsd: rows.reduce((sum, r) => sum + r.amountUsd, 0),
    totalTransactions: rows.length,
    byBroker,
  };
}
