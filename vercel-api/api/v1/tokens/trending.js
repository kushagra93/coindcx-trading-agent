// Compatibility route for Flutter app (/api/v1/tokens/trending → /api/trending)
const DEXSCREENER_BASE = 'https://api.dexscreener.com';

let cache = { data: null, ts: 0 };
const CACHE_TTL = 60_000;

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
    holders: 0, topHolderPct: 0, lpLocked: false, lpLockPct: 0, rugScore: 0, ctScore: 0,
    boosts: pair.boosts?.active || 0,
    txnsBuys24h: txns.h24?.buys || 0,
    txnsSells24h: txns.h24?.sells || 0,
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const now = Date.now();
  if (cache.data && now - cache.ts < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  try {
    const boostRes = await fetch(`${DEXSCREENER_BASE}/token-boosts/top/v1`);
    const boosted = boostRes.ok ? await boostRes.json() : [];
    const solAddrs = [];
    for (const t of Array.isArray(boosted) ? boosted : []) {
      if (t.chainId === 'solana' && t.tokenAddress) solAddrs.push(t.tokenAddress);
    }
    if (solAddrs.length === 0) return res.status(200).json({ tokens: [] });

    const pairRes = await fetch(`${DEXSCREENER_BASE}/tokens/v1/solana/${solAddrs.slice(0, 30).join(',')}`);
    const pairs = pairRes.ok ? await pairRes.json() : [];
    if (!Array.isArray(pairs)) return res.status(200).json({ tokens: [] });

    const byAddr = {};
    for (const p of pairs) {
      const a = p.baseToken?.address;
      if (!a) continue;
      if (!byAddr[a]) byAddr[a] = [];
      byAddr[a].push(p);
    }

    const tokens = [];
    for (const addr of Object.keys(byAddr)) {
      const best = byAddr[addr].sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];
      tokens.push(formatToken(best));
    }
    tokens.sort((a, b) => b.priceChange24h - a.priceChange24h);

    const result = { tokens: tokens.slice(0, 30) };
    cache = { data: result, ts: now };
    return res.status(200).json(result);
  } catch (e) {
    return res.status(200).json({ tokens: [] });
  }
}
