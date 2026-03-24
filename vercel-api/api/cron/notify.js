// Vercel Cron Job — runs every minute to check for hot tokens and send Telegram alerts
// Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel environment variables

const DEXSCREENER_BASE = 'https://api.dexscreener.com';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// KV-like dedup via Vercel KV or simple edge config
// For now, use Telegram's message dedup — only alert tokens with very high gains
const MIN_GAIN_PCT = 100;
const MIN_MCAP = 50000;

function escMd(s) {
  return String(s).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function formatUsd(n) {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function buildMessage(t) {
  const sign24 = t.priceChange24h >= 0 ? '\\+' : '';
  const sign1h = t.priceChange1h >= 0 ? '\\+' : '';
  const dex = t.address ? `https://dexscreener.com/solana/${t.address}` : '';
  const pump = t.address ? `https://pump.fun/coin/${t.address}` : '';

  const lines = [
    `🔥 *New Hot Token Alert*`,
    ``,
    `*${escMd(t.symbol)}* — ${escMd(t.name)}`,
    ``,
    `💰 24h: *${sign24}${escMd(t.priceChange24h.toFixed(1))}${escMd('%')}*`,
    `📊 MCap: *${escMd(formatUsd(t.marketCap))}*`,
    `📈 Vol: *${escMd(formatUsd(t.volume24h))}*`,
  ];

  if (t.priceChange1h !== 0) {
    lines.push(`⏱ 1h: *${sign1h}${escMd(t.priceChange1h.toFixed(1))}${escMd('%')}*`);
  }
  if (t.txnsBuys24h > 0) {
    lines.push(`🛒 Buys: *${escMd(t.txnsBuys24h.toLocaleString())}*`);
  }
  if (t.ageMinutes > 0) {
    const h = Math.floor(t.ageMinutes / 60);
    const m = t.ageMinutes % 60;
    lines.push(`🕐 Age: *${h > 0 ? `${h}h ${m}m` : `${m}m`}*`);
  }

  lines.push(``);
  if (dex) lines.push(`[📊 DexScreener](${dex})`);
  if (pump) lines.push(`[🎯 Pump\\.fun](${pump})`);
  lines.push(``, `_via @hotrightnowbot_`);

  return lines.join('\n');
}

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
  return data.ok;
}

async function getRecentMessageHashes() {
  // Fetch last 50 messages from channel to dedup
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-50&limit=50`
    );
    const data = await resp.json();
    const symbols = new Set();
    if (data.ok && data.result) {
      for (const u of data.result) {
        const text = u.channel_post?.text || u.message?.text || '';
        // Extract symbol from "**SYMBOL** —" pattern
        const match = text.match(/\*([A-Za-z0-9_]+)\*/);
        if (match) symbols.add(match[1].toUpperCase());
      }
    }
    return symbols;
  } catch {
    return new Set();
  }
}

export default async function handler(req, res) {
  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(200).json({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set' });
  }

  // Verify cron secret (optional security)
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch trending tokens
    const boostRes = await fetch(`${DEXSCREENER_BASE}/token-boosts/top/v1`);
    const boosted = boostRes.ok ? await boostRes.json() : [];

    const solAddrs = [];
    for (const t of Array.isArray(boosted) ? boosted : []) {
      if (t.chainId === 'solana' && t.tokenAddress) {
        solAddrs.push(t.tokenAddress);
      }
    }

    if (solAddrs.length === 0) {
      return res.status(200).json({ sent: 0, reason: 'no solana tokens' });
    }

    const pairRes = await fetch(
      `${DEXSCREENER_BASE}/tokens/v1/solana/${solAddrs.slice(0, 30).join(',')}`
    );
    if (!pairRes.ok) {
      return res.status(200).json({ sent: 0, reason: 'dexscreener pair fetch failed' });
    }

    const pairs = await pairRes.json();
    if (!Array.isArray(pairs)) {
      return res.status(200).json({ sent: 0, reason: 'invalid pairs data' });
    }

    // Group by token, pick best pair
    const byAddr = {};
    for (const p of pairs) {
      const addr = p.baseToken?.address;
      if (!addr) continue;
      if (!byAddr[addr]) byAddr[addr] = [];
      byAddr[addr].push(p);
    }

    const tokens = [];
    for (const addr of Object.keys(byAddr)) {
      const sorted = byAddr[addr].sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
      const p = sorted[0];
      const pc = p.priceChange || {};
      const age = p.pairCreatedAt ? Math.floor((Date.now() - p.pairCreatedAt) / 60000) : 0;

      tokens.push({
        symbol: p.baseToken?.symbol || '?',
        name: p.baseToken?.name || '',
        address: p.baseToken?.address || '',
        priceChange24h: pc.h24 || 0,
        priceChange1h: pc.h1 || 0,
        marketCap: p.marketCap || p.fdv || 0,
        volume24h: p.volume?.h24 || 0,
        txnsBuys24h: p.txns?.h24?.buys || 0,
        ageMinutes: age,
      });
    }

    // Filter hot tokens
    const hot = tokens.filter(
      t => t.priceChange24h >= MIN_GAIN_PCT && t.marketCap >= MIN_MCAP
    );

    // Dedup against recent channel messages
    const recentSymbols = await getRecentMessageHashes();

    let sent = 0;
    for (const token of hot.slice(0, 3)) {
      if (recentSymbols.has(token.symbol.toUpperCase())) continue;

      const msg = buildMessage(token);
      const ok = await sendTelegram(msg);
      if (ok) sent++;

      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    }

    return res.status(200).json({ sent, checked: tokens.length, hot: hot.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
