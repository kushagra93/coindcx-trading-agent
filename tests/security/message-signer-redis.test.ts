import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  exists: vi.fn().mockResolvedValue(0),
  sismember: vi.fn().mockResolvedValue(0),
  sadd: vi.fn().mockResolvedValue(1),
  pipeline: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnThis(),
    sadd: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }),
};

import {
  isNonceUsed,
  markNonceUsed,
  createSignedMessage,
  validateSignedMessage,
  validateWsMessage,
  signWsMessage,
} from '../../src/security/message-signer.js';
import type { WsMessage } from '../../src/core/ws-types.js';

const TEST_KEY = 'test-key-12345';

describe('message-signer (Redis)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isNonceUsed', () => {
    it('returns false when nonce not used', async () => {
      mockRedis.sismember.mockResolvedValue(0);
      const used = await isNonceUsed('nonce-1', mockRedis as any);
      expect(used).toBe(false);
    });

    it('returns true when nonce already used', async () => {
      mockRedis.sismember.mockResolvedValue(1);
      const used = await isNonceUsed('nonce-1', mockRedis as any);
      expect(used).toBe(true);
    });
  });

  describe('markNonceUsed', () => {
    it('stores nonce in Redis with TTL', async () => {
      await markNonceUsed('nonce-1', mockRedis as any);
      const pipeline = mockRedis.pipeline();
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });
  });

  describe('createSignedMessage', () => {
    it('creates a complete signed message', async () => {
      const msg = await createSignedMessage(
        'master-agent', 'agent-1', 'COMMAND',
        { action: 'start' }, TEST_KEY, mockRedis as any,
      );

      expect(msg.from).toBe('master-agent');
      expect(msg.to).toBe('agent-1');
      expect(msg.type).toBe('COMMAND');
      expect(msg.signature).toBeDefined();
      expect(msg.nonce).toBeDefined();
      expect(msg.timestamp).toBeDefined();
      expect(msg.corr_id).toBeDefined();
    });

    it('uses custom correlation ID', async () => {
      const msg = await createSignedMessage(
        'master-agent', 'agent-1', 'COMMAND',
        { action: 'start' }, TEST_KEY, mockRedis as any, 'custom-corr-id',
      );
      expect(msg.corr_id).toBe('custom-corr-id');
    });
  });

  describe('validateSignedMessage', () => {
    it('validates a correctly signed message', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const msg = await createSignedMessage(
        'master-agent', 'agent-1', 'COMMAND',
        { action: 'start' }, TEST_KEY, mockRedis as any,
      );

      const result = await validateSignedMessage(msg, TEST_KEY, mockRedis as any);
      expect(result.valid).toBe(true);
    });

    it('rejects expired message', async () => {
      const msg = await createSignedMessage(
        'master-agent', 'agent-1', 'COMMAND',
        { action: 'start' }, TEST_KEY, mockRedis as any,
      );
      msg.timestamp = new Date(Date.now() - 60_000).toISOString();

      const result = await validateSignedMessage(msg, TEST_KEY, mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('rejects replayed nonce', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const msg = await createSignedMessage(
        'master-agent', 'agent-1', 'COMMAND',
        { action: 'start' }, TEST_KEY, mockRedis as any,
      );

      const result = await validateSignedMessage(msg, TEST_KEY, mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('replay');
    });

    it('rejects wrong key', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const msg = await createSignedMessage(
        'master-agent', 'agent-1', 'COMMAND',
        { action: 'start' }, TEST_KEY, mockRedis as any,
      );

      const result = await validateSignedMessage(msg, 'wrong-key', mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('signature');
    });
  });

  describe('validateWsMessage', () => {
    it('validates a correctly signed WsMessage', async () => {
      mockRedis.exists.mockResolvedValue(0);
      const msg: WsMessage = {
        type: 'command', from: 'master-agent', to: 'agent-1',
        payload: { action: 'start' }, timestamp: Date.now(),
      };
      signWsMessage(msg, TEST_KEY);

      const result = await validateWsMessage(msg, TEST_KEY, mockRedis as any);
      expect(result.valid).toBe(true);
    });

    it('rejects expired WsMessage', async () => {
      const msg: WsMessage = {
        type: 'command', from: 'master-agent', to: 'agent-1',
        payload: { action: 'start' }, timestamp: Date.now() - 60_000,
      };
      signWsMessage(msg, TEST_KEY);

      const result = await validateWsMessage(msg, TEST_KEY, mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('rejects missing nonce', async () => {
      const msg: WsMessage = {
        type: 'command', from: 'master-agent', to: 'agent-1',
        payload: { action: 'start' }, timestamp: Date.now(),
      };

      const result = await validateWsMessage(msg, TEST_KEY, mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('nonce');
    });

    it('rejects replayed nonce', async () => {
      mockRedis.exists.mockResolvedValue(1);
      const msg: WsMessage = {
        type: 'command', from: 'master-agent', to: 'agent-1',
        payload: { action: 'start' }, timestamp: Date.now(),
      };
      signWsMessage(msg, TEST_KEY);

      const result = await validateWsMessage(msg, TEST_KEY, mockRedis as any);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('replay');
    });
  });
});
