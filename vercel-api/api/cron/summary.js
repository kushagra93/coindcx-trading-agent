// Daily Summary Digest — runs 2x/day (morning 9:30AM IST + evening 6:30PM IST)
// Gives a full snapshot: what's hot, what dropped, best/worst performers, overall market vibe

import crypto from 'crypto';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';
const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const MIN_GAIN_PCT = 50; // lower threshold for summary — show more tokens
const MIN_MCAP = 30000;

// ─── CoinDCX UUID (same as notify.js) ───────────────────────
function generateCoinDCXUUID(address) {
  const URL_NAMESPACE = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const input = 'SOLANA' + 'TOKEN' + address;
  const hash = crypto.createHash('md5').update(URL_NAMESPACE).update(input).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

function coinDCXLink(address) {
  const tokenId = generateCoinDCXUUID(address);
  return `https://go.coindcx.com/defi_trade_buy_bs?target=web3&tokenId=${tokenId}`;
}

// ─── RugCheck ───────────────────────────────────────────────
async function fetchRugCheck(address) {
  try {
    const r = await fetch(`${RUGCHECK_BASE}/tokens/${address}/report/summary`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ─── Formatting ─────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function fmtUsd(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toPrecision(3)}`;
}

function fmtAge(mins) {
  if (mins <= 0) return '';
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h`;
  return `${mins}m`;
}

function getRiskEmoji(audit) {
  if (!audit) return '⚠️';
  const rugScore = Math.round(Math.min(100, (audit.score || 0) / 10));
  const risks = audit.risks || [];
  const dangers = risks.filter(r => r.level === 'danger' || r.level === 'critical');
  if (audit.rugged) return '🚨';
  if (rugScore >= 70 && dangers.length === 0) return '🟢';
  if (rugScore >= 40) return '🟡';
  return '🔴';
}

function getAuditOneLiner(audit) {
  if (!audit) return 'unverified';
  const risks = audit.risks || [];
  const riskNames = new Set(risks.map(r => r.name));
  const noMint = !riskNames.has('Mint Authority still enabled');
  const noFreeze = !riskNames.has('Freeze Authority still enabled');
  const top10 = audit.topHoldersPct !== undefined ? `Top10: ${(audit.topHoldersPct * 100).toFixed(0)}%` : '';
  const parts = [];
  if (!noMint) parts.push('⚠️mint');
  if (!noFreeze) parts.push('⚠️freeze');
  if (top10) parts.push(top10);
  return parts.length > 0 ? parts.join(' ') : '✅ clean';
}

// ─── Time helpers ───────────────────────────────────────────
function getISTHour() {
  return (new Date().getUTCHours() + 5 + (new Date().getUTCMinutes() >= 30 ? 1 : 0)) % 24;
}

function isMorning() {
  const h = getISTHour();
  return h >= 8 && h < 14;
}

// ─── Build Summary Message ──────────────────────────────────
function buildSummary(hot, allTokens, audits, isMorningDigest) {
  const lines = [];
  const istHour = getISTHour();

  // Header
  if (isMorningDigest) {
    lines.push(`☀️ *Good Morning\\! Aaj ka Web3 Snapshot*`);
    lines.push(`_${esc(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }))}_`);
  } else {
    lines.push(`🌙 *Evening Roundup — Trading Hours Shuru\\!*`);
    lines.push(`_${esc(new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }))}_`);
  }
  lines.push(``);

  // Quick stats
  const totalHot = hot.length;
  const avgGain = hot.length > 0 ? hot.reduce((s, t) => s + t.priceChange24h, 0) / hot.length : 0;
  const safeCount = audits.filter(a => {
    if (!a) return false;
    const score = Math.round(Math.min(100, (a.score || 0) / 10));
    return score >= 70;
  }).length;

  lines.push(`📊 *Quick Stats*`);
  lines.push(`• ${esc(totalHot.toString())} tokens trending right now`);
  lines.push(`• Average gain: *${esc('+' + avgGain.toFixed(0))}%* in 24h`);
  lines.push(`• ${esc(safeCount.toString())}/${esc(Math.min(hot.length, 10).toString())} passed safety audit \\(RugCheck 70\\+\\)`);
  lines.push(``);

  // Top 5 by gain
  lines.push(`🏆 *Top 5 — Sabse Zyada Chadhe*`);
  lines.push(``);

  const top5 = hot.slice(0, 5);
  for (let i = 0; i < top5.length; i++) {
    const t = top5[i];
    const audit = audits[i];
    const risk = getRiskEmoji(audit);
    const auditLine = getAuditOneLiner(audit);
    const dex = `https://dexscreener.com/solana/${t.address}`;
    const cdx = coinDCXLink(t.address);
    const sign = t.priceChange24h >= 0 ? '\\+' : '';

    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}\\.`;

    lines.push(`${medal} ${risk} *${esc(t.symbol)}* — ${esc(t.name)}`);
    lines.push(`   💵 ${esc(fmtUsd(t.price))} \\(${sign}${esc(t.priceChange24h.toFixed(0))}%\\) · MCap ${esc(fmtUsd(t.marketCap))}`);
    lines.push(`   🛡 ${esc(auditLine)} · Age: ${esc(fmtAge(t.ageMinutes))}`);
    lines.push(`   \`${t.address.slice(0, 6)}...${t.address.slice(-4)}\` [CoinDCX](${cdx}) · [Chart](${dex})`);

    if (i < top5.length - 1) {
      lines.push(``);
    }
  }
  lines.push(``);

  // Newcomers (< 6 hours old)
  const newbies = hot.filter(t => t.ageMinutes > 0 && t.ageMinutes < 360).slice(0, 3);
  if (newbies.length > 0) {
    lines.push(`🆕 *Fresh Launches \\(< 6h old\\)*`);
    for (const t of newbies) {
      const sign = t.priceChange24h >= 0 ? '\\+' : '';
      lines.push(`• *${esc(t.symbol)}* — ${esc(fmtAge(t.ageMinutes))} old, ${sign}${esc(t.priceChange24h.toFixed(0))}%, MCap ${esc(fmtUsd(t.marketCap))}`);
    }
    lines.push(``);
  }

  // Cooling off (tokens with negative 1h change)
  const cooling = hot.filter(t => t.priceChange1h < -10).slice(0, 3);
  if (cooling.length > 0) {
    lines.push(`❄️ *Cooling Off \\(1h mein gire\\)*`);
    for (const t of cooling) {
      lines.push(`• *${esc(t.symbol)}* — ${esc(t.priceChange1h.toFixed(0))}% last hour \\(still ${esc('+' + t.priceChange24h.toFixed(0))}% 24h\\)`);
    }
    lines.push(``);
  }

  // Biggest volume
  const byVol = [...hot].sort((a, b) => b.volume24h - a.volume24h).slice(0, 3);
  if (byVol.length > 0 && byVol[0].volume24h > 100000) {
    lines.push(`💰 *Most Traded \\(Volume Kings\\)*`);
    for (const t of byVol) {
      lines.push(`• *${esc(t.symbol)}* — ${esc(fmtUsd(t.volume24h))} volume, ${esc(fmtUsd(t.liquidity))} liquidity`);
    }
    lines.push(``);
  }

  // Footer
  if (isMorningDigest) {
    lines.push(`_Next update: evening 7PM ke baad, jab trading hours shuru honge 🌙_`);
  } else {
    lines.push(`_Peak hours chal rahe hain — alerts zyada aayenge aaj raat\\! 🔥_`);
  }
  lines.push(`⚠️ _DYOR — ye financial advice nahi hai\\. Apna research karo\\._`);
  lines.push(`_by Hot Right Now · CoinDCX Web3_`);

  return lines.join('\n');
}

// ─── Telegram ───────────────────────────────────────────────
async function sendTelegram(text) {
  const resp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    }),
  });
  const data = await resp.json();
  if (!data.ok) console.error('Telegram send failed:', data.description);
  return data.ok;
}

