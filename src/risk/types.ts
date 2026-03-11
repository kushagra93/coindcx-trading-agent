import type { RiskLevel } from '../core/types.js';

export type MarketRegime = 'low-volatility' | 'medium-volatility' | 'high-volatility';

export interface RiskAssessment {
  allowed: boolean;
  reason?: string;
  adjustedSizePct?: number;
  regime: MarketRegime;
}

export interface RiskProfile {
  riskLevel: RiskLevel;
  kellyFraction: number;
  maxPositionSizePct: number;
  regimeSensitivity: number;
}

export const RISK_PROFILES: Record<RiskLevel, RiskProfile> = {
  conservative: {
    riskLevel: 'conservative',
    kellyFraction: 0.25,
    maxPositionSizePct: 5,
    regimeSensitivity: 2.0,
  },
  moderate: {
    riskLevel: 'moderate',
    kellyFraction: 0.5,
    maxPositionSizePct: 15,
    regimeSensitivity: 1.0,
  },
  aggressive: {
    riskLevel: 'aggressive',
    kellyFraction: 0.75,
    maxPositionSizePct: 25,
    regimeSensitivity: 0.5,
  },
};
