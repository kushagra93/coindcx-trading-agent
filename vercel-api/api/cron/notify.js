// Vercel Cron — Hot Token Digest for Web3 Community
// Sends ONE digest message with new entries + dropped tokens (sell signals)
// Anti-spam: tracks previously alerted tokens via Telegram pinned message state

import crypto from 'crypto';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';
const RUGCHECK_BASE = 'https://api.rugcheck.xyz/v1';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const MIN_GAIN_PCT = 100;
const MIN_MCAP = 50000;

// ─── Time-aware frequency (IST = UTC+5:30) ──────────────────
// 7PM-3AM IST: high volume hours → 30min cooldown (frequent updates)
// 9AM-7PM IST: daytime → 2h cooldown
// 3AM-9AM IST: sleep → 4h cooldown (near-silent)
function getCooldownMs() {
  const istHour = (new Date().getUTCHours() + 5 + (new Date().getUTCMinutes() >= 30 ? 1 : 0)) % 24;

  if (istHour >= 19 || istHour < 3) return 30 * 60 * 1000;      // Peak: 7PM-3AM IST → 30min cooldown
  if (istHour >= 9 && istHour < 19) return 2 * 60 * 60 * 1000;  // Day: 9AM-7PM → 2h cooldown
  return 4 * 60 * 60 * 1000;                                     // Sleep: 3AM-9AM → 4h cooldown
}

