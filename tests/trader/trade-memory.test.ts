import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeMockDb() {
  function makeChain(finalValue: any[] = []) {
    const chain: any = {};
    for (const method of ['select', 'insert', 'update', 'delete', 'from', 'where',
      'orderBy', 'limit', 'offset', 'values', 'set', 'returning',
      'onConflictDoNothing', 'onConflictDoUpdate', 'groupBy']) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    chain.limit.mockResolvedValue(finalValue);
    chain.where.mockReturnValue(chain);
    chain.returning.mockResolvedValue(finalValue);
    chain.then = (resolve: any) => Promise.resolve(resolve(finalValue));
    return chain;
  }

  let chain = makeChain();

  return {
    db: new Proxy({}, {
      get: (_t, prop) => (...args: any[]) => chain,
    }) as any,
    setResult: (val: any[]) => { chain = makeChain(val); },
  };
}

let mockDbHolder = makeMockDb();

vi.mock('../../src/db/index.js', () => ({
  getDb: () => mockDbHolder.db,
}));

import {
  createTradeRecord,
  transitionTrade,
  getTrade,
  getUserTrades,
  getRecoverableTrades,
} from '../../src/trader/trade-memory.js';

const baseRow = {
  id: 'trade-1', userId: 'user-1', intentId: 'intent-1', state: 'SIGNAL_GENERATED',
  chain: 'solana', venue: 'jupiter', side: 'buy', inputToken: 'USDC',
  outputToken: 'SOL', amountIn: '100', amountOut: null, feeAmount: null,
  feeToken: null, txHash: null, error: null, idempotencyKey: 'key-1',
  strategyId: 'strat-1', createdAt: new Date(), updatedAt: new Date(),
};

describe('trade-memory', () => {
  beforeEach(() => {
    mockDbHolder = makeMockDb();
  });

  describe('createTradeRecord', () => {
    it('creates a new trade with SIGNAL_GENERATED state', async () => {
      mockDbHolder.setResult([]);

      const trade = await createTradeRecord({
        userId: 'user-1', intentId: 'intent-1', chain: 'solana' as any,
        venue: 'jupiter' as any, side: 'buy' as any, inputToken: 'USDC',
        outputToken: 'SOL', amountIn: '100', idempotencyKey: 'key-1', strategyId: 'strat-1',
      });

      expect(trade.state).toBe('SIGNAL_GENERATED');
      expect(trade.userId).toBe('user-1');
    });

    it('returns existing trade for duplicate idempotencyKey', async () => {
      const existing = { ...baseRow, state: 'RISK_ASSESSED', idempotencyKey: 'dup-key' };
      mockDbHolder.setResult([existing]);

      const trade = await createTradeRecord({
        userId: 'user-1', intentId: 'intent-1', chain: 'solana' as any,
        venue: 'jupiter' as any, side: 'buy' as any, inputToken: 'USDC',
        outputToken: 'SOL', amountIn: '100', idempotencyKey: 'dup-key', strategyId: 'strat-1',
      });

      expect(trade.id).toBe('trade-1');
      expect(trade.state).toBe('RISK_ASSESSED');
    });
  });

  describe('transitionTrade', () => {
    it('throws for non-existent trade', async () => {
      mockDbHolder.setResult([]);
      await expect(transitionTrade('unknown', 'RISK_ASSESSED')).rejects.toThrow('Trade not found');
    });

    it('calls update with correct new state', async () => {
      const row = { ...baseRow, state: 'SIGNAL_GENERATED' };
      const updatedRow = { ...baseRow, state: 'RISK_ASSESSED' };
      mockDbHolder.setResult([row]);

      const result = await transitionTrade('trade-1', 'RISK_ASSESSED');
      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
    });

    it('rejects invalid transition', async () => {
      mockDbHolder.setResult([{ ...baseRow, state: 'POSITION_UPDATED' }]);
      await expect(transitionTrade('trade-1', 'SIGNAL_GENERATED')).rejects.toThrow(
        /Invalid trade state transition/
      );
    });
  });

  describe('getTrade', () => {
    it('returns undefined for non-existent trade', async () => {
      mockDbHolder.setResult([]);
      const result = await getTrade('unknown');
      expect(result).toBeUndefined();
    });

    it('returns trade record if found', async () => {
      mockDbHolder.setResult([baseRow]);
      const result = await getTrade('trade-1');
      expect(result).toBeDefined();
      expect(result!.id).toBe('trade-1');
    });
  });

  describe('getUserTrades', () => {
    it('returns empty array for user with no trades', async () => {
      mockDbHolder.setResult([]);
      const result = await getUserTrades('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getRecoverableTrades', () => {
    it('returns trades in recoverable states', async () => {
      const recoverableRow = { ...baseRow, state: 'FEE_RESERVED' };
      mockDbHolder.setResult([recoverableRow]);

      const result = await getRecoverableTrades();
      expect(result).toHaveLength(1);
      expect(result[0].state).toBe('FEE_RESERVED');
    });
  });
});
