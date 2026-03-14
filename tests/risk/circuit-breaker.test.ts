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
    chain.onConflictDoNothing.mockResolvedValue(undefined);
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

vi.mock('../../src/core/config.js', () => ({
  config: {
    risk: {
      circuitBreakerLossPct: 10,
      circuitBreakerWindowHours: 1,
    },
    logLevel: 'info',
    nodeEnv: 'test',
  },
}));

vi.mock('../../src/core/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  recordLoss,
  isTradingAllowed,
  resetBreaker,
  emergencyHalt,
  resumeTrading,
  isGlobalHalt,
  getTrippedUsers,
} from '../../src/risk/circuit-breaker.js';

describe('circuit-breaker', () => {
  beforeEach(() => {
    mockDbHolder = makeMockDb();
  });

  describe('recordLoss', () => {
    it('does nothing for non-negative loss', async () => {
      await recordLoss('user-1', 0);
      await recordLoss('user-1', 10);
    });

    it('inserts loss record for negative value', async () => {
      mockDbHolder.setResult([]);
      await recordLoss('user-1', -50);
    });
  });

  describe('isGlobalHalt', () => {
    it('returns false when no halt row', async () => {
      mockDbHolder.setResult([]);
      const result = await isGlobalHalt();
      expect(result).toBe(false);
    });

    it('returns true when halt row exists', async () => {
      mockDbHolder.setResult([{ value: 'true' }]);
      const result = await isGlobalHalt();
      expect(result).toBe(true);
    });
  });

  describe('emergencyHalt', () => {
    it('inserts global halt setting', async () => {
      mockDbHolder.setResult([]);
      await emergencyHalt();
    });
  });

  describe('resumeTrading', () => {
    it('deletes global halt setting', async () => {
      mockDbHolder.setResult([]);
      await resumeTrading();
    });
  });

  describe('isTradingAllowed', () => {
    it('returns true when no halt and no trip', async () => {
      mockDbHolder.setResult([]);
      const result = await isTradingAllowed('user-1');
      expect(result).toBe(true);
    });

    it('returns false during global halt', async () => {
      mockDbHolder.setResult([{ value: 'true' }]);
      const result = await isTradingAllowed('user-1');
      expect(result).toBe(false);
    });
  });

  describe('getTrippedUsers', () => {
    it('returns empty array when no trips', async () => {
      mockDbHolder.setResult([]);
      const users = await getTrippedUsers();
      expect(users).toEqual([]);
    });

    it('returns user IDs from trips table', async () => {
      mockDbHolder.setResult([{ userId: 'user-1' }, { userId: 'user-2' }]);
      const users = await getTrippedUsers();
      expect(users).toEqual(['user-1', 'user-2']);
    });
  });

  describe('resetBreaker', () => {
    it('deletes trip record for user', async () => {
      mockDbHolder.setResult([]);
      await resetBreaker('user-1');
    });
  });
});
