import { createChildLogger } from '../core/logger.js';

const log = createChildLogger('parameter-bounds');

/**
 * Hard safety bounds that CANNOT be overridden by user, admin, or AI.
 * These are the absolute limits of the system.
 */
export const PARAMETER_BOUNDS = {
  // Position sizing
  MAX_POSITION_SIZE_PCT: 25,       // Never more than 25% of portfolio in one position
  MIN_POSITION_SIZE_USD: 1,        // Minimum $1 per trade
  MAX_POSITIONS_PER_USER: 20,      // Max concurrent positions per user

  // Slippage
  MAX_SLIPPAGE_BPS: 500,           // 5% max slippage
  DEFAULT_SLIPPAGE_BPS: 100,       // 1% default slippage

  // Fee bounds
  MIN_FEE_PCT: 0.001,             // 0.1% minimum fee
  MAX_FEE_PCT: 0.01,             // 1% maximum fee

  // Risk
  MAX_DAILY_LOSS_PCT: 20,          // Circuit breaker at 20% daily loss
  MIN_CIRCUIT_BREAKER_PCT: 5,      // Can't set circuit breaker below 5%
  MAX_LEVERAGE: 10,                // Max 10x leverage (Hyperliquid)

  // Copy trading
  MAX_COPY_BUDGET_PCT: 50,         // Max 50% of portfolio to copy trading
  MIN_LEADER_TRACK_RECORD_DAYS: 30,
  LEADER_AUTO_STOP_DRAWDOWN_PCT: -15,

  // Timing
  MIN_TRADE_INTERVAL_MS: 1000,     // At least 1 second between trades
  MAX_TRADE_INTERVAL_MS: 86400000, // Max 24 hours between trades

  // Price deviation (copy trading)
  MAX_PRICE_DEVIATION_PCT: 2,      // Skip copy trade if price moved >2%
} as const;

/**
 * Clamp a value within bounds.
 */
export function clamp(value: number, min: number, max: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  if (clamped !== value) {
    log.warn({ original: value, clamped, min, max }, 'Parameter clamped to bounds');
  }
  return clamped;
}

/**
 * Validate and clamp position size percentage.
 */
export function clampPositionSize(pct: number): number {
  return clamp(pct, 0, PARAMETER_BOUNDS.MAX_POSITION_SIZE_PCT);
}

/**
 * Validate and clamp slippage.
 */
export function clampSlippage(bps: number): number {
  return clamp(bps, 0, PARAMETER_BOUNDS.MAX_SLIPPAGE_BPS);
}

/**
 * Validate leverage for Hyperliquid.
 */
export function clampLeverage(leverage: number): number {
  return clamp(leverage, 1, PARAMETER_BOUNDS.MAX_LEVERAGE);
}

/**
 * Validate daily loss limit.
 */
export function clampDailyLossLimit(pct: number): number {
  return clamp(pct, PARAMETER_BOUNDS.MIN_CIRCUIT_BREAKER_PCT, PARAMETER_BOUNDS.MAX_DAILY_LOSS_PCT);
}
