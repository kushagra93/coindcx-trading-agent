import { createHash, randomUUID } from 'node:crypto';
import { createChildLogger } from '../core/logger.js';
import type { PermissionTier } from '../core/types.js';
import type { ImmutableAuditEntry, AgentTier } from '../security/types.js';
import { SECURITY_DEFAULTS } from '../security/types.js';

const log = createChildLogger('audit');

// ===== Legacy Interface (kept for backward compatibility) =====

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

// ===== Immutable Audit Log with Hash Chain =====

/**
 * In-memory append-only audit log with SHA-256 hash chain.
 * Each entry's hash includes the previous entry's hash,
 * forming a tamper-evident chain.
 *
 * Production: PostgreSQL append-only table with INSERT-only grants.
 * The hash chain is still computed for tamper detection.
 */
const auditLog: ImmutableAuditEntry[] = [];
let sequenceCounter = 0;
let lastEntryHash = '0'.repeat(64); // Genesis hash

/**
 * Compute SHA-256 hash of an audit entry including the previous entry's hash.
 * This creates a hash chain: modifying any earlier entry invalidates all subsequent hashes.
 */
function computeEntryHash(entry: Omit<ImmutableAuditEntry, 'entryHash'>): string {
  const data = JSON.stringify({
    id: entry.id,
    sequence: entry.sequence,
    timestamp: entry.timestamp,
    actor: entry.actor,
    actorTier: entry.actorTier,
    action: entry.action,
    resource: entry.resource,
    details: entry.details,
    success: entry.success,
    error: entry.error,
    previousHash: entry.previousHash,
    corr_id: entry.corr_id,
  });

  return createHash(SECURITY_DEFAULTS.AUDIT_HASH_ALGO)
    .update(data)
    .digest('hex');
}

/**
 * Log an auditable action to the immutable audit log.
 * Supports both the legacy PermissionTier and the new AgentTier for actorTier.
 */
export function audit(params: {
  actor: string;
  actorTier: PermissionTier | AgentTier | 'admin' | 'ops' | 'system';
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  success?: boolean;
  error?: string;
  corr_id?: string;
}): ImmutableAuditEntry {
  const sequence = ++sequenceCounter;
  const id = `audit-${randomUUID()}`;
  const timestamp = new Date().toISOString();

  const entryWithoutHash: Omit<ImmutableAuditEntry, 'entryHash'> = {
    id,
    sequence,
    timestamp,
    actor: params.actor,
    actorTier: params.actorTier as ImmutableAuditEntry['actorTier'],
    action: params.action,
    resource: params.resource,
    details: params.details ?? {},
    success: params.success ?? true,
    error: params.error,
    previousHash: lastEntryHash,
    corr_id: params.corr_id,
  };

  const entryHash = computeEntryHash(entryWithoutHash);

  const entry: ImmutableAuditEntry = {
    ...entryWithoutHash,
    entryHash,
  };

  // Append to log (never modify/delete)
  auditLog.push(entry);
  lastEntryHash = entryHash;

  // Also log to structured logger for streaming/external consumption
  log.info({
    auditId: entry.id,
    sequence: entry.sequence,
    actor: entry.actor,
    tier: entry.actorTier,
    action: entry.action,
    resource: entry.resource,
    success: entry.success,
    corr_id: entry.corr_id,
    entryHash: entry.entryHash.substring(0, 16) + '...',
  }, `AUDIT: ${entry.action}`);

  return entry;
}

/**
 * Get recent audit entries.
 */
export function getAuditLog(limit: number = 100, filter?: {
  actor?: string;
  action?: string;
  resource?: string;
  corr_id?: string;
  actorTier?: string;
}): ImmutableAuditEntry[] {
  let entries: ImmutableAuditEntry[] = auditLog;

  if (filter?.actor) {
    entries = entries.filter(e => e.actor === filter.actor);
  }
  if (filter?.action) {
    entries = entries.filter(e => e.action === filter.action);
  }
  if (filter?.resource) {
    entries = entries.filter(e => e.resource === filter.resource);
  }
  if (filter?.corr_id) {
    entries = entries.filter(e => e.corr_id === filter.corr_id);
  }
  if (filter?.actorTier) {
    entries = entries.filter(e => e.actorTier === filter.actorTier);
  }

  return entries.slice(-limit);
}

// ===== Hash Chain Verification =====

/**
 * Verify the integrity of the entire audit log hash chain.
 * If any entry has been tampered with, the chain will be broken.
 *
 * @returns Object with validity status and index of first broken link (if any)
 */
export function verifyAuditChain(): {
  valid: boolean;
  brokenAt?: number;
  totalEntries: number;
  error?: string;
} {
  if (auditLog.length === 0) {
    return { valid: true, totalEntries: 0 };
  }

  let previousHash = '0'.repeat(64); // Genesis

  for (let i = 0; i < auditLog.length; i++) {
    const entry = auditLog[i];

    // Check the previous hash link
    if (entry.previousHash !== previousHash) {
      return {
        valid: false,
        brokenAt: i,
        totalEntries: auditLog.length,
        error: `Hash chain broken at entry ${i} (seq ${entry.sequence}): expected previousHash ${previousHash.substring(0, 16)}... got ${entry.previousHash.substring(0, 16)}...`,
      };
    }

    // Recompute and verify the entry's own hash
    const { entryHash: _, ...rest } = entry;
    const recomputed = computeEntryHash(rest as Omit<ImmutableAuditEntry, 'entryHash'>);
    if (recomputed !== entry.entryHash) {
      return {
        valid: false,
        brokenAt: i,
        totalEntries: auditLog.length,
        error: `Entry hash mismatch at entry ${i} (seq ${entry.sequence}): data has been tampered with`,
      };
    }

    previousHash = entry.entryHash;
  }

  return { valid: true, totalEntries: auditLog.length };
}

/**
 * Get a specific audit entry by correlation ID (for trade lifecycle tracing).
 */
export function getAuditTrail(corrId: string): ImmutableAuditEntry[] {
  return auditLog.filter(e => e.corr_id === corrId);
}

/**
 * Get the current chain head hash (for external verification).
 */
export function getChainHead(): { hash: string; sequence: number } {
  return {
    hash: lastEntryHash,
    sequence: sequenceCounter,
  };
}
