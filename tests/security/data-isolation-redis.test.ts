import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  sismember: vi.fn().mockResolvedValue(0),
  sadd: vi.fn().mockResolvedValue(1),
  srem: vi.fn().mockResolvedValue(1),
  smembers: vi.fn().mockResolvedValue([]),
  scan: vi.fn().mockResolvedValue(['0', []]),
};

import {
  registerNamespaceOwner,
  getNamespaceOwner,
  assertNamespaceAccess,
  setUserData,
  getUserData,
  deleteUserData,
  listUserKeys,
  purgeUserNamespace,
  assignUserToBroker,
  unassignUserFromBroker,
  getBrokerUsers,
  DataIsolationError,
} from '../../src/security/data-isolation.js';

describe('data-isolation (Redis)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerNamespaceOwner', () => {
    it('sets owner in Redis', async () => {
      await registerNamespaceOwner('user-1', 'agent-1', mockRedis as any);
      expect(mockRedis.set).toHaveBeenCalledWith('ns:user-1:owner', 'agent-1');
    });
  });

  describe('getNamespaceOwner', () => {
    it('returns null when no owner', async () => {
      mockRedis.get.mockResolvedValue(null);
      const owner = await getNamespaceOwner('user-1', mockRedis as any);
      expect(owner).toBeNull();
    });

    it('returns agent ID when owner exists', async () => {
      mockRedis.get.mockResolvedValue('agent-1');
      const owner = await getNamespaceOwner('user-1', mockRedis as any);
      expect(owner).toBe('agent-1');
    });
  });

  describe('assertNamespaceAccess', () => {
    it('allows master agent access', async () => {
      await expect(
        assertNamespaceAccess('master-agent', 'master', 'any-user', mockRedis as any)
      ).resolves.toBeUndefined();
    });

    it('allows broker access to managed user', async () => {
      mockRedis.sismember.mockResolvedValue(1);
      await expect(
        assertNamespaceAccess('broker-US', 'broker', 'user-1', mockRedis as any)
      ).resolves.toBeUndefined();
    });

    it('denies broker access to unmanaged user', async () => {
      mockRedis.sismember.mockResolvedValue(0);
      await expect(
        assertNamespaceAccess('broker-US', 'broker', 'user-1', mockRedis as any)
      ).rejects.toThrow(DataIsolationError);
    });

    it('allows user agent that owns namespace', async () => {
      mockRedis.get.mockResolvedValueOnce('agent-1');
      await expect(
        assertNamespaceAccess('agent-1', 'user', 'user-1', mockRedis as any)
      ).resolves.toBeUndefined();
    });

    it('allows agent with active task for user', async () => {
      mockRedis.get
        .mockResolvedValueOnce('other-agent')
        .mockResolvedValueOnce('user-1');
      await expect(
        assertNamespaceAccess('helper-1', 'helper', 'user-1', mockRedis as any)
      ).resolves.toBeUndefined();
    });

    it('denies user agent without ownership or task', async () => {
      mockRedis.get
        .mockResolvedValueOnce('other-agent')
        .mockResolvedValueOnce(null);
      await expect(
        assertNamespaceAccess('agent-wrong', 'user', 'user-1', mockRedis as any)
      ).rejects.toThrow(DataIsolationError);
    });
  });

  describe('setUserData / getUserData / deleteUserData', () => {
    it('sets data in namespaced key', async () => {
      await setUserData('user-1', 'positions', '[]', mockRedis as any);
      expect(mockRedis.set).toHaveBeenCalledWith('ns:user-1:positions', '[]');
    });

    it('sets data with TTL', async () => {
      await setUserData('user-1', 'cache', 'data', mockRedis as any, 300);
      expect(mockRedis.set).toHaveBeenCalledWith('ns:user-1:cache', 'data', 'EX', 300);
    });

    it('gets data from namespaced key', async () => {
      mockRedis.get.mockResolvedValue('{"balance": 100}');
      const data = await getUserData('user-1', 'portfolio', mockRedis as any);
      expect(data).toBe('{"balance": 100}');
    });

    it('deletes data from namespaced key', async () => {
      await deleteUserData('user-1', 'old-data', mockRedis as any);
      expect(mockRedis.del).toHaveBeenCalledWith('ns:user-1:old-data');
    });
  });

  describe('listUserKeys', () => {
    it('returns empty array when no keys', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      const keys = await listUserKeys('user-1', mockRedis as any);
      expect(keys).toEqual([]);
    });

    it('returns keys matching pattern', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['ns:user-1:positions', 'ns:user-1:trades']]);
      const keys = await listUserKeys('user-1', mockRedis as any);
      expect(keys).toEqual(['ns:user-1:positions', 'ns:user-1:trades']);
    });
  });

  describe('purgeUserNamespace', () => {
    it('returns 0 when no keys to delete', async () => {
      mockRedis.scan.mockResolvedValue(['0', []]);
      const count = await purgeUserNamespace('user-1', mockRedis as any);
      expect(count).toBe(0);
    });

    it('deletes all keys and returns count', async () => {
      mockRedis.scan.mockResolvedValue(['0', ['ns:user-1:a', 'ns:user-1:b']]);
      const count = await purgeUserNamespace('user-1', mockRedis as any);
      expect(count).toBe(2);
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('broker user management', () => {
    it('assigns user to broker', async () => {
      await assignUserToBroker('user-1', 'broker-US', mockRedis as any);
      expect(mockRedis.sadd).toHaveBeenCalledWith('broker:broker-US:users', 'user-1');
    });

    it('unassigns user from broker', async () => {
      await unassignUserFromBroker('user-1', 'broker-US', mockRedis as any);
      expect(mockRedis.srem).toHaveBeenCalledWith('broker:broker-US:users', 'user-1');
    });

    it('gets broker users', async () => {
      mockRedis.smembers.mockResolvedValue(['user-1', 'user-2']);
      const users = await getBrokerUsers('broker-US', mockRedis as any);
      expect(users).toEqual(['user-1', 'user-2']);
    });
  });
});
