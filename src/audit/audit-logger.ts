import { createHash, randomUUID } from 'node:crypto';
import { eq, desc, and, sql } from 'drizzle-orm';
import { createChildLogger } from '../core/logger.js';
import type { PermissionTier } from '../core/types.js';
import type { ImmutableAuditEntry, AgentTier } from '../security/types.js';
import { SECURITY_DEFAULTS } from '../security/types.js';
import { getDb } from '../db/index.js';
import { auditLog as auditLogTable } from '../db/schema.js';

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

export async function audit(params: {
  actor: string;
  actorTier: PermissionTier | AgentTier | 'admin' | 'ops' | 'system';
  action: string;
  resource: string;
  details?: Record<string, unknown>;
  success?: boolean;
  error?: string;
  corr_id?: string;
}): Promise<ImmutableAuditEntry> {
  const db = getDb();
  const id = `audit-${randomUUID()}`;
  const timestamp = new Date().toISOString();

  const [lastEntry] = await db
    .select({ entryHash: auditLogTable.entryHash })
    .from(auditLogTable)
    .orderBy(desc(auditLogTable.sequence))
    .limit(1);

  const previousHash = lastEntry?.entryHash ?? '0'.repeat(64);

  const entryWithoutHash: Omit<ImmutableAuditEntry, 'entryHash'> = {
    id,
    sequence: 0, // will be set by DB serial
    timestamp,
    actor: params.actor,
    actorTier: params.actorTier as ImmutableAuditEntry['actorTier'],
    action: params.action,
    resource: params.resource,
    details: params.details ?? {},
    success: params.success ?? true,
    error: params.error,
    previousHash,
    corr_id: params.corr_id,
  };

  const entryHash = computeEntryHash(entryWithoutHash);

  const [inserted] = await db
    .insert(auditLogTable)
    .values({
      id,
      timestamp,
      actor: params.actor,
      actorTier: params.actorTier,
      action: params.action,
      resource: params.resource,
      details: params.details ?? {},
      success: params.success ?? true,
      error: params.error ?? null,
      previousHash,
      entryHash,
      corrId: params.corr_id ?? null,
    })
    .returning();

  const entry: ImmutableAuditEntry = {
    ...entryWithoutHash,
    sequence: inserted.sequence,
    entryHash,
  };

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

export async function getAuditLog(limit: number = 100, filter?: {
  actor?: string;
  action?: string;
  resource?: string;
  corr_id?: string;
  actorTier?: string;
}): Promise<ImmutableAuditEntry[]> {
  const db = getDb();
  const conditions = [];

  if (filter?.actor) conditions.push(eq(auditLogTable.actor, filter.actor));
  if (filter?.action) conditions.push(eq(auditLogTable.action, filter.action));
  if (filter?.resource) conditions.push(eq(auditLogTable.resource, filter.resource));
  if (filter?.corr_id) conditions.push(eq(auditLogTable.corrId, filter.corr_id));
  if (filter?.actorTier) conditions.push(eq(auditLogTable.actorTier, filter.actorTier));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select()
    .from(auditLogTable)
    .where(where)
    .orderBy(desc(auditLogTable.sequence))
    .limit(limit);

  return rows.map(rowToAuditEntry);
}

function rowToAuditEntry(row: typeof auditLogTable.$inferSelect): ImmutableAuditEntry {
  return {
    id: row.id,
    sequence: row.sequence,
    timestamp: row.timestamp,
    actor: row.actor,
    actorTier: row.actorTier as ImmutableAuditEntry['actorTier'],
    action: row.action,
    resource: row.resource,
    details: (row.details ?? {}) as Record<string, unknown>,
    success: row.success,
    error: row.error ?? undefined,
    previousHash: row.previousHash,
    entryHash: row.entryHash,
    corr_id: row.corrId ?? undefined,
  };
}

export async function verifyAuditChain(): Promise<{
  valid: boolean;
  brokenAt?: number;
  totalEntries: number;
  error?: string;
}> {
  const db = getDb();

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogTable);

  const totalEntries = countResult?.count ?? 0;
  if (totalEntries === 0) {
    return { valid: true, totalEntries: 0 };
  }

  const batchSize = 500;
  let previousHash = '0'.repeat(64);
  let offset = 0;

  while (offset < totalEntries) {
    const rows = await db
      .select()
      .from(auditLogTable)
      .orderBy(auditLogTable.sequence)
      .limit(batchSize)
      .offset(offset);

    for (const row of rows) {
      const entry = rowToAuditEntry(row);

      if (entry.previousHash !== previousHash) {
        return {
          valid: false,
          brokenAt: entry.sequence,
          totalEntries,
          error: `Hash chain broken at entry seq ${entry.sequence}: expected previousHash ${previousHash.substring(0, 16)}... got ${entry.previousHash.substring(0, 16)}...`,
        };
      }

      const { entryHash: _, ...rest } = entry;
      const recomputed = computeEntryHash(rest as Omit<ImmutableAuditEntry, 'entryHash'>);
      if (recomputed !== entry.entryHash) {
        return {
          valid: false,
          brokenAt: entry.sequence,
          totalEntries,
          error: `Entry hash mismatch at seq ${entry.sequence}: data has been tampered with`,
        };
      }

      previousHash = entry.entryHash;
    }

    offset += batchSize;
  }

  return { valid: true, totalEntries };
}

export async function getAuditTrail(corrId: string): Promise<ImmutableAuditEntry[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(auditLogTable)
    .where(eq(auditLogTable.corrId, corrId))
    .orderBy(auditLogTable.sequence);

  return rows.map(rowToAuditEntry);
}

export async function getChainHead(): Promise<{ hash: string; sequence: number }> {
  const db = getDb();
  const [row] = await db
    .select({ entryHash: auditLogTable.entryHash, sequence: auditLogTable.sequence })
    .from(auditLogTable)
    .orderBy(desc(auditLogTable.sequence))
    .limit(1);

  return {
    hash: row?.entryHash ?? '0'.repeat(64),
    sequence: row?.sequence ?? 0,
  };
}
