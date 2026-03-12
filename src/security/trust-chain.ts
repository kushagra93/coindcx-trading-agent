/**
 * Certificate Authority hierarchy for the agent trust chain.
 *
 * Trust hierarchy:
 *   Master Agent (root CA, self-signed)
 *     └─ Regional Broker Agents (signed by Master)
 *         └─ User Personal Agents (signed by their Broker)
 *     └─ Helper Agents (signed by Master directly)
 *
 * Uses ECDSA P-256 for key pairs and certificate signing.
 * Private keys are stored encrypted via AWS KMS (reusing key-manager.ts).
 */

import {
  createSign,
  createVerify,
  generateKeyPairSync,
  randomUUID,
} from 'node:crypto';
import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { AgentCertificate, AgentTier, Jurisdiction } from './types.js';
import { SECURITY_DEFAULTS, SECURITY_REDIS_KEYS } from './types.js';

const log = createChildLogger('trust-chain');

// ===== Key Pair Generation =====

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

/**
 * Generate a new ECDSA P-256 key pair for agent identity.
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync(SECURITY_DEFAULTS.KEY_ALGO, {
    namedCurve: SECURITY_DEFAULTS.KEY_CURVE,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

// ===== Certificate Operations =====

/**
 * Canonical string representation of certificate fields for signing.
 */
function certCanonical(cert: Omit<AgentCertificate, 'signature' | 'revoked'>): string {
  return [
    cert.agentId,
    cert.tier,
    cert.publicKey,
    cert.issuedBy,
    cert.issuedAt,
    cert.expiresAt,
    cert.jurisdiction ?? '',
  ].join('|');
}

/**
 * Create a signed certificate for an agent.
 * The issuer (parent in trust chain) signs the certificate with their private key.
 *
 * @param agentId - ID of the agent receiving the certificate
 * @param tier - Agent tier (master, broker, user, helper)
 * @param issuerAgentId - ID of the signing authority
 * @param issuerPrivateKey - PEM private key of the issuer
 * @param jurisdiction - Required for broker agents
 * @param validityDays - Certificate validity period
 */
export function createCertificate(
  agentId: string,
  tier: AgentTier,
  issuerAgentId: string,
  issuerPrivateKey: string,
  jurisdiction?: Jurisdiction,
  validityDays: number = SECURITY_DEFAULTS.CERT_VALIDITY_DAYS,
): { certificate: AgentCertificate; keyPair: KeyPair } {
  const keyPair = generateKeyPair();
  const now = new Date();
  const expires = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const certFields = {
    agentId,
    tier,
    publicKey: keyPair.publicKey,
    issuedBy: issuerAgentId,
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    jurisdiction,
  };

  // Sign the certificate with issuer's private key
  const signer = createSign('SHA256');
  signer.update(certCanonical(certFields));
  signer.end();
  const signature = signer.sign(issuerPrivateKey, 'hex');

  const certificate: AgentCertificate = {
    ...certFields,
    signature,
    revoked: false,
  };

  log.info({
    agentId,
    tier,
    issuedBy: issuerAgentId,
    jurisdiction,
    expiresAt: expires.toISOString(),
  }, 'Certificate issued');

  return { certificate, keyPair };
}

/**
 * Create a self-signed root certificate for the Master Agent.
 */
export function createRootCertificate(
  masterAgentId: string,
  validityDays: number = 365,
): { certificate: AgentCertificate; keyPair: KeyPair } {
  const keyPair = generateKeyPair();
  const now = new Date();
  const expires = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const certFields = {
    agentId: masterAgentId,
    tier: 'master' as AgentTier,
    publicKey: keyPair.publicKey,
    issuedBy: masterAgentId, // Self-signed
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };

  const signer = createSign('SHA256');
  signer.update(certCanonical(certFields));
  signer.end();
  const signature = signer.sign(keyPair.privateKey, 'hex');

  const certificate: AgentCertificate = {
    ...certFields,
    signature,
    revoked: false,
  };

  log.info({ masterAgentId }, 'Root CA certificate created (self-signed)');

  return { certificate, keyPair };
}

/**
 * Verify a certificate's signature against the issuer's public key.
 */
