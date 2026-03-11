import { createChildLogger } from '../core/logger.js';
import { config } from '../core/config.js';

const log = createChildLogger('circuit-breaker');

interface LossRecord {
  amount: number;
  timestamp: number;
}

// Per-user loss tracking
const userLosses = new Map<string, LossRecord[]>();
const trippedBreakers = new Set<string>();

// Global emergency halt
let globalHalt = false;

/**
 * Record a loss for a user.
 */
export function recordLoss(userId: string, lossUsd: number): void {
  if (lossUsd >= 0) return; // Only track losses

  const losses = userLosses.get(userId) ?? [];
  losses.push({ amount: Math.abs(lossUsd), timestamp: Date.now() });
  userLosses.set(userId, losses);
}

/**
 * Check if the circuit breaker should trip for a user.
 * Guards against division-by-zero when portfolio value is zero or negative.
 */
export function shouldTrip(userId: string, portfolioValueUsd: number): boolean {
  if (globalHalt) return true;
  if (trippedBreakers.has(userId)) return true;

  // Guard: zero or negative portfolio → trip immediately
  if (portfolioValueUsd <= 0) {
    log.warn({ userId, portfolioValueUsd }, 'Portfolio value is zero or negative — circuit breaker tripped');
    trippedBreakers.add(userId);
    return true;
  }

  const windowMs = config.risk.circuitBreakerWindowHours * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;
  const losses = userLosses.get(userId) ?? [];

  // Clean up old records
  const recentLosses = losses.filter(l => l.timestamp > cutoff);
  userLosses.set(userId, recentLosses);

  const totalLoss = recentLosses.reduce((sum, l) => sum + l.amount, 0);
  const lossPct = (totalLoss / portfolioValueUsd) * 100;

  if (lossPct >= config.risk.circuitBreakerLossPct) {
    trippedBreakers.add(userId);
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

/**
 * Check if trading is allowed for a user.
 */
export function isTradingAllowed(userId: string): boolean {
  if (globalHalt) return false;
  return !trippedBreakers.has(userId);
}

/**
 * Reset circuit breaker for a user (admin/ops action).
 */
export function resetBreaker(userId: string): void {
  trippedBreakers.delete(userId);
  userLosses.delete(userId);
  log.info({ userId }, 'Circuit breaker reset');
}

/**
 * Emergency halt — stop all trading globally.
 */
export function emergencyHalt(): void {
  globalHalt = true;
  log.warn('EMERGENCY HALT: All trading stopped globally');
}

/**
 * Resume trading after emergency halt.
 */
export function resumeTrading(): void {
  globalHalt = false;
  log.info('Trading resumed after emergency halt');
}

/**
 * Check if global halt is active.
 */
export function isGlobalHalt(): boolean {
  return globalHalt;
}

/**
 * Get list of users with tripped breakers.
 */
export function getTrippedUsers(): string[] {
  return Array.from(trippedBreakers);
}