// ─── CoinDCX Web3 Deeplink ──────────────────────────────────
// Replicates Go's uuid.NewMD5(uuid.NameSpaceURL, "SOLANATOKEN<address>")
function generateCoinDCXUUID(address) {
  const URL_NAMESPACE = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex');
  const input = 'SOLANA' + 'TOKEN' + address;
  const hash = crypto.createHash('md5').update(URL_NAMESPACE).update(input).digest();
  hash[6] = (hash[6] & 0x0f) | 0x30; // version 3
  hash[8] = (hash[8] & 0x3f) | 0x80; // variant
  const hex = hash.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

function coinDCXDeeplink(address) {
  const tokenId = generateCoinDCXUUID(address);
  return {
    app: `dcxgo://go.coindcx.com/defi_trade_buy_bs?target=web3&tokenId=${tokenId}`,
    web: `https://go.coindcx.com/defi_trade_buy_bs?target=web3&tokenId=${tokenId}`,
    tokenId,
  };
}

// ─── RugCheck ────────────────────────────────────────────────
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

// ─── Formatting ──────────────────────────────────────────────
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
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Risk Label ──────────────────────────────────────────────
function getRiskLabel(audit) {
  if (!audit) return { emoji: '⚠️', label: 'UNVERIFIED', color: 'yellow' };

  const rugScore = Math.round(Math.min(100, (audit.score || 0) / 10));
  const risks = audit.risks || [];
  const riskNames = new Set(risks.map(r => r.name));
  const dangers = risks.filter(r => r.level === 'danger' || r.level === 'critical');
  const hasMint = riskNames.has('Mint Authority still enabled');

  if (audit.rugged) return { emoji: '🚨', label: 'RUGGED', color: 'red' };
  if (rugScore >= 70 && !hasMint && dangers.length === 0) return { emoji: '🟢', label: 'SAFER', color: 'green' };
  if (rugScore >= 40 && dangers.length <= 1) return { emoji: '🟡', label: 'RISKY', color: 'yellow' };
  return { emoji: '🔴', label: 'DEGEN', color: 'red' };
}

function auditSummary(audit) {
  if (!audit) return `_Audit data not available — extra DYOR needed_`;

  const risks = audit.risks || [];
  const riskNames = new Set(risks.map(r => r.name));
  const dangers = risks.filter(r => r.level === 'danger' || r.level === 'critical');

  const noMint = !riskNames.has('Mint Authority still enabled');
  const noFreeze = !riskNames.has('Freeze Authority still enabled');

  const parts = [];
  parts.push(noMint ? '✅ No Mint' : '❌ Mint On');
  parts.push(noFreeze ? '✅ No Freeze' : '❌ Freeze On');

  if (audit.topHoldersPct !== undefined) {
    const pct = (audit.topHoldersPct * 100).toFixed(1);
    const e = audit.topHoldersPct < 0.3 ? '✅' : audit.topHoldersPct < 0.5 ? '⚠️' : '🔴';
    parts.push(`${e} Top 10: ${esc(pct)}%`);
  }

  if (dangers.length > 0) {
    parts.push(`⛔ ${dangers.length} danger flag${dangers.length > 1 ? 's' : ''}`);
  }

  return parts.join('  ');
}

// ─── "Why it's hot" context ──────────────────────────────────
function whyHot(t) {
  const reasons = [];
  if (t.txnsBuys24h > 5000) reasons.push(`${(t.txnsBuys24h / 1000).toFixed(0)}K\\+ buys today`);
  else if (t.txnsBuys24h > 1000) reasons.push(`${(t.txnsBuys24h / 1000).toFixed(1)}K buys today`);
  if (t.priceChange1h > 50) reasons.push(`still pumping \\(${esc('+' + t.priceChange1h.toFixed(0))}% in 1h\\)`);
  else if (t.priceChange1h < -20) reasons.push(`cooling off \\(${esc(t.priceChange1h.toFixed(0))}% in 1h\\)`);
  if (t.volume24h > 1e6) reasons.push(`${esc(fmtUsd(t.volume24h))} volume`);
  if (t.ageMinutes > 0 && t.ageMinutes < 360) reasons.push(`only ${fmtAge(t.ageMinutes)} old`);
  if (t.boosts > 0) reasons.push('DexScreener boosted');

  if (reasons.length === 0) reasons.push('trending on DexScreener');
  return reasons.slice(0, 2).join(', ');
}

// ─── State: Track full symbol list + prices via bot description ──
// Bot description (512 chars) stores: "SYM1:price,SYM2:price|timestamp"
// Allows diffing: new entries = buy signal, removed = sell signal

async function getState() {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMyShortDescription`);
    const data = await r.json();
    if (!data.ok) return { symbols: {}, ts: 0 };
    const desc = data.result?.short_description || '';
    if (!desc.includes('|')) return { symbols: {}, ts: 0 };

    const [symPart, tsStr] = desc.split('|');
    const symbols = {}; // SYM → price
    for (const entry of symPart.split(',')) {
      const [sym, price] = entry.split(':');
      if (sym) symbols[sym] = parseFloat(price) || 0;
    }
    return { symbols, ts: parseInt(tsStr) || 0 };
  } catch {
    return { symbols: {}, ts: 0 };
  }
}

async function saveState(hotTokens, now) {
  // Compact: "SYM1:0.0021,SYM2:0.45|1711234567890"
  // Keep max 15 symbols to fit 120 char limit
  const entries = hotTokens.slice(0, 15).map(t => {
    const sym = t.symbol.toUpperCase().slice(0, 8); // truncate long symbols
    const p = t.price > 0 ? t.price.toPrecision(3) : '0';
    return `${sym}:${p}`;
  });
  const desc = `${entries.join(',')}|${now}`;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyShortDescription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ short_description: desc.slice(0, 120) }),
    });
  } catch { /* ignore */ }
}

// ─── Bot Setup (runs once) ───────────────────────────────────
async function ensureBotName() {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMyName`);
    const data = await r.json();
    if (data.ok && data.result?.name !== 'Hot Right Now by CoinDCX') {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyName`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hot Right Now by CoinDCX' }),
      });
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setMyDescription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'Solana ke hottest tokens, real-time. Safety audit, contract address, aur CoinDCX pe direct trade — sab ek jagah. By the CoinDCX Web3 community.',
        }),
      });
    }
  } catch { /* ignore */ }
}

// ─── Telegram Send ───────────────────────────────────────────
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

// ─── Time-based greeting ─────────────────────────────────────
function getGreeting() {
  const istHour = (new Date().getUTCHours() + 5 + (new Date().getUTCMinutes() >= 30 ? 1 : 0)) % 24;
  if (istHour >= 22 || istHour < 5) return 'Late night degens, yeh dekho 👀';
  if (istHour >= 17) return 'Evening update aa gaya 🌙';
  if (istHour >= 12) return 'Afternoon mein kuch naya aaya hai 📢';
  return 'Good morning\\! Fresh tokens trending ☀️';
}

// ─── Build Digest Message ────────────────────────────────────
function buildDigest(newTokens, droppedTokens, audits) {
  const lines = [];

  if (newTokens.length > 0) {
    lines.push(`🔥 *Abhi Trending — Hot Right Now*`);
    lines.push(``);
    lines.push(`${getGreeting()}`);
    lines.push(``);

    for (let i = 0; i < newTokens.length; i++) {
      const t = newTokens[i];
      const audit = audits[i];
      const risk = getRiskLabel(audit);
      const sign24 = t.priceChange24h >= 0 ? '\\+' : '';
      const dex = `https://dexscreener.com/solana/${t.address}`;
      const cdxLinks = coinDCXDeeplink(t.address);

      // Token header with risk badge
      lines.push(`${risk.emoji} *${esc(t.symbol)}* ${esc('[')}${esc(risk.label)}${esc(']')} — ${esc(t.name)}`);

      // Why it's hot — conversational
      lines.push(`📌 _${whyHot(t)}_`);

      // Price + change
      lines.push(`💵 *${esc(fmtUsd(t.price))}* \\(${sign24}${esc(t.priceChange24h.toFixed(0))}% today\\)`);

      // Key stats in one line
      lines.push(`📊 MCap ${esc(fmtUsd(t.marketCap))} · Vol ${esc(fmtUsd(t.volume24h))} · Liq ${esc(fmtUsd(t.liquidity))}`);

      // Safety check
      lines.push(`🛡 ${auditSummary(audit)}`);

      // Contract (copyable)
      lines.push(`\`${t.address}\``);

      // CTA links — web link clickable, app deeplink as copyable text
      lines.push(`👉 [Trade on CoinDCX](${cdxLinks.web}) · [Chart](${dex})`);

      // Separator between tokens
      if (i < newTokens.length - 1) {
        lines.push(`┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈`);
      }
      lines.push(``);
    }
  }

  if (droppedTokens.length > 0) {
    lines.push(`📉 *List se hat gaye — Sell signal ho sakta hai*`);
    lines.push(``);

    for (const d of droppedTokens) {
      const fromPeak = d.alertedPrice > 0 && d.currentPrice > 0
        ? ((d.currentPrice - d.alertedPrice) / d.alertedPrice * 100).toFixed(0)
        : null;

      let line = `• *${esc(d.symbol)}*`;
      if (d.currentPrice > 0) line += ` — ab ${esc(fmtUsd(d.currentPrice))}`;
      if (fromPeak) {
        const pf = parseFloat(fromPeak);
        if (pf >= 0) {
          line += ` \\(still \\+${esc(fromPeak)}% from alert — profit book karo?\\)`;
        } else {
          line += ` \\(${esc(fromPeak)}% from alert — ⚠️ loss zone\\)`;
        }
      }
      lines.push(line);
    }
    lines.push(``);
  }

  if (newTokens.length === 0 && droppedTokens.length === 0) {
    return null;
  }

  lines.push(`⚠️ _DYOR — ye financial advice nahi hai\\. Apna research karo\\._`);
  lines.push(`_by Hot Right Now · CoinDCX Web3_`);

  return lines.join('\n');
}

