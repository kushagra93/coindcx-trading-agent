/**
 * Live data service — fetches real on-chain data from free public APIs:
 *   - DexScreener: price, volume, liquidity, market cap, pair age
 *   - RugCheck: Solana token safety scores
 *   - GoPlus: EVM token security analysis
 *
 * All APIs are free and require no API keys.
 */

import type { Chain, TokenMetrics } from './blockchain';

// ─── DexScreener ─────────────────────────────────────────────────────

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

interface DexScreenerResponse {
  pairs: DexScreenerPair[] | null;
}

const DEXSCREENER_CHAIN_MAP: Partial<Record<Chain, string>> = {
  solana: 'solana',
  ethereum: 'ethereum',
  base: 'base',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  bsc: 'bsc',
  optimism: 'optimism',
  avalanche: 'avalanche',
  blast: 'blast',
  fantom: 'fantom',
  zksync: 'zksync',
  linea: 'linea',
  scroll: 'scroll',
  mantle: 'mantle',
  celo: 'celo',
  gnosis: 'gnosis',
  sui: 'sui',
  aptos: 'aptos',
};

const REVERSE_CHAIN_MAP: Record<string, Chain> = {};
for (const [chain, dexId] of Object.entries(DEXSCREENER_CHAIN_MAP)) {
  if (dexId) REVERSE_CHAIN_MAP[dexId] = chain as Chain;
}

// Well-known token addresses for precise lookups (avoids search ambiguity)
const KNOWN_TOKEN_ADDRESSES: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  BTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
  DEGEN: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
  BRETT: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
  AERO: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  ARB: '0x912CE59144191C1204E64559FE8253a0e49E6548',
  OP: '0x4200000000000000000000000000000000000042',
  LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
  UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
  POPCAT: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr',
  FARTCOIN: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
  MEW: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5',
  MYRO: 'HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4',
  GIGA: '63LfDmNb3MQ8mw9MtZ2To9bEA2M71kZUUGq5tiJxcqj9',
  MOG: '0xaaeE1A9723aaDB7afA2810263653A34bA2C21C7a',
  SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
  GMX: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a',
  PENDLE: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8',
  CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
  AVAX: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  BNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  SUI: '0x2::sui::SUI',
  APT: '0x1::aptos_coin::AptosCoin',
};

function pickBestPair(pairs: DexScreenerPair[], symbolHint?: string): DexScreenerPair {
  if (symbolHint) {
    const upper = symbolHint.toUpperCase();
    // Prefer pairs where the base token matches the searched symbol
    const matching = pairs.filter(
      p => p.baseToken.symbol.toUpperCase() === upper
        || p.baseToken.symbol.toUpperCase() === `W${upper}` // wrapped variants
    );
    if (matching.length > 0) {
      return matching.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    }
  }
  return pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

function pairToTokenMetrics(pair: DexScreenerPair, symbolOverride?: string): TokenMetrics {
  const ageMs = pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : 0;
  const ageMinutes = Math.floor(ageMs / 60_000);
  const chain = REVERSE_CHAIN_MAP[pair.chainId] ?? 'solana';

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
    ageMinutes: ageMinutes > 0 ? ageMinutes : 999999,
    holders: 0,
    topHolderPct: 0,
    lpLocked: false,
    lpLockPct: 0,
    rugScore: 50,
    ctScore: 50,
  };
}

