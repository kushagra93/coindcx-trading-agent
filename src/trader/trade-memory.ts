import { eq, desc, inArray } from 'drizzle-orm';
import { createChildLogger } from '../core/logger.js';
import type { TradeRecord, TradeState } from '../core/types.js';
import { assertTransition, getRecoverableStates } from '../core/state-machine.js';
import { getDb } from '../db/index.js';
import { trades as tradesTable } from '../db/schema.js';
import { v4 as uuid } from 'uuid';

const log = createChildLogger('trade-memory');

function rowToTradeRecord(row: typeof tradesTable.$inferSelect): TradeRecord {
  return {
    id: row.id,
    userId: row.userId,
    intentId: row.intentId,
    state: row.state as TradeState,
    chain: row.chain as TradeRecord['chain'],
    venue: row.venue as TradeRecord['venue'],
    side: row.side as TradeRecord['side'],
    inputToken: row.inputToken,
    outputToken: row.outputToken,
    amountIn: row.amountIn,
    amountOut: row.amountOut ?? undefined,
    feeAmount: row.feeAmount ?? undefined,
    feeToken: row.feeToken ?? undefined,
    txHash: row.txHash ?? undefined,
    error: row.error ?? undefined,
    idempotencyKey: row.idempotencyKey,
    strategyId: row.strategyId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function createTradeRecord(
  params: Omit<TradeRecord, 'id' | 'state' | 'createdAt' | 'updatedAt'>
): Promise<TradeRecord> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.idempotencyKey, params.idempotencyKey))
    .limit(1);

  if (existing) {
    log.info({ idempotencyKey: params.idempotencyKey, tradeId: existing.id }, 'Duplicate trade detected, returning existing');
    return rowToTradeRecord(existing);
  }

  const now = new Date();
  const trade: typeof tradesTable.$inferInsert = {
    id: uuid(),
    userId: params.userId,
    intentId: params.intentId,
    state: 'SIGNAL_GENERATED',
    chain: params.chain,
    venue: params.venue,
    side: params.side,
    inputToken: params.inputToken,
    outputToken: params.outputToken,
    amountIn: params.amountIn,
    amountOut: params.amountOut ?? null,
    feeAmount: params.feeAmount ?? null,
    feeToken: params.feeToken ?? null,
    txHash: params.txHash ?? null,
    error: params.error ?? null,
    idempotencyKey: params.idempotencyKey,
    strategyId: params.strategyId,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(tradesTable).values(trade);

  log.info({ tradeId: trade.id, userId: trade.userId, chain: trade.chain }, 'Trade record created');

  return {
    ...params,
    id: trade.id!,
    state: 'SIGNAL_GENERATED',
    createdAt: now,
    updatedAt: now,
  };
}

export async function transitionTrade(
  tradeId: string,
  newState: TradeState,
  updates?: Partial<TradeRecord>
): Promise<TradeRecord> {
  const db = getDb();

  const [row] = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.id, tradeId))
    .limit(1);

  if (!row) {
    throw new Error(`Trade not found: ${tradeId}`);
  }

  const fromState = row.state as TradeState;
  assertTransition(fromState, newState, tradeId);

  const updateFields: Partial<typeof tradesTable.$inferInsert> = {
    state: newState,
    updatedAt: new Date(),
  };

  if (updates) {
    if (updates.amountOut !== undefined) updateFields.amountOut = updates.amountOut;
    if (updates.feeAmount !== undefined) updateFields.feeAmount = updates.feeAmount;
    if (updates.feeToken !== undefined) updateFields.feeToken = updates.feeToken;
    if (updates.txHash !== undefined) updateFields.txHash = updates.txHash;
    if (updates.error !== undefined) updateFields.error = updates.error;
  }

  const [updated] = await db
    .update(tradesTable)
    .set(updateFields)
    .where(eq(tradesTable.id, tradeId))
    .returning();

  log.info({ tradeId, from: fromState, to: newState }, 'Trade state transition');

  return rowToTradeRecord(updated);
}

export async function getTrade(tradeId: string): Promise<TradeRecord | undefined> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.id, tradeId))
    .limit(1);

  return row ? rowToTradeRecord(row) : undefined;
}

export async function getUserTrades(userId: string, limit: number = 50): Promise<TradeRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(tradesTable)
    .where(eq(tradesTable.userId, userId))
    .orderBy(desc(tradesTable.createdAt))
    .limit(limit);

  return rows.map(rowToTradeRecord);
}

export async function getRecoverableTrades(): Promise<TradeRecord[]> {
  const db = getDb();
  const recoverableStates = getRecoverableStates();

  const rows = await db
    .select()
    .from(tradesTable)
    .where(inArray(tradesTable.state, recoverableStates));

  return rows.map(rowToTradeRecord);
}

export async function recoverTrades(
  reconcile: (trade: TradeRecord) => Promise<TradeState>
): Promise<number> {
  const stuckTrades = await getRecoverableTrades();

  if (stuckTrades.length === 0) {
    log.info('No trades to recover');
    return 0;
  }

  log.info({ count: stuckTrades.length }, 'Recovering stuck trades');

  let recovered = 0;
  for (const trade of stuckTrades) {
    try {
      const resolvedState = await reconcile(trade);
      if (resolvedState !== trade.state) {
        await transitionTrade(trade.id, resolvedState);
        recovered++;
        log.info({ tradeId: trade.id, resolvedTo: resolvedState }, 'Trade recovered');
      }
    } catch (err) {
      log.error({ err, tradeId: trade.id }, 'Failed to recover trade');
    }
  }

  return recovered;
}
