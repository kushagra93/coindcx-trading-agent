/**
 * Smart chat engine — parses natural language trading commands and
 * generates contextual responses using the blockchain service layer.
 *
 * Maintains conversation context (positions, last token discussed,
 * active screening results) for multi-turn interactions.
 */

import {
  screenToken,
  screenByAddress,
  screenTokenLive,
  screenByAddressLive,
  getTokenPriceLive,
  detectChainFromAddress,
  openPosition,
  closePosition,
  getOpenPositions,
  getTradeHistory,
  getPortfolioStats,
  getTokenPrice,
  getTrendingTokens,
  getHotSnipes,
  formatUsd,
  formatPrice,
  MEME_TOKENS,
  PERP_TOKENS,
  CHAIN_CONFIG,
  EVM_CHAINS,
  parseChainHint,
  type ScreeningResult,
  type Position,
  type TokenMetrics,
  type Chain,
} from './blockchain';

// ─── Types ───────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  metadata?: {
    action?: string;
    token?: string;
    screening?: ScreeningResult;
    position?: Position;
    createdRule?: { condition: string; action: string };
    createdAlert?: { token: string; price: number; direction: 'above' | 'below' };
    createdLimit?: { token: string; price: number; side: 'buy' | 'sell' };
    createdDca?: { token: string; amount: number; frequency: string };
  };
}

interface ChatContext {
  lastToken: string | null;
  lastScreening: ScreeningResult | null;
  lastPosition: Position | null;
  conversationTurn: number;
}

// ─── Context ─────────────────────────────────────────────────────────

const ctx: ChatContext = {
  lastToken: null,
  lastScreening: null,
  lastPosition: null,
  conversationTurn: 0,
};

// ─── Token extraction ────────────────────────────────────────────────

const ALL_TOKENS = /\b(sol|bonk|eth|wif|pepe|jup|aero|brett|btc|degen|toshi|fartcoin|popcat|myro|giga|mew|bome|mog|wen|tsla|nvda|aapl|amzn|msft|googl|meta|arb|gmx|magic|pendle|pol|aave|quick|bnb|cake|bake|op|velo|avax|joe|blast|ftm|zk|snx|mon|kuru|moyaki|sui|cetus|turbos|navx|apt|thala|gui|mega|gte|crab)\b/i;

// Contract address patterns
const SOLANA_ADDR = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const MOVE_ADDR = /\b0x[a-fA-F0-9]{64}\b/;
const MOVE_MODULE = /\b0x[a-fA-F0-9]{1,4}::\w+::\w+/;
const EVM_ADDR = /\b0x[a-fA-F0-9]{40}\b/;

function extractContractAddress(text: string): string | null {
  // Move module paths (0x2::sui::SUI)
  const moveModMatch = text.match(MOVE_MODULE);
  if (moveModMatch) return moveModMatch[0];
  // Move addresses (0x + 64 hex) — check before EVM (40 hex)
  const moveMatch = text.match(MOVE_ADDR);
  if (moveMatch) return moveMatch[0];
  // EVM addresses (0x + 40 hex)
  const evmMatch = text.match(EVM_ADDR);
  if (evmMatch) return evmMatch[0];
  // Solana (base58, avoid matching short token symbols)
  const solMatch = text.match(SOLANA_ADDR);
  if (solMatch && solMatch[0].length >= 32) return solMatch[0];
  return null;
}

function extractToken(text: string): string | null {
  const match = text.match(ALL_TOKENS);
  return match ? match[1].toUpperCase() : null;
}

function extractAmount(text: string): number {
  const match = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (match) return parseFloat(match[1].replace(/,/g, ''));
  const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:dollars?|usd|bucks)/i);
  if (numMatch) return parseFloat(numMatch[1]);
  return 200; // default
}

function extractLeverage(text: string): number {
  const match = text.match(/(\d+)\s*x/i);
  return match ? parseInt(match[1]) : 1;
}

// ─── Intent Detection ────────────────────────────────────────────────

type Intent =
  | 'buy' | 'sell' | 'long' | 'short'
  | 'screen' | 'analyze'
  | 'snipe' | 'dca'
  | 'positions' | 'pnl' | 'portfolio'
  | 'close' | 'exit'
  | 'trailing' | 'stoploss' | 'takeprofit'
  | 'trending' | 'hot'
  | 'copy' | 'strategy'
  | 'set_alert' | 'create_rule' | 'create_limit' | 'list_automations'
  | 'help' | 'unknown';

