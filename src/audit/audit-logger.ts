import { createChildLogger } from '../core/logger.js';
import type { PermissionTier } from '../core/types.js';

const log = createChildLogger('audit');

export interface AuditEntry {
  id: string;
  timestamp: Date;
  actor: string;
  actorTier: PermissionTier;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  success: boolean;
  error?: string;
}

// In-memory audit log (production: PostgreSQL append-only table)
const auditLog: AuditEntry[] = [];
let entryCounter = 0;

/**
 * Log an auditable action.
 */
export function audit(params: {
  actor: string;
  actorTier: PermissionTier;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  success?: boolean;
  error?: string;
}): void {
  const entry: AuditEntry = {
    id: `audit-${++entryCounter}`,
    timestamp: new Date(),
    actor: params.actor,
    actorTier: params.actorTier,
    action: params.action,
    resource: params.resource,
    details: params.details ?? {},
    success: params.success ?? true,
    error: params.error,
  };

  auditLog.push(entry);

  // Also log to structured logger for external consumption
  log.info({
    auditId: entry.id,
    actor: entry.actor,
    tier: entry.actorTier,
    action: entry.action,
    resource: entry.resource,
    success: entry.success,
  }, `AUDIT: ${entry.action}`);
}

/**
 * Get recent audit entries.
 */
export function getAuditLog(limit: number = 100, filter?: {
  actor?: string;
  action?: string;
  resource?: string;
}): AuditEntry[] {
  let entries = auditLog;

  if (filter?.actor) {
    entries = entries.filter(e => e.actor === filter.actor);
  }
  if (filter?.action) {
    entries = entries.filter(e => e.action === filter.action);
  }
  if (filter?.resource) {
    entries = entries.filter(e => e.resource === filter.resource);
  }

  return entries.slice(-limit);
}
