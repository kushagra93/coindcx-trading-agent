import { LRUCache } from 'lru-cache';
import { createChildLogger } from '../core/logger.js';
import type { Chain } from '../core/types.js';
import {
  CHAIN_TO_DEXSCREENER,
  DEXSCREENER_TO_CHAIN,
  GOPLUS_CHAIN_IDS as REGISTRY_GOPLUS_CHAIN_IDS,
} from '../core/chain-registry.js';

const log = createChildLogger('token-screener');

// ─── Types ────────────────────────────────────────────────────────────

export interface TokenMetrics {
  symbol: string;
  name: string;
  chain: Chain | string;
  address?: string;
  imageUrl?: string;
  price: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange6h: number;
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
  boosts?: number;
  txnsBuys24h?: number;
  txnsSells24h?: number;
}

export interface TokenAudit {
  noMint: boolean;
  noFreeze: boolean;
  burnt: number;
  top10HolderPct: number;
  insidersDetected: number;
  totalHolders: number;
  totalLiquidity: number;
  lpLockedPct: number;
  lpProviders: number;
  creator?: string;
  creatorBalance?: number;
  deployPlatform?: string;
  rugged: boolean;
  tokenCreatedAt?: string;
  risks: Array<{ name: string; level: string; description?: string }>;
  pairAddress?: string;
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
  audit?: TokenAudit;
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
  info?: {
    imageUrl?: string;
    header?: string;
    websites?: Array<{ label: string; url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
}

// Derived from chain registry — all supported chains auto-included
const DEXSCREENER_CHAIN_MAP: Record<string, string> = CHAIN_TO_DEXSCREENER;
const REVERSE_CHAIN_MAP: Record<string, string> = DEXSCREENER_TO_CHAIN;

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
    address: pair.baseToken.address,
    imageUrl: pair.info?.imageUrl ?? undefined,
    price: parseFloat(pair.priceUsd ?? '0'),
    priceChange5m: pair.priceChange?.m5 ?? 0,
    priceChange1h: pair.priceChange?.h1 ?? 0,
    priceChange6h: pair.priceChange?.h6 ?? 0,
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
    txnsBuys24h: pair.txns?.h24?.buys ?? 0,
    txnsSells24h: pair.txns?.h24?.sells ?? 0,
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
    const m = pairToMetrics(pickBestPair(pairs));
    m.address = address;
    return { metrics: m, address };
  } catch (e) {
    log.warn({ err: e, address }, 'DexScreener address lookup failed');
    return null;
  }
}

async function fetchBirdeyeTrending(): Promise<TokenMetrics[]> {
  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch(
      `${BIRDEYE_BASE}/defi/token_trending?sort_by=rank&sort_type=asc&offset=0&limit=20`,
      { headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' } },
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      data?: {
        tokens?: Array<{
          address: string; symbol: string; name: string; logoURI?: string;
          price: number; marketcap?: number; fdv?: number;
          volume24hUSD?: number; price24hChangePercent?: number;
          liquidity?: number; rank?: number;
        }>;
      };
    };

    const items = data.data?.tokens ?? [];
    return items
      .filter(t => (t.marketcap ?? t.fdv ?? 0) >= 100_000)
      .map(t => ({
        symbol: t.symbol,
        name: t.name,
        chain: 'solana' as Chain | string,
        address: t.address,
        imageUrl: t.logoURI ?? undefined,
        price: t.price,
        priceChange5m: 0,
        priceChange1h: 0,
        priceChange6h: 0,
        priceChange24h: t.price24hChangePercent ?? 0,
        volume24h: t.volume24hUSD ?? 0,
        marketCap: t.marketcap ?? t.fdv ?? 0,
        liquidity: t.liquidity ?? 0,
        ageMinutes: 999999,
        holders: 0,
        topHolderPct: 0,
        lpLocked: false,
        lpLockPct: 0,
        rugScore: 50,
        ctScore: 50,
      }));
  } catch (e) {
    log.warn({ err: e }, 'Birdeye trending fetch failed');
    return [];
  }
}