function detectIntent(text: string): Intent {
  const t = text.toLowerCase();

  if (t.includes('alert') || t.includes('notify me') || t.includes('tell me when')) return 'set_alert';
  if (t.includes('list automation') || t.includes('my rules') || t.includes('my alerts') || t.includes('active rules') || t.includes('show automations')) return 'list_automations';
  if (t.includes('limit order') || t.includes('limit buy') || t.includes('limit sell')) return 'create_limit';
  // Complex conditional rules: "buy X when Y", "trade X when Y and sell at Z", "when RSI < 30 buy"
  if (
    (t.includes('when') || t.includes('if ') || t.includes('as soon as') || t.includes('listed at') || t.includes('hits') || t.includes('crosses') || t.includes('reaches'))
    && (t.includes('buy') || t.includes('sell') || t.includes('trade') || t.includes('then') || t.includes('and '))
  ) return 'create_rule';
  if (t.includes('screen') || t.includes('safe') || t.includes('rug') || t.includes('check')) return 'screen';
  if (t.includes('snipe') || t.includes('low-cap') || t.includes('low cap') || t.includes('pump.fun') || t.includes('new token') || t.includes('launch')) return 'snipe';
  if ((t.includes('long') || t.includes('short')) && !t.includes('how long')) return t.includes('short') ? 'short' : 'long';
  if (t.includes('close') || t.includes('exit') || (t.includes('sell') && (t.includes('position') || t.includes('all')))) return 'close';
  if (t.includes('sell')) return 'sell';
  if (t.includes('buy') || t.includes('ape') || t.includes('get some') || t.includes('grab')) return 'buy';
  if (t.includes('analyze') || t.includes('analysis') || t.includes('research') || t.includes('look at') || t.includes('tell me about')) return 'analyze';
  if (t.includes('dca')) return 'dca';
  if (t.includes('position') || t.includes('open') || t.includes('holding')) return 'positions';
  if (t.includes('p&l') || t.includes('pnl') || t.includes('profit') || t.includes('performance') || t.includes('how am i')) return 'pnl';
  if (t.includes('portfolio') || t.includes('balance') || t.includes('wallet')) return 'portfolio';
  if (t.includes('trailing') || (t.includes('tp') && t.includes('sl'))) return 'trailing';
  if (t.includes('stop loss') || t.includes('stop-loss') || t.includes('stoploss')) return 'stoploss';
  if (t.includes('take profit') || t.includes('take-profit') || t.includes('tp')) return 'takeprofit';
  if (t.includes('trend') || t.includes('hot') || t.includes('what should') || t.includes('recommend') || t.includes('suggest')) return 'trending';
  if (t.includes('copy') || t.includes('mirror')) return 'copy';
  if (t.includes('strategy') || t.includes('strategies') || t.includes('bot')) return 'strategy';
  if (t.includes('help') || t.includes('what can')) return 'help';

  return 'unknown';
}

// ─── Response Generators ─────────────────────────────────────────────

function formatScreeningResult(result: ScreeningResult, contractAddress?: string): string {
  const t = result.token;

  const chainName = CHAIN_CONFIG[t.chain]?.name ?? t.chain.toUpperCase();
  let resp = `SCREENING: ${t.symbol} (${chainName})\n`;
  if (t.name && t.name !== t.symbol && !t.name.includes('..')) {
    resp += `Name: ${t.name}\n`;
  }
  if (contractAddress) {
    const short = contractAddress.length > 16
      ? contractAddress.slice(0, 6) + '...' + contractAddress.slice(-4)
      : contractAddress;
    resp += `Contract: ${short}\n`;
  }
  resp += `Grade: ${result.grade}\n`;
  resp += `AI Confidence: ${result.overallScore}%\n`;
  resp += `Rug Probability: ${result.rugProbability}%\n\n`;

  resp += `--- On-Chain Metrics ---\n`;
  resp += `Price: ${formatPrice(t.price)}  (5m: ${t.priceChange5m > 0 ? '+' : ''}${t.priceChange5m.toFixed(1)}%)\n`;
  resp += `24h Change: ${t.priceChange24h > 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}%\n`;
  resp += `Volume (24h): ${formatUsd(t.volume24h)}\n`;
  resp += `Market Cap: ${formatUsd(t.marketCap)}\n`;
  resp += `Liquidity: ${formatUsd(t.liquidity)}\n`;
  resp += `Age: ${t.ageMinutes > 1440 ? `${Math.floor(t.ageMinutes / 1440)}d` : `${t.ageMinutes}min`}\n`;
  resp += `Holders: ${t.holders.toLocaleString()}\n`;

  // Data sources from Photon, Axiom, FOMO, RugCheck, DexScreener
  if (result.dataSources.length > 0) {
    resp += `\n--- Intelligence Sources ---\n`;
    result.dataSources.forEach(ds => {
      const icon = ds.verdict === 'safe' ? '+' : ds.verdict === 'warn' ? '*' : 'X';
      resp += `${icon} ${ds.name}: ${ds.value}\n`;
    });
  }

  resp += `\n--- Safety Checks ---\n`;
  resp += `RugCheck Score: ${t.rugScore}/100\n`;
  resp += `LP Locked: ${t.lpLocked ? `Yes (${t.lpLockPct}%)` : 'NO'}\n`;
  resp += `Top Holder: ${t.topHolderPct.toFixed(1)}%\n`;
  resp += `CT Score: ${t.ctScore}/100\n`;

  if (result.warnings.length > 0) {
    resp += `\n--- Warnings ---\n`;
    result.warnings.forEach(w => { resp += `* ${w}\n`; });
  }
  if (result.reasons.length > 0) {
    resp += `\n--- Issues ---\n`;
    result.reasons.forEach(r => { resp += `X ${r}\n`; });
  }

  resp += `\n${result.recommendation}`;

  if (result.passed) {
    resp += `\n\nSay "buy ${t.symbol} $50" / "$200" / "$500" to execute with War Agent exit strategy.`;
  } else {
    resp += `\n\nSay "buy ${t.symbol} force" to override safety checks (not recommended).`;
  }

  return resp;
}

async function handleScreen(token: string): Promise<string> {
  const result = await screenTokenLive(token);
  ctx.lastScreening = result;
  ctx.lastToken = token;
  return formatScreeningResult(result);
}

async function handleScreenByAddress(address: string, chainHint?: Chain): Promise<string> {
  const result = await screenByAddressLive(address, chainHint);
  ctx.lastScreening = result;
  ctx.lastToken = result.token.symbol;
  return formatScreeningResult(result, address);
}

