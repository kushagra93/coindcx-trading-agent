import { createChildLogger } from '../core/logger.js';
import { getRedis } from '../core/redis.js';
import { getProvider } from '../wallet/evm-wallet.js';

const log = createChildLogger('nonce-manager');

const NONCE_KEY_PREFIX = 'nonce:';
const NONCE_LOCK_PREFIX = 'nonce-lock:';
const NONCE_TTL_SECONDS = 3600; // 1 hour

const lastUsed = new Map<string, number>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

function nonceKey(walletAddress: string, chainId?: number): string {
  return `${NONCE_KEY_PREFIX}${walletAddress}:${chainId ?? 'default'}`;
}

function lockKey(walletAddress: string, chainId?: number): string {
  return `${NONCE_LOCK_PREFIX}${walletAddress}:${chainId ?? 'default'}`;
}

/**
 * Get the next nonce for a wallet using Redis atomic INCR.
 * Initializes from chain state if key doesn't exist.
 * Uses a simple lock to prevent concurrent initialization.
 */
export async function getNextNonce(walletAddress: string, chainId?: number): Promise<number> {
  const redis = getRedis();
  const key = nonceKey(walletAddress, chainId);
  const lock = lockKey(walletAddress, chainId);

  const exists = await redis.exists(key);
  if (!exists) {
    const acquired = await redis.set(lock, '1', 'EX', 10, 'NX');
    if (acquired) {
      try {
        const provider = getProvider(chainId);
        const chainNonce = await provider.getTransactionCount(walletAddress, 'pending');
        await redis.set(key, (chainNonce - 1).toString(), 'EX', NONCE_TTL_SECONDS);
        log.info({ walletAddress, nonce: chainNonce, chainId }, 'Initialized nonce from chain');
      } finally {
        await redis.del(lock);
      }
    } else {
      // Wait for another process to initialize
      let retries = 20;
      while (retries-- > 0 && !(await redis.exists(key))) {
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }

  const nonce = await redis.incr(key);
  await redis.expire(key, NONCE_TTL_SECONDS);
  lastUsed.set(key, Date.now());
  if (!cleanupTimer) startCleanup();
  return nonce;
}

export async function resetNonce(walletAddress: string, chainId?: number): Promise<void> {
  const redis = getRedis();
  const key = nonceKey(walletAddress, chainId);
  const provider = getProvider(chainId);
  const nonce = await provider.getTransactionCount(walletAddress, 'pending');
  await redis.set(key, (nonce - 1).toString(), 'EX', NONCE_TTL_SECONDS);
  log.info({ walletAddress, nonce, chainId }, 'Nonce reset from chain');
}

export async function rollbackNonce(walletAddress: string, chainId?: number): Promise<void> {
  const redis = getRedis();
  const key = nonceKey(walletAddress, chainId);
  const current = await redis.get(key);
  if (current !== null && parseInt(current) > 0) {
    await redis.decr(key);
    log.info({ walletAddress, newNonce: parseInt(current) - 1 }, 'Nonce rolled back');
  }
}

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => cleanupIdleNonces(), CLEANUP_INTERVAL_MS);
  log.info('Nonce cleanup timer started (5min interval)');
}

async function cleanupIdleNonces() {
  const now = Date.now();
  const redis = getRedis();
  let cleaned = 0;

  for (const [key, timestamp] of lastUsed) {
    if (now - timestamp > IDLE_THRESHOLD_MS) {
      try {
        await redis.del(key);
        lastUsed.delete(key);
        cleaned++;
      } catch {
        // ignore cleanup errors
      }
    }
  }

  if (cleaned > 0) {
    log.info({ cleaned }, 'Cleaned up idle nonces');
  }
}

export function stopNonceCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    lastUsed.clear();
    log.info('Nonce cleanup stopped');
  }
}
