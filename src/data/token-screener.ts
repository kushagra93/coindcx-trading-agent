import { LRUCache } from 'lru-cache';
import { createChildLogger } from '../core/logger.js';
import type { Chain } from '../core/types.js';

const log = createChildLogger('token-screener');

// ─── Types ────────────────────────────────────────────────────────────

export interface TokenMetrics {
  symbol: string;
  name: string;
  chain: Chain | string;
  price: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  ageMinutes: number;
  holders: number;
  topHolderPct: number;
  lpLocked: boolean;
  lpLockPct: number;
  rugScore: number;
  ctScore: number;
}

export interface ScreeningResult {
  token: TokenMetrics;
  grade: string;
  aiConfidence: number;
  rugProbability: number;
  passed: boolean;
  recommendation: string;
  warnings: string[];
  reasons: string[];
  dataSources: Array<{ name: string; value: string; verdict: 'safe' | 'warn' | 'danger' }>;
}

// ─── DexScreener ──────────────────────────────────────────────────────

const DEXSCREENER_BASE = 'https://api.dexscreener.com';

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd: string | null;
  volume: { m5: number; h1: number; h6: number; h24: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number | null;
  marketCap: number | null;
  pairCreatedAt: number | null;
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
}

const DEXSCREENER_CHAIN_MAP: Record<string, string> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
};

const REVERSE_CHAIN_MAP: Record<string, string> = {};
for (const [chain, dexId] of Object.entries(DEXSCREENER_CHAIN_MAP)) {
  REVERSE_CHAIN_MAP[dexId] = chain;
}

const KNOWN_TOKEN_ADDRESSES: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  BTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
  DEGEN: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
  BRETT: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
  AERO: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  POPCAT: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  FARTCOIN: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
  SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
  LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
  UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
};

