import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  exists: vi.fn().mockResolvedValue(0),
  ttl: vi.fn().mockResolvedValue(30),
  sismember: vi.fn().mockResolvedValue(0),
};

import {
  issueApprovalToken,
  consumeApprovalToken,
  getApprovalToken,
  isTokenConsumed,
  validateAndConsumeToken,
} from '../../src/security/approval-token.js';

const MASTER_KEY = 'test-master-key-12345';

const mockRequest = {
  requestId: 'req-1',
  agentId: 'agent-1',
  userId: 'user-1',
  brokerId: 'broker-US',
  asset: 'SOL',
  side: 'buy' as const,
  amountUsd: 1000,
  chain: 'solana' as any,
  strategyId: 'strat-1',
  riskScore: 0.2,
  complianceResult: { passed: true, brokerId: 'broker-US', checkedAt: new Date().toISOString() },
  corr_id: 'corr-1',
};

describe('approval-token (Redis)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('issueApprovalToken', () => {
    it('issues token and stores in Redis', async () => {
      const token = await issueApprovalToken(MASTER_KEY, mockRequest, mockRedis as any);

      expect(token.tokenId).toMatch(/^tok_/);
      expect(token.agentId).toBe('agent-1');
      expect(token.maxAmountUsd).toBe(1000);
      expect(token.allowedAsset).toBe('SOL');
      expect(token.allowedSide).toBe('buy');
      expect(token.used).toBe(false);
      expect(token.masterSignature).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('custom validity affects expiry', async () => {
      const token = await issueApprovalToken(MASTER_KEY, mockRequest, mockRedis as any, 60);
      const approvedAt = new Date(token.approvedAt).getTime();
      const expiresAt = new Date(token.expiresAt).getTime();
      expect(expiresAt - approvedAt).toBe(60_000);
    });
  });

  describe('getApprovalToken', () => {
    it('returns null when token not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await getApprovalToken('tok_unknown', mockRedis as any);
      expect(result).toBeNull();
    });

    it('returns parsed token when found', async () => {
      const token = await issueApprovalToken(MASTER_KEY, mockRequest, mockRedis as any);
      mockRedis.get.mockResolvedValue(JSON.stringify(token));

      const result = await getApprovalToken(token.tokenId, mockRedis as any);
      expect(result).toBeDefined();
      expect(result!.tokenId).toBe(token.tokenId);
    });

    it('returns null for invalid JSON', async () => {
      mockRedis.get.mockResolvedValue('not-json');
      const result = await getApprovalToken('tok_bad', mockRedis as any);
      expect(result).toBeNull();
    });
  });

  describe('consumeApprovalToken', () => {
    it('consumes token successfully', async () => {
      const token = await issueApprovalToken(MASTER_KEY, mockRequest, mockRedis as any);
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get.mockResolvedValue(JSON.stringify(token));
      mockRedis.ttl.mockResolvedValue(25);

      const result = await consumeApprovalToken(token.tokenId, mockRedis as any);
      expect(result.consumed).toBe(true);
    });

    it('rejects double consumption', async () => {
      mockRedis.set.mockResolvedValue(null);
      const result = await consumeApprovalToken('tok_123', mockRedis as any);
      expect(result.consumed).toBe(false);
      expect(result.error).toContain('already consumed');
    });
  });

  describe('isTokenConsumed', () => {
    it('returns false when not consumed', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const result = await isTokenConsumed('tok_123', mockRedis as any);
      expect(result).toBe(false);
    });

    it('returns true when consumed', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const result = await isTokenConsumed('tok_123', mockRedis as any);
      expect(result).toBe(true);
    });
  });

  describe('validateAndConsumeToken', () => {
    it('returns error for non-existent token', async () => {
      mockRedis.get.mockResolvedValue(null);
      const result = await validateAndConsumeToken('tok_unknown', MASTER_KEY, mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('validates, consumes, and returns token', async () => {
      const token = await issueApprovalToken(MASTER_KEY, mockRequest, mockRedis as any);
      mockRedis.get.mockResolvedValue(JSON.stringify(token));
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.ttl.mockResolvedValue(25);

      const result = await validateAndConsumeToken(token.tokenId, MASTER_KEY, mockRedis as any);
      expect(result.valid).toBe(true);
      expect(result.token).toBeDefined();
      expect(result.token!.tokenId).toBe(token.tokenId);
    });

    it('validates trade params', async () => {
      const token = await issueApprovalToken(MASTER_KEY, mockRequest, mockRedis as any);
      mockRedis.get.mockResolvedValue(JSON.stringify(token));
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.ttl.mockResolvedValue(25);

      const result = await validateAndConsumeToken(
        token.tokenId, MASTER_KEY, mockRedis as any,
        { asset: 'SOL', side: 'buy', amountUsd: 500 }
      );
      expect(result.valid).toBe(true);
    });

    it('rejects mismatched trade params', async () => {
      const token = await issueApprovalToken(MASTER_KEY, mockRequest, mockRedis as any);
      mockRedis.get.mockResolvedValue(JSON.stringify(token));

      const result = await validateAndConsumeToken(
        token.tokenId, MASTER_KEY, mockRedis as any,
        { asset: 'ETH' }
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Asset mismatch');
    });
  });
});