async function handleBuy(token: string, text: string): Promise<string> {
  const amount = extractAmount(text);
  const screening = await screenTokenLive(token);

  if (!screening.passed && screening.grade !== 'C') {
    ctx.lastScreening = screening;
    return `BLOCKED: ${token} failed safety screening (Grade ${screening.grade}).\n\n` +
      `Issues:\n${screening.reasons.map(r => `X ${r}`).join('\n')}\n\n` +
      `${screening.recommendation}\n\n` +
      `Say "buy ${token} force" to override safety checks (not recommended).`;
  }

  const position = openPosition(token, amount);
  ctx.lastPosition = position;
  ctx.lastToken = token;

  const t = screening.token;
  const isMeme = MEME_TOKENS.has(token);

  let resp = `BUY ORDER EXECUTED\n\n`;
  resp += `${position.symbol} | ${position.dex}\n`;
  resp += `Chain: ${position.chain.toUpperCase()}\n`;
  resp += `Entry: ${formatPrice(position.entryPrice)}\n`;
  resp += `Size: ${formatUsd(amount)}\n`;
  resp += `Qty: ${position.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}\n`;
  resp += `Safety: Grade ${screening.grade} | Rug ${t.rugScore}/100\n`;

  resp += `\n--- Exit Strategy (War Agent) ---\n`;
  position.exitStrategies.forEach(e => {
    resp += `${e.active ? '[ON]' : '[OFF]'}  ${e.label}: ${e.triggerPct > 0 ? '+' : ''}${e.triggerPct}%`;
    if (e.sellPct) resp += ` (sell ${e.sellPct}%)`;
    resp += `\n`;
  });

  if (isMeme) {
    resp += `\nMEME SAFETY: Micro stop-loss active — if price dumps >25% in 30s, auto-exit.`;
    resp += `\nLadder exit: Selling 40% at 2.5x to recover principal.`;
  }

  resp += `\n\nSay "positions" to track, "close ${position.symbol}" to exit.`;
  return resp;
}

function handleSell(token: string, text: string): string {
  const positions = getOpenPositions().filter(p =>
    p.symbol.replace('-PERP', '') === token.replace('-PERP', '')
  );

  if (positions.length === 0) {
    return `No open position in ${token}. Your open positions:\n\n` +
      (getOpenPositions().length > 0
        ? getOpenPositions().map(p => `- ${p.symbol}: ${formatUsd(p.size)} (${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct}%)`).join('\n')
        : 'None — say "buy [token] $amount" to open one.');
  }

  const pos = positions[0];
  // Simulate some P&L
  pos.currentPrice = pos.entryPrice * (1 + (Math.random() * 0.3 - 0.05));
  pos.pnl = (pos.currentPrice - pos.entryPrice) * pos.quantity;
  pos.pnlPct = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;

  const record = closePosition(pos.id, 'Manual sell via chat', 'take_profit');
  if (!record) return 'Failed to close position.';

  let resp = `SOLD ${pos.symbol}\n\n`;
  resp += `Exit Price: ${formatPrice(pos.currentPrice)}\n`;
  resp += `Entry: ${formatPrice(pos.entryPrice)}\n`;
  resp += `P&L: ${pos.pnl >= 0 ? '+' : ''}${formatUsd(pos.pnl)} (${pos.pnlPct >= 0 ? '+' : ''}${pos.pnlPct.toFixed(1)}%)\n`;
  resp += `Hold Time: ${Math.round((Date.now() - pos.entryTime) / 60000)}min\n`;
  resp += `Venue: ${pos.dex}\n`;

  return resp;
}

function handleLongShort(token: string, text: string, side: 'long' | 'short'): string {
  const amount = extractAmount(text);
  const leverage = extractLeverage(text);
  const isPerp = PERP_TOKENS.has(token);
  const symbol = isPerp ? `${token}-PERP` : token;

  const position = openPosition(token, amount, leverage, side);
  ctx.lastPosition = position;
  ctx.lastToken = token;

  const t = getTokenPrice(token);
  const funding = isPerp ? '+0.01%' : 'N/A';

  let resp = `${side.toUpperCase()} ORDER PLACED\n\n`;
  resp += `${symbol} | ${position.dex}\n`;
  resp += `Side: ${side.toUpperCase()}\n`;
  resp += `Leverage: ${leverage}x\n`;
  resp += `Size: ${formatUsd(amount)} (notional: ${formatUsd(amount * leverage)})\n`;
  resp += `Entry: ${formatPrice(position.entryPrice)}\n`;
  if (isPerp) resp += `Funding Rate: ${funding}\n`;

  resp += `\n--- Risk Management ---\n`;
  position.exitStrategies.forEach(e => {
    resp += `[ON]  ${e.label}: ${e.triggerPct > 0 ? '+' : ''}${e.triggerPct}%\n`;
  });

  if (isPerp) {
    resp += `\nPerps trade 24/7 with crypto collateral.`;
    resp += `\nLiquidation price: ~${formatPrice(position.entryPrice * (side === 'long' ? (1 - 0.9 / leverage) : (1 + 0.9 / leverage)))}`;
  }

  resp += `\n\nSay "close ${symbol}" to exit or "trailing ${symbol}" to adjust.`;
  return resp;
}

