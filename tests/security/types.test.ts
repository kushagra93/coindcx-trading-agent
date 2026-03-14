import { describe, it, expect } from 'vitest';
import { SECURITY_REDIS_KEYS, SECURITY_DEFAULTS } from '../../src/security/types.js';

describe('security types', () => {
  describe('SECURITY_REDIS_KEYS', () => {
    it('generates correct nonce key', () => {
      expect(SECURITY_REDIS_KEYS.usedNonces).toBe('security:nonces:used');
    });

    it('generates correct agent cert key', () => {
      expect(SECURITY_REDIS_KEYS.agentCert('agent-1')).toBe('security:cert:agent-1');
    });

    it('generates correct revoked certs key', () => {
      expect(SECURITY_REDIS_KEYS.revokedCerts).toBe('security:cert:revoked');
    });

    it('generates correct agent key', () => {
      expect(SECURITY_REDIS_KEYS.agentKey('agent-1')).toBe('security:keys:agent-1');
    });

    it('generates correct approval token key', () => {
      expect(SECURITY_REDIS_KEYS.approvalToken('tok_123')).toBe('approval:token:tok_123');
    });

    it('generates correct consumed token key', () => {
      expect(SECURITY_REDIS_KEYS.consumedToken('tok_123')).toBe('approval:consumed:tok_123');
    });

    it('generates correct user namespace key', () => {
      expect(SECURITY_REDIS_KEYS.userNamespace('usr_1')).toBe('ns:usr_1');
    });
  });

  describe('SECURITY_DEFAULTS', () => {
    it('has correct message expiry', () => {
      expect(SECURITY_DEFAULTS.MESSAGE_EXPIRY_MS).toBe(30_000);
    });

    it('has correct nonce TTL', () => {
      expect(SECURITY_DEFAULTS.NONCE_TTL_SECONDS).toBe(60);
    });

    it('has correct approval token TTL', () => {
      expect(SECURITY_DEFAULTS.APPROVAL_TOKEN_TTL_SECONDS).toBe(60);
    });

    it('has correct consumed token TTL', () => {
      expect(SECURITY_DEFAULTS.CONSUMED_TOKEN_TTL_SECONDS).toBe(300);
    });

    it('has correct cert validity', () => {
      expect(SECURITY_DEFAULTS.CERT_VALIDITY_DAYS).toBe(30);
    });

    it('uses sha256 for signing', () => {
      expect(SECURITY_DEFAULTS.MESSAGE_SIGN_ALGO).toBe('sha256');
      expect(SECURITY_DEFAULTS.AUDIT_HASH_ALGO).toBe('sha256');
    });

    it('uses EC P-256 keys', () => {
      expect(SECURITY_DEFAULTS.KEY_ALGO).toBe('ec');
      expect(SECURITY_DEFAULTS.KEY_CURVE).toBe('P-256');
    });
  });
});
