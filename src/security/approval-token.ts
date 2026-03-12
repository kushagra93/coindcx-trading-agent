/**
 * One-time trade approval tokens issued by the Master Agent.
 *
 * No trade can execute without a valid, unexpired, unconsumed token.
 * Tokens are:
 *   - HMAC-SHA256 signed by the Master Agent's private key
 *   - 30-second expiry (configurable)
 *   - One-time use via atomic Redis CAS (compare-and-swap)
 *   - Scoped to a specific asset, side, chain, and maximum amount
 */

import { createHmac, randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { Chain } from '../core/types.js';
import type { ApprovalToken, TradeApprovalRequest } from './types.js';
import { SECURITY_DEFAULTS, SECURITY_REDIS_KEYS } from './types.js';

const log = createChildLogger('approval-token');

// ===== Token Signing =====

/**
 * Canonical string representation of token fields for signing.
 */
function tokenCanonical(token: Omit<ApprovalToken, 'masterSignature' | 'used'>): string {
  return [
    token.tokenId,
    token.tradeRequestId,
    token.agentId,
    token.brokerId,
    token.approvedAt,
    token.expiresAt,
    token.maxAmountUsd.toString(),
    token.allowedAsset,
    token.allowedSide,
    token.allowedChain,
  ].join('|');
}

/**
 * Sign a token's canonical form with the Master Agent's private key.
 */
function signToken(token: Omit<ApprovalToken, 'masterSignature' | 'used'>, masterPrivateKey: string): string {
  return createHmac(SECURITY_DEFAULTS.MESSAGE_SIGN_ALGO, masterPrivateKey)
    .update(tokenCanonical(token))
    .digest('hex');
}

// ===== Token Issuance =====

/**
 * Issue a new one-time approval token for a trade request.
 * Only the Master Agent should call this after validating the request
 * against global policies and broker pre-approval.
 *
 * @param masterPrivateKey - Master Agent's HMAC signing key
 * @param request - The validated trade approval request
 * @param redis - Redis instance for storing the token
 * @param validitySeconds - Token validity period (default: 30s)
 */
export async function issueApprovalToken(
  masterPrivateKey: string,
  request: TradeApprovalRequest,
  redis: Redis,
  validitySeconds: number = 30,
): Promise<ApprovalToken> {
  const tokenId = `tok_${randomUUID()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validitySeconds * 1000);

  const tokenFields = {
    tokenId,
    tradeRequestId: request.requestId,
    agentId: request.agentId,
    brokerId: request.brokerId,
    approvedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    maxAmountUsd: request.amountUsd,
    allowedAsset: request.asset,
    allowedSide: request.side,
    allowedChain: request.chain,
  };

  const masterSignature = signToken(tokenFields, masterPrivateKey);

  const token: ApprovalToken = {
    ...tokenFields,
    masterSignature,
    used: false,
  };

  // Store token in Redis with TTL
  const key = SECURITY_REDIS_KEYS.approvalToken(tokenId);
  await redis.set(
    key,
    JSON.stringify(token),
    'EX',
    SECURITY_DEFAULTS.APPROVAL_TOKEN_TTL_SECONDS,
  );

  log.info({
    tokenId,
    tradeRequestId: request.requestId,
    agentId: request.agentId,
    asset: request.asset,
    side: request.side,
    maxAmountUsd: request.amountUsd,
    expiresAt: expiresAt.toISOString(),
  }, 'Approval token issued');

  return token;
}

// ===== Token Validation =====

/**
 * Validate an approval token's signature, expiry, and constraints.
 * Does NOT consume the token — call consumeApprovalToken() separately.
 *
 * @param token - The token to validate
 * @param masterPrivateKey - Master Agent's HMAC key for signature verification
 * @param tradeParams - Actual trade parameters to validate against token constraints
 */
export function validateApprovalToken(
  token: ApprovalToken,
  masterPrivateKey: string,
  tradeParams?: {
    asset?: string;
    side?: 'buy' | 'sell';
    amountUsd?: number;
    chain?: Chain;
  },
): { valid: boolean; error?: string } {
  // 1. Check if already used
  if (token.used) {
    return { valid: false, error: 'Token already consumed' };
  }

  // 2. Check expiry
  if (new Date(token.expiresAt) < new Date()) {
    return { valid: false, error: `Token expired at ${token.expiresAt}` };
  }

  // 3. Verify HMAC signature
  const tokenFields = {
    tokenId: token.tokenId,
    tradeRequestId: token.tradeRequestId,
    agentId: token.agentId,
    brokerId: token.brokerId,
    approvedAt: token.approvedAt,
    expiresAt: token.expiresAt,
    maxAmountUsd: token.maxAmountUsd,
    allowedAsset: token.allowedAsset,
    allowedSide: token.allowedSide,
    allowedChain: token.allowedChain,
  };

  const expectedSig = signToken(tokenFields, masterPrivateKey);

  // Constant-time comparison
  if (expectedSig.length !== token.masterSignature.length) {
    return { valid: false, error: 'Invalid token signature' };
  }
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig.charCodeAt(i) ^ token.masterSignature.charCodeAt(i);
  }
  if (diff !== 0) {
    return { valid: false, error: 'Invalid token signature' };
  }

  // 4. Validate trade parameters against token constraints (if provided)
  if (tradeParams) {
    if (tradeParams.asset && tradeParams.asset !== token.allowedAsset) {
      return { valid: false, error: `Asset mismatch: ${tradeParams.asset} vs allowed ${token.allowedAsset}` };
    }
    if (tradeParams.side && tradeParams.side !== token.allowedSide) {
      return { valid: false, error: `Side mismatch: ${tradeParams.side} vs allowed ${token.allowedSide}` };
    }
    if (tradeParams.amountUsd && tradeParams.amountUsd > token.maxAmountUsd) {
      return { valid: false, error: `Amount $${tradeParams.amountUsd} exceeds max $${token.maxAmountUsd}` };
    }
    if (tradeParams.chain && tradeParams.chain !== token.allowedChain) {
      return { valid: false, error: `Chain mismatch: ${tradeParams.chain} vs allowed ${token.allowedChain}` };
    }
  }

  return { valid: true };
}

// ===== Token Consumption =====

/**
 * Atomically consume an approval token (one-time use).
 * Uses Redis SETNX as a compare-and-swap to prevent double-use.
 *
 * @returns true if the token was successfully consumed, false if already used
 */
export async function consumeApprovalToken(
  tokenId: string,
  redis: Redis,
): Promise<{ consumed: boolean; error?: string }> {
  const consumedKey = SECURITY_REDIS_KEYS.consumedToken(tokenId);

  // Atomic CAS: SETNX returns 1 if key was set (first use), 0 if already exists
  const result = await redis.set(
    consumedKey,
    Date.now().toString(),
    'EX',
    SECURITY_DEFAULTS.CONSUMED_TOKEN_TTL_SECONDS,
    'NX',
  );

  if (result !== 'OK') {
    log.warn({ tokenId }, 'Token consumption rejected: already consumed');
    return { consumed: false, error: 'Token already consumed (double-use attempt)' };
  }

  // Also update the stored token record
  const tokenKey = SECURITY_REDIS_KEYS.approvalToken(tokenId);
  const tokenData = await redis.get(tokenKey);
  if (tokenData) {
    const token = JSON.parse(tokenData) as ApprovalToken;
    token.used = true;
    // Keep the remaining TTL
    const ttl = await redis.ttl(tokenKey);
    if (ttl > 0) {
      await redis.set(tokenKey, JSON.stringify(token), 'EX', ttl);
    }
  }

  log.info({ tokenId }, 'Approval token consumed');
  return { consumed: true };
}

// ===== Token Retrieval =====

/**
 * Retrieve an approval token from Redis.
 */
export async function getApprovalToken(
  tokenId: string,
  redis: Redis,
): Promise<ApprovalToken | null> {
  const key = SECURITY_REDIS_KEYS.approvalToken(tokenId);
  const data = await redis.get(key);
  if (!data) return null;

  try {
    return JSON.parse(data) as ApprovalToken;
  } catch {
    log.error({ tokenId }, 'Failed to parse approval token');
    return null;
  }
}

/**
 * Check if a token has been consumed.
 */
export async function isTokenConsumed(
  tokenId: string,
  redis: Redis,
): Promise<boolean> {
  const consumedKey = SECURITY_REDIS_KEYS.consumedToken(tokenId);
  const exists = await redis.exists(consumedKey);
  return exists === 1;
}

/**
 * Full validation + consumption in a single operation.
 * This is the recommended function for executors to call before trade execution.
 *
 * @returns Result with the validated token if successful
 */
export async function validateAndConsumeToken(
  tokenId: string,
  masterPrivateKey: string,
  redis: Redis,
  tradeParams?: {
    asset?: string;
    side?: 'buy' | 'sell';
    amountUsd?: number;
    chain?: Chain;
  },
): Promise<{ valid: boolean; token?: ApprovalToken; error?: string }> {
  // 1. Retrieve token
  const token = await getApprovalToken(tokenId, redis);
  if (!token) {
    return { valid: false, error: 'Token not found or expired' };
  }

  // 2. Validate signature, expiry, and constraints
  const validation = validateApprovalToken(token, masterPrivateKey, tradeParams);
  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  // 3. Atomically consume
  const consumption = await consumeApprovalToken(tokenId, redis);
  if (!consumption.consumed) {
    return { valid: false, error: consumption.error };
  }

  return { valid: true, token };
}
