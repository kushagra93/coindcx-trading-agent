import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  createRootCertificate,
  createCertificate,
  verifyCertificateSignature,
} from '../../src/security/trust-chain.js';

describe('trust-chain', () => {
  describe('generateKeyPair', () => {
    it('generates PEM key pair', () => {
      const kp = generateKeyPair();
      expect(kp.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(kp.privateKey).toContain('BEGIN PRIVATE KEY');
    });

    it('generates unique keys each time', () => {
      const kp1 = generateKeyPair();
      const kp2 = generateKeyPair();
      expect(kp1.publicKey).not.toBe(kp2.publicKey);
      expect(kp1.privateKey).not.toBe(kp2.privateKey);
    });
  });

  describe('createRootCertificate', () => {
    it('creates a self-signed certificate', () => {
      const { certificate, keyPair } = createRootCertificate('master-agent');
      expect(certificate.agentId).toBe('master-agent');
      expect(certificate.tier).toBe('master');
      expect(certificate.issuedBy).toBe('master-agent');
      expect(certificate.revoked).toBe(false);
      expect(certificate.signature).toBeDefined();
      expect(keyPair.publicKey).toContain('BEGIN PUBLIC KEY');
    });

    it('uses custom validity', () => {
      const { certificate } = createRootCertificate('master-agent', 7);
      const issued = new Date(certificate.issuedAt);
      const expires = new Date(certificate.expiresAt);
      const diffDays = (expires.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.round(diffDays)).toBe(7);
    });

    it('signature is verifiable', () => {
      const { certificate } = createRootCertificate('master-agent');
      expect(verifyCertificateSignature(certificate, certificate.publicKey)).toBe(true);
    });
  });

  describe('createCertificate', () => {
    it('creates a certificate signed by the issuer', () => {
      const root = createRootCertificate('master-agent');
      const { certificate, keyPair } = createCertificate(
        'broker-US', 'broker', 'master-agent', root.keyPair.privateKey, 'US',
      );
      expect(certificate.agentId).toBe('broker-US');
      expect(certificate.tier).toBe('broker');
      expect(certificate.issuedBy).toBe('master-agent');
      expect(certificate.jurisdiction).toBe('US');
      expect(certificate.revoked).toBe(false);
      expect(keyPair.publicKey).toContain('BEGIN PUBLIC KEY');
    });

    it('signature verifiable with issuer public key', () => {
      const root = createRootCertificate('master-agent');
      const { certificate } = createCertificate(
        'broker-EU', 'broker', 'master-agent', root.keyPair.privateKey, 'EU',
      );
      expect(verifyCertificateSignature(certificate, root.keyPair.publicKey)).toBe(true);
    });

    it('rejects wrong issuer key', () => {
      const root = createRootCertificate('master-agent');
      const other = generateKeyPair();
      const { certificate } = createCertificate(
        'broker-EU', 'broker', 'master-agent', root.keyPair.privateKey, 'EU',
      );
      expect(verifyCertificateSignature(certificate, other.publicKey)).toBe(false);
    });

    it('creates user agent cert signed by broker', () => {
      const root = createRootCertificate('master-agent');
      const broker = createCertificate('broker-US', 'broker', 'master-agent', root.keyPair.privateKey, 'US');
      const { certificate } = createCertificate(
        'user-agent-123', 'user', 'broker-US', broker.keyPair.privateKey,
      );
      expect(certificate.agentId).toBe('user-agent-123');
      expect(certificate.tier).toBe('user');
      expect(certificate.issuedBy).toBe('broker-US');
      expect(verifyCertificateSignature(certificate, broker.keyPair.publicKey)).toBe(true);
    });
  });

  describe('verifyCertificateSignature', () => {
    it('detects tampered certificate', () => {
      const root = createRootCertificate('master-agent');
      const { certificate } = createCertificate(
        'broker-US', 'broker', 'master-agent', root.keyPair.privateKey, 'US',
      );
      certificate.agentId = 'tampered-id';
      expect(verifyCertificateSignature(certificate, root.keyPair.publicKey)).toBe(false);
    });
  });
});