/** Search DexScreener by token symbol — uses known addresses first for precision */
export async function searchDexScreener(query: string): Promise<{ metrics: TokenMetrics; address: string | null } | null> {
  const upper = query.toUpperCase();

  // If we have a known address, use the precise address endpoint
  const knownAddr = KNOWN_TOKEN_ADDRESSES[upper];
  if (knownAddr) {
    try {
      const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${knownAddr}`);
      if (res.ok) {
        const data = await res.json();
        const pairs: DexScreenerPair[] = data.pairs ?? data;
        if (pairs && pairs.length > 0) {
          const best = pickBestPair(pairs, upper);
          return { metrics: pairToTokenMetrics(best, upper), address: knownAddr };
        }
      }
    } catch (e) {
      console.error('[DexScreener] known address lookup failed:', e);
    }
  }

  // Fall back to search, but filter results to matching base token symbol
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    const data: DexScreenerResponse = await res.json();
    if (!data.pairs || data.pairs.length === 0) return null;

    const best = pickBestPair(data.pairs, upper);
    const address = best.baseToken.address ?? null;
    return { metrics: pairToTokenMetrics(best, upper), address };
  } catch (e) {
    console.error('[DexScreener] search failed:', e);
    return null;
  }
}

/** Look up a token by contract address on DexScreener */
export async function lookupDexScreenerByAddress(address: string): Promise<TokenMetrics | null> {
  try {
    const res = await fetch(`${DEXSCREENER_BASE}/latest/dex/tokens/${address}`);
    if (!res.ok) return null;
    const data = await res.json();
    const pairs: DexScreenerPair[] = data.pairs ?? data;
    if (!pairs || pairs.length === 0) return null;
    return pairToTokenMetrics(pickBestPair(pairs));
  } catch (e) {
    console.error('[DexScreener] address lookup failed:', e);
    return null;
  }
}

// ─── RugCheck (Solana) ───────────────────────────────────────────────

const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1';

interface RugCheckReport {
  score: number;
  risks: Array<{ name: string; level: string; description: string; score: number }>;
  topHolders: Array<{ address: string; pct: number; insider: boolean }>;
  markets: Array<{ lp: { lpLockedPct: number } }>;
}

/**
 * Fetch RugCheck report for a Solana token mint address.
 * Returns normalized score (0-100, higher = safer), top holder %, and LP lock info.
 */
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
    const data: RugCheckReport = await res.json();

    const rugScore = Math.max(0, Math.min(100, Math.round(data.score / 10)));
    const topHolderPct = data.topHolders?.[0]?.pct ?? 0;
    const lpLockedPct = data.markets?.[0]?.lp?.lpLockedPct ?? 0;

    return {
      rugScore,
      topHolderPct,
      lpLocked: lpLockedPct > 0,
      lpLockPct: Math.round(lpLockedPct),
      holders: data.topHolders?.length ?? 0,
      risks: data.risks
        ?.filter(r => r.level === 'error' || r.level === 'warn')
        .map(r => r.name) ?? [],
    };
  } catch (e) {
    console.error('[RugCheck] failed:', e);
    return null;
  }
}

// ─── GoPlus Security (EVM) ───────────────────────────────────────────

const GOPLUS_BASE = 'https://api.gopluslabs.com/api/v1';

const GOPLUS_CHAIN_IDS: Partial<Record<Chain, string>> = {
  ethereum: '1',
  bsc: '56',
  polygon: '137',
  arbitrum: '42161',
  base: '8453',
  optimism: '10',
  avalanche: '43114',
  fantom: '250',
  zksync: '324',
  blast: '81457',
  linea: '59144',
  scroll: '534352',
};

interface GoPlusTokenSecurity {
  is_open_source?: string;
  is_proxy?: string;
  is_mintable?: string;
  is_honeypot?: string;
  holder_count?: string;
  lp_holder_count?: string;
  total_supply?: string;
  owner_address?: string;
  creator_address?: string;
  is_anti_whale?: string;
  holders?: Array<{ address: string; is_locked: number; percent: string; is_contract: number }>;
  lp_holders?: Array<{ address: string; is_locked: number; percent: string; is_contract: number }>;
}

/**
 * Fetch GoPlus security report for an EVM token.
 * Returns derived safety metrics.
 */
export async function fetchGoPlus(contractAddress: string, chain: Chain): Promise<{
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
    const data = await res.json();
    const result: GoPlusTokenSecurity | undefined =
      data?.result?.[contractAddress.toLowerCase()];
    if (!result) return null;

    const risks: string[] = [];
    let score = 100;

    const isHoneypot = result.is_honeypot === '1';
    if (isHoneypot) { risks.push('HONEYPOT detected'); score -= 50; }
    if (result.is_proxy === '1') { risks.push('Proxy contract'); score -= 10; }
    if (result.is_mintable === '1') { risks.push('Mintable supply'); score -= 15; }
    if (!result.is_open_source || result.is_open_source === '0') { risks.push('Closed source'); score -= 20; }

    const holders = parseInt(result.holder_count ?? '0', 10);
    const topHolderPct = result.holders?.[0]
      ? parseFloat(result.holders[0].percent) * 100
      : 0;

    const lpLockedPct = result.lp_holders
      ?.filter(h => h.is_locked === 1)
      .reduce((sum, h) => sum + parseFloat(h.percent) * 100, 0) ?? 0;

    return {
      rugScore: Math.max(0, Math.min(100, score)),
      topHolderPct,
      lpLocked: lpLockedPct > 0,
      lpLockPct: Math.round(lpLockedPct),
      holders,
      isHoneypot,
      risks,
    };
  } catch (e) {
    console.error('[GoPlus] failed:', e);
    return null;
  }
}

// ─── Unified Live Screening ─────────────────────────────────────────

const metricsCache = new Map<string, { data: TokenMetrics; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

function getCached(key: string): TokenMetrics | null {
  const entry = metricsCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: TokenMetrics) {
  metricsCache.set(key, { data, ts: Date.now() });
}

/** Fetch live token metrics by symbol */
export async function fetchLiveTokenBySymbol(symbol: string): Promise<TokenMetrics | null> {
  const cacheKey = `sym:${symbol.toUpperCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const result = await searchDexScreener(symbol);
  if (!result) return null;

  const enriched = await enrichWithSecurity(result.metrics, result.address);
  setCache(cacheKey, enriched);
  return enriched;
}

/** Fetch live token metrics by contract address */
export async function fetchLiveTokenByAddress(
  address: string,
  chain?: Chain
): Promise<TokenMetrics | null> {
  const cacheKey = `addr:${address.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const dexData = await lookupDexScreenerByAddress(address);
  if (!dexData) return null;

  if (chain) dexData.chain = chain;
  const enriched = await enrichWithSecurity(dexData, address);
  setCache(cacheKey, enriched);
  return enriched;
}

/** Enrich DexScreener data with RugCheck (Solana) or GoPlus (EVM) security */
async function enrichWithSecurity(
  metrics: TokenMetrics,
  contractAddress: string | null
): Promise<TokenMetrics> {
  const enriched = { ...metrics };

  // Derive a CT score heuristic from volume and price momentum
  const volScore = Math.min(50, (metrics.volume24h / 100_000) * 10);
  const momentumScore = Math.min(50, Math.max(0, metrics.priceChange24h));
  enriched.ctScore = Math.round(Math.min(100, volScore + momentumScore));

  if (!contractAddress) return enriched;

  if (metrics.chain === 'solana') {
    const rugData = await fetchRugCheck(contractAddress);
    if (rugData) {
      enriched.rugScore = rugData.rugScore;
      enriched.topHolderPct = rugData.topHolderPct;
      enriched.lpLocked = rugData.lpLocked;
      enriched.lpLockPct = rugData.lpLockPct;
      if (rugData.holders > 0) enriched.holders = rugData.holders;
    }
  } else if (metrics.chain !== 'perps') {
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
