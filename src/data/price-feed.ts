import { LRUCache } from 'lru-cache';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import type { Chain, PriceUpdate } from '../core/types.js';

const log = createChildLogger('price-feed');

// LRU cache for price data (5 minute TTL)
const priceCache = new LRUCache<string, PriceUpdate>({
  max: 1000,
  ttl: 5 * 60 * 1000,
});

/**
 * Fetch price from CoinGecko API.
 */
export async function fetchCoinGeckoPrice(tokenId: string): Promise<PriceUpdate | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;
    const headers: Record<string, string> = {};

    if (config.marketData.coinGeckoApiKey) {
      headers['x-cg-demo-api-key'] = config.marketData.coinGeckoApiKey;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      log.warn({ status: res.status, tokenId }, 'CoinGecko price fetch failed');
      return null;
    }

    const data = await res.json() as Record<string, { usd: number; usd_24h_vol?: number; usd_24h_change?: number }>;
    const tokenData = data[tokenId];
    if (!tokenData) return null;

    const update: PriceUpdate = {
      token: tokenId,
      chain: 'ethereum', // CoinGecko is chain-agnostic
      priceUsd: tokenData.usd,
      volume24h: tokenData.usd_24h_vol,
      change24hPct: tokenData.usd_24h_change,
      timestamp: Date.now(),
    };

    priceCache.set(tokenId, update);
    return update;
  } catch (err) {
    log.error({ err, tokenId }, 'CoinGecko fetch error');
    return null;
  }
}

/**
 * Fetch price from Jupiter Price API (Solana tokens).
 */
export async function fetchJupiterPrice(tokenMint: string): Promise<PriceUpdate | null> {
  try {
    const url = `https://price.jup.ag/v6/price?ids=${tokenMint}`;
    const res = await fetch(url);

    if (!res.ok) {
      log.warn({ status: res.status, tokenMint }, 'Jupiter price fetch failed');
      return null;
    }

    const data = await res.json() as { data: Record<string, { id: string; mintSymbol: string; price: number }> };
    const tokenData = data.data[tokenMint];
    if (!tokenData) return null;

    const update: PriceUpdate = {
      token: tokenMint,
      chain: 'solana',
      priceUsd: tokenData.price,
      timestamp: Date.now(),
    };

    priceCache.set(`sol:${tokenMint}`, update);
    return update;
  } catch (err) {
    log.error({ err, tokenMint }, 'Jupiter price fetch error');
    return null;
  }
}

/**
 * Fetch price from DexScreener.
 */
export async function fetchDexScreenerPrice(pairAddress: string, chain: Chain): Promise<PriceUpdate | null> {
  try {
    const chainSlug = chain === 'solana' ? 'solana' : chain;
    const url = `https://api.dexscreener.com/latest/dex/pairs/${chainSlug}/${pairAddress}`;
    const res = await fetch(url);

    if (!res.ok) return null;

    const data = await res.json() as { pair?: { priceUsd: string; volume?: { h24: number }; priceChange?: { h24: number } } };
    if (!data.pair) return null;

    const update: PriceUpdate = {
      token: pairAddress,
      chain,
      priceUsd: parseFloat(data.pair.priceUsd),
      volume24h: data.pair.volume?.h24,
      change24hPct: data.pair.priceChange?.h24,
      timestamp: Date.now(),
    };

    priceCache.set(`dex:${chain}:${pairAddress}`, update);
    return update;
  } catch (err) {
    log.error({ err, pairAddress }, 'DexScreener fetch error');
    return null;
  }
}

/**
 * Get cached price or fetch fresh.
 */
export async function getPrice(token: string, chain: Chain): Promise<PriceUpdate | null> {
  // Check cache first
  const cacheKey = `${chain}:${token}`;
  const cached = priceCache.get(cacheKey);
  if (cached) return cached;

  // Try chain-specific source first
  if (chain === 'solana') {
    return fetchJupiterPrice(token);
  }

  // Fall back to CoinGecko
  return fetchCoinGeckoPrice(token);
}

/**
 * Get price from cache only (no network call).
 */
export function getCachedPrice(token: string, chain: Chain): PriceUpdate | null {
  return priceCache.get(`${chain}:${token}`) ?? null;
}

/**
 * Batch price fetch for multiple tokens.
 */
export async function batchFetchPrices(tokenIds: string[]): Promise<Map<string, PriceUpdate>> {
  const results = new Map<string, PriceUpdate>();

  try {
    const ids = tokenIds.join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_vol=true&include_24hr_change=true`;
    const headers: Record<string, string> = {};

    if (config.marketData.coinGeckoApiKey) {
      headers['x-cg-demo-api-key'] = config.marketData.coinGeckoApiKey;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return results;

    const data = await res.json() as Record<string, { usd: number; usd_24h_vol?: number; usd_24h_change?: number }>;

    for (const [tokenId, tokenData] of Object.entries(data)) {
      const update: PriceUpdate = {
        token: tokenId,
        chain: 'ethereum',
        priceUsd: tokenData.usd,
        volume24h: tokenData.usd_24h_vol,
        change24hPct: tokenData.usd_24h_change,
        timestamp: Date.now(),
      };
      results.set(tokenId, update);
      priceCache.set(tokenId, update);
    }
  } catch (err) {
    log.error({ err }, 'Batch price fetch failed');
  }

  return results;
}
