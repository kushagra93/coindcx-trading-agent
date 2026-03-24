import { createChildLogger } from '../core/logger.js';
import { fetchGainers, type TokenMetrics } from '../data/token-screener.js';

const log = createChildLogger('telegram-hot');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';
const POLL_INTERVAL_MS = 60_000; // check every 60s

// Track tokens we've already alerted on (by address) to avoid spam
const alertedTokens = new Set<string>();
let pollTimer: ReturnType<typeof setInterval> | null = null;

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function buildMessage(token: TokenMetrics): string {
  const dexUrl = token.address
    ? `https://dexscreener.com/solana/${token.address}`
    : '';

  const pumpUrl = token.address
    ? `https://pump.fun/coin/${token.address}`
    : '';

  const lines = [
    `🔥 *New Hot Token Alert*`,
    ``,
    `*${escMd(token.symbol)}* — ${escMd(token.name)}`,
    ``,
    `💰 Price Change 24h: *${escNum(token.priceChange24h, '%')}*`,
    `📊 Market Cap: *${escMd(formatUsd(token.marketCap))}*`,
    `📈 Volume 24h: *${escMd(formatUsd(token.volume24h))}*`,
  ];

  if (token.priceChange1h !== 0) {
    lines.push(`⏱ 1h Change: *${escNum(token.priceChange1h, '%')}*`);
  }

  if (token.txnsBuys24h && token.txnsBuys24h > 0) {
    lines.push(`🛒 Buys 24h: *${escMd(token.txnsBuys24h.toLocaleString())}*`);
  }

  if (token.liquidity > 0) {
    lines.push(`💧 Liquidity: *${escMd(formatUsd(token.liquidity))}*`);
  }

  if (token.ageMinutes > 0) {
    const hours = Math.floor(token.ageMinutes / 60);
    const mins = token.ageMinutes % 60;
    lines.push(`🕐 Age: *${hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}*`);
  }

  if (token.chain) {
    lines.push(`⛓ Chain: *${escMd(String(token.chain))}*`);
  }

  lines.push(``);
  if (dexUrl) lines.push(`[📊 DexScreener](${dexUrl})`);
  if (pumpUrl) lines.push(`[🎯 Pump\\.fun](${pumpUrl})`);
  lines.push(``, `_via @hotrightnowbot_`);

  return lines.join('\n');
}

function escMd(s: string): string {
  return s.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function escNum(n: number, suffix = ''): string {
  const sign = n >= 0 ? '\\+' : '';
  return `${sign}${escMd(n.toFixed(1))}${escMd(suffix)}`;
}

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      }),
    });
    const data = await resp.json() as any;
    if (!data.ok) {
      log.warn({ error: data.description, chatId }, 'Telegram send failed');
      return false;
    }
    return true;
  } catch (err) {
    log.error({ err }, 'Telegram API error');
    return false;
  }
}

async function pollAndNotify(): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  try {
    const gainers = await fetchGainers();
    // Only alert on tokens with >100% 24h gain and >$50K mcap
    const hotTokens = gainers.filter(
      t => t.priceChange24h >= 100 && t.marketCap >= 50_000 && t.address
    );

    for (const token of hotTokens.slice(0, 5)) { // max 5 alerts per cycle
      const key = token.address!.toLowerCase();
      if (alertedTokens.has(key)) continue;

      const msg = buildMessage(token);
      const sent = await sendTelegram(TELEGRAM_CHAT_ID, msg);
      if (sent) {
        alertedTokens.add(key);
        log.info({ symbol: token.symbol, change24h: token.priceChange24h }, 'Telegram alert sent');
      }

      // Small delay between messages to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    }

    // Prune old entries (keep last 500)
    if (alertedTokens.size > 500) {
      const arr = Array.from(alertedTokens);
      for (let i = 0; i < arr.length - 500; i++) {
        alertedTokens.delete(arr[i]);
      }
    }
  } catch (err) {
    log.error({ err }, 'Hot token poll failed');
  }
}

export function startHotTokenNotifier(): void {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log.warn('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — hot token notifier disabled');
    return;
  }

  log.info({ chatId: TELEGRAM_CHAT_ID, interval: `${POLL_INTERVAL_MS / 1000}s` }, 'Hot token Telegram notifier started');

  // Run immediately, then on interval
  pollAndNotify();
  pollTimer = setInterval(pollAndNotify, POLL_INTERVAL_MS);
}

export function stopHotTokenNotifier(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
