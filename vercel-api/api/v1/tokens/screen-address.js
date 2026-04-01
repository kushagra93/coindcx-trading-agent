// Token screening endpoint — fetches DexScreener pair data + RugCheck audit
const DEXSCREENER = 'https://api.dexscreener.com';
const RUGCHECK = 'https://api.rugcheck.xyz/v1';

let screenCache = {};
const CACHE_TTL = 120_000; // 2 min

async function fetchRugCheck(address) {
  try {
    const r = await fetch(`${RUGCHECK}/tokens/${address}/report/summary`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchDexPair(address) {
  try {
    const r = await fetch(`${DEXSCREENER}/tokens/v1/solana/${address}`);
    if (!r.ok) return null;
    const pairs = await r.json();
    if (!Array.isArray(pairs) || pairs.length === 0) return null;
    // Return highest volume pair
    return pairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];
  } catch { return null; }
}

function buildScreeningResult(pair, rugData, address) {
  const pc = pair?.priceChange || {};
  const txns = pair?.txns || {};
  const age = pair?.pairCreatedAt ? Math.floor((Date.now() - pair.pairCreatedAt) / 60000) : 0;

  const metrics = {
    symbol: pair?.baseToken?.symbol || '?',
    name: pair?.baseToken?.name || '',
    chain: 'solana',
    address: address,
    imageUrl: pair?.info?.imageUrl || '',
    price: parseFloat(pair?.priceUsd) || 0,
    priceChange5m: pc.m5 || 0,
    priceChange1h: pc.h1 || 0,
    priceChange6h: pc.h6 || 0,
    priceChange24h: pc.h24 || 0,
    volume24h: pair?.volume?.h24 || 0,
    marketCap: pair?.marketCap || pair?.fdv || 0,
    liquidity: pair?.liquidity?.usd || 0,
    ageMinutes: age,
    holders: 0,
    topHolderPct: 0,
    lpLocked: false,
    lpLockPct: 0,
    rugScore: 0,
    ctScore: 0,
    boosts: pair?.boosts?.active || 0,
    txnsBuys24h: txns.h24?.buys || 0,
    txnsSells24h: txns.h24?.sells || 0,
    hasSecurityData: false,
  };

  let audit = null;
  let score = 0;
  const flags = [];
  let verdict = 'C';

  // Process RugCheck data
  if (rugData) {
    metrics.hasSecurityData = true;
    const risks = rugData.risks || [];
    const riskMap = {};
    for (const r of risks) riskMap[r.name] = r;

    audit = {
      noMint: !riskMap['Mutable metadata'] && !riskMap['Mint Authority still enabled'],
      noFreeze: !riskMap['Freeze Authority still enabled'],
      burnt: rugData.score >= 500 ? 80 : rugData.score >= 300 ? 50 : 20,
      top10HolderPct: rugData.topHoldersPct || 0,
      insidersDetected: 0,
      totalHolders: rugData.totalMarketLiquidity ? Math.round(rugData.totalMarketLiquidity / 100) : 0,
      totalLiquidity: rugData.totalMarketLiquidity || 0,
      lpLockedPct: rugData.lpLockedPct || 0,
      lpProviders: rugData.markets?.length || 0,
      creator: rugData.creator || null,
      creatorBalance: null,
      deployPlatform: rugData.tokenType || null,
      rugged: rugData.rugged === true,
      tokenCreatedAt: rugData.tokenMeta?.created || null,
      pairAddress: pair?.pairAddress || null,
      risks: risks.map(r => ({ name: r.name, level: r.level, description: r.description || '', score: r.score || 0 })),
    };

    // Calculate rugScore (RugCheck uses 0=dangerous to 1000=safe, normalize to 0-100)
    metrics.rugScore = Math.round(Math.min(100, (rugData.score || 0) / 10));

    // Safety scoring
    let safetyScore = 0;
    if (metrics.rugScore >= 80) safetyScore += 20;
    else if (metrics.rugScore >= 50) { safetyScore += 12; flags.push(`Moderate safety: ${metrics.rugScore}/100`); }
    else if (metrics.rugScore >= 20) { safetyScore += 4; flags.push(`Low safety score: ${metrics.rugScore}/100`); }
    else flags.push(`Very low safety score: ${metrics.rugScore}/100`);

    if (audit.rugged) { flags.push('Token flagged as RUGGED'); safetyScore -= 40; }
    if (audit.noMint) safetyScore += 4; else { flags.push('Mint authority active'); safetyScore -= 4; }
    if (audit.noFreeze) safetyScore += 4; else { flags.push('Freeze authority active'); safetyScore -= 4; }

    safetyScore = Math.max(0, Math.min(40, safetyScore));

    // Liquidity scoring
    let liqScore = 0;
    if (metrics.liquidity >= 100000) liqScore += 12;
    else if (metrics.liquidity >= 50000) liqScore += 8;
    else if (metrics.liquidity >= 10000) { liqScore += 4; flags.push(`Low liquidity: $${Math.round(metrics.liquidity).toLocaleString()}`); }
    else flags.push(`Very low liquidity: $${Math.round(metrics.liquidity).toLocaleString()}`);

    if (metrics.volume24h >= 100000) liqScore += 8;
    else if (metrics.volume24h >= 10000) liqScore += 4;

    if (age < 60) { flags.push(`Very new: ${age}min old`); liqScore -= 3; }
    else if (age > 60 * 24 * 7) liqScore += 5;

    liqScore = Math.max(0, Math.min(30, liqScore));

    // Momentum scoring
    let momScore = 0;
    if (pc.h24 > 50) momScore += 10;
    else if (pc.h24 > 10) momScore += 5;
    if (pc.h1 > 5) momScore += 5;
    momScore = Math.max(0, Math.min(30, momScore));

    score = safetyScore + liqScore + momScore;

    if (score >= 70) verdict = 'A';
    else if (score >= 55) verdict = 'B';
    else if (score >= 35) verdict = 'C';
    else if (score >= 20) verdict = 'D';
    else verdict = 'F';
  } else {
    flags.push('No security data available');
    // Score based on liquidity/volume only
    if (metrics.liquidity >= 50000 && metrics.volume24h >= 50000) { score = 40; verdict = 'C'; }
    else { score = 20; verdict = 'D'; }
  }

  return { metrics, verdict, score, flags, audit, dataSources: rugData ? ['dexscreener', 'rugcheck'] : ['dexscreener'] };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  let address;
  if (req.method === 'POST') {
    address = req.body?.address;
  } else {
    address = req.query?.address;
  }

  if (!address) return res.status(400).json({ error: 'address is required' });

  const now = Date.now();
  if (screenCache[address] && now - screenCache[address].ts < CACHE_TTL) {
    return res.status(200).json(screenCache[address].data);
  }

  const [pair, rugData] = await Promise.all([
    fetchDexPair(address),
    fetchRugCheck(address),
  ]);

  if (!pair) {
    return res.status(404).json({ error: `Could not find token ${address}` });
  }

  const result = buildScreeningResult(pair, rugData, address);
  screenCache[address] = { data: result, ts: now };

  // Prune cache
  const keys = Object.keys(screenCache);
  if (keys.length > 100) {
    for (const k of keys.slice(0, 50)) delete screenCache[k];
  }

  return res.status(200).json(result);
}
