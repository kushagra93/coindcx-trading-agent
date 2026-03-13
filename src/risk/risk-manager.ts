import { createChildLogger } from '../core/logger.js';
import { getRedis } from '../core/redis.js';
import type { RiskLevel, TradeIntent, RiskSettings } from '../core/types.js';
import type { RiskAssessment, MarketRegime } from './types.js';
import { RISK_PROFILES } from './types.js';
import { PARAMETER_BOUNDS, clampPositionSize } from './parameter-bounds.js';
import { shouldTrip, isTradingAllowed, recordLoss } from './circuit-breaker.js';

const log = createChildLogger('risk-manager');

const VOLATILITY_KEY_PREFIX = 'volatility:';
const VOLATILITY_MAX_ENTRIES = 30;
const VOLATILITY_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function kellySize(winRate: number, avgWinLossRatio: number, kellyFraction: number): number {
  const b = avgWinLossRatio;
  const p = winRate;
  const q = 1 - p;
  const fullKelly = (b * p - q) / b;
  const fractionalKelly = Math.max(0, fullKelly * kellyFraction);
  return fractionalKelly;
}

export function detectRegime(recentVolatility: number[]): MarketRegime {
  if (recentVolatility.length === 0) return 'medium-volatility';
  const avg = recentVolatility.reduce((a, b) => a + b, 0) / recentVolatility.length;
  if (avg < 0.02) return 'low-volatility';
  if (avg > 0.05) return 'high-volatility';
  return 'medium-volatility';
}

export async function updateVolatility(token: string, dailyReturn: number): Promise<void> {
  const redis = getRedis();
  const key = `${VOLATILITY_KEY_PREFIX}${token}`;

  await redis.rpush(key, Math.abs(dailyReturn).toString());
  await redis.ltrim(key, -VOLATILITY_MAX_ENTRIES, -1);
  await redis.expire(key, VOLATILITY_TTL_SECONDS);
}

async function getVolatility(token: string): Promise<number[]> {
  const redis = getRedis();
  const key = `${VOLATILITY_KEY_PREFIX}${token}`;
  const values = await redis.lrange(key, 0, -1);
  return values.map(Number);
}

export async function validateTrade(
  intent: TradeIntent,
  userSettings: RiskSettings,
  portfolioValueUsd: number,
  tradeValueUsd: number
): Promise<RiskAssessment> {
  const profile = RISK_PROFILES[userSettings.riskLevel];

  if (!(await isTradingAllowed(intent.userId))) {
    return {
      allowed: false,
      reason: 'Circuit breaker tripped — trading paused',
      regime: 'medium-volatility',
    };
  }

  if (portfolioValueUsd <= 0) {
    return {
      allowed: false,
      reason: 'No portfolio value — deposit required',
      regime: 'medium-volatility',
    };
  }

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

  if (await shouldTrip(intent.userId, portfolioValueUsd)) {
    return {
      allowed: false,
      reason: 'Daily loss limit reached — trading paused',
      regime: 'medium-volatility',
    };
  }

  const volatility = await getVolatility(intent.outputToken);
  const regime = detectRegime(volatility);

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

export function getDefaultRiskSettings(riskLevel: RiskLevel): RiskSettings {
  const profile = RISK_PROFILES[riskLevel];
  return {
    riskLevel,
    dailyLossLimitUsd: 1000,
    maxPerTradePct: profile.maxPositionSizePct,
  };
}