function handleSnipe(): string {
  const hotTokens = getHotSnipes();

  let resp = `MEME SNIPER ARMED\n\n`;
  const evmDexes = EVM_CHAINS.slice(0, 5).map(c => CHAIN_CONFIG[c].dex).join(', ');
  resp += `Scanning: Pump.fun, Raydium, ${evmDexes} + ${EVM_CHAINS.length - 5} more\n\n`;
  resp += `--- Screening Filters (War Agent) ---\n`;
  resp += `Min Age: 30 minutes\n`;
  resp += `Min Volume: $25K (24h)\n`;
  resp += `Min Liquidity: $10K\n`;
  resp += `RugCheck: Score > 50\n`;
  resp += `LP: Must be locked\n`;
  resp += `Max Top Holder: 15%\n`;
  resp += `Positive 5m Momentum: Required\n`;

  resp += `\n--- Auto Exit Strategy ---\n`;
  resp += `Micro SL: -25% within 30s (instant dump protection)\n`;
  resp += `Ladder Exit: Sell 40% at 2.5x (recover principal)\n`;
  resp += `Trailing Stop: -30% from peak (locks in gains)\n`;
  resp += `Time Stop: Exit if <10% gain after 5min\n`;
  resp += `Max per trade: $50\n`;

  if (hotTokens.length > 0) {
    resp += `\n--- Live Hot Tokens ---\n`;
    hotTokens.forEach(t => {
      resp += `${t.symbol} (${t.chain}) — +${t.priceChange24h}% | MCap ${formatUsd(t.marketCap)} | Rug ${t.rugScore}/100\n`;
    });
  }

  resp += `\nSay "screen [token]" to check safety, or "buy [token] $50" to enter.`;
  return resp;
}

async function handleAnalyze(token: string): Promise<string> {
  const t = await getTokenPriceLive(token);
  if (!t) return `Token ${token} not found. Try: SOL, FARTCOIN, TSLA, DEGEN, ETH...`;

  ctx.lastToken = token;
  const screening = await screenTokenLive(token);
  ctx.lastScreening = screening;
  const isMeme = MEME_TOKENS.has(token);
  const isPerp = PERP_TOKENS.has(token);

  let resp = `ANALYSIS: ${t.symbol} (LIVE DATA)\n`;
  resp += `${t.name} | ${t.chain.toUpperCase()}\n\n`;

  resp += `--- Price Action ---\n`;
  resp += `Price: ${formatPrice(t.price)}\n`;
  resp += `5min: ${t.priceChange5m > 0 ? '+' : ''}${t.priceChange5m}%\n`;
  resp += `1h: ${t.priceChange1h > 0 ? '+' : ''}${t.priceChange1h}%\n`;
  resp += `24h: ${t.priceChange24h > 0 ? '+' : ''}${t.priceChange24h}%\n`;

  resp += `\n--- Fundamentals ---\n`;
  resp += `Market Cap: ${formatUsd(t.marketCap)}\n`;
  resp += `Volume (24h): ${formatUsd(t.volume24h)}\n`;
  resp += `Vol/MCap: ${(t.volume24h / Math.max(t.marketCap, 1) * 100).toFixed(1)}%\n`;
  resp += `Liquidity: ${formatUsd(t.liquidity)}\n`;

  if (!isPerp) {
    resp += `\n--- On-Chain ---\n`;
    resp += `Holders: ${t.holders > 0 ? t.holders.toLocaleString() : 'N/A'}\n`;
    resp += `Top Holder: ${t.topHolderPct > 0 ? t.topHolderPct.toFixed(1) + '%' : 'N/A'}\n`;
    resp += `LP Locked: ${t.lpLocked ? `${t.lpLockPct}%` : t.lpLockPct === 0 ? 'Unknown' : 'NO'}\n`;
    resp += `Safety Score: ${t.rugScore}/100\n`;
    resp += `Age: ${t.ageMinutes > 1440 ? `${Math.floor(t.ageMinutes / 1440)} days` : `${t.ageMinutes} min`}\n`;
  }

  resp += `\n--- Sentiment ---\n`;
  resp += `CT Score: ${t.ctScore}/100\n`;
  if (isMeme) {
    const momentum = t.priceChange1h > 5 ? 'Strong bullish' : t.priceChange1h > 0 ? 'Mildly bullish' : 'Bearish';
    resp += `Momentum: ${momentum}\n`;
    resp += `Category: ${t.marketCap < 50_000_000 ? 'Micro-cap meme' : 'Mid-cap meme'}\n`;
  }

  resp += `\nScreening Grade: ${screening.grade} — ${screening.recommendation}\n`;

  resp += `\nActions:\n`;
  if (screening.passed) {
    resp += `- "buy ${t.symbol} $200"\n`;
    resp += `- "dca ${t.symbol}"\n`;
    if (isPerp) resp += `- "long ${t.symbol} 3x"\n`;
  }
  resp += `- "screen ${t.symbol}" for full safety report`;

  return resp;
}

function handlePositions(): string {
  const open = getOpenPositions();
  if (open.length === 0) {
    return 'No open positions.\n\nSay "buy [token] $amount" to open one, or "trending" to see what\'s hot.';
  }

  let resp = `OPEN POSITIONS (${open.length})\n\n`;
  open.forEach(p => {
    // Simulate price movement
    const drift = (Math.random() - 0.4) * 0.1;
    p.currentPrice = p.entryPrice * (1 + drift);
    p.pnl = (p.currentPrice - p.entryPrice) * p.quantity * (p.side === 'short' ? -1 : 1);
    p.pnlPct = (p.pnl / p.size) * 100;

    resp += `${p.symbol} (${p.chain.toUpperCase()}) — ${p.side.toUpperCase()}${p.leverage > 1 ? ` ${p.leverage}x` : ''}\n`;
    resp += `  Entry: ${formatPrice(p.entryPrice)} | Now: ${formatPrice(p.currentPrice)}\n`;
    resp += `  Size: ${formatUsd(p.size)} | P&L: ${p.pnl >= 0 ? '+' : ''}${formatUsd(p.pnl)} (${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}%)\n`;
    resp += `  Exit: ${p.exitStrategies.filter(e => e.active).map(e => e.label).join(', ')}\n`;
    resp += `  Via: ${p.dex}\n\n`;
  });

  resp += `Say "close [token]" to exit, or "trailing [token]" to adjust exits.`;
  return resp;
}

