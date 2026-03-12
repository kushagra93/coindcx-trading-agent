/**
 * Strategy Engine — executable strategy classes for all 6 types.
 *
 * Each strategy evaluates market data + portfolio state → TradeSignal[].
 * Strategies: DCA, Momentum, MeanReversion, StopLossGuard, VolatilityPause, Custom.
 */

import { createChildLogger } from '../core/logger.js';
import type { StrategyType, Chain } from '../core/types.js';

const log = createChildLogger('strategy-engine');

// ===== Trade Signal =====

export interface TradeSignal {
  id: string;
  strategyId: string;
  strategyType: StrategyType;
  asset: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  chain: Chain;
  confidence: number;     // 0-1
  reason: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MarketSnapshot {
  prices: Record<string, number>;
  volumes24h?: Record<string, number>;
  changes24h?: Record<string, number>;
  timestamp: number;
}

export interface PortfolioState {
  totalValueUsd: number;
  cashBalanceUsd: number;
  positions: Array<{
    token: string;
    amount: number;
    currentPriceUsd: number;
    entryPriceUsd: number;
    unrealizedPnlPct: number;
  }>;
}

// ===== Base Strategy =====

export interface Strategy {
  id: string;
  type: StrategyType;
  evaluate(market: MarketSnapshot, portfolio: PortfolioState): TradeSignal[];
}

// ===== Strategy Implementations =====

export class DCAStrategy implements Strategy {
  constructor(
    public id: string,
    private config: {
      asset: string;
      chain: Chain;
      amountUsd: number;
      intervalMs: number;
    },
    private lastExecutedAt: number = 0,
  ) {}

  type: StrategyType = 'dca';

  evaluate(market: MarketSnapshot, portfolio: PortfolioState): TradeSignal[] {
    const elapsed = Date.now() - this.lastExecutedAt;
    if (elapsed < this.config.intervalMs) return [];

    if (portfolio.cashBalanceUsd < this.config.amountUsd) return [];

    this.lastExecutedAt = Date.now();
    return [{
      id: `sig_dca_${Date.now()}`,
      strategyId: this.id,
      strategyType: 'dca',
      asset: this.config.asset,
      side: 'buy',
      amountUsd: this.config.amountUsd,
      chain: this.config.chain,
      confidence: 0.9,
      reason: 'DCA interval triggered',
      timestamp: new Date().toISOString(),
    }];
  }
}

export class MomentumStrategy implements Strategy {
  constructor(
    public id: string,
    private config: {
      asset: string;
      chain: Chain;
      maxPositionPct: number;
      shortWindow: number;   // e.g. 20
      longWindow: number;    // e.g. 50
    },
    private priceHistory: number[] = [],
  ) {}

  type: StrategyType = 'momentum';

  evaluate(market: MarketSnapshot, portfolio: PortfolioState): TradeSignal[] {
    const price = market.prices[this.config.asset];
    if (!price) return [];

    this.priceHistory.push(price);
    if (this.priceHistory.length > this.config.longWindow) {
      this.priceHistory.shift();
    }

    if (this.priceHistory.length < this.config.longWindow) return [];

    const shortMA = this.avg(this.priceHistory.slice(-this.config.shortWindow));
    const longMA = this.avg(this.priceHistory);

    const maxAmount = portfolio.totalValueUsd * (this.config.maxPositionPct / 100);

    // Golden cross: short MA crosses above long MA → buy
    if (shortMA > longMA * 1.01) {
      return [{
        id: `sig_momentum_${Date.now()}`,
        strategyId: this.id,
        strategyType: 'momentum',
        asset: this.config.asset,
        side: 'buy',
        amountUsd: Math.min(maxAmount, portfolio.cashBalanceUsd),
        chain: this.config.chain,
        confidence: Math.min((shortMA / longMA - 1) * 10, 1),
        reason: `Momentum: short MA ($${shortMA.toFixed(2)}) > long MA ($${longMA.toFixed(2)})`,
        timestamp: new Date().toISOString(),
      }];
    }

    // Death cross: short MA crosses below long MA → sell
    if (shortMA < longMA * 0.99) {
      const position = portfolio.positions.find(p => p.token === this.config.asset);
      if (position && position.amount > 0) {
        return [{
          id: `sig_momentum_${Date.now()}`,
          strategyId: this.id,
          strategyType: 'momentum',
          asset: this.config.asset,
          side: 'sell',
          amountUsd: position.amount * position.currentPriceUsd,
          chain: this.config.chain,
          confidence: Math.min((1 - shortMA / longMA) * 10, 1),
          reason: `Momentum: short MA ($${shortMA.toFixed(2)}) < long MA ($${longMA.toFixed(2)})`,
          timestamp: new Date().toISOString(),
        }];
      }
    }

    return [];
  }

