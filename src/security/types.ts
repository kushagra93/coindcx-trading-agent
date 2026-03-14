/**
 * Security types for the multi-tier agent architecture.
 * Defines agent identity, signed messaging, approval tokens,
 * certificates, and immutable audit entries.
 */

import type { Chain } from '../core/types.js';

// ===== Agent Identity =====

export type AgentTier = 'master' | 'broker' | 'user' | 'helper';

export type Jurisdiction = 'US' | 'EU' | 'APAC' | 'GLOBAL';

// ===== Signed Inter-Agent Messaging =====

export type AgentMessageType =
  | 'TRADE_REQUEST'
  | 'TRADE_APPROVAL'
  | 'TRADE_EXECUTION'
  | 'TRADE_RESULT'
  | 'FEE_TRANSFER'
  | 'FEE_RECEIPT'
  | 'RISK_ASSESSMENT'
  | 'COMPLIANCE_CHECK'
  | 'COMPLIANCE_RESULT'
  | 'HEARTBEAT'
  | 'COMMAND'
  | 'EVENT'
  | 'MARKET_DATA'
  | 'NOTIFICATION'
  | 'DEPOSIT'
  | 'WITHDRAW'
  | 'CERT_ISSUE'
  | 'CERT_REVOKE';

/**
 * Every inter-agent message is wrapped in this signed envelope.
 * Ensures authenticity, integrity, freshness, and replay prevention.
 */
export interface SignedMessage {
  /** Sender agent identifier, e.g. "user_agent_usr_123" */
  from: string;
  /** Recipient agent identifier, e.g. "broker_agent_US_03" */
  to: string;
  /** Message type for routing */
  type: AgentMessageType;
  /** Arbitrary payload — type depends on message type */
  payload: Record<string, unknown>;
  /** HMAC-SHA256 signature of canonical payload */
  signature: string;
  /** ISO-8601 timestamp — messages older than 30s are rejected */
  timestamp: string;
  /** One-time UUID nonce — prevents replay attacks */
  nonce: string;
  /** Correlation ID spanning entire trade lifecycle for tracing */
  corr_id: string;
}

// ===== Trade Approval Tokens =====

/**
 * One-time approval token issued by Master Agent for every trade.
 * No trade can execute without a valid, unexpired, unconsumed token.
 */
export interface ApprovalToken {
  /** Unique token identifier */
  tokenId: string;
  /** Reference to the original trade request */
  tradeRequestId: string;
  /** User agent requesting the trade */
  agentId: string;
  /** Broker that pre-approved the trade */
  brokerId: string;
  /** ISO-8601 timestamp of approval */
  approvedAt: string;
  /** ISO-8601 expiry (approvedAt + 30 seconds) */
  expiresAt: string;
  /** Maximum allowed trade amount in USD */
  maxAmountUsd: number;
  /** Specific asset this token is valid for */
  allowedAsset: string;
  /** Allowed trade direction */
  allowedSide: 'buy' | 'sell';
  /** Chain the trade must execute on */
  allowedChain: Chain;
  /** Master Agent's HMAC-SHA256 signature */
  masterSignature: string;
  /** Whether this token has been consumed (one-time use) */
  used: boolean;
}

/** Request from user agent to master for trade approval */
export interface TradeApprovalRequest {
  requestId: string;
  agentId: string;
  userId: string;
  brokerId: string;
  asset: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  chain: Chain;
  strategyId: string;
  riskScore: number;
  complianceResult: {
    passed: boolean;
    brokerId: string;
    checkedAt: string;
  };
  corr_id: string;
}

// ===== Agent Certificate & Trust Chain =====

/**
 * Certificate in the hierarchical trust chain:
 * Master (root CA) → signs Broker certs → Broker signs User certs
 * Master also signs Helper Agent certs directly.
 */
export interface AgentCertificate {
  /** Agent this cert belongs to */
  agentId: string;
  /** Agent tier determines trust level */
  tier: AgentTier;
  /** ECDSA P-256 public key (PEM format) */
  publicKey: string;
  /** Agent ID of the signing authority */
  issuedBy: string;
  /** ISO-8601 issue timestamp */
  issuedAt: string;
  /** ISO-8601 expiry timestamp */
  expiresAt: string;
  /** Jurisdiction for broker agents */
  jurisdiction?: Jurisdiction;
  /** ECDSA signature by the issuer */
  signature: string;
  /** Whether this cert has been revoked */
  revoked: boolean;
}

// ===== Immutable Audit Log =====

/**
 * Tamper-evident audit entry with hash chain.
 * Each entry's hash includes the previous entry's hash,
 * forming a chain that detects any modification.
 */
export interface ImmutableAuditEntry {
  /** Unique entry identifier */
  id: string;
  /** Monotonic sequence number for ordering */
  sequence: number;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Actor performing the action */
  actor: string;
  /** Actor's tier in the agent hierarchy */
  actorTier: AgentTier | 'admin' | 'ops' | 'user' | 'system';
  /** Action performed */
  action: string;
  /** Resource acted upon */
  resource: string;
  /** Additional context */
  details: Record<string, unknown>;
  /** Whether the action succeeded */
  success: boolean;
  /** Error message if action failed */
  error?: string;
  /** Hash of the previous audit entry (chain link) */
  previousHash: string;
  /** SHA-256 hash of this entry (includes previousHash) */
  entryHash: string;
  /** Correlation ID for tracing across the trade lifecycle */
  corr_id?: string;
}

// ===== Security Redis Keys =====

export const SECURITY_REDIS_KEYS = {
  /** Used nonces set — prevents replay attacks (60s TTL per nonce) */
  usedNonces: 'security:nonces:used',
  /** Agent certificate hash */
  agentCert: (agentId: string) => `security:cert:${agentId}`,
  /** Set of revoked certificate IDs */
  revokedCerts: 'security:cert:revoked',
  /** KMS-encrypted agent private key */
  agentKey: (agentId: string) => `security:keys:${agentId}`,
  /** Approval token hash (60s TTL) */
  approvalToken: (tokenId: string) => `approval:token:${tokenId}`,
  /** Consumed token flag (300s TTL — prevents reuse) */
  consumedToken: (tokenId: string) => `approval:consumed:${tokenId}`,
  /** User namespace prefix */
  userNamespace: (userId: string) => `ns:${userId}`,
} as const;

// ===== Message Expiry & Security Config =====

export const SECURITY_DEFAULTS = {
  /** Maximum age of a signed message before rejection */
  MESSAGE_EXPIRY_MS: 30_000,
  /** TTL for used nonces in Redis (2x message expiry for safety) */
  NONCE_TTL_SECONDS: 60,
  /** TTL for approval tokens in Redis */
  APPROVAL_TOKEN_TTL_SECONDS: 60,
  /** TTL for consumed token flags (prevents late replays) */
  CONSUMED_TOKEN_TTL_SECONDS: 300,
  /** Certificate validity period */
  CERT_VALIDITY_DAYS: 30,
  /** Hash algorithm for audit chain */
  AUDIT_HASH_ALGO: 'sha256' as const,
  /** Signing algorithm for messages */
  MESSAGE_SIGN_ALGO: 'sha256' as const,
  /** Key pair algorithm for trust chain */
  KEY_ALGO: 'ec' as const,
  /** Named curve for ECDSA */
  KEY_CURVE: 'P-256' as const,
} as const;