function handlePnl(): string {
  const stats = getPortfolioStats();
  const history = getTradeHistory().slice(0, 5);

  let resp = `PAPER TRADING P&L\n\n`;
  resp += `Portfolio: ${formatUsd(stats.totalValue)}\n`;
  resp += `Open P&L: ${stats.totalPnl >= 0 ? '+' : ''}${formatUsd(stats.totalPnl)}\n`;
  resp += `Win Rate: ${stats.winRate}%\n`;
  resp += `Total Trades: ${stats.totalTrades}\n`;
  resp += `Open Positions: ${stats.openPositions}\n`;

  if (history.length > 0) {
    resp += `\n--- Recent Trades ---\n`;
    history.forEach(t => {
      const ago = Math.round((Date.now() - t.time) / 60000);
      resp += `${t.side.toUpperCase()} ${t.symbol}: ${formatUsd(t.usdValue)} — ${ago}min ago\n`;
      resp += `  ${t.reason}\n`;
    });
  }

  return resp;
}

async function handleDca(token: string, text: string): Promise<string> {
  const amount = extractAmount(text);
  const t = await getTokenPriceLive(token);
  if (!t) return `Token ${token} not found.`;

  const screening = await screenTokenLive(token);
  const isMeme = MEME_TOKENS.has(token);
  const isPerp = PERP_TOKENS.has(token);

  let resp = `DCA STRATEGY ACTIVATED\n\n`;
  resp += `Token: ${t.symbol} (${t.chain.toUpperCase()})\n`;
  resp += `Safety: Grade ${screening.grade} | Rug ${t.rugScore}/100\n\n`;
  resp += `--- Parameters ---\n`;
  resp += `Buy on: Every ${isMeme ? '5%' : isPerp ? '2%' : '3%'} dip\n`;
  resp += `Per buy: ${formatUsd(amount)}\n`;
  resp += `Max budget: ${formatUsd(amount * 10)}\n`;
  resp += `Venue: ${CHAIN_CONFIG[t.chain]?.dex ?? 'Best DEX'}\n`;
  resp += `MEV Protection: ON\n`;

  resp += `\n--- Exit (War Agent) ---\n`;
  if (isMeme) {
    resp += `Micro SL: -25% in 30s\n`;
    resp += `Ladder: Sell 40% at 2.5x\n`;
    resp += `Trailing: -30% from peak\n`;
    resp += `Wider dip threshold for meme volatility.\n`;
  } else {
    resp += `Stop Loss: -${isPerp ? '8' : '5'}%\n`;
    resp += `Take Profit: +${isPerp ? '15' : '20'}%\n`;
    resp += `Trailing: -${isPerp ? '6' : '8'}% from peak\n`;
  }

  resp += `\nSay "dca $100 per buy, 3% dips" to customize.`;
  return resp;
}

function handleTrending(): string {
  const trending = getTrendingTokens();
  const hotSnipes = getHotSnipes();

  let resp = `MARKET SIGNALS\n\n`;

  if (hotSnipes.length > 0) {
    resp += `--- Low-Cap Opportunities (Screened) ---\n`;
    hotSnipes.forEach(t => {
      const screening = screenToken(t.symbol);
      resp += `${t.symbol} (${t.chain}) — Grade ${screening.grade}\n`;
      resp += `  Price: ${formatPrice(t.price)} | 24h: +${t.priceChange24h}%\n`;
      resp += `  MCap: ${formatUsd(t.marketCap)} | Vol: ${formatUsd(t.volume24h)}\n`;
      resp += `  Safety: Rug ${t.rugScore}/100 | LP ${t.lpLockPct}% locked\n\n`;
    });
  }

  resp += `--- Trending (CT Score > 65) ---\n`;
  trending.forEach(t => {
    resp += `${t.symbol}: +${t.priceChange24h}% | CT ${t.ctScore}/100\n`;
  });

  resp += `\nActions:\n`;
  resp += `- "screen [token]" — Full safety check\n`;
  resp += `- "buy [token] $200" — Buy with auto exit strategy\n`;
  resp += `- "snipe" — Arm meme sniper with War Agent filters`;

  return resp;
}

function handleTrailing(token: string): string {
  const positions = getOpenPositions().filter(p =>
    p.symbol.replace('-PERP', '') === token.replace('-PERP', '')
  );

  if (positions.length === 0) {
    return `No open position in ${token}. Open one first with "buy ${token} $200".`;
  }

  const pos = positions[0];
  let resp = `EXIT STRATEGY: ${pos.symbol}\n\n`;
  resp += `--- Current Exits ---\n`;
  pos.exitStrategies.forEach(e => {
    resp += `${e.active ? '[ON] ' : '[OFF]'} ${e.label}: ${e.triggerPct > 0 ? '+' : ''}${e.triggerPct}%`;
    if (e.sellPct) resp += ` (sell ${e.sellPct}%)`;
    resp += `\n`;
  });

  resp += `\n--- War Agent Defaults ---\n`;
  resp += `Memes: Micro SL (-25%/30s) + Ladder (2.5x/40%) + Trail (-30%)\n`;
  resp += `Blue Chips: SL (-5%) + TP (+20%) + Trail (-8%)\n`;
  resp += `Perps: SL (-8%) + TP (+15%) + Trail (-6%)\n`;

  resp += `\nAdjust: "set TP 15% SL 3%" or "tighter trailing -15%"`;
  return resp;
}

function handleClose(token: string | null): string {
  if (!token) {
    const open = getOpenPositions();
    if (open.length === 0) return 'No open positions to close.';
    return `Which position? Open:\n${open.map(p => `- ${p.symbol}`).join('\n')}\n\nSay "close [token]"`;
  }

  return handleSell(token, '');
}

