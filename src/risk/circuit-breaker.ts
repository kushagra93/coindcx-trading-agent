import { eq, and, gte, sql } from 'drizzle-orm';
import { createChildLogger } from '../core/logger.js';
import { config } from '../core/config.js';
import { getDb } from '../db/index.js';
import {
  circuitBreakerLosses,
  circuitBreakerTrips,
  globalSettings,
} from '../db/schema.js';

const log = createChildLogger('circuit-breaker');

const GLOBAL_HALT_KEY = 'global_halt';

export async function recordLoss(userId: string, lossUsd: number): Promise<void> {
  if (lossUsd >= 0) return;

  const db = getDb();
  await db.insert(circuitBreakerLosses).values({
    userId,
    amount: Math.abs(lossUsd),
    recordedAt: new Date(),
  });
}

export async function shouldTrip(userId: string, portfolioValueUsd: number): Promise<boolean> {
  if (await isGlobalHalt()) return true;
  if (await isTripped(userId)) return true;

  if (portfolioValueUsd <= 0) {
    log.warn({ userId, portfolioValueUsd }, 'Portfolio value is zero or negative — circuit breaker tripped');
    await tripBreaker(userId, 'Portfolio value zero or negative');
    return true;
  }

  const db = getDb();
  const windowMs = config.risk.circuitBreakerWindowHours * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - windowMs);

  const [result] = await db
    .select({ totalLoss: sql<number>`coalesce(sum(${circuitBreakerLosses.amount}), 0)` })
    .from(circuitBreakerLosses)
    .where(and(
      eq(circuitBreakerLosses.userId, userId),
      gte(circuitBreakerLosses.recordedAt, cutoff),
    ));

  const totalLoss = result?.totalLoss ?? 0;
  const lossPct = (totalLoss / portfolioValueUsd) * 100;

  if (lossPct >= config.risk.circuitBreakerLossPct) {
    await tripBreaker(userId, `Loss ${lossPct.toFixed(2)}% exceeded threshold ${config.risk.circuitBreakerLossPct}%`);
    log.warn({
      userId,
      lossPct: lossPct.toFixed(2),
      threshold: config.risk.circuitBreakerLossPct,
      totalLoss: totalLoss.toFixed(2),
      windowHours: config.risk.circuitBreakerWindowHours,
    }, 'Circuit breaker tripped!');
    return true;
  }

  return false;
}

async function isTripped(userId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(circuitBreakerTrips)
    .where(eq(circuitBreakerTrips.userId, userId))
    .limit(1);
  return !!row;
}

async function tripBreaker(userId: string, reason: string): Promise<void> {
  const db = getDb();
  await db
    .insert(circuitBreakerTrips)
    .values({ userId, trippedAt: new Date(), reason })
    .onConflictDoNothing();
}

export async function isTradingAllowed(userId: string): Promise<boolean> {
  if (await isGlobalHalt()) return false;
  return !(await isTripped(userId));
}

export async function resetBreaker(userId: string): Promise<void> {
  const db = getDb();
  await db.delete(circuitBreakerTrips).where(eq(circuitBreakerTrips.userId, userId));
  log.info({ userId }, 'Circuit breaker reset');
}

export async function emergencyHalt(): Promise<void> {
  const db = getDb();
  await db
    .insert(globalSettings)
    .values({ key: GLOBAL_HALT_KEY, value: 'true', updatedAt: new Date() })
    .onConflictDoUpdate({
      target: globalSettings.key,
      set: { value: 'true', updatedAt: new Date() },
    });
  log.warn('EMERGENCY HALT: All trading stopped globally');
}

export async function resumeTrading(): Promise<void> {
  const db = getDb();
  await db.delete(globalSettings).where(eq(globalSettings.key, GLOBAL_HALT_KEY));
  log.info('Trading resumed after emergency halt');
}

export async function isGlobalHalt(): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(globalSettings)
    .where(eq(globalSettings.key, GLOBAL_HALT_KEY))
    .limit(1);
  return row?.value === 'true';
}

export async function getTrippedUsers(): Promise<string[]> {
  const db = getDb();
  const rows = await db.select({ userId: circuitBreakerTrips.userId }).from(circuitBreakerTrips);
  return rows.map(r => r.userId);
}
