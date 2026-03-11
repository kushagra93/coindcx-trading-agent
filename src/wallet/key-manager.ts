import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { LRUCache } from 'lru-cache';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import type { Chain } from '../core/types.js';
import type { EncryptedKey } from './types.js';

const log = createChildLogger('key-manager');

// LRU cache with TTL for decrypted keys — auto-evicts after 5 minutes, max 100 keys
const keyCache = new LRUCache<string, Buffer>({
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minute TTL
  dispose: (value: Buffer, key: string) => {
    // Zeroize buffer contents on eviction
    value.fill(0);
    log.debug({ key }, 'Key evicted and zeroized');
  },
  noDisposeOnSet: false,
});

let kmsClient: KMSClient;

function getKmsClient(): KMSClient {
  if (!kmsClient) {
    kmsClient = new KMSClient({ region: config.kms.region });
  }
  return kmsClient;
}

function cacheKey(userId: string, chain: Chain): string {
  return `${userId}:${chain}`;
}

/**
 * Generate a new encrypted key pair for a user on a specific chain.
 * Returns the encrypted private key data — plaintext key is only held in memory briefly.
 */
export async function generateEncryptedKey(
  userId: string,
  chain: Chain,
  privateKeyBytes: Uint8Array
): Promise<EncryptedKey> {
  const client = getKmsClient();

  log.info({ userId, chain }, 'Encrypting key with KMS');

  const encryptResult = await client.send(
    new EncryptCommand({
      KeyId: config.kms.keyId,
      Plaintext: privateKeyBytes,
      EncryptionContext: {
        userId,
        chain,
        purpose: 'trading-agent-wallet',
      },
    })
  );

  if (!encryptResult.CiphertextBlob) {
    throw new Error('KMS encryption returned no ciphertext');
  }

  return {
    userId,
    chain,
    encryptedData: Buffer.from(encryptResult.CiphertextBlob),
    kmsKeyId: config.kms.keyId,
    createdAt: new Date(),
  };
}

/**
 * Decrypt a user's private key from KMS-encrypted storage.
 * Result is cached in LRU with 5-minute TTL. Buffers are zeroized on eviction.
 */
export async function decryptKey(encryptedKey: EncryptedKey): Promise<Buffer> {
  const ck = cacheKey(encryptedKey.userId, encryptedKey.chain);

  const cached = keyCache.get(ck);
  if (cached) return cached;

  const client = getKmsClient();

  log.info({ userId: encryptedKey.userId, chain: encryptedKey.chain }, 'Decrypting key from KMS');

  const decryptResult = await client.send(
    new DecryptCommand({
      CiphertextBlob: encryptedKey.encryptedData,
      KeyId: encryptedKey.kmsKeyId,
      EncryptionContext: {
        userId: encryptedKey.userId,
        chain: encryptedKey.chain,
        purpose: 'trading-agent-wallet',
      },
    })
  );

  if (!decryptResult.Plaintext) {
    throw new Error('KMS decryption returned no plaintext');
  }

  const plaintext = Buffer.from(decryptResult.Plaintext);
  keyCache.set(ck, plaintext);

  return plaintext;
}

/**
 * Clear all cached keys with zeroization.
 */
export function clearKeyCache(): void {
  keyCache.clear();
  log.info('Key cache cleared and zeroized');
}

/**
 * Remove a specific key from cache (triggers zeroization via dispose).
 */
export function evictCachedKey(userId: string, chain: Chain): void {
  keyCache.delete(cacheKey(userId, chain));
}

// Clear keys on process exit
process.on('exit', clearKeyCache);
process.on('SIGINT', () => { clearKeyCache(); process.exit(0); });
process.on('SIGTERM', () => { clearKeyCache(); process.exit(0); });