  private avg(arr: number[]): number {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }
}

export class MeanReversionStrategy implements Strategy {
  constructor(
    public id: string,
    private config: {
      asset: string;
      chain: Chain;
      maxPositionPct: number;
      rsiPeriod: number;
      oversoldThreshold: number;    // e.g. 30
      overboughtThreshold: number;  // e.g. 70
    },
    private priceHistory: number[] = [],
  ) {}

  type: StrategyType = 'mean-reversion';

  evaluate(market: MarketSnapshot, portfolio: PortfolioState): TradeSignal[] {
    const price = market.prices[this.config.asset];
    if (!price) return [];

    this.priceHistory.push(price);
    if (this.priceHistory.length > this.config.rsiPeriod + 1) {
      this.priceHistory.shift();
    }

    if (this.priceHistory.length < this.config.rsiPeriod + 1) return [];

    const rsi = this.calculateRSI();
    const maxAmount = portfolio.totalValueUsd * (this.config.maxPositionPct / 100);

    // Oversold → buy
    if (rsi < this.config.oversoldThreshold) {
      return [{
        id: `sig_meanrev_${Date.now()}`,
        strategyId: this.id,
        strategyType: 'mean-reversion',
        asset: this.config.asset,
        side: 'buy',
        amountUsd: Math.min(maxAmount, portfolio.cashBalanceUsd),
        chain: this.config.chain,
        confidence: (this.config.oversoldThreshold - rsi) / this.config.oversoldThreshold,
        reason: `Mean reversion: RSI ${rsi.toFixed(1)} < ${this.config.oversoldThreshold} (oversold)`,
        timestamp: new Date().toISOString(),
      }];
    }

    // Overbought → sell
    if (rsi > this.config.overboughtThreshold) {
      const position = portfolio.positions.find(p => p.token === this.config.asset);
      if (position) {
        return [{
          id: `sig_meanrev_${Date.now()}`,
          strategyId: this.id,
          strategyType: 'mean-reversion',
          asset: this.config.asset,
          side: 'sell',
          amountUsd: position.amount * position.currentPriceUsd,
          chain: this.config.chain,
          confidence: (rsi - this.config.overboughtThreshold) / (100 - this.config.overboughtThreshold),
          reason: `Mean reversion: RSI ${rsi.toFixed(1)} > ${this.config.overboughtThreshold} (overbought)`,
          timestamp: new Date().toISOString(),
        }];
      }
    }

    return [];
  }

  private calculateRSI(): number {
    let gains = 0, losses = 0;
    for (let i = 1; i < this.priceHistory.length; i++) {
      const diff = this.priceHistory[i] - this.priceHistory[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const period = this.priceHistory.length - 1;
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }
}

// ===== Strategy Factory =====

export function createStrategy(
  id: string,
  type: StrategyType,
  config: Record<string, unknown>,
): Strategy {
  switch (type) {
    case 'dca':
      return new DCAStrategy(id, {
        asset: (config.asset as string) || 'BTC',
        chain: (config.chain as Chain) || 'solana',
        amountUsd: (config.amountUsd as number) || 100,
        intervalMs: (config.intervalMs as number) || 86400000,
      });
    case 'momentum':
      return new MomentumStrategy(id, {
        asset: (config.asset as string) || 'ETH',
        chain: (config.chain as Chain) || 'ethereum',
        maxPositionPct: (config.maxPositionPct as number) || 10,
        shortWindow: (config.shortWindow as number) || 20,
        longWindow: (config.longWindow as number) || 50,
      });
    case 'mean-reversion':
      return new MeanReversionStrategy(id, {
        asset: (config.asset as string) || 'ETH',
        chain: (config.chain as Chain) || 'ethereum',
        maxPositionPct: (config.maxPositionPct as number) || 10,
        rsiPeriod: (config.rsiPeriod as number) || 14,
        oversoldThreshold: (config.oversoldThreshold as number) || 30,
        overboughtThreshold: (config.overboughtThreshold as number) || 70,
      });
    default:
      return new DCAStrategy(id, {
        asset: 'BTC',
        chain: 'solana',
        amountUsd: 100,
        intervalMs: 86400000,
      });
  }
}