// ─── Handler ────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(200).json({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' });
  }

  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Fetch hot tokens
    const boostRes = await fetch(`${DEXSCREENER_BASE}/token-boosts/top/v1`);
    const boosted = boostRes.ok ? await boostRes.json() : [];

    const solAddrs = [];
    for (const t of Array.isArray(boosted) ? boosted : []) {
      if (t.chainId === 'solana' && t.tokenAddress) solAddrs.push(t.tokenAddress);
    }

    if (solAddrs.length === 0) {
      return res.status(200).json({ sent: 0, reason: 'no solana tokens' });
    }

    const pairRes = await fetch(`${DEXSCREENER_BASE}/tokens/v1/solana/${solAddrs.slice(0, 30).join(',')}`);
    if (!pairRes.ok) return res.status(200).json({ sent: 0, reason: 'pair fetch failed' });

    const pairs = await pairRes.json();
    if (!Array.isArray(pairs)) return res.status(200).json({ sent: 0, reason: 'invalid pairs' });

    const byAddr = {};
    for (const p of pairs) {
      const addr = p.baseToken?.address;
      if (!addr) continue;
      if (!byAddr[addr]) byAddr[addr] = [];
      byAddr[addr].push(p);
    }

    const allTokens = [];
    for (const addr of Object.keys(byAddr)) {
      const best = byAddr[addr].sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))[0];
      const pc = best.priceChange || {};
      const age = best.pairCreatedAt ? Math.floor((Date.now() - best.pairCreatedAt) / 60000) : 0;
      allTokens.push({
        symbol: best.baseToken?.symbol || '?',
        name: best.baseToken?.name || '',
        address: best.baseToken?.address || '',
        price: parseFloat(best.priceUsd) || 0,
        priceChange24h: pc.h24 || 0,
        priceChange1h: pc.h1 || 0,
        priceChange5m: pc.m5 || 0,
        marketCap: best.marketCap || best.fdv || 0,
        volume24h: best.volume?.h24 || 0,
        liquidity: best.liquidity?.usd || 0,
        txnsBuys24h: best.txns?.h24?.buys || 0,
        ageMinutes: age,
        boosts: best.boosts?.active || 0,
      });
    }

    const hot = allTokens
      .filter(t => t.priceChange24h >= MIN_GAIN_PCT && t.marketCap >= MIN_MCAP)
      .sort((a, b) => b.priceChange24h - a.priceChange24h);

    // 2. Fetch audits for top 10
    const top10 = hot.slice(0, 10);
    const audits = await Promise.all(top10.map(t => fetchRugCheck(t.address)));

    // 3. Build and send summary
    const msg = buildSummary(hot, allTokens, audits, isMorning());
    const ok = await sendTelegram(msg);

    return res.status(200).json({
      sent: ok ? 1 : 0,
      type: isMorning() ? 'morning' : 'evening',
      totalHot: hot.length,
      checked: allTokens.length,
    });
  } catch (err) {
    console.error('Summary error:', err);
    return res.status(500).json({ error: err.message });
  }
}
