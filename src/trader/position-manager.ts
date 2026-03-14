import { eq, and, sql } from 'drizzle-orm';
import { createChildLogger } from '../core/logger.js';
import type { Position, Chain } from '../core/types.js';
import { getDb } from '../db/index.js';
import { positions as positionsTable, userStats as userStatsTable } from '../db/schema.js';
import { v4 as uuid } from 'uuid';

const log = createChildLogger('position-manager');

function rowToPosition(row: typeof positionsTable.$inferSelect): Position {
  return {
    id: row.id,
    userId: row.userId,
    chain: row.chain as Chain,
    token: row.token,
    tokenSymbol: row.tokenSymbol,
    entryPrice: row.entryPrice,
    currentPrice: row.currentPrice,
    amount: row.amount,
    costBasis: row.costBasis,
    unrealizedPnl: row.unrealizedPnl,
    unrealizedPnlPct: row.unrealizedPnlPct,
    highWaterMark: row.highWaterMark,
    status: row.status as Position['status'],
    strategyId: row.strategyId,
    openedAt: row.openedAt,
    closedAt: row.closedAt ?? undefined,
  };
}

export async function openPosition(params: {
  userId: string;
  chain: Chain;
  token: string;
  tokenSymbol: string;
  entryPrice: number;
  amount: number;
  costBasis: number;
  strategyId: string;
}): Promise<Position> {
  const db = getDb();
  const positionId = uuid();

  const row: typeof positionsTable.$inferInsert = {
    id: positionId,
    userId: params.userId,
    chain: params.chain,
    token: params.token,
    tokenSymbol: params.tokenSymbol,
    entryPrice: params.entryPrice,
    currentPrice: params.entryPrice,
    amount: params.amount,
    costBasis: params.costBasis,
    unrealizedPnl: 0,
    unrealizedPnlPct: 0,
    highWaterMark: params.entryPrice,
    status: 'open',
    strategyId: params.strategyId,
    openedAt: new Date(),
  };

  await db.insert(positionsTable).values(row);

  log.info({
    positionId,
    userId: params.userId,
    token: params.tokenSymbol,
    entryPrice: params.entryPrice,
    amount: params.amount,
  }, 'Position opened');

  return rowToPosition(row as typeof positionsTable.$inferSelect);
}

export async function updatePositionPrice(positionId: string, currentPrice: number): Promise<void> {
  const db = getDb();

  const [pos] = await db
    .select()
    .from(positionsTable)
    .where(and(eq(positionsTable.id, positionId), eq(positionsTable.status, 'open')))
    .limit(1);

  if (!pos) return;

  const unrealizedPnl = (currentPrice - pos.entryPrice) * pos.amount;
  const unrealizedPnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
  const highWaterMark = Math.max(currentPrice, pos.highWaterMark);

  await db
    .update(positionsTable)
    .set({ currentPrice, unrealizedPnl, unrealizedPnlPct, highWaterMark })
    .where(eq(positionsTable.id, positionId));
}

export async function closePosition(
  positionId: string,
  exitPrice: number,
  reason: string,
  sellPct: number = 100
): Promise<{ realizedPnl: number; soldAmount: number } | null> {
  const db = getDb();

  const [pos] = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.id, positionId))
    .limit(1);

  if (!pos || pos.status === 'closed') {
    log.warn({ positionId }, 'Position not found or already closed');
    return null;
  }

  const sellFraction = sellPct / 100;
  const soldAmount = pos.amount * sellFraction;
  const soldCostBasis = pos.costBasis * sellFraction;
  const proceeds = soldAmount * exitPrice;
  const realizedPnl = proceeds - soldCostBasis;

  if (sellPct >= 100) {
    await db
      .update(positionsTable)
      .set({
        status: 'closed',
        closedAt: new Date(),
        currentPrice: exitPrice,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
      })
      .where(eq(positionsTable.id, positionId));

    await db
      .insert(userStatsTable)
      .values({
        userId: pos.userId,
        totalPnl: realizedPnl,
        totalTrades: 1,
        winCount: realizedPnl > 0 ? 1 : 0,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userStatsTable.userId,
        set: {
          totalPnl: sql`${userStatsTable.totalPnl} + ${realizedPnl}`,
          totalTrades: sql`${userStatsTable.totalTrades} + 1`,
          winCount: sql`${userStatsTable.winCount} + ${realizedPnl > 0 ? 1 : 0}`,
          updatedAt: new Date(),
        },
      });

    log.info({
      positionId,
      token: pos.tokenSymbol,
      realizedPnl: realizedPnl.toFixed(4),
      reason,
    }, 'Position fully closed');
  } else {
    const remainingAmount = pos.amount - soldAmount;
    const remainingCostBasis = pos.costBasis - soldCostBasis;
    const unrealizedPnl = (exitPrice - pos.entryPrice) * remainingAmount;
    const unrealizedPnlPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;

    await db
      .update(positionsTable)
      .set({
        status: 'open',
        amount: remainingAmount,
        costBasis: remainingCostBasis,
        currentPrice: exitPrice,
        unrealizedPnl,
        unrealizedPnlPct,
      })
      .where(eq(positionsTable.id, positionId));

    log.info({
      positionId,
      token: pos.tokenSymbol,
      soldPct: sellPct,
      remainingAmount,
      realizedPnl: realizedPnl.toFixed(4),
    }, 'Position partially closed');
  }

  return { realizedPnl, soldAmount };
}

export async function getUserPositions(userId: string): Promise<Position[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(positionsTable)
    .where(and(eq(positionsTable.userId, userId), eq(positionsTable.status, 'open')));

  return rows.map(rowToPosition);
}

export async function getPosition(positionId: string): Promise<Position | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.id, positionId))
    .limit(1);

  return row ? rowToPosition(row) : undefined;
}

export async function getAllOpenPositions(): Promise<Position[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(positionsTable)
    .where(eq(positionsTable.status, 'open'));

  return rows.map(rowToPosition);
}

export async function getUserClosedTrades(userId: string): Promise<Position[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(positionsTable)
    .where(and(eq(positionsTable.userId, userId), eq(positionsTable.status, 'closed')));

  return rows.map(rowToPosition);
}

export async function getUserStats(userId: string): Promise<{
  totalPnl: number;
  totalTrades: number;
  winCount: number;
  winRate: number;
  openPositions: number;
}> {
  const db = getDb();

  const [stats] = await db
    .select()
    .from(userStatsTable)
    .where(eq(userStatsTable.userId, userId))
    .limit(1);

  const [openCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(positionsTable)
    .where(and(eq(positionsTable.userId, userId), eq(positionsTable.status, 'open')));

  const s = stats ?? { totalPnl: 0, totalTrades: 0, winCount: 0 };

  return {
    totalPnl: s.totalPnl,
    totalTrades: s.totalTrades,
    winCount: s.winCount,
    winRate: s.totalTrades > 0 ? s.winCount / s.totalTrades : 0,
    openPositions: openCount?.count ?? 0,
  };
}

export async function closeAllPositions(userId: string, exitPrice: number, reason: string): Promise<void> {
  const userPositions = await getUserPositions(userId);
  for (const pos of userPositions) {
    await closePosition(pos.id, exitPrice, reason, 100);
  }
  log.info({ userId, count: userPositions.length, reason }, 'All positions closed');
}

export async function getOpenPositionCount(userId?: string): Promise<number> {
  const db = getDb();

  const condition = userId
    ? and(eq(positionsTable.userId, userId), eq(positionsTable.status, 'open'))
    : eq(positionsTable.status, 'open');

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(positionsTable)
    .where(condition);

  return result?.count ?? 0;
}
