/**
 * Per-user data isolation and namespace enforcement.
 *
 * Every user's data lives under a namespaced prefix: `ns:{userId}:*`
 * This module ensures:
 *   1. All user-scoped Redis keys are properly prefixed
 *   2. Cross-user access is explicitly denied unless the agent has authority
 *   3. Agent-to-user ownership is verified before data access
 *
 * Integration: User agents, broker agents, and gateways must use
 * `scopedRedisKey()` for ALL user data access.
 */

import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { AgentTier } from './types.js';
import { SECURITY_REDIS_KEYS } from './types.js';

const log = createChildLogger('data-isolation');

// ===== Namespace Utilities =====

/**
 * Get the Redis namespace prefix for a user.
 * All user data lives under `ns:{userId}:*`
 */
export function getUserNamespace(userId: string): string {
  if (!userId || userId.trim() === '') {
    throw new DataIsolationError('User ID is required for namespace');
  }
  return SECURITY_REDIS_KEYS.userNamespace(userId);
}

/**
 * Create a fully-qualified Redis key scoped to a user's namespace.
 *
 * @example
 * scopedRedisKey('usr_123', 'positions')       → 'ns:usr_123:positions'
 * scopedRedisKey('usr_123', 'trades:active')   → 'ns:usr_123:trades:active'
 * scopedRedisKey('usr_123', 'memory:decisions') → 'ns:usr_123:memory:decisions'
 */
export function scopedRedisKey(userId: string, key: string): string {
  const namespace = getUserNamespace(userId);
  return `${namespace}:${key}`;
}

/**
 * Extract the userId from a namespaced Redis key.
 * Returns null if the key doesn't follow the namespace pattern.
 */
export function extractUserIdFromKey(key: string): string | null {
  const match = key.match(/^ns:([^:]+):/);
  return match ? match[1] : null;
}

/**
 * Check if a Redis key belongs to a specific user's namespace.
 */
export function isKeyInNamespace(key: string, userId: string): boolean {
  const namespace = getUserNamespace(userId);
  return key.startsWith(`${namespace}:`);
}

// ===== Access Control =====

/**
 * Agent-to-user ownership mapping stored in Redis.
 * Format: `ns:{userId}:owner` → agentId
 */
const OWNER_KEY_SUFFIX = 'owner';

/**
 * Register an agent as the owner of a user's namespace.
 * Only one agent can own a user namespace at a time.
 */
export async function registerNamespaceOwner(
  userId: string,
  agentId: string,
  redis: Redis,
): Promise<void> {
  const key = scopedRedisKey(userId, OWNER_KEY_SUFFIX);
  await redis.set(key, agentId);
  log.info({ userId, agentId }, 'Namespace owner registered');
}

/**
 * Get the agent that owns a user's namespace.
 */
export async function getNamespaceOwner(
  userId: string,
  redis: Redis,
): Promise<string | null> {
  const key = scopedRedisKey(userId, OWNER_KEY_SUFFIX);
  return redis.get(key);
}

/**
 * Assert that a requesting agent has access to a user's namespace.
 *
 * Access rules:
 *   - Master agents: can access any namespace
 *   - Broker agents: can access namespaces of users assigned to them
 *   - User agents: can only access their own assigned user's namespace
 *   - Helper agents: can access only the namespace of the user they're servicing (via task context)
 *
 * @throws DataIsolationError if access is denied
 */
export async function assertNamespaceAccess(
  requestingAgentId: string,
  requestingAgentTier: AgentTier,
  targetUserId: string,
  redis: Redis,
): Promise<void> {
  // Master agents have global access
  if (requestingAgentTier === 'master') {
    return;
  }

  // Broker agents can access their managed users
  if (requestingAgentTier === 'broker') {
    const managedUsersKey = `broker:${requestingAgentId}:users`;
    const isManagedUser = await redis.sismember(managedUsersKey, targetUserId);
    if (isManagedUser === 1) {
      return;
    }
    log.warn({
      agentId: requestingAgentId,
      tier: requestingAgentTier,
      targetUserId,
    }, 'Broker access denied: user not in managed set');
    throw new DataIsolationError(
      `Agent ${requestingAgentId} (broker) cannot access namespace of user ${targetUserId}`,
    );
  }

  // User agents and helpers must be the namespace owner
  const owner = await getNamespaceOwner(targetUserId, redis);
  if (owner === requestingAgentId) {
    return;
  }

  // Check if the agent is servicing this user via an active task
  const activeTaskKey = `agent:${requestingAgentId}:active-task-user`;
  const activeTaskUser = await redis.get(activeTaskKey);
  if (activeTaskUser === targetUserId) {
    return;
  }

  log.warn({
    agentId: requestingAgentId,
    tier: requestingAgentTier,
    targetUserId,
    owner,
  }, 'Namespace access denied');

  throw new DataIsolationError(
    `Agent ${requestingAgentId} (${requestingAgentTier}) cannot access namespace of user ${targetUserId}`,
  );
}

