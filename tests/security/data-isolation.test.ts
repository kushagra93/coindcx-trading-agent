import { describe, it, expect } from 'vitest';
import {
  getUserNamespace,
  scopedRedisKey,
  extractUserIdFromKey,
  isKeyInNamespace,
  USER_DATA_KEYS,
  DataIsolationError,
} from '../../src/security/data-isolation.js';

describe('data-isolation', () => {
  describe('getUserNamespace', () => {
    it('returns ns: prefix for a user', () => {
      expect(getUserNamespace('usr_123')).toBe('ns:usr_123');
    });

    it('throws for empty userId', () => {
      expect(() => getUserNamespace('')).toThrow(DataIsolationError);
    });

    it('throws for whitespace-only userId', () => {
      expect(() => getUserNamespace('   ')).toThrow(DataIsolationError);
    });
  });

  describe('scopedRedisKey', () => {
    it('creates namespaced key', () => {
      expect(scopedRedisKey('usr_123', 'positions')).toBe('ns:usr_123:positions');
    });

    it('handles nested keys', () => {
      expect(scopedRedisKey('usr_123', 'trades:active')).toBe('ns:usr_123:trades:active');
    });

    it('handles memory keys', () => {
      expect(scopedRedisKey('usr_123', 'memory:decisions')).toBe('ns:usr_123:memory:decisions');
    });
  });

  describe('extractUserIdFromKey', () => {
    it('extracts userId from valid key', () => {
      expect(extractUserIdFromKey('ns:usr_123:positions')).toBe('usr_123');
    });

    it('returns null for non-namespaced key', () => {
      expect(extractUserIdFromKey('random:key')).toBeNull();
    });

    it('returns null for partial match', () => {
      expect(extractUserIdFromKey('ns:')).toBeNull();
    });

    it('handles complex key paths', () => {
      expect(extractUserIdFromKey('ns:user-abc:memory:chat')).toBe('user-abc');
    });
  });

  describe('isKeyInNamespace', () => {
    it('returns true for key in namespace', () => {
      expect(isKeyInNamespace('ns:usr_123:positions', 'usr_123')).toBe(true);
    });

    it('returns false for key in different namespace', () => {
      expect(isKeyInNamespace('ns:usr_456:positions', 'usr_123')).toBe(false);
    });

    it('returns false for key without namespace', () => {
      expect(isKeyInNamespace('global:setting', 'usr_123')).toBe(false);
    });
  });

  describe('USER_DATA_KEYS', () => {
    it('has all standard keys', () => {
      expect(USER_DATA_KEYS.positions).toBe('positions');
      expect(USER_DATA_KEYS.trades).toBe('trades');
      expect(USER_DATA_KEYS.riskSettings).toBe('risk:settings');
      expect(USER_DATA_KEYS.portfolio).toBe('portfolio');
      expect(USER_DATA_KEYS.memoryDecisions).toBe('memory:decisions');
      expect(USER_DATA_KEYS.walletBalances).toBe('wallet:balances');
      expect(USER_DATA_KEYS.agentConfig).toBe('agent:config');
    });
  });

  describe('DataIsolationError', () => {
    it('is an instance of Error', () => {
      const err = new DataIsolationError('test');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('DataIsolationError');
      expect(err.message).toBe('test');
    });
  });
});
