import { createChildLogger } from '../core/logger.js';
import type { Position, Chain } from '../core/types.js';
import { v4 as uuid } from 'uuid';

const log = createChildLogger('position-manager');

// In-memory position tracking (production: PostgreSQL)
const positions = new Map<string, Position>();
const closedPositions: Position[] = [];

// Aggregate stats per user
const userStats = new Map<string, {
  totalPnl: number;
  totalTrades: number;
  winCount: number;
}>();

/**
 * Open a new position.
 */
export function openPosition(params: {
  userId: string;
  chain: Chain;
  token: string;
  tokenSymbol: string;
  entryPrice: number;
  amount: number;
  costBasis: number;
  strategyId: string;
}): Position {
  const positionId = uuid();

  const position: Position = {
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

  positions.set(positionId, position);
  log.info({
    positionId,
    userId: params.userId,
    token: params.tokenSymbol,
    entryPrice: params.entryPrice,
    amount: params.amount,
  }, 'Position opened');

  return position;
}

/**
 * Update price for a position.
 */
export function updatePositionPrice(positionId: string, currentPrice: number): void {
  const pos = positions.get(positionId);
  if (!pos || pos.status !== 'open') return;

  pos.currentPrice = currentPrice;
  pos.unrealizedPnl = (currentPrice - pos.entryPrice) * pos.amount;
  pos.unrealizedPnlPct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

  if (currentPrice > pos.highWaterMark) {
    pos.highWaterMark = currentPrice;
  }
}

/**
 * Close a position (full or partial).
 */
export function closePosition(
  positionId: string,
  exitPrice: number,
  reason: string,
  sellPct: number = 100
): { realizedPnl: number; soldAmount: number } | null {
  const pos = positions.get(positionId);
  if (!pos || pos.status === 'closed') {
    log.warn({ positionId }, 'Position not found or already closed');
    return null;
  }

  pos.status = 'closing';
  const sellFraction = sellPct / 100;
  const soldAmount = pos.amount * sellFraction;
  const soldCostBasis = pos.costBasis * sellFraction;
  const proceeds = soldAmount * exitPrice;
  const realizedPnl = proceeds - soldCostBasis;

  if (sellPct >= 100) {
    // Full close
    pos.status = 'closed';
    pos.closedAt = new Date();
    pos.currentPrice = exitPrice;
    pos.unrealizedPnl = 0;
    pos.unrealizedPnlPct = 0;

    positions.delete(positionId);
    closedPositions.push({ ...pos });

    // Update user stats
    const stats = userStats.get(pos.userId) ?? { totalPnl: 0, totalTrades: 0, winCount: 0 };
    stats.totalPnl += realizedPnl;
    stats.totalTrades++;
    if (realizedPnl > 0) stats.winCount++;
    userStats.set(pos.userId, stats);

    log.info({
      positionId,
      token: pos.tokenSymbol,
      realizedPnl: realizedPnl.toFixed(4),
      reason,
    }, 'Position fully closed');
  } else {
    // Partial close
    pos.status = 'open';
    pos.amount -= soldAmount;
    pos.costBasis -= soldCostBasis;
    pos.currentPrice = exitPrice;
    pos.unrealizedPnl = (exitPrice - pos.entryPrice) * pos.amount;
    pos.unrealizedPnlPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;

    log.info({
      positionId,
      token: pos.tokenSymbol,
      soldPct: sellPct,
      remainingAmount: pos.amount,
      realizedPnl: realizedPnl.toFixed(4),
    }, 'Position partially closed');
  }

  return { realizedPnl, soldAmount };
}

/**
 * Get all open positions for a user.
 */
export function getUserPositions(userId: string): Position[] {
  return Array.from(positions.values()).filter(p => p.userId === userId);
}

/**
 * Get a specific position.
 */
export function getPosition(positionId: string): Position | undefined {
  return positions.get(positionId);
}

/**
 * Get all open positions.
 */
export function getAllOpenPositions(): Position[] {
  return Array.from(positions.values());
}

/**
 * Get closed trades for a user.
 */
export function getUserClosedTrades(userId: string): Position[] {
  return closedPositions.filter(p => p.userId === userId);
}

/**
 * Get user stats.
 */
export function getUserStats(userId: string): {
  totalPnl: number;
  totalTrades: number;
  winCount: number;
  winRate: number;
  openPositions: number;
} {
  const stats = userStats.get(userId) ?? { totalPnl: 0, totalTrades: 0, winCount: 0 };
  const openCount = Array.from(positions.values()).filter(p => p.userId === userId).length;

  return {
    ...stats,
    winRate: stats.totalTrades > 0 ? stats.winCount / stats.totalTrades : 0,
    openPositions: openCount,
  };
}

/**
 * Close all positions for a user (emergency stop).
 */
export function closeAllPositions(userId: string, exitPrice: number, reason: string): void {
  const userPositions = getUserPositions(userId);
  for (const pos of userPositions) {
    closePosition(pos.id, exitPrice, reason, 100);
  }
  log.info({ userId, count: userPositions.length, reason }, 'All positions closed');
}

/**
 * Get open position count.
 */
export function getOpenPositionCount(userId?: string): number {
  if (userId) {
    return Array.from(positions.values()).filter(p => p.userId === userId).length;
  }
  return positions.size;
}