export function verifyCertificateSignature(
  cert: AgentCertificate,
  issuerPublicKey: string,
): boolean {
  const certFields = {
    agentId: cert.agentId,
    tier: cert.tier,
    publicKey: cert.publicKey,
    issuedBy: cert.issuedBy,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt,
    jurisdiction: cert.jurisdiction,
  };

  const verifier = createVerify('SHA256');
  verifier.update(certCanonical(certFields));
  verifier.end();

  try {
    return verifier.verify(issuerPublicKey, cert.signature, 'hex');
  } catch (err) {
    log.warn({ agentId: cert.agentId, error: err }, 'Certificate signature verification failed');
    return false;
  }
}

/**
 * Verify a certificate chain from leaf to root.
 * Checks: signature validity, expiry, revocation status.
 */
export async function verifyCertificateChain(
  cert: AgentCertificate,
  trustedRoots: AgentCertificate[],
  redis: Redis,
): Promise<{ valid: boolean; error?: string }> {
  // Check expiry
  if (new Date(cert.expiresAt) < new Date()) {
    return { valid: false, error: `Certificate expired: ${cert.agentId}` };
  }

  // Check revocation
  if (await isCertificateRevoked(cert.agentId, redis)) {
    return { valid: false, error: `Certificate revoked: ${cert.agentId}` };
  }

  // Self-signed root check
  if (cert.issuedBy === cert.agentId) {
    const isRoot = trustedRoots.some(root =>
      root.agentId === cert.agentId &&
      verifyCertificateSignature(cert, cert.publicKey)
    );
    return isRoot
      ? { valid: true }
      : { valid: false, error: `Self-signed cert not in trusted roots: ${cert.agentId}` };
  }

  // Find issuer's certificate
  const issuerCert = await getCertificate(cert.issuedBy, redis);
  if (!issuerCert) {
    return { valid: false, error: `Issuer certificate not found: ${cert.issuedBy}` };
  }

  // Verify this cert's signature with issuer's public key
  if (!verifyCertificateSignature(cert, issuerCert.publicKey)) {
    return { valid: false, error: `Invalid signature on cert: ${cert.agentId}` };
  }

  // Recursively verify issuer's chain
  return verifyCertificateChain(issuerCert, trustedRoots, redis);
}

// ===== Certificate Store (Redis-backed) =====

/**
 * Store a certificate in Redis.
 */
export async function storeCertificate(cert: AgentCertificate, redis: Redis): Promise<void> {
  const key = SECURITY_REDIS_KEYS.agentCert(cert.agentId);
  await redis.hmset(key, {
    agentId: cert.agentId,
    tier: cert.tier,
    publicKey: cert.publicKey,
    issuedBy: cert.issuedBy,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt,
    jurisdiction: cert.jurisdiction ?? '',
    signature: cert.signature,
    revoked: cert.revoked ? '1' : '0',
  });
}

/**
 * Retrieve a certificate from Redis.
 */
export async function getCertificate(agentId: string, redis: Redis): Promise<AgentCertificate | null> {
  const key = SECURITY_REDIS_KEYS.agentCert(agentId);
  const data = await redis.hgetall(key);
  if (!data.agentId) return null;

  return {
    agentId: data.agentId,
    tier: data.tier as AgentTier,
    publicKey: data.publicKey,
    issuedBy: data.issuedBy,
    issuedAt: data.issuedAt,
    expiresAt: data.expiresAt,
    jurisdiction: data.jurisdiction ? data.jurisdiction as Jurisdiction : undefined,
    signature: data.signature,
    revoked: data.revoked === '1',
  };
}

/**
 * Store an agent's encrypted private key in Redis.
 */
export async function storeAgentKey(agentId: string, encryptedKey: string, redis: Redis): Promise<void> {
  await redis.set(SECURITY_REDIS_KEYS.agentKey(agentId), encryptedKey);
}

/**
 * Retrieve an agent's encrypted private key from Redis.
 */
export async function getAgentKey(agentId: string, redis: Redis): Promise<string | null> {
  return redis.get(SECURITY_REDIS_KEYS.agentKey(agentId));
}

/**
 * Revoke a certificate. Adds to revoked set and updates cert record.
 */
export async function revokeCertificate(agentId: string, redis: Redis): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.sadd(SECURITY_REDIS_KEYS.revokedCerts, agentId);
  pipeline.hset(SECURITY_REDIS_KEYS.agentCert(agentId), 'revoked', '1');
  await pipeline.exec();
  log.info({ agentId }, 'Certificate revoked');
}

/**
 * Check if a certificate has been revoked.
 */
export async function isCertificateRevoked(agentId: string, redis: Redis): Promise<boolean> {
  const result = await redis.sismember(SECURITY_REDIS_KEYS.revokedCerts, agentId);
  return result === 1;
}
