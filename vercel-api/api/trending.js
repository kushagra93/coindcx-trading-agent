const DEXSCREENER_BASE = 'https://api.dexscreener.com';
const BIRDEYE_BASE = 'https://public-api.birdeye.so';

// In-memory cache (survives across warm invocations)
let cache = { data: null, ts: 0 };
const CACHE_TTL = 60_000; // 60s

function pickBest(pairs) {
  if (!pairs || pairs.length === 0) return null;
  return pairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];
}

function formatToken(pair) {
  const pc = pair.priceChange || {};
  const txns = pair.txns || {};
  const age = pair.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 60000) : 0;

  return {
    symbol: pair.baseToken?.symbol || '?',
    name: pair.baseToken?.name || '',
    chain: pair.chainId || 'solana',
    address: pair.baseToken?.address || '',
    imageUrl: pair.info?.imageUrl || '',
    price: parseFloat(pair.priceUsd) || 0,
    priceChange5m: pc.m5 || 0,
    priceChange1h: pc.h1 || 0,
    priceChange6h: pc.h6 || 0,
    priceChange24h: pc.h24 || 0,
    volume24h: pair.volume?.h24 || 0,
    marketCap: pair.marketCap || pair.fdv || 0,
    liquidity: pair.liquidity?.usd || 0,
    ageMinutes: age,
    holders: 0,
    topHolderPct: 0,
    lpLocked: false,
    lpLockPct: 0,
    rugScore: 0,
    ctScore: 0,
    boosts: pair.boosts?.active || 0,
    txnsBuys24h: txns.h24?.buys || 0,
    txnsSells24h: txns.h24?.sells || 0,
  };
}

async function fetchDexScreenerTrending() {
  try {
    const [boostRes, trendingRes] = await Promise.all([
      fetch(`${DEXSCREENER_BASE}/token-boosts/top/v1`),
      fetch(`${DEXSCREENER_BASE}/token-profiles/latest/v1`),
    ]);

    const boosted = boostRes.ok ? await boostRes.json() : [];
    const trending = trendingRes.ok ? await trendingRes.json() : [];

    // Collect unique Solana addresses
    const solAddrs = new Set();
    for (const t of [...(Array.isArray(boosted) ? boosted : []), ...(Array.isArray(trending) ? trending : [])]) {
      if (t.chainId === 'solana' && t.tokenAddress) {
        solAddrs.add(t.tokenAddress);
      }
    }

    if (solAddrs.size === 0) return [];

    // Batch lookup for pair data
    const addrs = Array.from(solAddrs).slice(0, 30);
    const pairRes = await fetch(`${DEXSCREENER_BASE}/tokens/v1/solana/${addrs.join(',')}`);
    if (!pairRes.ok) return [];

    const pairs = await pairRes.json();
    if (!Array.isArray(pairs)) return [];

    // Group by base token address, pick best pair per token
    const byAddr = {};
    for (const p of pairs) {
      const addr = p.baseToken?.address;
      if (!addr) continue;
      if (!byAddr[addr]) byAddr[addr] = [];
      byAddr[addr].push(p);
    }

    const tokens = [];
    for (const addr of Object.keys(byAddr)) {
      const best = pickBest(byAddr[addr]);
      if (best) tokens.push(formatToken(best));
    }

    // Sort by volume
    tokens.sort((a, b) => b.volume24h - a.volume24h);
    return tokens.slice(0, 30);
  } catch (e) {
    console.error('DexScreener fetch failed:', e.message);
    return [];
  }
}

async function fetchGainers(tokens) {
  return tokens
    .filter(t => t.priceChange24h > 0)
    .sort((a, b) => b.priceChange24h - a.priceChange24h);
}

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  const tokens = await fetchDexScreenerTrending();
  const gainers = await fetchGainers(tokens);

  const result = {
    tokens,
    gainers,
    total: tokens.length,
    updatedAt: new Date().toISOString(),
    source: 'dexscreener',
  };

  cache = { data: result, ts: now };
  return res.status(200).json(result);
}