function handleCopy(): string {
  return `COPY TRADING\n\n` +
    `--- Top Traders (Screened) ---\n` +
    `1. MemeKing (Solana memes)\n` +
    `   30d: +145% | Sharpe: 2.8 | Win: 72%\n` +
    `   Top: FARTCOIN +142%, POPCAT +67%\n` +
    `   Strategy: War Agent screened entries, ladder exits\n\n` +
    `2. PerpWhale (US Stock Perps)\n` +
    `   30d: +38% | Sharpe: 3.1 | Win: 68%\n` +
    `   Top: TSLA-PERP +18%, NVDA-PERP +12%\n` +
    `   Strategy: Momentum with trailing stops\n\n` +
    `3. BaseBuilder (Base Chain)\n` +
    `   30d: +31% | Sharpe: 2.4 | Win: 65%\n` +
    `   Top: DEGEN +28%, TOSHI +19%\n` +
    `   Strategy: Volume breakout, DCA on dips\n\n` +
    `Say "copy MemeKing $500" to mirror trades with auto risk management.`;
}

function handleStrategy(): string {
  return `STRATEGIES (War Agent + Custom)\n\n` +
    `--- Active ---\n` +
    `1. Meme Sniper\n` +
    `   Screens: Age >30min, Vol >$25K, Rug >50\n` +
    `   Exits: Micro SL + Ladder 2.5x + Trailing -30%\n\n` +
    `2. Trending Scan\n` +
    `   Finds established tokens with volume surge\n` +
    `   Exits: TP +20%, SL -5%, Trailing -8%\n\n` +
    `3. Perps Momentum\n` +
    `   Long/short US stocks on earnings & momentum\n` +
    `   Exits: TP +15%, SL -8%, Trailing -6%\n\n` +
    `--- Available ---\n` +
    `4. Migration Snipe — Buy tokens graduating Pump.fun\n` +
    `5. Copy Trade — Mirror curated whale wallets\n` +
    `6. DCA Bot — Auto-buy on dips\n` +
    `7. Whale Discovery — Find profitable new wallets\n\n` +
    `Say "activate [strategy]" or "buy [token]" to start trading.`;
}

function handleHelp(): string {
  return `TRADING COMMANDS\n\n` +
    `--- Buy/Sell ---\n` +
    `"buy FARTCOIN $200" — Buy with safety screening\n` +
    `"sell POPCAT" — Close position\n` +
    `"long TSLA 3x" — Leveraged perp position\n` +
    `"short NVDA 2x" — Short perp position\n\n` +
    `--- Analysis ---\n` +
    `"screen MYRO" — Full safety check (age/vol/rug)\n` +
    `"screen 0x..." — Screen any EVM token by contract\n` +
    `"screen 0x... on arbitrum" — Specify chain\n` +
    `"screen So1..." — Screen any Solana token by address\n` +
    `"screen 0x...64hex on sui" — Screen Sui/Aptos token\n` +
    `"analyze DEGEN" — Price action + fundamentals\n` +
    `"trending" — Hot tokens with CT scores\n\n` +
    `--- Strategies ---\n` +
    `"snipe" — Arm meme sniper (War Agent filters)\n` +
    `"dca SOL $100" — Dollar cost average\n` +
    `"copy" — Copy top traders\n\n` +
    `--- Portfolio ---\n` +
    `"positions" — Open positions + P&L\n` +
    `"pnl" — Performance stats\n` +
    `"trailing FARTCOIN" — View/adjust exit strategy\n\n` +
    `EVM: Ethereum, Base, Arbitrum, Polygon, BSC, Optimism, Avalanche, Blast, Fantom, zkSync, Monad + more\n` +
    `Move: Sui, Aptos | Solana | Perps: Hyperliquid\n` +
    `Tip: Add "on <chain>" to specify chain (e.g., "on arbitrum", "on sui", "on aptos")`;
}

async function handleUnknown(text: string): Promise<string> {
  const addr = extractContractAddress(text);
  if (addr) return handleScreenByAddress(addr);

  const token = extractToken(text) ?? ctx.lastToken;
  if (token) return handleAnalyze(token);

  return `I can help you trade. Try:\n\n` +
    `"buy FARTCOIN $200" — Buy memecoin\n` +
    `"screen POPCAT" — Safety check\n` +
    `"screen 0x..." — Screen by contract (EVM/Sui/Aptos)\n` +
    `"long TSLA 3x" — US stock perps\n` +
    `"snipe" — Arm meme sniper\n` +
    `"trending" — See what's hot\n` +
    `"positions" — Your portfolio\n\n` +
    `Or say "help" for all commands.`;
}

