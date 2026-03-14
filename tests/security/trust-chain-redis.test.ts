import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = {
  hmset: vi.fn().mockResolvedValue('OK'),
  hgetall: vi.fn().mockResolvedValue({}),
  hset: vi.fn().mockResolvedValue(1),
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue(null),
  sismember: vi.fn().mockResolvedValue(0),
  sadd: vi.fn().mockResolvedValue(1),
  pipeline: vi.fn().mockReturnValue({
    sadd: vi.fn().mockReturnThis(),
    hset: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }),
};

import {
  createRootCertificate,
  createCertificate,
  storeCertificate,
  getCertificate,
  storeAgentKey,
  getAgentKey,
  revokeCertificate,
  isCertificateRevoked,
  verifyCertificateChain,
} from '../../src/security/trust-chain.js';

describe('trust-chain (Redis)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeCertificate', () => {
    it('stores cert fields in Redis hash', async () => {
      const { certificate } = createRootCertificate('master-agent');
      await storeCertificate(certificate, mockRedis as any);
      expect(mockRedis.hmset).toHaveBeenCalled();
      const call = mockRedis.hmset.mock.calls[0];
      expect(call[0]).toBe('security:cert:master-agent');
      expect(call[1].agentId).toBe('master-agent');
    });
  });

  describe('getCertificate', () => {
    it('returns null when cert not found', async () => {
      mockRedis.hgetall.mockResolvedValue({});
      const cert = await getCertificate('unknown', mockRedis as any);
      expect(cert).toBeNull();
    });

    it('returns parsed certificate when found', async () => {
      mockRedis.hgetall.mockResolvedValue({
        agentId: 'broker-US', tier: 'broker', publicKey: 'pk',
        issuedBy: 'master-agent', issuedAt: '2026-01-01', expiresAt: '2026-12-31',
        jurisdiction: 'US', signature: 'sig', revoked: '0',
      });

      const cert = await getCertificate('broker-US', mockRedis as any);
      expect(cert).toBeDefined();
      expect(cert!.agentId).toBe('broker-US');
      expect(cert!.revoked).toBe(false);
    });
  });

  describe('storeAgentKey / getAgentKey', () => {
    it('stores encrypted key', async () => {
      await storeAgentKey('agent-1', 'encrypted-key', mockRedis as any);
      expect(mockRedis.set).toHaveBeenCalledWith('security:keys:agent-1', 'encrypted-key');
    });

    it('retrieves encrypted key', async () => {
      mockRedis.get.mockResolvedValue('encrypted-key');
      const key = await getAgentKey('agent-1', mockRedis as any);
      expect(key).toBe('encrypted-key');
    });
  });

  describe('revokeCertificate / isCertificateRevoked', () => {
    it('revokes a certificate', async () => {
      await revokeCertificate('agent-bad', mockRedis as any);
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('checks revocation status — not revoked', async () => {
      mockRedis.sismember.mockResolvedValue(0);
      const revoked = await isCertificateRevoked('agent-1', mockRedis as any);
      expect(revoked).toBe(false);
    });

    it('checks revocation status — revoked', async () => {
      mockRedis.sismember.mockResolvedValue(1);
      const revoked = await isCertificateRevoked('agent-bad', mockRedis as any);
      expect(revoked).toBe(true);
    });
  });

  describe('verifyCertificateChain', () => {
    it('validates self-signed root in trusted roots', async () => {
      mockRedis.sismember.mockResolvedValue(0);
      const { certificate } = createRootCertificate('master-agent');

      const result = await verifyCertificateChain(certificate, [certificate], mockRedis as any);
      expect(result.valid).toBe(true);
    });

    it('rejects expired certificate', async () => {
      const { certificate } = createRootCertificate('master-agent', 0);
      certificate.expiresAt = new Date(Date.now() - 86400000).toISOString();

      const result = await verifyCertificateChain(certificate, [certificate], mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('rejects revoked certificate', async () => {
      mockRedis.sismember.mockResolvedValue(1);
      const { certificate } = createRootCertificate('master-agent');

      const result = await verifyCertificateChain(certificate, [certificate], mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('revoked');
    });

    it('rejects self-signed cert not in trusted roots', async () => {
      mockRedis.sismember.mockResolvedValue(0);
      const { certificate } = createRootCertificate('unknown-root');

      const result = await verifyCertificateChain(certificate, [], mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not in trusted roots');
    });

    it('rejects cert with missing issuer', async () => {
      mockRedis.sismember.mockResolvedValue(0);
      mockRedis.hgetall.mockResolvedValue({});

      const root = createRootCertificate('master-agent');
      const { certificate } = createCertificate('broker-US', 'broker', 'master-agent', root.keyPair.privateKey, 'US');

      const result = await verifyCertificateChain(certificate, [root.certificate], mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
});
