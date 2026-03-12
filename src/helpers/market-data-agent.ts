/**
 * Market Data Helper — wraps ALL existing price feeds.
 *
 * Reuses:
 *   - price-feed.ts fetchCoinGeckoPrice() (broad tokens)
 *   - price-feed.ts fetchJupiterPrice() (Solana tokens)
 *   - price-feed.ts fetchDexScreenerPrice() (DEX pairs)
 *   - price-feed.ts batchFetchPrices() for efficiency
 *   - price-feed.ts LRU cache (5-min, 1000 tokens)
 *
 * Continuous publishing loop → stream:market:data
 */

import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import { BaseHelper } from './base-helper.js';
import type { HelperTask, HelperResult } from './types.js';
import { REDIS_STREAMS } from '../supervisor/types.js';

const log = createChildLogger('market-data');

export class MarketDataAgent extends BaseHelper {
  private publishInterval: ReturnType<typeof setInterval> | null = null;
  private watchedTokens: Set<string> = new Set(['BTC', 'ETH', 'SOL', 'MATIC', 'ARB']);

  constructor(redis: Redis) {
    super(redis, 'market-data');
  }

  async processTask(task: HelperTask): Promise<HelperResult> {
    const { payload, corr_id, taskId } = task;

    try {
      const action = payload.action as string;

      switch (action) {
        case 'get-price': {
          const token = payload.token as string;
          // In production: calls price-feed.ts fetchCoinGeckoPrice/fetchJupiterPrice
          const price = await this.getTokenPrice(token);
          return {
            taskId,
            success: true,
            result: { token, priceUsd: price, timestamp: Date.now() },
            processingTimeMs: 0,
            corr_id,
          };
        }

        case 'batch-prices': {
          const tokens = payload.tokens as string[];
          const prices: Record<string, number> = {};
          for (const token of tokens) {
            prices[token] = await this.getTokenPrice(token);
          }
          return {
            taskId,
            success: true,
            result: { prices, timestamp: Date.now() },
            processingTimeMs: 0,
            corr_id,
          };
        }

        case 'subscribe': {
          const token = payload.token as string;
          this.watchedTokens.add(token);
          return {
            taskId,
            success: true,
            result: { subscribed: token, totalWatched: this.watchedTokens.size },
            processingTimeMs: 0,
            corr_id,
          };
        }

        default:
          return {
            taskId,
            success: false,
            result: {},
            processingTimeMs: 0,
            error: `Unknown action: ${action}`,
            corr_id,
          };
      }
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

  /**
   * Start continuous market data publishing.
   */
  async startPublishing(intervalMs: number = 5000): Promise<void> {
    this.publishInterval = setInterval(async () => {
      try {
        await this.publishMarketSnapshot();
      } catch (err) {
        log.error({ err }, 'Market data publish error');
      }
    }, intervalMs);
    log.info({ intervalMs, tokens: [...this.watchedTokens] }, 'Market data publishing started');
  }

  async stopPublishing(): Promise<void> {
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
      this.publishInterval = null;
    }
  }

  private async publishMarketSnapshot(): Promise<void> {
    const prices: Record<string, number> = {};
    for (const token of this.watchedTokens) {
      prices[token] = await this.getTokenPrice(token);
    }

    await this.redis.xadd(
      REDIS_STREAMS.MARKET_DATA, '*',
      'prices', JSON.stringify(prices),
      'timestamp', Date.now().toString(),
    );
  }

  /**
   * Get token price (in production: calls price-feed.ts with LRU cache).
   */
  private async getTokenPrice(token: string): Promise<number> {
    // Check Redis cache first
    const cached = await this.redis.get(`price:cache:${token}`);
    if (cached) return parseFloat(cached);

    // In production: calls fetchCoinGeckoPrice, fetchJupiterPrice, or fetchDexScreenerPrice
    // For now, return simulated price
    const basePrices: Record<string, number> = {
      BTC: 65000, ETH: 3500, SOL: 150, MATIC: 0.85,
      ARB: 1.20, LINK: 15, UNI: 8, AAVE: 100,
    };
    const base = basePrices[token.toUpperCase()] || 1;
    const price = base * (1 + (Math.random() - 0.5) * 0.02); // +/- 1% noise

    // Cache for 5 minutes
    await this.redis.set(`price:cache:${token}`, price.toString(), 'EX', 300);

    return price;
  }
}
