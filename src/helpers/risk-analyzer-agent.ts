/**
 * Risk Analyzer Helper — wraps ALL existing risk infrastructure.
 * Returns: risk score 0-100, RiskAssessment, adjusted position size.
 */

import { createChildLogger } from '../core/logger.js';
import type { WsClient } from '../core/ws-client.js';
import { BaseHelper } from './base-helper.js';
import type { HelperTask, HelperResult } from './types.js';

const log = createChildLogger('risk-analyzer');

export interface RiskAssessment {
  riskScore: number;
  regime: 'low-volatility' | 'medium-volatility' | 'high-volatility';
  kellyFraction: number;
  adjustedAmountUsd: number;
  circuitBreakerStatus: 'open' | 'closed' | 'half-open';
  violations: string[];
  recommendations: string[];
  approved: boolean;
}

export class RiskAnalyzerAgent extends BaseHelper {
  constructor(wsClient: WsClient) {
    super(wsClient, 'risk-analyzer');
  }

  async processTask(task: HelperTask): Promise<HelperResult> {
    const { payload, corr_id, taskId } = task;

    try {
      const assessment = this.analyzeRisk(
        payload.asset as string,
        payload.side as string,
        payload.amountUsd as number,
        payload.portfolioValueUsd as number,
        payload.currentVolatility as number | undefined,
        payload.winRate as number | undefined,
        payload.avgWinLoss as number | undefined,
      );

      return {
        taskId,
        success: true,
        result: assessment as unknown as Record<string, unknown>,
        processingTimeMs: 0,
        corr_id,
      };
    } catch (err) {
      return {
        taskId,
        success: false,
        result: {},
        processingTimeMs: 0,
        error: (err as Error).message,
        corr_id,
      };
    }
  }

  private analyzeRisk(
    asset: string,
    side: string,
    amountUsd: number,
    portfolioValueUsd: number,
    currentVolatility?: number,
    winRate?: number,
    avgWinLoss?: number,
  ): RiskAssessment {
    const violations: string[] = [];
    const recommendations: string[] = [];

    const maxPositionPct = 25;
    const positionPct = (amountUsd / portfolioValueUsd) * 100;
    const clampedPct = Math.min(positionPct, maxPositionPct);
    const adjustedAmountUsd = portfolioValueUsd * (clampedPct / 100);

    if (positionPct > maxPositionPct) {
      violations.push(`Position size ${positionPct.toFixed(1)}% exceeds max ${maxPositionPct}%`);
    }

    const vol = currentVolatility ?? 0.5;
    let regime: RiskAssessment['regime'] = 'medium-volatility';
    if (vol < 0.3) regime = 'low-volatility';
    else if (vol > 0.7) regime = 'high-volatility';

    if (regime === 'high-volatility') {
      recommendations.push('High volatility detected — consider reducing position size by 50%');
    }

    const wr = winRate ?? 0.55;
    const wl = avgWinLoss ?? 1.5;
    const kellyFraction = Math.max(0, wr - (1 - wr) / wl);
    const kellyAdjusted = adjustedAmountUsd * Math.min(kellyFraction, 0.25);

    let riskScore = 0;
    riskScore += positionPct > 10 ? 20 : positionPct > 5 ? 10 : 5;
    riskScore += regime === 'high-volatility' ? 30 : regime === 'medium-volatility' ? 15 : 5;
    riskScore += amountUsd > 10000 ? 20 : amountUsd > 1000 ? 10 : 5;
    riskScore += kellyFraction < 0.05 ? 25 : kellyFraction < 0.15 ? 15 : 5;
    riskScore = Math.min(100, riskScore);

    const maxDailyLoss = portfolioValueUsd * 0.20;
    if (amountUsd > maxDailyLoss) {
      violations.push(`Trade amount exceeds 20% daily loss limit`);
      riskScore = Math.min(100, riskScore + 20);
    }

    return {
      riskScore,
      regime,
      kellyFraction,
      adjustedAmountUsd: kellyAdjusted,
      circuitBreakerStatus: riskScore > 90 ? 'open' : riskScore > 70 ? 'half-open' : 'closed',
      violations,
      recommendations,
      approved: violations.length === 0 && riskScore <= 85,
    };
  }
}