function handleSetAlert(token: string | null, text: string): { text: string; metadata: ChatMessage['metadata'] } {
  const t = token ?? 'BTC';
  const lower = text.toLowerCase();
  const direction = lower.includes('drop') || lower.includes('below') || lower.includes('under') || lower.includes('down') || lower.includes('less than') || lower.includes('<') ? 'below' : 'above';

  // Try to extract price from various patterns
  const priceMatch = text.match(/\$\s*([\d,]+(?:\.\d+)?[KkMm]?)/);
  let price = 0;
  if (priceMatch) {
    let raw = priceMatch[1].replace(/,/g, '');
    if (raw.match(/[Kk]$/)) price = parseFloat(raw) * 1000;
    else if (raw.match(/[Mm]$/)) price = parseFloat(raw) * 1_000_000;
    else price = parseFloat(raw);
  }
  // Also try "hits 100K" / "reaches 3000" without $
  if (!price) {
    const numMatch = text.match(/(?:hits|reaches|at|above|below|under|over)\s+([\d,.]+[KkMm]?)/);
    if (numMatch) {
      let raw = numMatch[1].replace(/,/g, '');
      if (raw.match(/[Kk]$/)) price = parseFloat(raw) * 1000;
      else if (raw.match(/[Mm]$/)) price = parseFloat(raw) * 1_000_000;
      else price = parseFloat(raw);
    }
  }
  // Also try percentage-based alerts: "drops 5%", "up 10%"
  const pctMatch = text.match(/(?:drop|fall|down|up|rise|gain)s?\s+(\d+)%/i);
  if (!price && pctMatch) {
    return {
      text: `PRICE ALERT SET\n\nToken: ${t}\nAlert: When ${t} ${direction === 'below' ? 'drops' : 'rises'} ${pctMatch[1]}%\nStatus: Active\n\nYou'll be notified when the condition is met.`,
      metadata: { action: 'set_alert', token: t, createdAlert: { token: t, price: parseInt(pctMatch[1]), direction } },
    };
  }

  if (!price) price = direction === 'above' ? 100000 : 50000;

  return {
    text: `PRICE ALERT SET\n\nToken: ${t}\nAlert: When price goes ${direction} $${price.toLocaleString()}\nStatus: Active\n\nYou'll be notified when the condition is met.`,
    metadata: { action: 'set_alert', token: t, createdAlert: { token: t, price, direction } },
  };
}

function handleCreateRule(text: string): { text: string; metadata: ChatMessage['metadata'] } {
  const t = text.toLowerCase();
  const token = extractToken(text);

  // --- Parse entry condition ---
  let condition = '';
  let entryAction = '';
  let exitAction = '';
  let target = '';

  // Pattern: "trade/buy any token listed at hot right now"
  if (t.match(/(?:trade|buy)\s+(?:any|all)\s+(?:token|coin)s?\s+(?:listed\s+)?(?:at|on|in)\s+hot/)) {
    condition = 'Token appears in Hot Now';
    entryAction = 'Auto-buy';
  }
  // Pattern: "buy any US stock when RSI < 30" / "buy when RSI crosses below 30"
  else if (t.match(/(?:buy|trade|long)\s+(?:any\s+)?(?:us\s+stock|perp|stock)s?\s+when\s+/)) {
    const rsiMatch = t.match(/rsi\s+(?:is\s+)?(?:less\s+than|below|under|<|crosses?\s+below)\s+(\d+)/);
    if (rsiMatch) {
      condition = `RSI crosses below ${rsiMatch[1]}`;
    } else {
      condition = t.replace(/^.*?when\s+/i, '').replace(/\s+and\s+sell.*/i, '').trim();
    }
    entryAction = token ? `Buy ${token}` : 'Buy matching token';
  }
  // Pattern: "when RSI < 30 buy TOKEN" / "if BTC drops 10% buy"
  else if (t.match(/(?:when|if|as soon as)\s+/)) {
    const condMatch = t.match(/(?:when|if|as soon as)\s+(.+?)(?:\s+then\s+|\s*,\s*|\s+(?=buy|sell|trade|long|short))/i);
    condition = condMatch?.[1]?.trim() ?? '';
    const actionMatch = t.match(/(?:then\s+|,\s*)?(?:buy|sell|trade|long|short)\s*(.*?)(?:\s+and\s+sell|\s+with|\s*$)/i);
    entryAction = actionMatch ? actionMatch[0].replace(/\s+and\s+sell.*/i, '').trim() : '';
  }
  // Pattern: "TOKEN hits/reaches/crosses X then buy"
  else if (t.match(/(?:hits|reaches|crosses|listed)/)) {
    const beforeAction = t.split(/(?:then|,)\s*/)[0];
    condition = beforeAction.replace(/^(?:trade|buy)\s+/, '').trim();
    entryAction = 'Auto-buy';
  }

  // Clean up condition
  if (!condition) condition = 'condition met';
  if (!entryAction) entryAction = token ? `Buy ${token}` : 'Buy token';

  // --- Parse exit / take profit ---
  const tpMatch = t.match(/(?:sell|exit|tp|take\s*profit)\s+(?:at|@)?\s*(\d+)%/);
  if (tpMatch) {
    exitAction = `Take profit at +${tpMatch[1]}%`;
    target = `+${tpMatch[1]}%`;
  }
  const slMatch = t.match(/(?:stop\s*loss|sl)\s+(?:at|@)?\s*(\d+)%/);
  const slTarget = slMatch ? `Stop loss at -${slMatch[1]}%` : '';

  // --- Parse amount ---
  const amount = extractAmount(text);
  const amountStr = amount !== 200 ? ` $${amount}` : '';

  // Build nice response
  const conditionDisplay = condition.charAt(0).toUpperCase() + condition.slice(1);
  const entryDisplay = entryAction.charAt(0).toUpperCase() + entryAction.slice(1);

  let resp = `AUTOMATION RULE CREATED\n\n`;
  resp += `--- Entry Condition ---\n`;
  resp += `IF: ${conditionDisplay}\n`;
  resp += `THEN: ${entryDisplay}${amountStr}\n`;

  if (exitAction || slTarget) {
    resp += `\n--- Exit Strategy ---\n`;
    if (exitAction) resp += `[ON]  ${exitAction}\n`;
    if (slTarget) resp += `[ON]  ${slTarget}\n`;
    if (!slTarget) resp += `[ON]  Trailing stop: -15% from peak (default)\n`;
    resp += `[ON]  Micro SL: Active for meme tokens\n`;
  } else {
    resp += `\n--- Exit Strategy (War Agent Defaults) ---\n`;
    resp += `[ON]  Trailing stop: -15% from peak\n`;
    resp += `[ON]  Micro SL: Active for meme tokens\n`;
    resp += `[ON]  Time stop: Exit if <5% gain after 30min\n`;
  }

  resp += `\nStatus: Active — Agent will monitor continuously.\n`;
  resp += `Say "my rules" to see all active automations.`;

  const ruleCondition = conditionDisplay;
  const ruleAction = `${entryDisplay}${amountStr}${target ? `, sell at ${target}` : ''}`;

  return {
    text: resp,
    metadata: { action: 'create_rule', token: token ?? undefined, createdRule: { condition: ruleCondition, action: ruleAction } },
  };
}

