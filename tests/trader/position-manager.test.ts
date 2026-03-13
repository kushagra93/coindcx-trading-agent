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
    chain[Symbol.asyncIterator] = async function* () { for (const v of finalValue) yield v; };
    chain.then = (resolve: any) => Promise.resolve(resolve(finalValue));
    return chain;
  }

  let chain = makeChain();

  return {
    db: new Proxy({}, {
      get: (_t, prop) => {
        if (prop === '_setResult') return (val: any[]) => { chain = makeChain(val); };
        return (...args: any[]) => chain;
      },
    }) as any,
    setResult: (val: any[]) => { chain = makeChain(val); },
    setSequentialResults: (results: any[][]) => {
      let callIdx = 0;
      const origSelect = chain.select;
      chain = makeChain(results[0]);
      const newSelect = vi.fn().mockImplementation((...args: any[]) => {
        const idx = callIdx++;
        const r = results[idx] ?? [];
        const c = makeChain(r);
        return c;
      });
      chain.select = newSelect;
    },
  };
}

let mockDbHolder = makeMockDb();

vi.mock('../../src/db/index.js', () => ({
  getDb: () => mockDbHolder.db,
}));

import {
  openPosition,
  getUserPositions,
  getPosition,
  getAllOpenPositions,
  getUserClosedTrades,
  getUserStats,
  getOpenPositionCount,
} from '../../src/trader/position-manager.js';

describe('position-manager', () => {
  beforeEach(() => {
    mockDbHolder = makeMockDb();
  });

  describe('openPosition', () => {
    it('creates a new position', async () => {
      mockDbHolder.setResult([]);
      const pos = await openPosition({
        userId: 'user-1',
        chain: 'solana' as any,
        token: 'SOL-MINT',
        tokenSymbol: 'SOL',
        entryPrice: 150.0,
        amount: 10,
        costBasis: 1500,
        strategyId: 'strat-1',
      });

      expect(pos.userId).toBe('user-1');
      expect(pos.tokenSymbol).toBe('SOL');
      expect(pos.entryPrice).toBe(150.0);
      expect(pos.status).toBe('open');
      expect(pos.unrealizedPnl).toBe(0);
    });
  });

  describe('getUserPositions', () => {
    it('returns open positions for user', async () => {
      const rows = [{
        id: 'p1', userId: 'user-1', chain: 'solana', token: 'SOL',
        tokenSymbol: 'SOL', entryPrice: 100, currentPrice: 110,
        amount: 5, costBasis: 500, unrealizedPnl: 50, unrealizedPnlPct: 10,
        highWaterMark: 110, status: 'open', strategyId: 's1',
        openedAt: new Date(), closedAt: null,
      }];
      mockDbHolder.setResult(rows);

      const positions = await getUserPositions('user-1');
      expect(positions).toHaveLength(1);
      expect(positions[0].tokenSymbol).toBe('SOL');
    });
  });

  describe('getPosition', () => {
    it('returns undefined for non-existent position', async () => {
      mockDbHolder.setResult([]);
      const result = await getPosition('unknown-id');
      expect(result).toBeUndefined();
    });

    it('returns position if found', async () => {
      const row = {
        id: 'p1', userId: 'u1', chain: 'ethereum', token: 'ETH',
        tokenSymbol: 'ETH', entryPrice: 3000, currentPrice: 3200,
        amount: 1, costBasis: 3000, unrealizedPnl: 200, unrealizedPnlPct: 6.67,
        highWaterMark: 3200, status: 'open', strategyId: 's1',
        openedAt: new Date(), closedAt: null,
      };
      mockDbHolder.setResult([row]);

      const result = await getPosition('p1');
      expect(result).toBeDefined();
      expect(result!.tokenSymbol).toBe('ETH');
    });
  });

  describe('getAllOpenPositions', () => {
    it('returns all open positions', async () => {
      const rows = [{
        id: 'p1', userId: 'u1', chain: 'solana', token: 'SOL',
        tokenSymbol: 'SOL', entryPrice: 100, currentPrice: 110,
        amount: 5, costBasis: 500, unrealizedPnl: 50, unrealizedPnlPct: 10,
        highWaterMark: 110, status: 'open', strategyId: 's1',
        openedAt: new Date(), closedAt: null,
      }];
      mockDbHolder.setResult(rows);

      const positions = await getAllOpenPositions();
      expect(positions).toHaveLength(1);
    });
  });

  describe('getUserClosedTrades', () => {
    it('returns closed positions for user', async () => {
      mockDbHolder.setResult([]);
      const result = await getUserClosedTrades('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('getOpenPositionCount', () => {
    it('returns count of open positions', async () => {
      mockDbHolder.setResult([{ count: 5 }]);
      const count = await getOpenPositionCount('user-1');
      expect(count).toBe(5);
    });

    it('returns 0 when no positions', async () => {
      mockDbHolder.setResult([{ count: 0 }]);
      const count = await getOpenPositionCount();
      expect(count).toBe(0);
    });
  });
});