async function fetchDexScreenerBoosted(): Promise<TokenMetrics[]> {
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/token-boosts/top/v1`);
    if (!res.ok) return [];
    const boostItems = await res.json() as Array<{
      tokenAddress: string; chainId: string; amount?: number;
      icon?: string; header?: string; description?: string;
    }>;

    const seen = new Set<string>();
    const items = boostItems.filter(item => {
      if (seen.has(item.tokenAddress)) return false;
      seen.add(item.tokenAddress);
      return true;
    });

    const boostMap = new Map<string, { amount: number; icon?: string }>();
    for (const item of items) {
      boostMap.set(item.tokenAddress.toLowerCase(), { amount: item.amount ?? 0, icon: item.icon });
    }

    // Batch lookup by chain — single request per chain instead of N individual ones
    const byChain = new Map<string, string[]>();
    for (const item of items) {
      const chain = item.chainId;
      if (!byChain.has(chain)) byChain.set(chain, []);
      byChain.get(chain)!.push(item.tokenAddress);
    }

    const allPairs: DexScreenerPair[] = [];
    for (const [chain, addrs] of byChain) {
      try {
        const batchUrl = `${DEXSCREENER_BASE}/tokens/v1/${chain}/${addrs.join(',')}`;
        const batchRes = await fetch(batchUrl);
        if (batchRes.ok) {
          const pairs = await batchRes.json() as DexScreenerPair[];
          if (Array.isArray(pairs)) allPairs.push(...pairs);
        }
      } catch (e) {
        log.warn({ err: e, chain }, 'Batch token lookup failed');
      }
    }

    const pairsByToken = new Map<string, DexScreenerPair[]>();
    for (const pair of allPairs) {
      const addr = pair.baseToken.address.toLowerCase();
      if (!pairsByToken.has(addr)) pairsByToken.set(addr, []);
      pairsByToken.get(addr)!.push(pair);
    }

    const results: TokenMetrics[] = [];
    for (const [addr, pairs] of pairsByToken) {
      const best = pickBestPair(pairs);
      const m = pairToMetrics(best);
      const boost = boostMap.get(addr);
      if (boost) {
        m.boosts = boost.amount;
        if (boost.icon && !m.imageUrl) m.imageUrl = boost.icon;
      }
      if (m.marketCap >= 100_000) {
        results.push(m);
      }
    }

    return results;
  } catch (e) {
    log.warn({ err: e }, 'DexScreener boosted fetch failed');
    return [];
  }
}

export async function fetchTrending(): Promise<TokenMetrics[]> {
  // Fetch from both Birdeye trending (algorithmic) and DexScreener boosts (paid) in parallel
  const [birdeyeTokens, dexTokens] = await Promise.all([
    fetchBirdeyeTrending(),
    fetchDexScreenerBoosted(),
  ]);

  // Merge, deduplicate by address, prefer DexScreener data (has richer multi-timeframe metrics)
  const merged = new Map<string, TokenMetrics>();
  for (const t of birdeyeTokens) {
    if (t.address) merged.set(t.address.toLowerCase(), t);
  }
  for (const t of dexTokens) {
    if (t.address) merged.set(t.address.toLowerCase(), t);
  }

  // Birdeye tokens lack 5m/1h/6h data — enrich via DexScreener batch lookup
  const needsEnrich = Array.from(merged.values()).filter(
    t => t.priceChange5m === 0 && t.priceChange1h === 0 && t.priceChange6h === 0
      && t.address
  );
  if (needsEnrich.length > 0) {
    const addrs = needsEnrich.map(t => t.address!);
    try {
      const batchUrl = `${DEXSCREENER_BASE}/tokens/v1/solana/${addrs.join(',')}`;
      const batchRes = await fetch(batchUrl);
      if (batchRes.ok) {
        const pairs = await batchRes.json() as DexScreenerPair[];
        const pairsByAddr = new Map<string, DexScreenerPair[]>();
        for (const p of (Array.isArray(pairs) ? pairs : [])) {
          const a = p.baseToken.address.toLowerCase();
          if (!pairsByAddr.has(a)) pairsByAddr.set(a, []);
          pairsByAddr.get(a)!.push(p);
        }
        for (const t of needsEnrich) {
          const tokenPairs = pairsByAddr.get(t.address!.toLowerCase());
          if (tokenPairs && tokenPairs.length > 0) {
            const best = pickBestPair(tokenPairs);
            t.priceChange5m = best.priceChange?.m5 ?? 0;
            t.priceChange1h = best.priceChange?.h1 ?? 0;
            t.priceChange6h = best.priceChange?.h6 ?? 0;
            t.priceChange24h = best.priceChange?.h24 ?? t.priceChange24h;
            if (!t.imageUrl && best.info?.imageUrl) t.imageUrl = best.info.imageUrl;
            t.txnsBuys24h = best.txns?.h24?.buys ?? 0;
            t.txnsSells24h = best.txns?.h24?.sells ?? 0;
            const ageMs = best.pairCreatedAt ? Date.now() - best.pairCreatedAt : 0;
            if (ageMs > 0) t.ageMinutes = Math.floor(ageMs / 60_000);
          }
        }
      }
    } catch (e) {
      log.warn({ err: e }, 'Birdeye enrichment via DexScreener failed');
    }
  }

  const results = Array.from(merged.values());
  results.sort((a, b) => b.volume24h - a.volume24h);
  return results.slice(0, 30);
}

export async function fetchGainers(): Promise<TokenMetrics[]> {
  const trending = await fetchTrending();
  return trending
    .filter(t => t.priceChange24h > 0)
    .sort((a, b) => b.priceChange24h - a.priceChange24h);
}

// ─── RugCheck (Solana) ────────────────────────────────────────────────

const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1';

interface RugCheckFullReport {
  rugScore: number;
  topHolderPct: number;
  top10HolderPct: number;
  lpLocked: boolean;
  lpLockPct: number;
  holders: number;
  risks: string[];
  audit: TokenAudit;
}

export async function fetchRugCheck(mintAddress: string): Promise<RugCheckFullReport | null> {
  try {
    const res = await fetch(`${RUGCHECK_BASE}/tokens/${mintAddress}/report`);
    if (!res.ok) return null;
    const data = await res.json() as {
      score: number;
      score_normalised: number;
      mintAuthority: string | null;
      freezeAuthority: string | null;
      creator?: string;
      creatorBalance?: number;
      deployPlatform?: string;
      rugged?: boolean;
      detectedAt?: string;
      graphInsidersDetected?: number;
      totalHolders?: number;
      totalLPProviders?: number;
      totalMarketLiquidity?: number;
      risks?: Array<{ name: string; level: string; description?: string }>;
      topHolders?: Array<{ address: string; pct: number; amount?: number }>;
      markets?: Array<{
        pubkey: string;
        lp?: { lpLockedPct: number; lpBurnedPct?: number };
        liquidityA?: number;
        liquidityB?: number;
      }>;
      lockers?: Record<string, unknown>;
    };

    const topHolders = data.topHolders ?? [];
    const top10Pct = topHolders.slice(0, 10).reduce((s, h) => s + (h.pct ?? 0), 0);
    const lpLockedPct = data.markets?.[0]?.lp?.lpLockedPct ?? 0;
    const lpBurnedPct = data.markets?.[0]?.lp?.lpBurnedPct ?? 0;

    return {
      rugScore: Math.max(0, Math.min(100, 100 - Math.round(data.score / 10))),
      topHolderPct: topHolders[0]?.pct ?? 0,
      top10HolderPct: Math.round(top10Pct * 100) / 100,
      lpLocked: lpLockedPct > 0,
      lpLockPct: Math.round(lpLockedPct),
      holders: data.totalHolders ?? topHolders.length,
      risks: data.risks?.filter(r => r.level === 'error' || r.level === 'warn').map(r => r.name) ?? [],
      audit: {
        noMint: data.mintAuthority === null,
        noFreeze: data.freezeAuthority === null,
        burnt: Math.round(lpBurnedPct),
        top10HolderPct: Math.round(top10Pct * 100) / 100,
        insidersDetected: data.graphInsidersDetected ?? 0,
        totalHolders: data.totalHolders ?? topHolders.length,
        totalLiquidity: data.totalMarketLiquidity ?? 0,
        lpLockedPct: Math.round(lpLockedPct * 100) / 100,
        lpProviders: data.totalLPProviders ?? 0,
        creator: data.creator,
        creatorBalance: data.creatorBalance,
        deployPlatform: data.deployPlatform,
        rugged: data.rugged ?? false,
        tokenCreatedAt: data.detectedAt,
        risks: data.risks ?? [],
        pairAddress: data.markets?.[0]?.pubkey,
      },
    };
  } catch (e) {
    log.warn({ err: e, mintAddress }, 'RugCheck failed');
    return null;
  }
}

// ─── GoPlus Security (EVM) ────────────────────────────────────────────

const GOPLUS_BASE = 'https://api.gopluslabs.com/api/v1';

// Derived from chain registry — all GoPlus-supported chains auto-included
const GOPLUS_CHAIN_IDS: Record<string, string> = REGISTRY_GOPLUS_CHAIN_IDS;

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
    const total = data.data?.total ?? 0;
    const top10Pct = items.slice(0, 10).reduce((sum, h) => sum + (h.percentage ?? 0), 0);

    // Only return holder count if Birdeye provides a real total, not items.length
    return {
      holderCount: total > 0 ? total : 0,
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
      enriched._audit = rugData.audit;
    }

    // Birdeye holder counts — only use if Birdeye returned a real total
    if (birdeyeHolders) {
      if (birdeyeHolders.holderCount > 0) enriched.holders = birdeyeHolders.holderCount;
      if (birdeyeHolders.topHolderPct > 0) enriched.topHolderPct = birdeyeHolders.topHolderPct;
      if (birdeyeHolders.top10HolderPct > 0) enriched.top10HolderPct = birdeyeHolders.top10HolderPct;
    }

    if (birdeyeOverview) {
      enriched.trade24hCount = birdeyeOverview.trade24hCount;
      enriched.uniqueWallets24h = birdeyeOverview.uniqueWallets24h;
      enriched.buyPressure = birdeyeOverview.buyPressure;
    }

    // Helius gives us raw top holder addresses
    if (heliusHolders) {
      if (heliusHolders.holderCount > enriched.holders) enriched.holders = heliusHolders.holderCount;
      enriched.topHolders = heliusHolders.topHolders;
    }

    // Final reconciliation: audit totalHolders is often the most accurate
    if (enriched._audit?.totalHolders && enriched._audit.totalHolders > enriched.holders) {
      enriched.holders = enriched._audit.totalHolders;
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
  const audit: TokenAudit | undefined = (metrics as any)._audit;
  let score = 0;

  // ── Safety score (rugScore is 0-100 where 100 = safest) ──
  const hasSecurityData = metrics.rugScore !== 50;
  if (hasSecurityData) {
    if (metrics.rugScore >= 80) { score += 30; }
    else if (metrics.rugScore >= 50) { score += 20; warnings.push(`Moderate safety: ${metrics.rugScore}/100`); }
    else if (metrics.rugScore >= 20) { score += 5; reasons.push(`Low safety score: ${metrics.rugScore}/100`); }
    else { reasons.push(`Very low safety score: ${metrics.rugScore}/100`); }
  } else {
    score += 10;
    warnings.push('No security data available');
  }

  // ── Audit data (if available from RugCheck/GoPlus) ──
  if (audit) {
    if (audit.rugged) { reasons.push('Token flagged as RUGGED'); score -= 50; }
    if (audit.noMint) score += 5; else { warnings.push('Mint authority active — supply can increase'); score -= 5; }
    if (audit.noFreeze) score += 5; else { warnings.push('Freeze authority active — wallets can be frozen'); score -= 5; }
    if (audit.burnt > 50) score += 5;
    else if (audit.burnt === 0) warnings.push('LP not burnt');
    if (audit.insidersDetected > 0) { reasons.push(`${audit.insidersDetected} insider(s) detected`); score -= 10; }
    if (audit.top10HolderPct > 50) { reasons.push(`Top 10 holders own ${audit.top10HolderPct.toFixed(1)}%`); score -= 15; }
    else if (audit.top10HolderPct > 30) { warnings.push(`Top 10 holders own ${audit.top10HolderPct.toFixed(1)}%`); score -= 5; }
  }

  // ── Liquidity ──
  if (metrics.liquidity >= 100_000) score += 15;
  else if (metrics.liquidity >= 50_000) score += 10;
  else if (metrics.liquidity >= 10_000) { score += 5; warnings.push(`Low liquidity: $${metrics.liquidity.toLocaleString()}`); }
  else { reasons.push(`Very low liquidity: $${metrics.liquidity.toLocaleString()}`); }

  // ── Volume ──
  if (metrics.volume24h >= 100_000) score += 10;
  else if (metrics.volume24h >= 10_000) score += 5;
  else { warnings.push(`Low volume: $${metrics.volume24h.toLocaleString()}`); }

  // ── Holder concentration (non-audit path) ──
  if (!audit) {
    if (metrics.topHolderPct > 20) { reasons.push(`Top holder owns ${metrics.topHolderPct.toFixed(1)}%`); score -= 10; }
    else if (metrics.topHolderPct > 10) { warnings.push(`Top holder owns ${metrics.topHolderPct.toFixed(1)}%`); }
  }

  // ── LP lock ──
  if (metrics.lpLocked || metrics.lpLockPct > 0) score += 5;
  else if (hasSecurityData) warnings.push('LP not locked');

  // ── Age ──
  if (metrics.ageMinutes < 60) { warnings.push(`Very new token: ${metrics.ageMinutes}min old`); score -= 5; }
  else if (metrics.ageMinutes > 60 * 24 * 7) score += 5;

  // ── Data sources ──
  dataSources.push({
    name: 'DexScreener',
    value: `$${metrics.price.toFixed(6)} | Vol $${(metrics.volume24h / 1000).toFixed(0)}K`,
    verdict: metrics.volume24h > 50_000 ? 'safe' : metrics.volume24h > 10_000 ? 'warn' : 'danger',
  });
  dataSources.push({
    name: metrics.chain === 'solana' ? 'RugCheck' : 'GoPlus',
    value: hasSecurityData ? `Safety ${metrics.rugScore}/100` : 'No data',
    verdict: !hasSecurityData ? 'warn' : metrics.rugScore >= 60 ? 'safe' : metrics.rugScore >= 30 ? 'warn' : 'danger',
  });

  score = Math.max(0, Math.min(100, score));

  const grade = score >= 70 ? 'A' : score >= 50 ? 'B' : score >= 35 ? 'C' : score >= 15 ? 'D' : 'F';
  const passed = score >= 35;

  let recommendation: string;
  if (grade === 'A') recommendation = `${metrics.symbol} looks solid. Good liquidity, safety checks pass.`;
  else if (grade === 'B') recommendation = `${metrics.symbol} is reasonable but has minor flags. Proceed with caution.`;
  else if (grade === 'C') recommendation = `${metrics.symbol} has notable risks. Consider smaller position size.`;
  else recommendation = `${metrics.symbol} has significant red flags. High risk of loss.`;

  return {
    token: metrics,
    grade,
    aiConfidence: score,
    rugProbability: hasSecurityData ? Math.max(0, 100 - metrics.rugScore) : 50,
    passed,
    recommendation,
    warnings,
    reasons,
    dataSources,
    audit,
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

// ─── GMGN Top Traders Leaderboard ─────────────────────────────────────

export interface TopTrader {
  walletAddress: string;
  name: string;
  twitterUsername: string;
  tags: string[];
  avatar: string;
  pnl7d: number;
  pnl30d: number;
  realizedProfit7d: number;
  realizedProfit30d: number;
  winRate7d: number;
  winRate30d: number;
  buys7d: number;
  sells7d: number;
  volume7d: number;
  avgCost7d: number;
  trades5xPlus: number;
  trades2x5x: number;
  solBalance: number;
  lastActive: number;
}

const leaderboardCache = new LRUCache<string, TopTrader[]>({ max: 5, ttl: 5 * 60_000 });

export async function fetchTopTraders(
  period: '7d' | '30d' = '7d',
  orderBy: 'pnl_7d' | 'pnl_30d' | 'winrate_7d' | 'realized_profit_7d' = 'pnl_7d',
): Promise<TopTrader[]> {
  const cacheKey = `${period}_${orderBy}`;
  const cached = leaderboardCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://gmgn.ai/defi/quotation/v1/rank/sol/wallets/${period}?orderby=${orderBy}&direction=desc`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://gmgn.ai/',
      },
    });

    if (!resp.ok) {
      log.warn({ status: resp.status }, 'GMGN leaderboard request failed');
      return [];
    }

    const data = await resp.json() as any;
    if (data.code !== 0 || !data.data?.rank) return [];

    const traders: TopTrader[] = data.data.rank.slice(0, 50).map((w: any) => ({
      walletAddress: w.wallet_address || w.address || '',
      name: w.name || w.twitter_name || '',
      twitterUsername: w.twitter_username || '',
      tags: w.tags || [],
      avatar: w.avatar || '',
      pnl7d: parseFloat(w.pnl_7d) || 0,
      pnl30d: parseFloat(w.pnl_30d) || 0,
      realizedProfit7d: parseFloat(w.realized_profit_7d) || 0,
      realizedProfit30d: parseFloat(w.realized_profit_30d) || 0,
      winRate7d: parseFloat(w.winrate_7d) || 0,
      winRate30d: parseFloat(w.winrate_30d) || 0,
      buys7d: w.buy_7d || 0,
      sells7d: w.sell_7d || 0,
      volume7d: parseFloat(w.volume_7d) || 0,
      avgCost7d: parseFloat(w.avg_cost_7d) || 0,
      trades5xPlus: w.pnl_gt_5x_num_7d || 0,
      trades2x5x: w.pnl_2x_5x_num_7d || 0,
      solBalance: parseFloat(w.sol_balance) || 0,
      lastActive: w.last_active || 0,
    }));

    leaderboardCache.set(cacheKey, traders);
    return traders;
  } catch (err) {
    log.error({ err }, 'Failed to fetch GMGN leaderboard');
    return [];
  }
}

export async function fetchKOLs(): Promise<TopTrader[]> {
  const all = await fetchTopTraders('7d', 'pnl_7d');
  return all.filter(t =>
    t.tags.includes('kol') || t.tags.includes('top_followed') || t.twitterUsername,
  ).sort((a, b) => b.realizedProfit7d - a.realizedProfit7d);
}