function handleCreateLimit(token: string | null, text: string): { text: string; metadata: ChatMessage['metadata'] } {
  const t = token ?? 'TOKEN';
  const price = extractAmount(text);
  const side = text.toLowerCase().includes('sell') ? 'sell' : 'buy';

  return {
    text: `LIMIT ORDER PLACED\n\nToken: ${t}\nSide: ${side.toUpperCase()}\nTrigger Price: $${price}\nStatus: Active\n\nOrder will execute when price reaches target.`,
    metadata: { action: 'create_limit', token: t, createdLimit: { token: t, price, side } },
  };
}

function handleListAutomations(): string {
  return `ACTIVE AUTOMATIONS\n\n` +
    `--- Rules ---\n` +
    `1. IF FARTCOIN hits Hot Now → THEN Buy $5 [Active]\n` +
    `2. IF BTC RSI < 30 → THEN Buy $50 BTC [Active]\n\n` +
    `--- DCA Plans ---\n` +
    `1. DCA $50 into ETH weekly (7/20 buys) [Active]\n\n` +
    `--- Limit Orders ---\n` +
    `1. Buy POPCAT at $0.65 [Pending]\n` +
    `2. Sell ARB at $1.50 [Pending]\n\n` +
    `--- Alerts ---\n` +
    `1. BTC > $100K [Active]\n` +
    `2. ETH < $2,800 [Active]\n\n` +
    `--- Copy Trades ---\n` +
    `1. Copying MemeKing ($500) [Active]\n\n` +
    `Say "new rule", "set alert", or "limit order" to add more.`;
}

// ─── Main Engine ─────────────────────────────────────────────────────

export async function processMessage(text: string): Promise<ChatMessage> {
  ctx.conversationTurn++;
  const intent = detectIntent(text);
  const token = extractToken(text) ?? ctx.lastToken;
  const contractAddress = extractContractAddress(text);

  let response: string;

  const chainHint = parseChainHint(text) ?? undefined;

  if (contractAddress && (intent === 'screen' || intent === 'unknown' || intent === 'analyze' || intent === 'buy')) {
    if (intent === 'buy') {
      const result = await screenByAddressLive(contractAddress, chainHint);
      ctx.lastScreening = result;
      ctx.lastToken = result.token.symbol;
      if (!result.passed && result.grade !== 'C') {
        response = formatScreeningResult(result, contractAddress) +
          '\n\nBuy blocked — token failed safety screening. Say "buy force" to override.';
      } else {
        response = formatScreeningResult(result, contractAddress) +
          `\n\nPassed screening. Say "buy ${result.token.symbol} $200" to execute.`;
      }
    } else {
      response = await handleScreenByAddress(contractAddress, chainHint);
    }
  } else switch (intent) {
    case 'screen':
      response = token ? await handleScreen(token) : 'Which token? Say "screen FARTCOIN" or paste a contract address.';
      break;
    case 'buy':
      response = token ? await handleBuy(token, text) : 'Which token? Say "buy FARTCOIN $200".';
      break;
    case 'sell':
      response = handleSell(token ?? '', text);
      break;
    case 'long':
      response = token ? handleLongShort(token, text, 'long') : 'Which token? Say "long TSLA 3x".';
      break;
    case 'short':
      response = token ? handleLongShort(token, text, 'short') : 'Which token? Say "short NVDA 2x".';
      break;
    case 'snipe':
      response = handleSnipe();
      break;
    case 'analyze':
      response = token ? await handleAnalyze(token) : 'Which token? Say "analyze FARTCOIN" or "analyze NVDA".';
      break;
    case 'dca':
      response = token ? await handleDca(token, text) : 'Which token? Say "dca SOL $100".';
      break;
    case 'positions':
      response = handlePositions();
      break;
    case 'pnl':
    case 'portfolio':
      response = handlePnl();
      break;
    case 'trailing':
    case 'stoploss':
    case 'takeprofit':
      response = token ? handleTrailing(token) : 'Which position? Say "trailing FARTCOIN".';
      break;
    case 'close':
      response = handleClose(token);
      break;
    case 'trending':
    case 'hot':
      response = handleTrending();
      break;
    case 'copy':
      response = handleCopy();
      break;
    case 'strategy':
      response = handleStrategy();
      break;
    case 'set_alert': {
      const result = handleSetAlert(token, text);
      return { id: `a${Date.now()}`, role: 'assistant', text: result.text, metadata: result.metadata };
    }
    case 'create_rule': {
      const result = handleCreateRule(text);
      return { id: `a${Date.now()}`, role: 'assistant', text: result.text, metadata: result.metadata };
    }
    case 'create_limit': {
      const result = handleCreateLimit(token, text);
      return { id: `a${Date.now()}`, role: 'assistant', text: result.text, metadata: result.metadata };
    }
    case 'list_automations':
      response = handleListAutomations();
      break;
    case 'help':
      response = handleHelp();
      break;
    default:
      response = await handleUnknown(text);
  }

  return {
    id: `a${Date.now()}`,
    role: 'assistant',
    text: response,
    metadata: {
      action: intent,
      token: token ?? undefined,
      screening: ctx.lastScreening ?? undefined,
      position: ctx.lastPosition ?? undefined,
    },
  };
}
