import { LRUCache } from 'lru-cache';
import { createChildLogger } from '../core/logger.js';
import type { TradeRecord, TradeState } from '../core/types.js';
import { assertTransition, getRecoverableStates } from '../core/state-machine.js';
import { v4 as uuid } from 'uuid';

const log = createChildLogger('trade-memory');

// In-memory trade store (production: PostgreSQL with WAL)
const trades = new Map<string, TradeRecord>();

// LRU cache for idempotency keys to prevent unbounded growth
const idempotencyIndex = new LRUCache<string, string>({
  max: 50_000,
  ttl: 24 * 60 * 60 * 1000, // 24 hour TTL
});

/**
 * Create a new trade record.
 */
export function createTradeRecord(params: Omit<TradeRecord, 'id' | 'state' | 'createdAt' | 'updatedAt'>): TradeRecord {
  // Check idempotency
  const existing = idempotencyIndex.get(params.idempotencyKey);
  if (existing) {
    const existingTrade = trades.get(existing);
    if (existingTrade) {
      log.info({ idempotencyKey: params.idempotencyKey, tradeId: existing }, 'Duplicate trade detected, returning existing');
      return existingTrade;
    }
  }

  const trade: TradeRecord = {
    ...params,
    id: uuid(),
    state: 'SIGNAL_GENERATED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  trades.set(trade.id, trade);
  idempotencyIndex.set(params.idempotencyKey, trade.id);

  log.info({ tradeId: trade.id, userId: trade.userId, chain: trade.chain }, 'Trade record created');

  return trade;
}

/**
 * Transition a trade to a new state (WAL pattern).
 * Validates the transition and persists the change.
 */
export function transitionTrade(tradeId: string, newState: TradeState, updates?: Partial<TradeRecord>): TradeRecord {
  const trade = trades.get(tradeId);
  if (!trade) {
    throw new Error(`Trade not found: ${tradeId}`);
  }

  // Capture old state BEFORE mutation for logging
  const fromState = trade.state;

  // Validate state transition
  assertTransition(fromState, newState, tradeId);

  trade.state = newState;
  trade.updatedAt = new Date();

  if (updates) {
    // Filter out protected fields — state, id, userId, idempotencyKey cannot be overwritten
    const { state: _s, id: _i, userId: _u, idempotencyKey: _k, ...safeUpdates } = updates;
    Object.assign(trade, safeUpdates);
  }

  log.info({ tradeId, from: fromState, to: newState }, 'Trade state transition');

  return trade;
}

/**
 * Get a trade by ID.
 */
export function getTrade(tradeId: string): TradeRecord | undefined {
  return trades.get(tradeId);
}

/**
 * Get trades by user ID.
 */
export function getUserTrades(userId: string, limit: number = 50): TradeRecord[] {
  return Array.from(trades.values())
    .filter(t => t.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Get trades in non-terminal states (for crash recovery).
 */
export function getRecoverableTrades(): TradeRecord[] {
  const recoverableStates = new Set(getRecoverableStates());
  return Array.from(trades.values()).filter(t => recoverableStates.has(t.state));
}

/**
 * Recover a stuck trade by checking on-chain status.
 */
export async function recoverTrades(
  reconcile: (trade: TradeRecord) => Promise<TradeState>
): Promise<number> {
  const stuckTrades = getRecoverableTrades();

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
        transitionTrade(trade.id, resolvedState);
        recovered++;
        log.info({ tradeId: trade.id, resolvedTo: resolvedState }, 'Trade recovered');
      }
    } catch (err) {
      log.error({ err, tradeId: trade.id }, 'Failed to recover trade');
    }
  }

  return recovered;
}
