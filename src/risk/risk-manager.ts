import { createChildLogger } from '../core/logger.js';
import { config } from '../core/config.js';
import type { RiskLevel, TradeIntent, RiskSettings } from '../core/types.js';
import type { RiskAssessment, MarketRegime } from './types.js';
import { RISK_PROFILES } from './types.js';
import { PARAMETER_BOUNDS, clampPositionSize } from './parameter-bounds.js';
import { shouldTrip, isTradingAllowed, recordLoss } from './circuit-breaker.js';

const log = createChildLogger('risk-manager');

// Volatility tracking per token (rolling window)
const volatilityHistory = new Map<string, number[]>();

/**
 * Kelly Criterion position sizing.
 * f* = (bp - q) / b
 * where b = odds, p = win probability, q = 1 - p
 */
export function kellySize(winRate: number, avgWinLossRatio: number, kellyFraction: number): number {
  const b = avgWinLossRatio;
  const p = winRate;
  const q = 1 - p;
  const fullKelly = (b * p - q) / b;

  // Fractional Kelly (conservative)
  const fractionalKelly = Math.max(0, fullKelly * kellyFraction);

  return fractionalKelly;
}

/**
 * Detect market regime from recent volatility.
 */
export function detectRegime(recentVolatility: number[]): MarketRegime {
  if (recentVolatility.length === 0) return 'medium-volatility';

  const avg = recentVolatility.reduce((a, b) => a + b, 0) / recentVolatility.length;

  if (avg < 0.02) return 'low-volatility';    // <2% daily moves
  if (avg > 0.05) return 'high-volatility';   // >5% daily moves
  return 'medium-volatility';
}

/**
 * Update volatility data for a token.
 */
export function updateVolatility(token: string, dailyReturn: number): void {
  const history = volatilityHistory.get(token) ?? [];
  history.push(Math.abs(dailyReturn));

  // Keep last 30 data points
  if (history.length > 30) history.shift();

  volatilityHistory.set(token, history);
}

/**
 * Validate a trade against risk parameters.
 */
export function validateTrade(
  intent: TradeIntent,
  userSettings: RiskSettings,
  portfolioValueUsd: number,
  tradeValueUsd: number
): RiskAssessment {
  const profile = RISK_PROFILES[userSettings.riskLevel];

  // Check circuit breaker
  if (!isTradingAllowed(intent.userId)) {
    return {
      allowed: false,
      reason: 'Circuit breaker tripped — trading paused',
      regime: 'medium-volatility',
    };
  }

  // Check portfolio value is non-zero
  if (portfolioValueUsd <= 0) {
    return {
      allowed: false,
      reason: 'No portfolio value — deposit required',
      regime: 'medium-volatility',
    };
  }

  // Check position size limit
  const positionSizePct = (tradeValueUsd / portfolioValueUsd) * 100;
  const maxPct = Math.min(
    userSettings.maxPerTradePct,
    profile.maxPositionSizePct,
    PARAMETER_BOUNDS.MAX_POSITION_SIZE_PCT
  );

  if (positionSizePct > maxPct) {
    return {
      allowed: false,
      reason: `Trade size ${positionSizePct.toFixed(1)}% exceeds max ${maxPct}%`,
      regime: 'medium-volatility',
    };
  }

  // Check daily loss limit
  if (shouldTrip(intent.userId, portfolioValueUsd)) {
    return {
      allowed: false,
      reason: 'Daily loss limit reached — trading paused',
      regime: 'medium-volatility',
    };
  }

  // Get market regime
  const volatility = volatilityHistory.get(intent.outputToken) ?? [];
  const regime = detectRegime(volatility);

  // Adjust size based on regime and risk profile
  let adjustedSizePct = positionSizePct;
  if (regime === 'high-volatility') {
    adjustedSizePct *= (1 - profile.regimeSensitivity * 0.3);
    adjustedSizePct = Math.max(1, adjustedSizePct);
  }

  adjustedSizePct = clampPositionSize(adjustedSizePct);

  log.info({
    userId: intent.userId,
    token: intent.outputToken,
    originalSizePct: positionSizePct.toFixed(2),
    adjustedSizePct: adjustedSizePct.toFixed(2),
    regime,
    riskLevel: userSettings.riskLevel,
  }, 'Trade validated');

  return {
    allowed: true,
    adjustedSizePct,
    regime,
  };
}

/**
 * Get default risk settings for a risk level.
 */
export function getDefaultRiskSettings(riskLevel: RiskLevel): RiskSettings {
  const profile = RISK_PROFILES[riskLevel];
  return {
    riskLevel,
    dailyLossLimitUsd: 1000, // Default $1000 daily loss limit
    maxPerTradePct: profile.maxPositionSizePct,
  };
}
