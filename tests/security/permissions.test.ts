import { describe, it, expect, vi } from 'vitest';
import { hasPermission, assertPermission, canAccessUser, PermissionError } from '../../src/permissions/permissions.js';
import type { AuthContext } from '../../src/core/types.js';

vi.mock('../../src/audit/audit-logger.js', () => ({
  audit: vi.fn().mockResolvedValue({}),
}));

function ctx(tier: string, userId = 'user-1'): AuthContext {
  return { tier: tier as any, userId } as AuthContext;
}

describe('permissions', () => {
  describe('hasPermission', () => {
    it('allows admin to do admin actions', () => {
      expect(hasPermission(ctx('admin'), 'admin.emergency-halt')).toBe(true);
      expect(hasPermission(ctx('admin'), 'admin.force-close-positions')).toBe(true);
    });

    it('denies user from admin actions', () => {
      expect(hasPermission(ctx('user'), 'admin.emergency-halt')).toBe(false);
      expect(hasPermission(ctx('user'), 'admin.force-close-positions')).toBe(false);
    });

    it('allows user to do user actions', () => {
      expect(hasPermission(ctx('user'), 'user.configure-strategy')).toBe(true);
      expect(hasPermission(ctx('user'), 'user.view-portfolio')).toBe(true);
      expect(hasPermission(ctx('user'), 'user.start-agent')).toBe(true);
    });

    it('allows admin+ops for ops actions', () => {
      expect(hasPermission(ctx('admin'), 'ops.pause-agent')).toBe(true);
      expect(hasPermission(ctx('ops'), 'ops.pause-agent')).toBe(true);
      expect(hasPermission(ctx('user'), 'ops.pause-agent')).toBe(false);
    });

    it('allows broker tier for broker actions', () => {
      expect(hasPermission(ctx('broker'), 'broker.approve-trade')).toBe(true);
      expect(hasPermission(ctx('admin'), 'broker.approve-trade')).toBe(true);
      expect(hasPermission(ctx('user'), 'broker.approve-trade')).toBe(false);
    });

    it('returns false for unknown action', () => {
      expect(hasPermission(ctx('admin'), 'nonexistent.action')).toBe(false);
    });
  });

  describe('assertPermission', () => {
    it('does not throw for allowed action', () => {
      expect(() => assertPermission(ctx('admin'), 'admin.emergency-halt')).not.toThrow();
    });

    it('throws PermissionError for denied action', () => {
      expect(() => assertPermission(ctx('user'), 'admin.emergency-halt')).toThrow(PermissionError);
    });

    it('PermissionError has correct properties', () => {
      try {
        assertPermission(ctx('user'), 'admin.emergency-halt');
      } catch (err) {
        expect(err).toBeInstanceOf(PermissionError);
        expect((err as PermissionError).tier).toBe('user');
        expect((err as PermissionError).action).toBe('admin.emergency-halt');
      }
    });
  });

  describe('canAccessUser', () => {
    it('admin can access any user', () => {
      expect(canAccessUser(ctx('admin', 'admin-1'), 'other-user')).toBe(true);
    });

    it('ops can access any user', () => {
      expect(canAccessUser(ctx('ops', 'ops-1'), 'other-user')).toBe(true);
    });

    it('broker can access any user', () => {
      expect(canAccessUser(ctx('broker', 'broker-1'), 'other-user')).toBe(true);
    });

    it('user can access own resources', () => {
      expect(canAccessUser(ctx('user', 'user-1'), 'user-1')).toBe(true);
    });

    it('user cannot access other user resources', () => {
      expect(canAccessUser(ctx('user', 'user-1'), 'user-2')).toBe(false);
    });
  });

  describe('PermissionError', () => {
    it('extends Error', () => {
      const err = new PermissionError('test', 'user' as any, 'action');
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('PermissionError');
      expect(err.message).toBe('test');
      expect(err.tier).toBe('user');
      expect(err.action).toBe('action');
    });
  });
});