function pickBestPair(pairs: DexScreenerPair[], symbolHint?: string): DexScreenerPair {
  if (symbolHint) {
    const upper = symbolHint.toUpperCase();
    const matching = pairs.filter(
      p => p.baseToken.symbol.toUpperCase() === upper
        || p.baseToken.symbol.toUpperCase() === `W${upper}`
    );
    if (matching.length > 0) {
      return matching.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    }
  }
  return pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

function pairToMetrics(pair: DexScreenerPair, symbolOverride?: string): TokenMetrics {
  const ageMs = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : 0;
  const chain = REVERSE_CHAIN_MAP[pair.chainId] ?? pair.chainId;

  return {
    symbol: symbolOverride ?? pair.baseToken.symbol,
    name: pair.baseToken.name,
    chain,
    price: parseFloat(pair.priceUsd ?? '0'),
    priceChange5m: pair.priceChange?.m5 ?? 0,
    priceChange1h: pair.priceChange?.h1 ?? 0,
    priceChange24h: pair.priceChange?.h24 ?? 0,
    volume24h: pair.volume?.h24 ?? 0,
    marketCap: pair.marketCap ?? pair.fdv ?? 0,
    liquidity: pair.liquidity?.usd ?? 0,
    ageMinutes: ageMs > 0 ? Math.floor(ageMs / 60_000) : 999999,
    holders: 0,
    topHolderPct: 0,
    lpLocked: false,
    lpLockPct: 0,
    rugScore: 50,
    ctScore: 50,
  };
}

export async function searchToken(query: string): Promise<{ metrics: TokenMetrics; address: string | null } | null> {
  const upper = query.toUpperCase();
  const knownAddr = KNOWN_TOKEN_ADDRESSES[upper];

  if (knownAddr) {
    try {
      const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${knownAddr}`);
      if (res.ok) {
        const data = await res.json() as { pairs?: DexScreenerPair[] };
        const pairs = data.pairs ?? [];
        if (pairs.length > 0) {
          return { metrics: pairToMetrics(pickBestPair(pairs, upper), upper), address: knownAddr };
        }
      }
    } catch (e) {
      log.warn({ err: e, query }, 'Known address lookup failed');
    }
  }

  try {
    const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data = await res.json() as { pairs?: DexScreenerPair[] };
    if (!data.pairs || data.pairs.length === 0) return null;

    const best = pickBestPair(data.pairs, upper);
    return { metrics: pairToMetrics(best, upper), address: best.baseToken.address ?? null };
  } catch (e) {
    log.warn({ err: e, query }, 'DexScreener search failed');
    return null;
  }
}

export async function lookupByAddress(address: string): Promise<{ metrics: TokenMetrics; address: string } | null> {
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${address}`);
    if (!res.ok) return null;
    const data = await res.json() as { pairs?: DexScreenerPair[] };
    const pairs = data.pairs ?? [];
    if (pairs.length === 0) return null;
    return { metrics: pairToMetrics(pickBestPair(pairs)), address };
  } catch (e) {
    log.warn({ err: e, address }, 'DexScreener address lookup failed');
    return null;
  }
}

export async function fetchTrending(): Promise<TokenMetrics[]> {
  // Fetch known popular tokens in parallel, filter for green 24h, sort by volume
  const symbols = Object.keys(KNOWN_TOKEN_ADDRESSES);

  const fetches = symbols.map(async (sym) => {
    try {
      const addr = KNOWN_TOKEN_ADDRESSES[sym];
      const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${addr}`);
      if (!res.ok) return null;
      const data = await res.json() as { pairs?: DexScreenerPair[] };
      if (!data.pairs || data.pairs.length === 0) return null;
      return pairToMetrics(pickBestPair(data.pairs, sym), sym);
    } catch { return null; }
  });

  const results = (await Promise.all(fetches)).filter((t): t is TokenMetrics => t !== null);

  // Only show tokens that are green on 24h and have meaningful volume
  const greenTokens = results
    .filter(t => t.priceChange24h > 0 && t.volume24h > 10_000)
    .sort((a, b) => b.volume24h - a.volume24h);

  // If not enough green tokens, also include top volume tokens regardless of color
  if (greenTokens.length >= 5) return greenTokens.slice(0, 15);

  const byVolume = results
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 15);

  // Green first, then rest by volume
  const seen = new Set(greenTokens.map(t => t.symbol));
  const combined = [...greenTokens, ...byVolume.filter(t => !seen.has(t.symbol))];
  return combined.slice(0, 15);
}

// ─── RugCheck (Solana) ────────────────────────────────────────────────

const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1';

export async function fetchRugCheck(mintAddress: string): Promise<{
  rugScore: number;
  topHolderPct: number;
  lpLocked: boolean;
  lpLockPct: number;
  holders: number;
  risks: string[];
} | null> {
  try {
    const res = await fetch(`${RUGCHECK_BASE}/tokens/${mintAddress}/report/summary`);
    if (!res.ok) return null;
    const data = await res.json() as {
      score: number;
      risks?: Array<{ name: string; level: string }>;
      topHolders?: Array<{ pct: number }>;
      markets?: Array<{ lp: { lpLockedPct: number } }>;
    };

    return {
      rugScore: Math.max(0, Math.min(100, Math.round(data.score / 10))),
      topHolderPct: data.topHolders?.[0]?.pct ?? 0,
      lpLocked: (data.markets?.[0]?.lp?.lpLockedPct ?? 0) > 0,
      lpLockPct: Math.round(data.markets?.[0]?.lp?.lpLockedPct ?? 0),
      holders: data.topHolders?.length ?? 0,
      risks: data.risks?.filter(r => r.level === 'error' || r.level === 'warn').map(r => r.name) ?? [],
    };
  } catch (e) {
    log.warn({ err: e, mintAddress }, 'RugCheck failed');
    return null;
  }
}

// ─── GoPlus Security (EVM) ────────────────────────────────────────────

const GOPLUS_BASE = 'https://api.gopluslabs.com/api/v1';

const GOPLUS_CHAIN_IDS: Record<string, string> = {
  ethereum: '1',
  polygon: '137',
  arbitrum: '42161',
  base: '8453',
};

export async function fetchGoPlus(contractAddress: string, chain: string): Promise<{
  rugScore: number;
  topHolderPct: number;
  lpLocked: boolean;
  lpLockPct: number;
  holders: number;
  isHoneypot: boolean;
  risks: string[];
} | null> {
  const chainId = GOPLUS_CHAIN_IDS[chain];
  if (!chainId) return null;

  try {
    const res = await fetch(
      `${GOPLUS_BASE}/token_security/${chainId}?contract_addresses=${contractAddress.toLowerCase()}`
    );
    if (!res.ok) return null;
    const data = await res.json() as { result?: Record<string, {
      is_open_source?: string; is_proxy?: string; is_mintable?: string; is_honeypot?: string;
      holder_count?: string; holders?: Array<{ percent: string }>; lp_holders?: Array<{ is_locked: number; percent: string }>;
    }> };

    const result = data?.result?.[contractAddress.toLowerCase()];
    if (!result) return null;

    const risks: string[] = [];
    let score = 100;
    const isHoneypot = result.is_honeypot === '1';
    if (isHoneypot) { risks.push('HONEYPOT detected'); score -= 50; }
    if (result.is_proxy === '1') { risks.push('Proxy contract'); score -= 10; }
    if (result.is_mintable === '1') { risks.push('Mintable supply'); score -= 15; }
    if (!result.is_open_source || result.is_open_source === '0') { risks.push('Closed source'); score -= 20; }

    const holders = parseInt(result.holder_count ?? '0', 10);
    const topHolderPct = result.holders?.[0] ? parseFloat(result.holders[0].percent) * 100 : 0;
    const lpLockedPct = result.lp_holders
      ?.filter(h => h.is_locked === 1)
      .reduce((sum, h) => sum + parseFloat(h.percent) * 100, 0) ?? 0;

    return {
      rugScore: Math.max(0, Math.min(100, score)),
      topHolderPct, lpLocked: lpLockedPct > 0, lpLockPct: Math.round(lpLockedPct),
      holders, isHoneypot, risks,
    };
  } catch (e) {
    log.warn({ err: e, contractAddress, chain }, 'GoPlus failed');
    return null;
  }
}

// ─── Birdeye (Solana token holder distribution) ──────────────────────

const BIRDEYE_BASE = 'https://public-api.birdeye.so';

export async function fetchBirdeyeHolders(mintAddress: string): Promise<{
  holderCount: number;
  topHolderPct: number;
  top10HolderPct: number;
  distribution: Array<{ range: string; count: number; pct: number }>;
} | null> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${BIRDEYE_BASE}/defi/v3/token/holder?address=${mintAddress}`, {
      headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      data?: {
        total?: number;
        items?: Array<{ owner: string; balance: number; percentage: number }>;
      };
    };

    const items = data.data?.items ?? [];
    const total = data.data?.total ?? items.length;
    const top10Pct = items.slice(0, 10).reduce((sum, h) => sum + (h.percentage ?? 0), 0);

    return {
      holderCount: total,
      topHolderPct: items[0]?.percentage ?? 0,
      top10HolderPct: top10Pct,
      distribution: [],
    };
  } catch (e) {
    log.warn({ err: e, mintAddress }, 'Birdeye holder fetch failed');
    return null;
  }
}

export async function fetchBirdeyeOverview(mintAddress: string): Promise<{
  trade24hCount: number;
  uniqueWallets24h: number;
  buyPressure: number;
} | null> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${BIRDEYE_BASE}/defi/token_overview?address=${mintAddress}`, {
      headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      data?: {
        trade24h?: number;
        uniqueWallet24h?: number;
        buy24h?: number;
        sell24h?: number;
      };
    };

    const d = data.data;
    if (!d) return null;

    const buys = d.buy24h ?? 0;
    const sells = d.sell24h ?? 0;
    const total = buys + sells;

    return {
      trade24hCount: d.trade24h ?? 0,
      uniqueWallets24h: d.uniqueWallet24h ?? 0,
      buyPressure: total > 0 ? Math.round((buys / total) * 100) : 50,
    };
  } catch (e) {
    log.warn({ err: e, mintAddress }, 'Birdeye overview failed');
    return null;
  }
}

// ─── Helius (Solana token holders via DAS) ────────────────────────────

export async function fetchHeliusHolders(mintAddress: string): Promise<{
  holderCount: number;
  topHolders: Array<{ address: string; pct: number }>;
} | null> {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccounts',
        params: { mint: mintAddress, limit: 20 },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      result?: {
        total?: number;
        token_accounts?: Array<{ owner: string; amount: number }>;
      };
    };

    const accounts = data.result?.token_accounts ?? [];
    const total = data.result?.total ?? accounts.length;
    const totalSupply = accounts.reduce((s, a) => s + a.amount, 0);

    const topHolders = accounts.slice(0, 10).map(a => ({
      address: a.owner,
      pct: totalSupply > 0 ? Math.round((a.amount / totalSupply) * 10000) / 100 : 0,
    }));

    return { holderCount: total, topHolders };
  } catch (e) {
    log.warn({ err: e, mintAddress }, 'Helius holder fetch failed');
    return null;
  }
}

// ─── Unified Screening ────────────────────────────────────────────────

const metricsCache = new LRUCache<string, TokenMetrics>({ max: 500, ttl: 60_000 });

async function enrichWithSecurity(metrics: TokenMetrics, contractAddress: string | null): Promise<TokenMetrics> {
  const enriched = { ...metrics } as any;

  const volScore = Math.min(50, (metrics.volume24h / 100_000) * 10);
  const momentumScore = Math.min(50, Math.max(0, metrics.priceChange24h));
  enriched.ctScore = Math.round(Math.min(100, volScore + momentumScore));

  if (!contractAddress) return enriched;

  if (metrics.chain === 'solana') {
    // Fire all Solana data sources in parallel
    const [rugData, birdeyeHolders, birdeyeOverview, heliusHolders] = await Promise.all([
      fetchRugCheck(contractAddress),
      fetchBirdeyeHolders(contractAddress),
      fetchBirdeyeOverview(contractAddress),
      fetchHeliusHolders(contractAddress),
    ]);

    if (rugData) {
      enriched.rugScore = rugData.rugScore;
      enriched.topHolderPct = rugData.topHolderPct;
      enriched.lpLocked = rugData.lpLocked;
      enriched.lpLockPct = rugData.lpLockPct;
      if (rugData.holders > 0) enriched.holders = rugData.holders;
    }

    // Birdeye provides more accurate holder counts
    if (birdeyeHolders) {
      enriched.holders = birdeyeHolders.holderCount;
      enriched.topHolderPct = birdeyeHolders.topHolderPct || enriched.topHolderPct;
      enriched.top10HolderPct = birdeyeHolders.top10HolderPct;
    }

    if (birdeyeOverview) {
      enriched.trade24hCount = birdeyeOverview.trade24hCount;
      enriched.uniqueWallets24h = birdeyeOverview.uniqueWallets24h;
      enriched.buyPressure = birdeyeOverview.buyPressure;
    }

    // Helius gives us raw top holder addresses
    if (heliusHolders) {
      if (!birdeyeHolders) enriched.holders = heliusHolders.holderCount;
      enriched.topHolders = heliusHolders.topHolders;
    }
  } else {
    const goplusData = await fetchGoPlus(contractAddress, metrics.chain);
    if (goplusData) {
      enriched.rugScore = goplusData.rugScore;
      enriched.topHolderPct = goplusData.topHolderPct;
      enriched.lpLocked = goplusData.lpLocked;
      enriched.lpLockPct = goplusData.lpLockPct;
      if (goplusData.holders > 0) enriched.holders = goplusData.holders;
    }
  }

  return enriched;
}

export async function getTokenBySymbol(symbol: string): Promise<TokenMetrics | null> {
  const cacheKey = `sym:${symbol.toUpperCase()}`;
  const cached = metricsCache.get(cacheKey);
  if (cached) return cached;

  const result = await searchToken(symbol);
  if (!result) return null;

  const enriched = await enrichWithSecurity(result.metrics, result.address);
  metricsCache.set(cacheKey, enriched);
  return enriched;
}

export async function getTokenByAddress(address: string, chainHint?: string): Promise<TokenMetrics | null> {
  const cacheKey = `addr:${address.toLowerCase()}`;
  const cached = metricsCache.get(cacheKey);
  if (cached) return cached;

  const result = await lookupByAddress(address);
  if (!result) return null;

  if (chainHint) result.metrics.chain = chainHint;
  const enriched = await enrichWithSecurity(result.metrics, address);
  metricsCache.set(cacheKey, enriched);
  return enriched;
}

export function screenToken(metrics: TokenMetrics): ScreeningResult {
  const warnings: string[] = [];
  const reasons: string[] = [];
  const dataSources: ScreeningResult['dataSources'] = [];
  let score = 100;

  if (metrics.rugScore < 30) { reasons.push(`Low safety score: ${metrics.rugScore}/100`); score -= 30; }
  else if (metrics.rugScore < 60) { warnings.push(`Moderate safety score: ${metrics.rugScore}/100`); score -= 10; }

  if (metrics.liquidity < 10_000) { reasons.push(`Very low liquidity: $${metrics.liquidity.toLocaleString()}`); score -= 25; }
  else if (metrics.liquidity < 50_000) { warnings.push(`Low liquidity: $${metrics.liquidity.toLocaleString()}`); score -= 10; }

  if (metrics.volume24h < 5_000) { warnings.push(`Low volume: $${metrics.volume24h.toLocaleString()}`); score -= 10; }

  if (metrics.topHolderPct > 20) { reasons.push(`Top holder owns ${metrics.topHolderPct.toFixed(1)}%`); score -= 20; }
  else if (metrics.topHolderPct > 10) { warnings.push(`Top holder owns ${metrics.topHolderPct.toFixed(1)}%`); score -= 5; }

  if (!metrics.lpLocked && metrics.lpLockPct === 0) { warnings.push('LP not locked'); score -= 10; }

  if (metrics.ageMinutes < 60) { warnings.push(`Very new token: ${metrics.ageMinutes}min old`); score -= 15; }

  dataSources.push({
    name: 'DexScreener',
    value: `$${metrics.price.toFixed(6)} | Vol $${(metrics.volume24h / 1000).toFixed(0)}K`,
    verdict: metrics.volume24h > 50_000 ? 'safe' : metrics.volume24h > 10_000 ? 'warn' : 'danger',
  });
  dataSources.push({
    name: metrics.chain === 'solana' ? 'RugCheck' : 'GoPlus',
    value: `Score ${metrics.rugScore}/100`,
    verdict: metrics.rugScore >= 60 ? 'safe' : metrics.rugScore >= 30 ? 'warn' : 'danger',
  });

  score = Math.max(0, Math.min(100, score));

  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F';
  const passed = score >= 40;

  let recommendation: string;
  if (grade === 'A') recommendation = `${metrics.symbol} looks solid. Good liquidity, safety checks pass.`;
  else if (grade === 'B') recommendation = `${metrics.symbol} is reasonable but has some minor flags. Proceed with caution.`;
  else if (grade === 'C') recommendation = `${metrics.symbol} has notable risks. Consider smaller position size.`;
  else recommendation = `${metrics.symbol} has significant red flags. High risk of loss.`;

  return {
    token: metrics,
    grade,
    aiConfidence: score,
    rugProbability: Math.max(0, 100 - metrics.rugScore),
    passed,
    recommendation,
    warnings,
    reasons,
    dataSources,
  };
}

export async function screenBySymbol(symbol: string): Promise<ScreeningResult | null> {
  const metrics = await getTokenBySymbol(symbol);
  if (!metrics) return null;
  return screenToken(metrics);
}

export async function screenByAddress(address: string, chainHint?: string): Promise<ScreeningResult | null> {
  const metrics = await getTokenByAddress(address, chainHint);
  if (!metrics) return null;
  return screenToken(metrics);
}
