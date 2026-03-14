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
  audit,
  getAuditLog,
  getAuditTrail,
  getChainHead,
  verifyAuditChain,
} from '../../src/audit/audit-logger.js';

describe('audit-logger', () => {
  beforeEach(() => {
    mockDbHolder = makeMockDb();
  });

  describe('audit', () => {
    it('creates an audit entry with hash chain', async () => {
      mockDbHolder.setResult([{
        id: 'audit-test',
        sequence: 1,
        timestamp: new Date().toISOString(),
        actor: 'admin',
        actorTier: 'admin',
        action: 'test-action',
        resource: 'resource-1',
        details: {},
        success: true,
        error: null,
        previousHash: '0'.repeat(64),
        entryHash: 'abc123',
        corrId: null,
      }]);

      const entry = await audit({
        actor: 'admin',
        actorTier: 'admin',
        action: 'test-action',
        resource: 'resource-1',
      });

      expect(entry).toBeDefined();
      expect(entry.actor).toBe('admin');
      expect(entry.action).toBe('test-action');
      expect(entry.entryHash).toBeDefined();
    });

    it('records error entries', async () => {
      mockDbHolder.setResult([{
        id: 'audit-err',
        sequence: 2,
        timestamp: new Date().toISOString(),
        actor: 'system',
        actorTier: 'system',
        action: 'trade-failed',
        resource: 'trade-1',
        details: {},
        success: false,
        error: 'Insufficient balance',
        previousHash: '0'.repeat(64),
        entryHash: 'def456',
        corrId: 'corr-1',
      }]);

      const entry = await audit({
        actor: 'system',
        actorTier: 'system',
        action: 'trade-failed',
        resource: 'trade-1',
        success: false,
        error: 'Insufficient balance',
        corr_id: 'corr-1',
      });

      expect(entry.success).toBe(false);
    });
  });

  describe('getAuditLog', () => {
    it('returns audit entries', async () => {
      const rows = [{
        id: 'a1', sequence: 1, timestamp: '2026-01-01T00:00:00Z',
        actor: 'admin', actorTier: 'admin', action: 'halt',
        resource: 'system', details: {}, success: true, error: null,
        previousHash: '0'.repeat(64), entryHash: 'hash1', corrId: null,
      }];

      mockDbHolder.setResult(rows);
      const result = await getAuditLog(10);
      expect(result).toHaveLength(1);
      expect(result[0].actor).toBe('admin');
    });

    it('returns filtered entries', async () => {
      mockDbHolder.setResult([]);
      const result = await getAuditLog(10, { actor: 'admin', action: 'halt' });
      expect(result).toEqual([]);
    });
  });

  describe('getChainHead', () => {
    it('returns zero hash when no entries', async () => {
      mockDbHolder.setResult([]);
      const head = await getChainHead();
      expect(head.hash).toBe('0'.repeat(64));
      expect(head.sequence).toBe(0);
    });

    it('returns last entry hash and sequence', async () => {
      mockDbHolder.setResult([{ entryHash: 'latest-hash', sequence: 42 }]);
      const head = await getChainHead();
      expect(head.hash).toBe('latest-hash');
      expect(head.sequence).toBe(42);
    });
  });

  describe('verifyAuditChain', () => {
    it('returns valid for empty chain', async () => {
      mockDbHolder.setResult([{ count: 0 }]);
      const result = await verifyAuditChain();
      expect(result.valid).toBe(true);
      expect(result.totalEntries).toBe(0);
    });
  });

  describe('getAuditTrail', () => {
    it('queries by correlation ID', async () => {
      const rows = [{
        id: 'a1', sequence: 1, timestamp: '2026-01-01',
        actor: 'agent-1', actorTier: 'user', action: 'trade',
        resource: 'trade-1', details: {}, success: true, error: null,
        previousHash: '0'.repeat(64), entryHash: 'hash1', corrId: 'corr-abc',
      }];

      mockDbHolder.setResult(rows);
      const trail = await getAuditTrail('corr-abc');
      expect(trail).toHaveLength(1);
    });
  });
});
