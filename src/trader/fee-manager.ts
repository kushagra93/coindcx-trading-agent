import { eq, and, sql } from 'drizzle-orm';
import { createChildLogger } from '../core/logger.js';
import { config } from '../core/config.js';
import type { Chain, FeeReservation } from '../core/types.js';
import { getDb } from '../db/index.js';
import { feeReservations as feeReservationsTable, builderFees as builderFeesTable } from '../db/schema.js';
import { v4 as uuid } from 'uuid';

const log = createChildLogger('fee-manager');

const FEE_TIERS = [
  { minAumUsd: 10_000, feePct: 0.0015 },
  { minAumUsd: 1_000,  feePct: 0.0020 },
  { minAumUsd: 0,      feePct: 0.0025 },
];

const COPY_TRADE_PROFIT_SHARE = 0.10;

export function getFeeRate(aumUsd: number): number {
  for (const tier of FEE_TIERS) {
    if (aumUsd >= tier.minAumUsd) {
      return tier.feePct;
    }
  }
  return FEE_TIERS[FEE_TIERS.length - 1].feePct;
}

export function calculateFee(amountIn: string, aumUsd: number): { feeAmount: string; feeRate: number } {
  const rate = getFeeRate(aumUsd);
  const amount = parseFloat(amountIn);

  if (isNaN(amount) || amount <= 0) {
    return { feeAmount: '0', feeRate: rate };
  }

  const fee = amount * rate;
  return { feeAmount: fee.toFixed(8), feeRate: rate };
}

export function calculateProfitShare(profitUsd: number): number {
  if (profitUsd <= 0) return 0;
  return profitUsd * COPY_TRADE_PROFIT_SHARE;
}

export async function reserveFee(
  userId: string,
  tradeId: string,
  amount: string,
  token: string,
  chain: Chain
): Promise<FeeReservation> {
  const db = getDb();

  const reservation: typeof feeReservationsTable.$inferInsert = {
    id: uuid(),
    userId,
    tradeId,
    amount,
    token,
    chain,
    status: 'reserved',
    createdAt: new Date(),
  };

  await db.insert(feeReservationsTable).values(reservation);

  log.info({
    reservationId: reservation.id,
    userId,
    tradeId,
    amount,
    token,
  }, 'Fee reserved');

  return {
    id: reservation.id!,
    userId,
    tradeId,
    amount,
    token,
    chain,
    status: 'reserved',
    createdAt: reservation.createdAt!,
  };
}

export async function refundFee(reservationId: string, userId: string): Promise<boolean> {
  const db = getDb();

  const [reservation] = await db
    .select()
    .from(feeReservationsTable)
    .where(eq(feeReservationsTable.id, reservationId))
    .limit(1);

  if (!reservation) {
    log.warn({ reservationId }, 'Fee reservation not found for refund');
    return false;
  }

  if (reservation.userId !== userId) {
    log.warn({ reservationId, requestedBy: userId, ownedBy: reservation.userId }, 'Fee refund denied — ownership mismatch');
    return false;
  }

  if (reservation.status !== 'reserved') {
    log.warn({ reservationId, status: reservation.status }, 'Fee refund denied — not in reserved state');
    return false;
  }

  await db
    .update(feeReservationsTable)
    .set({ status: 'refunded' })
    .where(eq(feeReservationsTable.id, reservationId));

  log.info({ reservationId, amount: reservation.amount }, 'Fee refunded');
  return true;
}

export async function settleFee(reservationId: string): Promise<void> {
  const db = getDb();
  await db
    .update(feeReservationsTable)
    .set({ status: 'settled', settledAt: new Date() })
    .where(eq(feeReservationsTable.id, reservationId));

  log.info({ reservationId }, 'Fee settled');
}

export async function shouldSettle(chain: Chain, token: string): Promise<boolean> {
  const db = getDb();
  const threshold = config.fees.settlementThresholdUsd;

  if (threshold <= 0) {
    log.warn({ threshold }, 'Settlement threshold is zero or negative — skipping');
    return false;
  }

  const [result] = await db
    .select({ total: sql<number>`coalesce(sum(${feeReservationsTable.amount}::numeric), 0)` })
    .from(feeReservationsTable)
    .where(and(
      eq(feeReservationsTable.chain, chain),
      eq(feeReservationsTable.token, token),
      eq(feeReservationsTable.status, 'reserved'),
    ));

  return (result?.total ?? 0) >= threshold;
}

