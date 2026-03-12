import { createChildLogger } from '../core/logger.js';
import type { PermissionTier, AuthContext } from '../core/types.js';
import { audit } from '../audit/audit-logger.js';

const log = createChildLogger('permissions');

// Action permissions by tier
const PERMISSIONS: Record<string, PermissionTier[]> = {
  // Admin only
  'admin.emergency-halt': ['admin'],
  'admin.force-close-positions': ['admin'],
  'admin.modify-global-bounds': ['admin'],
  'admin.broadcast-update': ['admin'],
  'admin.deploy-version': ['admin'],

  // Admin + Ops
  'ops.pause-agent': ['admin', 'ops'],
  'ops.resume-agent': ['admin', 'ops'],
  'ops.adjust-risk-params': ['admin', 'ops'],
  'ops.view-user-configs': ['admin', 'ops'],
  'ops.view-trade-logs': ['admin', 'ops'],
  'ops.reset-circuit-breaker': ['admin', 'ops'],

  // Broker tier — regional broker agents
  'broker.approve-trade': ['admin', 'broker'],
  'broker.compliance-check': ['admin', 'broker'],
  'broker.manage-user-agents': ['admin', 'broker'],
  'broker.aggregate-fees': ['admin', 'broker'],
  'broker.position-limits': ['admin', 'broker'],
  'broker.kyc-gate': ['admin', 'broker'],
  'broker.view-managed-users': ['admin', 'broker'],
  'broker.dual-sign-withdrawal': ['admin', 'broker'],

  // All tiers
  'user.configure-strategy': ['admin', 'broker', 'ops', 'user'],
  'user.deposit': ['admin', 'broker', 'ops', 'user'],
  'user.withdraw': ['admin', 'broker', 'ops', 'user'],
  'user.start-agent': ['admin', 'broker', 'ops', 'user'],
  'user.stop-agent': ['admin', 'broker', 'ops', 'user'],
  'user.view-portfolio': ['admin', 'broker', 'ops', 'user'],
  'user.view-positions': ['admin', 'broker', 'ops', 'user'],
  'user.view-trades': ['admin', 'broker', 'ops', 'user'],
  'user.set-risk': ['admin', 'broker', 'ops', 'user'],

  // Supervisor / Master Agent
  'supervisor.manage-agents': ['admin'],
  'supervisor.override-risk': ['admin'],
  'supervisor.manage-policies': ['admin'],
  'supervisor.view-monitoring': ['admin', 'ops'],
  'supervisor.emergency-halt': ['admin'],
  'supervisor.deploy-strategy': ['admin'],
  'supervisor.issue-certificate': ['admin'],
  'supervisor.revoke-certificate': ['admin'],
  'supervisor.view-fee-ledger': ['admin', 'ops'],
  'supervisor.generate-report': ['admin', 'ops'],
};

/**
 * Check if a user has permission to perform an action.
 */
export function hasPermission(context: AuthContext, action: string): boolean {
  const allowedTiers = PERMISSIONS[action];

  if (!allowedTiers) {
    log.warn({ action, userId: context.userId }, 'Unknown permission action');
    return false;
  }

  return allowedTiers.includes(context.tier);
}

/**
 * Assert permission, throwing if denied.
 */
export function assertPermission(context: AuthContext, action: string): void {
  if (!hasPermission(context, action)) {
    audit({
      actor: context.userId,
      actorTier: context.tier,
      action,
      resource: 'permission-check',
      success: false,
      error: 'Permission denied',
    });

    throw new PermissionError(
      `Permission denied: ${context.tier} cannot perform ${action}`,
      context.tier,
      action
    );
  }
}

/**
 * Check if an action targets the user's own resources, or requires cross-user access.
 */
export function canAccessUser(context: AuthContext, targetUserId: string): boolean {
  // Admin, ops, and broker can access any user
  if (context.tier === 'admin' || context.tier === 'ops' || context.tier === 'broker') return true;

  // Users can only access their own resources
  return context.userId === targetUserId;
}

export class PermissionError extends Error {
  constructor(
    message: string,
    public readonly tier: PermissionTier,
    public readonly action: string
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}
