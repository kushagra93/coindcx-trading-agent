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

vi.mock('../../src/audit/audit-logger.js', () => ({
  audit: vi.fn().mockResolvedValue({}),
}));

import {
  recordFee,
  getFeeSummary,
  reconcileFees,
  getFeeEntries,
  generateRegulatoryReport,
} from '../../src/supervisor/fee-ledger.js';

describe('fee-ledger', () => {
  beforeEach(() => {
    mockDbHolder = makeMockDb();
  });

  describe('recordFee', () => {
    it('inserts fee entry and returns it', async () => {
      mockDbHolder.setResult([{
        id: 'fee_test-123', sequence: 1, timestamp: '2026-01-01T00:00:00Z',
        type: 'trade-fee', userId: 'user-1', agentId: 'agent-1',
        brokerId: 'broker-US', tradeId: 'trade-1', amountUsd: 1.5,
        amountToken: '0.001', feeToken: 'SOL', chain: 'solana',
        feeRate: 0.0015, corrId: 'corr-1', metadata: null,
      }]);

      const entry = await recordFee({
        type: 'trade-fee', userId: 'user-1', agentId: 'agent-1',
        brokerId: 'broker-US', tradeId: 'trade-1', amountUsd: 1.5,
        amountToken: '0.001', feeToken: 'SOL', chain: 'solana',
        feeRate: 0.0015, corr_id: 'corr-1',
      });

      expect(entry.type).toBe('trade-fee');
      expect(entry.amountUsd).toBe(1.5);
      expect(entry.userId).toBe('user-1');
    });
  });

  describe('getFeeSummary', () => {
    it('returns summary from rows', async () => {
      mockDbHolder.setResult([
        { amountUsd: 1.0, type: 'trade-fee', brokerId: 'broker-US', chain: 'solana' },
        { amountUsd: 2.5, type: 'trade-fee', brokerId: 'broker-US', chain: 'ethereum' },
        { amountUsd: 0.5, type: 'builder-fee', brokerId: 'broker-EU', chain: 'solana' },
      ]);

      const summary = await getFeeSummary('2026-01-01', '2026-12-31');
      expect(summary.totalFeesUsd).toBe(4.0);
      expect(summary.totalEntries).toBe(3);
      expect(summary.byType['trade-fee']).toBe(3.5);
      expect(summary.byType['builder-fee']).toBe(0.5);
      expect(summary.byBroker['broker-US']).toBe(3.5);
    });

    it('returns empty summary for no data', async () => {
      mockDbHolder.setResult([]);
      const summary = await getFeeSummary();
      expect(summary.totalFeesUsd).toBe(0);
      expect(summary.totalEntries).toBe(0);
    });
  });

  describe('reconcileFees', () => {
    it('returns broker reconciliation', async () => {
      mockDbHolder.setResult([{
        id: 'f1', sequence: 1, timestamp: '2026-01-01', type: 'trade-fee',
        userId: 'u1', agentId: 'a1', brokerId: 'broker-US', tradeId: 't1',
        amountUsd: 2.0, amountToken: '0.01', feeToken: 'SOL', chain: 'solana',
        feeRate: 0.002, corrId: 'c1', metadata: null,
      }]);

      const result = await reconcileFees('broker-US');
      expect(result.brokerId).toBe('broker-US');
      expect(result.totalFeesUsd).toBe(2.0);
      expect(result.entryCount).toBe(1);
    });
  });

  describe('getFeeEntries', () => {
    it('returns fee entries', async () => {
      mockDbHolder.setResult([{
        id: 'f1', sequence: 1, timestamp: '2026-01-01', type: 'trade-fee',
        userId: 'u1', agentId: 'a1', brokerId: 'b1', tradeId: 't1',
        amountUsd: 1.0, amountToken: '0.01', feeToken: 'SOL', chain: 'solana',
        feeRate: 0.002, corrId: 'c1', metadata: null,
      }]);

      const entries = await getFeeEntries({ userId: 'u1' });
      expect(entries).toHaveLength(1);
    });
  });

  describe('generateRegulatoryReport', () => {
    it('generates per-broker report', async () => {
      mockDbHolder.setResult([
        { amountUsd: 10, type: 'trade-fee', brokerId: 'broker-US' },
        { amountUsd: 5, type: 'builder-fee', brokerId: 'broker-US' },
        { amountUsd: 8, type: 'trade-fee', brokerId: 'broker-EU' },
      ]);

      const report = await generateRegulatoryReport('2026-01-01', '2026-12-31');
      expect(report.totalFeesUsd).toBe(23);
      expect(report.totalTransactions).toBe(3);
      expect(report.byBroker['broker-US'].totalFeesUsd).toBe(15);
      expect(report.byBroker['broker-EU'].totalFeesUsd).toBe(8);
    });

    it('handles empty period', async () => {
      mockDbHolder.setResult([]);
      const report = await generateRegulatoryReport('2026-01-01', '2026-01-02');
      expect(report.totalFeesUsd).toBe(0);
      expect(report.totalTransactions).toBe(0);
    });
  });
});