export async function getUnsettledFees(userId: string): Promise<Map<string, number>> {
  const db = getDb();

  const rows = await db
    .select({
      chain: feeReservationsTable.chain,
      token: feeReservationsTable.token,
      total: sql<number>`sum(${feeReservationsTable.amount}::numeric)`,
    })
    .from(feeReservationsTable)
    .where(and(
      eq(feeReservationsTable.userId, userId),
      eq(feeReservationsTable.status, 'reserved'),
    ))
    .groupBy(feeReservationsTable.chain, feeReservationsTable.token);

  const fees = new Map<string, number>();
  for (const row of rows) {
    fees.set(`${row.chain}:${row.token}`, row.total);
  }
  return fees;
}

export async function getPendingSettlements(chain: Chain, token: string): Promise<FeeReservation[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(feeReservationsTable)
    .where(and(
      eq(feeReservationsTable.chain, chain),
      eq(feeReservationsTable.token, token),
      eq(feeReservationsTable.status, 'reserved'),
    ));

  return rows.map(r => ({
    id: r.id,
    userId: r.userId,
    tradeId: r.tradeId,
    amount: r.amount,
    token: r.token,
    chain: r.chain as Chain,
    status: r.status as FeeReservation['status'],
    createdAt: r.createdAt,
    settledAt: r.settledAt ?? undefined,
  }));
}

export async function recordBuilderFee(
  tradeId: string,
  volumeUsd: number,
  feeBps: number,
  builderCode: string
): Promise<void> {
  const db = getDb();
  const feeUsd = (volumeUsd * feeBps) / 10000;

  await db.insert(builderFeesTable).values({
    tradeId,
    volumeUsd,
    feeBps,
    feeUsd,
    builderCode,
    createdAt: new Date(),
  });

  log.info({
    tradeId,
    volumeUsd,
    feeBps,
    feeUsd,
    builderCode,
  }, 'Builder fee recorded');
}

export async function getBuilderFeeSummary(): Promise<{
  totalFeeUsd: number;
  totalVolumeUsd: number;
  tradeCount: number;
  builderCode: string;
  recentFees: Array<{
    tradeId: string;
    volumeUsd: number;
    feeBps: number;
    feeUsd: number;
    builderCode: string;
    timestamp: Date;
  }>;
}> {
  const db = getDb();

  const [agg] = await db
    .select({
      totalFeeUsd: sql<number>`coalesce(sum(${builderFeesTable.feeUsd}), 0)`,
      totalVolumeUsd: sql<number>`coalesce(sum(${builderFeesTable.volumeUsd}), 0)`,
      tradeCount: sql<number>`count(*)::int`,
    })
    .from(builderFeesTable);

  const recentRows = await db
    .select()
    .from(builderFeesTable)
    .orderBy(sql`${builderFeesTable.createdAt} desc`)
    .limit(50);

  return {
    totalFeeUsd: agg?.totalFeeUsd ?? 0,
    totalVolumeUsd: agg?.totalVolumeUsd ?? 0,
    tradeCount: agg?.tradeCount ?? 0,
    builderCode: config.hyperliquid.builderCode,
    recentFees: recentRows.map(r => ({
      tradeId: r.tradeId,
      volumeUsd: r.volumeUsd,
      feeBps: r.feeBps,
      feeUsd: r.feeUsd,
      builderCode: r.builderCode,
      timestamp: r.createdAt,
    })),
  };
}

export async function getTotalAccumulatedFees(): Promise<{ byChainToken: Record<string, number>; totalUsd: number }> {
  const db = getDb();

  const rows = await db
    .select({
      chain: feeReservationsTable.chain,
      token: feeReservationsTable.token,
      total: sql<number>`coalesce(sum(${feeReservationsTable.amount}::numeric), 0)`,
    })
    .from(feeReservationsTable)
    .where(eq(feeReservationsTable.status, 'reserved'))
    .groupBy(feeReservationsTable.chain, feeReservationsTable.token);

  const byChainToken: Record<string, number> = {};
  let totalUsd = 0;

  for (const row of rows) {
    const key = `${row.chain}:${row.token}`;
    byChainToken[key] = row.total;
    totalUsd += row.total;
  }

  return { byChainToken, totalUsd };
}
