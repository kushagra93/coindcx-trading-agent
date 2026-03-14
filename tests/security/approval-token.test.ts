import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateApprovalToken } from '../../src/security/approval-token.js';
import type { ApprovalToken, TradeApprovalRequest } from '../../src/security/types.js';
import { createHmac } from 'node:crypto';
import { SECURITY_DEFAULTS } from '../../src/security/types.js';

const MASTER_KEY = 'test-master-key-12345';

function makeToken(overrides: Partial<ApprovalToken> = {}): ApprovalToken {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30_000);

  const base = {
    tokenId: 'tok_test-123',
    tradeRequestId: 'req_456',
    agentId: 'agent-1',
    brokerId: 'broker-US',
    approvedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    maxAmountUsd: 1000,
    allowedAsset: 'SOL',
    allowedSide: 'buy' as const,
    allowedChain: 'solana' as any,
    used: false,
  };

  const merged = { ...base, ...overrides };

  const canonical = [
    merged.tokenId,
    merged.tradeRequestId,
    merged.agentId,
    merged.brokerId,
    merged.approvedAt,
    merged.expiresAt,
    merged.maxAmountUsd.toString(),
    merged.allowedAsset,
    merged.allowedSide,
    merged.allowedChain,
  ].join('|');

  const masterSignature = createHmac(SECURITY_DEFAULTS.MESSAGE_SIGN_ALGO, MASTER_KEY)
    .update(canonical)
    .digest('hex');

  return { ...merged, masterSignature };
}

describe('approval-token', () => {
  describe('validateApprovalToken', () => {
    it('validates a correct token', () => {
      const token = makeToken();
      const result = validateApprovalToken(token, MASTER_KEY);
      expect(result.valid).toBe(true);
    });

    it('rejects already used token', () => {
      const token = makeToken({ used: true });
      const result = validateApprovalToken(token, MASTER_KEY);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consumed');
    });

    it('rejects expired token', () => {
      const expired = new Date(Date.now() - 60_000).toISOString();
      const token = makeToken({ expiresAt: expired });
      const result = validateApprovalToken(token, MASTER_KEY);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('rejects wrong master key', () => {
      const token = makeToken();
      const result = validateApprovalToken(token, 'wrong-key');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('signature');
    });

    it('rejects tampered amount', () => {
      const token = makeToken();
      token.maxAmountUsd = 9999;
      const result = validateApprovalToken(token, MASTER_KEY);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('signature');
    });

    it('validates trade params — correct', () => {
      const token = makeToken();
      const result = validateApprovalToken(token, MASTER_KEY, {
        asset: 'SOL',
        side: 'buy',
        amountUsd: 500,
        chain: 'solana' as any,
      });
      expect(result.valid).toBe(true);
    });

    it('rejects asset mismatch', () => {
      const token = makeToken();
      const result = validateApprovalToken(token, MASTER_KEY, { asset: 'ETH' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Asset mismatch');
    });

    it('rejects side mismatch', () => {
      const token = makeToken();
      const result = validateApprovalToken(token, MASTER_KEY, { side: 'sell' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Side mismatch');
    });

    it('rejects amount exceeding max', () => {
      const token = makeToken();
      const result = validateApprovalToken(token, MASTER_KEY, { amountUsd: 5000 });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds max');
    });

    it('rejects chain mismatch', () => {
      const token = makeToken();
      const result = validateApprovalToken(token, MASTER_KEY, { chain: 'ethereum' as any });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Chain mismatch');
    });

    it('passes when partial trade params match', () => {
      const token = makeToken();
      const result = validateApprovalToken(token, MASTER_KEY, { asset: 'SOL' });
      expect(result.valid).toBe(true);
    });
  });
});
