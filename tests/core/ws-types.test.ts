import { describe, it, expect } from 'vitest';
import {
  isValidDownstreamType,
  isValidUpstreamType,
  WS_CLOSE_CODES,
  WS_PING_INTERVAL_MS,
  WS_PONG_TIMEOUT_MS,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_MAX_MS,
  WS_OFFLINE_QUEUE_LIMIT,
  GW_REDIS_KEYS,
} from '../../src/core/ws-types.js';

describe('ws-types', () => {
  describe('isValidDownstreamType', () => {
    it('allows master-only types', () => {
      expect(isValidDownstreamType('command')).toBe(true);
      expect(isValidDownstreamType('emergency')).toBe(true);
      expect(isValidDownstreamType('policy-update')).toBe(true);
      expect(isValidDownstreamType('trade-approval')).toBe(true);
      expect(isValidDownstreamType('compliance-result')).toBe(true);
      expect(isValidDownstreamType('helper-task')).toBe(true);
    });

    it('rejects agent-only types', () => {
      expect(isValidDownstreamType('ack')).toBe(false);
      expect(isValidDownstreamType('event')).toBe(false);
      expect(isValidDownstreamType('heartbeat')).toBe(false);
      expect(isValidDownstreamType('helper-result')).toBe(false);
    });

    it('rejects shared types as not downstream-only', () => {
      expect(isValidDownstreamType('market-data')).toBe(false);
    });
  });

  describe('isValidUpstreamType', () => {
    it('allows agent types', () => {
      expect(isValidUpstreamType('ack')).toBe(true);
      expect(isValidUpstreamType('event')).toBe(true);
      expect(isValidUpstreamType('heartbeat')).toBe(true);
      expect(isValidUpstreamType('helper-result')).toBe(true);
    });

    it('rejects master-only types', () => {
      expect(isValidUpstreamType('command')).toBe(false);
      expect(isValidUpstreamType('emergency')).toBe(false);
      expect(isValidUpstreamType('policy-update')).toBe(false);
      expect(isValidUpstreamType('trade-approval')).toBe(false);
      expect(isValidUpstreamType('helper-task')).toBe(false);
    });
  });

  describe('WS_CLOSE_CODES', () => {
    it('has standard and custom codes', () => {
      expect(WS_CLOSE_CODES.NORMAL).toBe(1000);
      expect(WS_CLOSE_CODES.GOING_AWAY).toBe(1001);
      expect(WS_CLOSE_CODES.AUTH_FAILED).toBe(4001);
      expect(WS_CLOSE_CODES.DUPLICATE_AGENT).toBe(4002);
      expect(WS_CLOSE_CODES.HUB_SHUTDOWN).toBe(4003);
      expect(WS_CLOSE_CODES.DIRECTION_VIOLATION).toBe(4004);
    });
  });

  describe('constants', () => {
    it('has sensible defaults', () => {
      expect(WS_PING_INTERVAL_MS).toBe(30_000);
      expect(WS_PONG_TIMEOUT_MS).toBe(10_000);
      expect(WS_RECONNECT_BASE_MS).toBe(1_000);
      expect(WS_RECONNECT_MAX_MS).toBe(30_000);
      expect(WS_OFFLINE_QUEUE_LIMIT).toBe(200);
    });
  });

  describe('GW_REDIS_KEYS', () => {
    it('generates agent gateway key', () => {
      expect(GW_REDIS_KEYS.agentGateway('agent-1')).toBe('agent-gw:agent-1');
    });

    it('generates gateway channel key', () => {
      expect(GW_REDIS_KEYS.gatewayChannel('gw-abc')).toBe('internal:gw:gw-abc');
    });

    it('has static broadcast channel', () => {
      expect(GW_REDIS_KEYS.broadcastChannel).toBe('ops:broadcast');
    });

    it('generates offline queue key', () => {
      expect(GW_REDIS_KEYS.offlineQueue('agent-1')).toBe('q:agent-1');
    });

    it('generates ack queue key', () => {
      expect(GW_REDIS_KEYS.ackQueue('corr-123')).toBe('ack:corr-123');
    });

    it('generates strategy params key', () => {
      expect(GW_REDIS_KEYS.strategyParams('agent-1')).toBe('strategy:agent-1');
    });

    it('has static keys for manifest and config', () => {
      expect(GW_REDIS_KEYS.manifest).toBe('ops:manifest');
      expect(GW_REDIS_KEYS.manifestUpdate).toBe('ops:manifest-update');
      expect(GW_REDIS_KEYS.hotConfig).toBe('ops:config');
      expect(GW_REDIS_KEYS.hotConfigUpdate).toBe('ops:config-update');
      expect(GW_REDIS_KEYS.latestCheckpoint).toBe('ops:latest');
      expect(GW_REDIS_KEYS.upstreamEvents).toBe('stream:agent:events');
      expect(GW_REDIS_KEYS.upstreamGroup).toBe('master-consumers');
    });
  });
});