// ===== Scoped Data Operations =====

/**
 * Standard user data key suffixes for consistent naming.
 */
export const USER_DATA_KEYS = {
  /** Active positions */
  positions: 'positions',
  /** Trade history */
  trades: 'trades',
  /** Active strategies */
  strategies: 'strategies',
  /** Risk settings */
  riskSettings: 'risk:settings',
  /** Portfolio snapshot */
  portfolio: 'portfolio',
  /** Memory: trade decisions */
  memoryDecisions: 'memory:decisions',
  /** Memory: chat history */
  memoryChatHistory: 'memory:chat',
  /** Memory: user preferences */
  memoryPreferences: 'memory:preferences',
  /** Fee reservations */
  feeReservations: 'fees:reservations',
  /** Wallet balances cache */
  walletBalances: 'wallet:balances',
  /** Agent configuration */
  agentConfig: 'agent:config',
  /** Hibernation snapshot */
  hibernationSnapshot: 'hibernation:snapshot',
} as const;

/**
 * Set a value in the user's namespace.
 */
export async function setUserData(
  userId: string,
  keySuffix: string,
  value: string,
  redis: Redis,
  ttlSeconds?: number,
): Promise<void> {
  const key = scopedRedisKey(userId, keySuffix);
  if (ttlSeconds) {
    await redis.set(key, value, 'EX', ttlSeconds);
  } else {
    await redis.set(key, value);
  }
}

/**
 * Get a value from the user's namespace.
 */
export async function getUserData(
  userId: string,
  keySuffix: string,
  redis: Redis,
): Promise<string | null> {
  const key = scopedRedisKey(userId, keySuffix);
  return redis.get(key);
}

/**
 * Delete a value from the user's namespace.
 */
export async function deleteUserData(
  userId: string,
  keySuffix: string,
  redis: Redis,
): Promise<void> {
  const key = scopedRedisKey(userId, keySuffix);
  await redis.del(key);
}

/**
 * Get all keys in a user's namespace (for migration/hibernation).
 * WARNING: Use sparingly — KEYS can be slow on large datasets.
 * Prefer SCAN in production.
 */
export async function listUserKeys(
  userId: string,
  redis: Redis,
  pattern: string = '*',
): Promise<string[]> {
  const namespace = getUserNamespace(userId);
  const fullPattern = `${namespace}:${pattern}`;
  const keys: string[] = [];

  // Use SCAN for production safety
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== '0');

  return keys;
}

/**
 * Delete all data in a user's namespace (for account deletion/cleanup).
 * Uses SCAN to avoid blocking Redis.
 */
export async function purgeUserNamespace(
  userId: string,
  redis: Redis,
): Promise<number> {
  const keys = await listUserKeys(userId, redis);

  if (keys.length === 0) return 0;

  // Delete in batches to avoid blocking
  const batchSize = 100;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    await redis.del(...batch);
  }

  log.info({ userId, keysDeleted: keys.length }, 'User namespace purged');
  return keys.length;
}

// ===== Broker User Management =====

/**
 * Assign a user to a broker's managed set.
 */
export async function assignUserToBroker(
  userId: string,
  brokerId: string,
  redis: Redis,
): Promise<void> {
  const managedUsersKey = `broker:${brokerId}:users`;
  await redis.sadd(managedUsersKey, userId);
  log.info({ userId, brokerId }, 'User assigned to broker');
}

/**
 * Remove a user from a broker's managed set.
 */
export async function unassignUserFromBroker(
  userId: string,
  brokerId: string,
  redis: Redis,
): Promise<void> {
  const managedUsersKey = `broker:${brokerId}:users`;
  await redis.srem(managedUsersKey, userId);
  log.info({ userId, brokerId }, 'User unassigned from broker');
}

/**
 * Get all users managed by a broker.
 */
export async function getBrokerUsers(
  brokerId: string,
  redis: Redis,
): Promise<string[]> {
  const managedUsersKey = `broker:${brokerId}:users`;
  return redis.smembers(managedUsersKey);
}

// ===== Error Class =====

export class DataIsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataIsolationError';
  }
}
