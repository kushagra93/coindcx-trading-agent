// Health check endpoint — verifies Vercel API + DexScreener + Telegram are all working
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export default async function handler(req, res) {
  const checks = {
    vercelApi: { status: 'ok', latency: 0 },
    dexscreener: { status: 'unknown', latency: 0, tokens: 0 },
    telegram: { status: 'unknown', latency: 0 },
    timestamp: new Date().toISOString(),
  };

  // 1. Check DexScreener
  try {
    const t0 = Date.now();
    const r = await fetch('https://api.dexscreener.com/token-boosts/top/v1');
    checks.dexscreener.latency = Date.now() - t0;
    if (r.ok) {
      const data = await r.json();
      checks.dexscreener.status = 'ok';
      checks.dexscreener.tokens = Array.isArray(data) ? data.length : 0;
    } else {
      checks.dexscreener.status = `error_${r.status}`;
    }
  } catch (e) {
    checks.dexscreener.status = `error: ${e.message}`;
  }

  // 2. Check Telegram bot can send (dry — just verify bot info)
  if (BOT_TOKEN) {
    try {
      const t0 = Date.now();
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
      checks.telegram.latency = Date.now() - t0;
      const data = await r.json();
      if (data.ok) {
        checks.telegram.status = 'ok';
        checks.telegram.bot = data.result.username;
      } else {
        checks.telegram.status = `error: ${data.description}`;
      }
    } catch (e) {
      checks.telegram.status = `error: ${e.message}`;
    }
  } else {
    checks.telegram.status = 'not_configured';
  }

  // 3. Check last Telegram channel message age
  if (BOT_TOKEN && CHAT_ID) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1&limit=1`);
      const data = await r.json();
      if (data.ok && data.result.length > 0) {
        const lastMsg = data.result[0];
        const msgTime = (lastMsg.channel_post?.date || lastMsg.message?.date || 0) * 1000;
        const ageMin = Math.floor((Date.now() - msgTime) / 60000);
        checks.telegram.lastAlertAgeMin = ageMin;
        checks.telegram.alertsFlowing = ageMin < 15; // should have alert within 15 min
      }
    } catch {}
  }

  const allOk = checks.dexscreener.status === 'ok' &&
                checks.telegram.status === 'ok';

  return res.status(allOk ? 200 : 503).json({
    healthy: allOk,
    ...checks,
  });
}
