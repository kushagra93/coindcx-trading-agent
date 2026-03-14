import { describe, it, expect, vi } from 'vitest';
import {
  signPayload,
  verifySignature,
  isTimestampValid,
  signWsMessage,
  verifyWsSignature,
  isWsTimestampFresh,
} from '../../src/security/message-signer.js';
import type { WsMessage } from '../../src/core/ws-types.js';

const TEST_KEY = 'test-secret-key-12345';

describe('message-signer', () => {
  describe('signPayload + verifySignature', () => {
    const from = 'master-agent';
    const to = 'agent-1';
    const type = 'COMMAND' as any;
    const payload = { action: 'start' };
    const timestamp = new Date().toISOString();
    const nonce = 'nonce-123';
    const corrId = 'corr-456';

    it('produces a hex signature', () => {
      const sig = signPayload(from, to, type, payload, timestamp, nonce, corrId, TEST_KEY);
      expect(sig).toMatch(/^[0-9a-f]+$/);
      expect(sig.length).toBe(64);
    });

    it('verifies correct signature', () => {
      const sig = signPayload(from, to, type, payload, timestamp, nonce, corrId, TEST_KEY);
      const msg = { from, to, type, payload, signature: sig, timestamp, nonce, corr_id: corrId } as any;
      expect(verifySignature(msg, TEST_KEY)).toBe(true);
    });

    it('rejects wrong key', () => {
      const sig = signPayload(from, to, type, payload, timestamp, nonce, corrId, TEST_KEY);
      const msg = { from, to, type, payload, signature: sig, timestamp, nonce, corr_id: corrId } as any;
      expect(verifySignature(msg, 'wrong-key')).toBe(false);
    });

    it('rejects tampered payload', () => {
      const sig = signPayload(from, to, type, payload, timestamp, nonce, corrId, TEST_KEY);
      const msg = { from, to, type, payload: { action: 'stop' }, signature: sig, timestamp, nonce, corr_id: corrId } as any;
      expect(verifySignature(msg, TEST_KEY)).toBe(false);
    });

    it('rejects tampered from field', () => {
      const sig = signPayload(from, to, type, payload, timestamp, nonce, corrId, TEST_KEY);
      const msg = { from: 'imposter', to, type, payload, signature: sig, timestamp, nonce, corr_id: corrId } as any;
      expect(verifySignature(msg, TEST_KEY)).toBe(false);
    });

    it('produces deterministic signatures for same input', () => {
      const sig1 = signPayload(from, to, type, payload, timestamp, nonce, corrId, TEST_KEY);
      const sig2 = signPayload(from, to, type, payload, timestamp, nonce, corrId, TEST_KEY);
      expect(sig1).toBe(sig2);
    });

    it('produces different signatures for different nonces', () => {
      const sig1 = signPayload(from, to, type, payload, timestamp, 'nonce-1', corrId, TEST_KEY);
      const sig2 = signPayload(from, to, type, payload, timestamp, 'nonce-2', corrId, TEST_KEY);
      expect(sig1).not.toBe(sig2);
    });

    it('canonicalizes payload key order', () => {
      const payload1 = { b: 2, a: 1 };
      const payload2 = { a: 1, b: 2 };
      const sig1 = signPayload(from, to, type, payload1, timestamp, nonce, corrId, TEST_KEY);
      const sig2 = signPayload(from, to, type, payload2, timestamp, nonce, corrId, TEST_KEY);
      expect(sig1).toBe(sig2);
    });
  });

  describe('isTimestampValid', () => {
    it('accepts recent timestamp', () => {
      const ts = new Date().toISOString();
      expect(isTimestampValid(ts)).toBe(true);
    });

    it('rejects expired timestamp', () => {
      const ts = new Date(Date.now() - 60_000).toISOString();
      expect(isTimestampValid(ts)).toBe(false);
    });

    it('rejects far-future timestamp', () => {
      const ts = new Date(Date.now() + 60_000).toISOString();
      expect(isTimestampValid(ts)).toBe(false);
    });

    it('tolerates small clock skew (5s)', () => {
      const ts = new Date(Date.now() + 3_000).toISOString();
      expect(isTimestampValid(ts)).toBe(true);
    });

    it('rejects invalid date string', () => {
      expect(isTimestampValid('not-a-date')).toBe(false);
    });

    it('accepts custom maxAgeMs', () => {
      const ts = new Date(Date.now() - 50_000).toISOString();
      expect(isTimestampValid(ts, 60_000)).toBe(true);
      expect(isTimestampValid(ts, 30_000)).toBe(false);
    });
  });

  describe('signWsMessage + verifyWsSignature', () => {
    function makeMsg(): WsMessage {
      return {
        type: 'command',
        from: 'master-agent',
        to: 'agent-1',
        payload: { action: 'start', value: 42 },
        timestamp: Date.now(),
        corrId: 'corr-789',
      };
    }

    it('signs and verifies a WsMessage', () => {
      const msg = makeMsg();
      signWsMessage(msg, TEST_KEY);
      expect(msg.signature).toBeDefined();
      expect(msg.nonce).toBeDefined();
      expect(verifyWsSignature(msg, TEST_KEY)).toBe(true);
    });

    it('rejects wrong key', () => {
      const msg = makeMsg();
      signWsMessage(msg, TEST_KEY);
      expect(verifyWsSignature(msg, 'wrong-key')).toBe(false);
    });

    it('rejects tampered payload', () => {
      const msg = makeMsg();
      signWsMessage(msg, TEST_KEY);
      msg.payload.action = 'stop';
      expect(verifyWsSignature(msg, TEST_KEY)).toBe(false);
    });

    it('rejects missing signature', () => {
      const msg = makeMsg();
      expect(verifyWsSignature(msg, TEST_KEY)).toBe(false);
    });

    it('rejects missing nonce', () => {
      const msg = makeMsg();
      msg.signature = 'fake';
      expect(verifyWsSignature(msg, TEST_KEY)).toBe(false);
    });

    it('generates unique nonces per call', () => {
      const msg1 = makeMsg();
      const msg2 = makeMsg();
      signWsMessage(msg1, TEST_KEY);
      signWsMessage(msg2, TEST_KEY);
      expect(msg1.nonce).not.toBe(msg2.nonce);
    });

    it('handles message without corrId', () => {
      const msg: WsMessage = {
        type: 'emergency',
        from: 'master-agent',
        to: '*',
        payload: { reason: 'halt' },
        timestamp: Date.now(),
      };
      signWsMessage(msg, TEST_KEY);
      expect(verifyWsSignature(msg, TEST_KEY)).toBe(true);
    });
  });

  describe('isWsTimestampFresh', () => {
    it('accepts current timestamp', () => {
      expect(isWsTimestampFresh(Date.now())).toBe(true);
    });

    it('rejects expired timestamp', () => {
      expect(isWsTimestampFresh(Date.now() - 60_000)).toBe(false);
    });

    it('rejects far-future timestamp', () => {
      expect(isWsTimestampFresh(Date.now() + 60_000)).toBe(false);
    });

    it('tolerates small clock skew', () => {
      expect(isWsTimestampFresh(Date.now() + 3_000)).toBe(true);
    });

    it('respects custom maxAgeMs', () => {
      const ts = Date.now() - 50_000;
      expect(isWsTimestampFresh(ts, 60_000)).toBe(true);
      expect(isWsTimestampFresh(ts, 30_000)).toBe(false);
    });
  });
});