// ─── Main Handler ────────────────────────────────────────────
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
    // Set bot name on first run
    await ensureBotName();

    // 1. Fetch current hot tokens from DexScreener
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

    // Group by token, pick best pair
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
      });
    }

    // Filter hot tokens
    const hot = allTokens
      .filter(t => t.priceChange24h >= MIN_GAIN_PCT && t.marketCap >= MIN_MCAP)
      .sort((a, b) => b.priceChange24h - a.priceChange24h);

    const currentHotMap = new Map(hot.map(t => [t.symbol.toUpperCase(), t]));

    // 2. Load previous state and diff
    const { symbols: prevSymbols, ts: prevTs } = await getState();
    const now = Date.now();
    const cooldown = getCooldownMs();
    const prevSymSet = new Set(Object.keys(prevSymbols));
    const currSymSet = new Set(currentHotMap.keys());

    // Find NEW entries (in current but not in previous)
    const newTokens = hot.filter(t => !prevSymSet.has(t.symbol.toUpperCase()));

    // Find DROPPED entries (in previous but not in current)
    const droppedTokens = [];
    for (const [sym, prevPrice] of Object.entries(prevSymbols)) {
      if (currSymSet.has(sym)) continue; // still hot
      // Find current data for this token (might still be in allTokens, just not "hot" anymore)
      const current = allTokens.find(t => t.symbol.toUpperCase() === sym);
      droppedTokens.push({
        symbol: sym,
        alertedPrice: prevPrice,
        currentPrice: current?.price || 0,
        currentChange: current?.priceChange24h || 0,
      });
    }

    // If nothing new and nothing dropped → skip
    if (newTokens.length === 0 && droppedTokens.length === 0) {
      return res.status(200).json({ sent: 0, reason: 'no new entries or drops', totalHot: hot.length });
    }

    // Cooldown: don't send if last message was too recent (even if list changed)
    if (prevTs > 0 && (now - prevTs) < cooldown) {
      const istHour = (new Date().getUTCHours() + 5 + (new Date().getUTCMinutes() >= 30 ? 1 : 0)) % 24;
      return res.status(200).json({
        sent: 0, reason: 'cooldown active',
        newPending: newTokens.length, droppedPending: droppedTokens.length,
        cooldownH: cooldown / 3600000, istHour,
      });
    }

    // 5. Fetch RugCheck audits for new tokens (parallel)
    const auditPromises = newTokens.slice(0, 5).map(t => fetchRugCheck(t.address));
    const audits = await Promise.all(auditPromises);

    // 6. Build and send digest
    const limitedNew = newTokens.slice(0, 5);
    const limitedDropped = droppedTokens.slice(0, 5);

    const digest = buildDigest(limitedNew, limitedDropped, audits);

    let sent = 0;
    if (digest) {
      const ok = await sendTelegram(digest);
      if (ok) sent = 1;
    }

    // 7. Save current hot list as state
    await saveState(hot, now);

    return res.status(200).json({
      sent,
      newTokens: limitedNew.length,
      droppedTokens: limitedDropped.length,
      totalHot: hot.length,
      checked: allTokens.length,
    });
  } catch (err) {
    console.error('Notify error:', err);
    return res.status(500).json({ error: err.message });
  }
}
