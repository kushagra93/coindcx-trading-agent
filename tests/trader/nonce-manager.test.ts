import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = {
  exists: vi.fn().mockResolvedValue(1),
  incr: vi.fn().mockResolvedValue(42),
  expire: vi.fn().mockResolvedValue(1),
  set: vi.fn().mockResolvedValue('OK'),
  get: vi.fn().mockResolvedValue('10'),
  decr: vi.fn().mockResolvedValue(9),
  del: vi.fn().mockResolvedValue(1),
};

const mockProvider = {
  getTransactionCount: vi.fn().mockResolvedValue(100),
};

vi.mock('../../src/core/redis.js', () => ({
  getRedis: () => mockRedis,
}));

vi.mock('../../src/wallet/evm-wallet.js', () => ({
  getProvider: () => mockProvider,
}));

import {
  getNextNonce,
  rollbackNonce,
} from '../../src/trader/nonce-manager.js';

describe('nonce-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.incr.mockResolvedValue(42);
    mockRedis.get.mockResolvedValue('10');
  });

  describe('getNextNonce', () => {
    it('returns incremented nonce when key exists', async () => {
      const nonce = await getNextNonce('0xWallet123');
      expect(nonce).toBe(42);
      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('initializes from chain when key does not exist and acquires lock', async () => {
      mockRedis.exists.mockResolvedValueOnce(0);
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.incr.mockResolvedValue(100);
      mockProvider.getTransactionCount.mockResolvedValue(100);

      const nonce = await getNextNonce('0xWallet123', 1);
      expect(nonce).toBe(100);
      expect(mockProvider.getTransactionCount).toHaveBeenCalledWith('0xWallet123', 'pending');
    });

    it('waits for initialization when lock not acquired', async () => {
      mockRedis.exists
        .mockResolvedValueOnce(0)   // first check: key doesn't exist
        .mockResolvedValueOnce(1);  // after waiting: key now exists
      mockRedis.set.mockResolvedValueOnce(null);  // lock not acquired
      mockRedis.incr.mockResolvedValue(50);

      const nonce = await getNextNonce('0xWallet123');
      expect(nonce).toBe(50);
    });
  });

  describe('rollbackNonce', () => {
    it('decrements nonce when current > 0', async () => {
      mockRedis.get.mockResolvedValue('5');
      await rollbackNonce('0xWallet123');
      expect(mockRedis.decr).toHaveBeenCalled();
    });

    it('does nothing when nonce is null', async () => {
      mockRedis.get.mockResolvedValue(null);
      await rollbackNonce('0xWallet123');
      expect(mockRedis.decr).not.toHaveBeenCalled();
    });

    it('does nothing when nonce is 0', async () => {
      mockRedis.get.mockResolvedValue('0');
      await rollbackNonce('0xWallet123');
      expect(mockRedis.decr).not.toHaveBeenCalled();
    });

    it('supports chain-specific key', async () => {
      mockRedis.get.mockResolvedValue('3');
      await rollbackNonce('0xWallet123', 137);
      expect(mockRedis.decr).toHaveBeenCalled();
    });
  });
});
