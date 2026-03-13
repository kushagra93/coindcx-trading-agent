/**
 * HMAC-SHA256 message signing and verification for inter-agent communication.
 * Every message is signed before sending over WebSocket and verified on receipt.
 *
 * Security guarantees:
 * 1. Authenticity — only the holder of the private key can sign
 * 2. Integrity — any payload modification invalidates the signature
 * 3. Freshness — messages expire after 30 seconds
 * 4. Replay prevention — one-time nonces stored in Redis
 */

import { createHmac, randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { AgentMessageType, SignedMessage } from './types.js';
import { SECURITY_DEFAULTS, SECURITY_REDIS_KEYS } from './types.js';
import type { WsMessage } from '../core/ws-types.js';

const log = createChildLogger('message-signer');

/**
 * Produce a canonical string representation of the payload for signing.
 * Keys are sorted to ensure deterministic output regardless of insertion order.
 */
function canonicalize(data: Record<string, unknown>): string {
  return JSON.stringify(data, Object.keys(data).sort());
}

/**
 * Compute HMAC-SHA256 of the canonical message content.
 * Signs: from + to + type + canonical(payload) + timestamp + nonce + corr_id
 */
export function signPayload(
  from: string,
  to: string,
  type: AgentMessageType,
  payload: Record<string, unknown>,
  timestamp: string,
  nonce: string,
  corrId: string,
  privateKey: string,
): string {
  const message = `${from}|${to}|${type}|${canonicalize(payload)}|${timestamp}|${nonce}|${corrId}`;
  return createHmac(SECURITY_DEFAULTS.MESSAGE_SIGN_ALGO, privateKey)
    .update(message)
    .digest('hex');
}

/**
 * Verify the HMAC-SHA256 signature of a signed message.
 */
export function verifySignature(
  msg: SignedMessage,
  senderKey: string,
): boolean {
  const expected = signPayload(
    msg.from, msg.to, msg.type, msg.payload,
    msg.timestamp, msg.nonce, msg.corr_id, senderKey,
  );
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== msg.signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ msg.signature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if a nonce has already been used (replay prevention).
 */
export async function isNonceUsed(nonce: string, redis: Redis): Promise<boolean> {
  const exists = await redis.sismember(SECURITY_REDIS_KEYS.usedNonces, nonce);
  return exists === 1;
}

/**
 * Mark a nonce as used with TTL expiry.
 * Uses SADD + individual key with TTL for automatic cleanup.
 */
export async function markNonceUsed(nonce: string, redis: Redis): Promise<void> {
  const nonceKey = `${SECURITY_REDIS_KEYS.usedNonces}:${nonce}`;
  const pipeline = redis.pipeline();
  pipeline.set(nonceKey, '1', 'EX', SECURITY_DEFAULTS.NONCE_TTL_SECONDS);
  pipeline.sadd(SECURITY_REDIS_KEYS.usedNonces, nonce);
  await pipeline.exec();
}

/**
 * Check if a message timestamp is within the allowed freshness window.
 */
export function isTimestampValid(
  timestamp: string,
  maxAgeMs: number = SECURITY_DEFAULTS.MESSAGE_EXPIRY_MS,
): boolean {
  const messageTime = new Date(timestamp).getTime();
  if (isNaN(messageTime)) return false;
  const now = Date.now();
  const age = now - messageTime;
  // Reject messages that are too old or from the future (clock skew tolerance: 5s)
  return age >= -5000 && age <= maxAgeMs;
}

/**
 * Create a fully signed message envelope ready for transmission.
 */
export async function createSignedMessage(
  from: string,
  to: string,
  type: AgentMessageType,
  payload: Record<string, unknown>,
  privateKey: string,
  redis: Redis,
  corrId?: string,
): Promise<SignedMessage> {
  const nonce = randomUUID();
  const timestamp = new Date().toISOString();
  const correlationId = corrId ?? randomUUID();

  const signature = signPayload(
    from, to, type, payload, timestamp, nonce, correlationId, privateKey,
  );

  // Mark nonce as used immediately to prevent self-replay
  await markNonceUsed(nonce, redis);

  return {
    from,
    to,
    type,
    payload,
    signature,
    timestamp,
    nonce,
    corr_id: correlationId,
  };
}

/**
 * Validate a received signed message.
 * Checks: signature integrity, nonce uniqueness, timestamp freshness.
 *
 * @returns Validation result with error description if invalid.
 */
export async function validateSignedMessage(
  message: SignedMessage,
  senderKey: string,
  redis: Redis,
): Promise<{ valid: boolean; error?: string }> {
  // 1. Check timestamp freshness
  if (!isTimestampValid(message.timestamp)) {
    log.warn({ from: message.from, timestamp: message.timestamp }, 'Message expired or future timestamp');
    return { valid: false, error: 'Message timestamp expired or invalid' };
  }

  // 2. Check nonce uniqueness (replay prevention)
  const nonceKey = `${SECURITY_REDIS_KEYS.usedNonces}:${message.nonce}`;
  const nonceExists = await redis.exists(nonceKey);
  if (nonceExists) {
    log.warn({ from: message.from, nonce: message.nonce }, 'Replay attack detected: nonce already used');
    return { valid: false, error: 'Nonce already used (replay attack)' };
  }

  // 3. Verify HMAC-SHA256 signature
  if (!verifySignature(message, senderKey)) {
    log.warn({ from: message.from, to: message.to, type: message.type }, 'Invalid message signature');
    return { valid: false, error: 'Invalid signature' };
  }

  // 4. Mark nonce as used for future replay prevention
  await markNonceUsed(message.nonce, redis);

  return { valid: true };
}

// ═══════════════════════════════════════════════
// WsMessage signing (MDC §Message Signing & Authenticity)
// ═══════════════════════════════════════════════

function canonicalizeWsPayload(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

/**
 * Sign a WsMessage in-place: populates `signature` and `nonce` fields.
 * Signs: from|to|type|canonical(payload)|timestamp|nonce|corrId
 */
export function signWsMessage(msg: WsMessage, privateKey: string): WsMessage {
  const nonce = randomUUID();
  const corrId = msg.corrId ?? '';
  const signInput = `${msg.from}|${msg.to}|${msg.type}|${canonicalizeWsPayload(msg.payload)}|${msg.timestamp}|${nonce}|${corrId}`;
  const signature = createHmac(SECURITY_DEFAULTS.MESSAGE_SIGN_ALGO, privateKey)
    .update(signInput)
    .digest('hex');

  msg.nonce = nonce;
  msg.signature = signature;
  return msg;
}

/**
 * Verify the HMAC-SHA256 signature on a WsMessage.
 */
export function verifyWsSignature(msg: WsMessage, senderKey: string): boolean {
  if (!msg.signature || !msg.nonce) return false;

  const corrId = msg.corrId ?? '';
  const signInput = `${msg.from}|${msg.to}|${msg.type}|${canonicalizeWsPayload(msg.payload)}|${msg.timestamp}|${msg.nonce}|${corrId}`;
  const expected = createHmac(SECURITY_DEFAULTS.MESSAGE_SIGN_ALGO, senderKey)
    .update(signInput)
    .digest('hex');

  if (expected.length !== msg.signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ msg.signature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check WsMessage timestamp freshness (numeric epoch ms).
 */
export function isWsTimestampFresh(
  timestamp: number,
  maxAgeMs: number = SECURITY_DEFAULTS.MESSAGE_EXPIRY_MS,
): boolean {
  const age = Date.now() - timestamp;
  return age >= -5000 && age <= maxAgeMs;
}

/**
 * Full validation of an inbound WsMessage:
 * 1. Timestamp freshness (30s window)
 * 2. Nonce uniqueness (replay prevention)
 * 3. HMAC signature verification
 */
export async function validateWsMessage(
  msg: WsMessage,
  senderKey: string,
  redis: Redis,
): Promise<{ valid: boolean; error?: string }> {
  if (!isWsTimestampFresh(msg.timestamp)) {
    return { valid: false, error: 'Message timestamp expired or future' };
  }

  if (!msg.nonce) {
    return { valid: false, error: 'Missing nonce' };
  }

  const nonceKey = `${SECURITY_REDIS_KEYS.usedNonces}:${msg.nonce}`;
  const nonceExists = await redis.exists(nonceKey);
  if (nonceExists) {
    return { valid: false, error: 'Nonce already used (replay)' };
  }

  if (!verifyWsSignature(msg, senderKey)) {
    return { valid: false, error: 'Invalid signature' };
  }

  await markNonceUsed(msg.nonce, redis);
  return { valid: true };
}

