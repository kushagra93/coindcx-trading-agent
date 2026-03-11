import { ethers } from 'ethers';
import { createChildLogger } from '../core/logger.js';
import { getProvider } from '../wallet/evm-wallet.js';

const log = createChildLogger('nonce-manager');

// Per-wallet nonce tracking with chained-promise mutex (no TOCTOU race)
const nonceChains = new Map<string, Promise<void>>();
const currentNonces = new Map<string, number>();

function walletKey(walletAddress: string, chainId?: number): string {
  return `${walletAddress}:${chainId ?? 'default'}`;
}

/**
 * Get the next nonce for a wallet, ensuring sequential ordering.
 * Uses a chained-promise mutex — each call chains on the previous,
 * eliminating the TOCTOU race in the old await-then-lock pattern.
 */
export async function getNextNonce(walletAddress: string, chainId?: number): Promise<number> {
  const key = walletKey(walletAddress, chainId);

  const noncePromise = (nonceChains.get(key) ?? Promise.resolve()).then(async () => {
    let nonce = currentNonces.get(key);

    if (nonce === undefined) {
      // First time — fetch from chain
      const provider = getProvider(chainId);
      nonce = await provider.getTransactionCount(walletAddress, 'pending');
      log.info({ walletAddress, nonce, chainId }, 'Initialized nonce from chain');
    } else {
      nonce++;
    }

    currentNonces.set(key, nonce);
    return nonce;
  });

  // Chain the next caller behind this one (ignore the return value for the chain)
  nonceChains.set(key, noncePromise.then(() => {}, () => {}));

  return noncePromise;
}

/**
 * Reset nonce for a wallet (e.g., after detecting nonce mismatch).
 */
export async function resetNonce(walletAddress: string, chainId?: number): Promise<void> {
  const key = walletKey(walletAddress, chainId);
  const provider = getProvider(chainId);
  const nonce = await provider.getTransactionCount(walletAddress, 'pending');
  currentNonces.set(key, nonce - 1); // Will be incremented on next getNextNonce
  log.info({ walletAddress, nonce, chainId }, 'Nonce reset from chain');
}

/**
 * Mark a nonce as failed (decrement so it can be reused).
 */
export function rollbackNonce(walletAddress: string, chainId?: number): void {
  const key = walletKey(walletAddress, chainId);
  const current = currentNonces.get(key);
  if (current !== undefined && current > 0) {
    currentNonces.set(key, current - 1);
    log.info({ walletAddress, newNonce: current - 1 }, 'Nonce rolled back');
  }
}
