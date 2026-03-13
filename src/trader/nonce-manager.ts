import { createChildLogger } from '../core/logger.js';
import { getRedis } from '../core/redis.js';
import { getProvider } from '../wallet/evm-wallet.js';

const log = createChildLogger('nonce-manager');

const NONCE_KEY_PREFIX = 'nonce:';
const NONCE_LOCK_PREFIX = 'nonce-lock:';
const NONCE_TTL_SECONDS = 3600; // 1 hour

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
