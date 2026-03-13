import type { FastifyInstance } from 'fastify';
import {
  screenBySymbol,
  screenByAddress,
  getTokenBySymbol,
  fetchTrending,
  fetchTopTraders,
  fetchKOLs,
  type TokenMetrics,
  type ScreeningResult,
  type TopTrader,
} from '../../data/token-screener.js';
import { chatCompletion, isLLMAvailable, type LLMMessage } from '../../data/llm.js';
import { createChildLogger } from '../../core/logger.js';

const log = createChildLogger('chat');

// ─── Intent detection (regex fast-path, LLM fallback) ────────────────

type Intent =
  | 'buy' | 'sell' | 'long' | 'short'
  | 'confirm_buy' | 'confirm_sell'
  | 'limit_order'
  | 'screen' | 'analyze'
  | 'snipe' | 'dca'
  | 'positions' | 'pnl' | 'portfolio'
  | 'close' | 'exit'
  | 'trending' | 'hot'
  | 'leaderboard' | 'kol' | 'copy_trade'
  | 'help' | 'price' | 'unknown';

const ALL_TOKENS = /\b(sol|bonk|eth|wif|pepe|jup|aero|brett|btc|degen|toshi|fartcoin|popcat|myro|giga|mew|bome|mog|wen|arb|gmx|pendle|pol|aave|bnb|op|avax|shib|link|uni|sui|apt)\b/i;
const SOLANA_ADDR = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const EVM_ADDR = /\b0x[a-fA-F0-9]{40}\b/;

function detectIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (t.includes('confirm buy') || t.includes('confirm purchase') || (t.includes('confirm') && t.includes('buy'))) return 'confirm_buy';
  if (t.includes('confirm sell')) return 'confirm_sell';

  // Conditional / limit orders — must match BEFORE bare "sell"/"buy"
  if (t.match(/\b(take.?profit|stop.?loss|limit.?(order|sell|buy)|set.*(sell|buy|order|limit|tp|sl)|trail)/))
    return 'limit_order';
  if ((t.includes('sell') || t.includes('buy')) && t.match(/\b(at|when|if|once|after).+(%|percent|price|hits?|reaches?)/))
    return 'limit_order';

  // KOL / leaderboard / copy trade — before bare sell/buy to avoid false matches on "kol buys"
  if (t.match(/\b(kol|influencer|follow.*kol|kol.*buy|kol.*trad)/)) return 'kol';
  if (t.match(/\b(copy.?trad|follow.*wallet|mirror.*trad)/)) return 'copy_trade';
  if (t.match(/\b(leader|top.?trader|smart.?money|whales?|best.?trader)/)) return 'leaderboard';

  if (t.includes('screen') || t.includes('safe') || t.includes('rug') || t.includes('check')) return 'screen';
  if (t.includes('price') || t.match(/\b(how much|what.*(cost|worth))\b/)) return 'price';
  if (t.includes('snipe') || t.includes('new token') || t.includes('launch')) return 'snipe';
  if (t.includes('close') || t.includes('exit')) return 'close';
  if (t.includes('sell')) return 'sell';
  if (t.includes('buy') || t.includes('ape') || t.includes('grab')) return 'buy';
  if (t.includes('long') && !t.includes('how long')) return 'long';
  if (t.includes('short')) return 'short';
  if (t.includes('analyz') || t.includes('research') || t.includes('tell me about')) return 'analyze';
  if (t.includes('dca')) return 'dca';
  if (t.includes('position') || t.includes('holding')) return 'positions';
  if (t.includes('p&l') || t.includes('pnl') || t.includes('performance')) return 'pnl';
  if (t.includes('portfolio') || t.includes('balance') || t.includes('wallet')) return 'portfolio';
  if (t.includes('trend') || t.includes('hot') || t.includes('recommend') || t.includes('suggest') || t.includes('top') || t.includes('popular')) return 'trending';
  if (t.includes('help') || t.includes('what can')) return 'help';
  return 'unknown';
}

function extractToken(text: string): string | null {
  const match = text.match(ALL_TOKENS);
  return match ? match[1].toUpperCase() : null;
}

function extractContractAddress(text: string): string | null {
  const evmMatch = text.match(EVM_ADDR);
  if (evmMatch) return evmMatch[0];
  const solMatch = text.match(SOLANA_ADDR);
  if (solMatch && solMatch[0].length >= 32) return solMatch[0];
  return null;
}

function extractAmount(text: string): number {
  const match = text.match(/\$\s*([\d,]+(?:\.\d+)?)/);
  if (match) return parseFloat(match[1].replace(/,/g, ''));
  const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:dollars?|usd|bucks)/i);
  if (numMatch) return parseFloat(numMatch[1]);
  return 200;
}

function formatUsd(n: number | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatPrice(p: number): string {
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(8)}`;
}

// ─── Response types ───────────────────────────────────────────────────

interface ChatResponse {
  text: string;
  intent: string;
  cards: ChatCard[];
  suggestions: string[];
  token?: string;
}

type ChatCard =
  | { type: 'screening'; data: ScreeningResult }
  | { type: 'token_price'; data: TokenMetrics }
  | { type: 'trending'; data: TokenMetrics[] }
  | { type: 'trade_preview'; data: { symbol: string; amount: number; price: number; chain: string } }
  | { type: 'portfolio'; data: { positions: any[]; totalInvested: number; totalSold: number } };

// ─── LLM-powered response generation ─────────────────────────────────

const SYSTEM_PROMPT = `You are an AI trading agent for CoinDCX's Web3 platform. You help users discover, screen, trade tokens, and manage their portfolio.

You speak in a concise, knowledgeable tone — like a smart degen friend who also understands risk.

Capabilities:
- Screen tokens for safety (rug checks, audit: mint authority, freeze, LP burn, top holders, insiders)
- Show trending/hot tokens with real-time data
- Execute buys and sells (dry-run mode)
- Show portfolio positions and P&L
- Analyze tokens with full security audit data

Rules:
- Keep responses SHORT (2-4 sentences max)
- Use simple language, avoid jargon unless the user uses it first
- Always mention key numbers: price, 24h change, volume, safety score
- When showing audit data, highlight: NoMint, NoFreeze, LP Burn %, Top 10 holder %, insiders
- If a token looks risky, warn clearly but don't be preachy
- Use bold (**text**) for token names and key figures
- Never make up data — only reference what's provided in the context
- When user asks about portfolio, reference their actual positions
- If user wants to sell, check if they hold that token first`;

async function generateLLMResponse(
  userMessage: string,
  context: string,
  conversationHistory: LLMMessage[],
): Promise<string> {
  if (!isLLMAvailable()) return context;

  try {
    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-6),
      {
        role: 'user',
        content: `User asked: "${userMessage}"\n\nHere is the data I fetched:\n${context}\n\nRespond naturally to the user based on this data. Be concise.`,
      },
    ];

    const response = await chatCompletion(messages, { temperature: 0.7, maxTokens: 512 });
    return response || context;
  } catch (err) {
    log.warn({ err }, 'LLM generation failed, falling back to template');
    return context;
  }
}

// ─── Data formatters for LLM context ─────────────────────────────────

function screeningToContext(result: ScreeningResult): string {
  const t = result.token;
  let ctx = `Token: ${t.symbol} (${t.chain})
Price: ${formatPrice(t.price)} | 24h change: ${t.priceChange24h > 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}%
Volume 24h: ${formatUsd(t.volume24h)} | Liquidity: ${formatUsd(t.liquidity)}
Market Cap: ${formatUsd(t.marketCap)}
Safety Score: ${t.rugScore}/100 | Grade: ${result.grade}
${result.passed ? 'PASSED safety checks' : 'FAILED safety checks'}
Recommendation: ${result.recommendation}
Reasons: ${result.reasons.join(', ')}`;

  if (result.audit) {
    const a = result.audit;
    ctx += `\n\nToken Audit:
NoMint: ${a.noMint ? 'YES (safe)' : 'NO (can mint more)'}
NoFreeze: ${a.noFreeze ? 'YES (safe)' : 'NO (can freeze wallets)'}
LP Burnt: ${a.burnt}%
Top 10 Holders: ${a.top10HolderPct.toFixed(1)}%
Insiders Detected: ${a.insidersDetected}
Holders: ${a.totalHolders}
Total Liquidity: ${formatUsd(a.totalLiquidity)}
LP Locked: ${a.lpLockedPct.toFixed(1)}%
Rugged: ${a.rugged ? 'YES (DANGER)' : 'No'}`;
    if (a.deployPlatform) ctx += `\nPlatform: ${a.deployPlatform}`;
    if (a.risks.length > 0) ctx += `\nRisks: ${a.risks.map((r: any) => r.name).join(', ')}`;
  }

  return ctx;
}

function tokenToContext(m: TokenMetrics): string {
  return `Token: ${m.symbol} (${m.chain})
Price: ${formatPrice(m.price)} | 24h: ${m.priceChange24h > 0 ? '+' : ''}${m.priceChange24h.toFixed(1)}%
Volume: ${formatUsd(m.volume24h)} | Liquidity: ${formatUsd(m.liquidity)}
Market Cap: ${formatUsd(m.marketCap)}`;
}

function trendingToContext(tokens: TokenMetrics[]): string {
  return `Trending tokens:\n${tokens.slice(0, 8).map((t, i) =>
    `${i + 1}. ${t.symbol} (${t.chain}): ${formatPrice(t.price)} | 24h: ${t.priceChange24h > 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}% | Vol: ${formatUsd(t.volume24h)} | MCap: ${formatUsd(t.marketCap)}`
  ).join('\n')}`;
}

// ─── Handlers ─────────────────────────────────────────────────────────

async function handleScreen(token: string, userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const result = await screenBySymbol(token);
  if (!result) {
    return {
      text: `Could not find token "${token}". Try a different symbol or paste a contract address.`,
      intent: 'screen', cards: [], suggestions: ['screen SOL', 'screen ETH', 'trending'],
    };
  }

  const context = screeningToContext(result);
  const text = await generateLLMResponse(userMsg, context, history);

  return {
    text, intent: 'screen',
    cards: [{ type: 'screening', data: result }],
    suggestions: result.passed
      ? [`buy ${result.token.symbol} $200`, `analyze ${result.token.symbol}`, `dca ${result.token.symbol}`]
      : [`analyze ${result.token.symbol}`, 'trending'],
    token: result.token.symbol,
  };
}

async function handleScreenAddress(address: string, userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const result = await screenByAddress(address);
  if (!result) {
    return {
      text: 'Could not screen this contract address. It may not be listed on any DEX yet.',
      intent: 'screen', cards: [], suggestions: ['trending', 'help'],
    };
  }
  const context = screeningToContext(result);
  const text = await generateLLMResponse(userMsg, context, history);

  return {
    text, intent: 'screen',
    cards: [{ type: 'screening', data: result }],
    suggestions: result.passed ? [`buy ${result.token.symbol} $200`, `analyze ${result.token.symbol}`] : ['trending'],
    token: result.token.symbol,
  };
}

async function handlePrice(token: string, userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const metrics = await getTokenBySymbol(token);
  if (!metrics) {
    return {
      text: `Could not find price for "${token}".`,
      intent: 'price', cards: [], suggestions: ['sol price', 'eth price', 'trending'],
    };
  }
  const context = tokenToContext(metrics);
  const text = await generateLLMResponse(userMsg, context, history);

  return {
    text, intent: 'price',
    cards: [{ type: 'token_price', data: metrics }],
    suggestions: [`screen ${metrics.symbol}`, `buy ${metrics.symbol} $200`, `analyze ${metrics.symbol}`],
    token: metrics.symbol,
  };
}

async function handleAnalyze(token: string, userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const metrics = await getTokenBySymbol(token);
  if (!metrics) {
    return { text: `Token "${token}" not found.`, intent: 'analyze', cards: [], suggestions: ['trending'] };
  }

  const screening = await screenBySymbol(token);
  let context = tokenToContext(metrics);
  if (screening) context += `\n${screeningToContext(screening)}`;

  const text = await generateLLMResponse(userMsg, context, history);

  const cards: ChatCard[] = [{ type: 'token_price', data: metrics }];
  if (screening) cards.push({ type: 'screening', data: screening });

  return {
    text, intent: 'analyze', cards,
    suggestions: [`buy ${metrics.symbol} $200`, `screen ${metrics.symbol}`, `dca ${metrics.symbol}`],
    token: metrics.symbol,
  };
}

async function handleBuy(token: string, userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const amount = extractAmount(userMsg);
  const metrics = await getTokenBySymbol(token);
  if (!metrics) {
    return { text: `Token "${token}" not found.`, intent: 'buy', cards: [], suggestions: ['trending'] };
  }

  const screening = await screenBySymbol(token);
  if (screening && !screening.passed && screening.grade !== 'C') {
    const context = `User wants to buy ${token} but it FAILED safety screening.\nGrade: ${screening.grade}\nReasons: ${screening.reasons.join(', ')}`;
    const text = await generateLLMResponse(userMsg, context, history);
    return {
      text, intent: 'buy',
      cards: screening ? [{ type: 'screening', data: screening }] : [],
      suggestions: [`screen ${token}`, 'trending'],
      token,
    };
  }

  const context = `Trade preview: Buy $${amount} of ${token} at ${formatPrice(metrics.price)} on ${metrics.chain}.\nSafety grade: ${screening?.grade ?? 'unknown'}`;
  const text = await generateLLMResponse(userMsg, context, history);

  return {
    text, intent: 'buy',
    cards: [{ type: 'trade_preview', data: { symbol: token, amount, price: metrics.price, chain: metrics.chain as string } }],
    suggestions: [`confirm buy ${token} ${formatUsd(amount)}`, 'cancel', `screen ${token}`],
    token,
  };
}

async function handleConfirmBuy(token: string, userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const amount = extractAmount(userMsg);
  const metrics = await getTokenBySymbol(token);
  if (!metrics) {
    return { text: `Token "${token}" not found.`, intent: 'confirm_buy', cards: [], suggestions: ['trending'] };
  }

  // Execute the trade via the trade endpoint logic (in-process)
  try {
    const tradeRes = await fetch(`http://localhost:${process.env.PORT ?? 3000}/api/v1/trade/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: token, side: 'buy', amountUsd: amount }),
    });
    const tradeData = await tradeRes.json() as any;

    if (!tradeRes.ok) {
      return {
        text: `Trade failed: ${tradeData.error ?? 'Unknown error'}`,
        intent: 'confirm_buy', cards: [], suggestions: ['trending', `screen ${token}`],
      };
    }

    const context = `Trade EXECUTED successfully.\nBought $${amount} of ${token} at ${formatPrice(metrics.price)} on ${metrics.chain}.\nTrade ID: ${tradeData.trade?.id}\nStatus: ${tradeData.trade?.status}\nQuantity: ${tradeData.trade?.quantity?.toFixed(6)} ${token}`;
    const text = await generateLLMResponse(userMsg, context, history);

    return {
      text, intent: 'confirm_buy',
      cards: [{ type: 'trade_executed', data: tradeData.trade } as any],
      suggestions: ['portfolio', `screen ${token}`, 'trending'],
      token,
    };
  } catch (err) {
    return {
      text: `Could not execute trade. Backend might be unavailable.`,
      intent: 'confirm_buy', cards: [], suggestions: ['trending'],
    };
  }
}

async function handleSell(token: string, userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const amount = extractAmount(userMsg);
  const metrics = await getTokenBySymbol(token);
  if (!metrics) {
    return { text: `Token "${token}" not found.`, intent: 'sell', cards: [], suggestions: ['portfolio', 'trending'] };
  }

  try {
    const tradeRes = await fetch(`http://localhost:${process.env.PORT ?? 3000}/api/v1/trade/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: token, side: 'sell', amountUsd: amount }),
    });
    const tradeData = await tradeRes.json() as any;

    if (!tradeRes.ok) {
      return {
        text: `Sell failed: ${tradeData.error ?? 'Unknown error'}`,
        intent: 'sell', cards: [], suggestions: ['portfolio'],
      };
    }

    const context = `Sell EXECUTED.\nSold $${amount} of ${token} at ${formatPrice(metrics.price)} on ${metrics.chain}.\nTrade ID: ${tradeData.trade?.id}\nStatus: ${tradeData.trade?.status}`;
    const text = await generateLLMResponse(userMsg, context, history);

    return {
      text, intent: 'sell',
      cards: [{ type: 'trade_executed', data: tradeData.trade } as any],
      suggestions: ['portfolio', 'trending'],
      token,
    };
  } catch {
    return { text: 'Could not execute sell. Try again.', intent: 'sell', cards: [], suggestions: ['portfolio'] };
  }
}

async function fetchPortfolio(): Promise<{ positions: any[]; totalInvested: number; totalSold: number }> {
  try {
    const res = await fetch(`http://localhost:${process.env.PORT ?? 3000}/api/v1/trade/portfolio`);
    if (!res.ok) return { positions: [], totalInvested: 0, totalSold: 0 };
    const data = await res.json() as any;
    return {
      positions: data.positions ?? [],
      totalInvested: data.totalInvested ?? 0,
      totalSold: data.totalSold ?? 0,
    };
  } catch { return { positions: [], totalInvested: 0, totalSold: 0 }; }
}

function portfolioToContext(portfolio: { positions: any[]; totalInvested: number; totalSold: number }): string {
  if (portfolio.positions.length === 0) return 'Portfolio is empty. No positions yet.';

  const buys = portfolio.positions.filter((p: any) => p.side === 'buy');
  const sells = portfolio.positions.filter((p: any) => p.side === 'sell');

  let ctx = `Portfolio Summary:
Total Invested: ${formatUsd(portfolio.totalInvested)}
Total Sold: ${formatUsd(portfolio.totalSold)}
Open Positions: ${buys.length} buys, ${sells.length} sells

Holdings:`;

  for (const p of buys) {
    ctx += `\n- ${p.symbol}: ${p.amount?.toFixed(4)} tokens @ ${formatPrice(p.price)} ($${((p.amount ?? 0) * p.price).toFixed(2)} value)`;
  }

  return ctx;
}

async function handlePortfolio(userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const portfolio = await fetchPortfolio();

  if (portfolio.positions.length === 0) {
    const text = await generateLLMResponse(userMsg, 'Portfolio is empty. User has no positions yet.', history);
    return {
      text, intent: 'portfolio',
      cards: [],
      suggestions: ['trending', 'buy SOL $200', 'screen ETH'],
    };
  }

  const context = portfolioToContext(portfolio);
  const text = await generateLLMResponse(userMsg, context, history);

  const holdingSymbols = [...new Set(portfolio.positions.filter((p: any) => p.side === 'buy').map((p: any) => p.symbol))];

  return {
    text, intent: 'portfolio',
    cards: [{ type: 'portfolio', data: portfolio }],
    suggestions: [
      ...holdingSymbols.slice(0, 2).map((s: string) => `sell ${s}`),
      'trending',
    ],
  };
}

async function handleSellFromPortfolio(token: string, userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const portfolio = await fetchPortfolio();
  const held = portfolio.positions.filter((p: any) => p.side === 'buy' && p.symbol.toUpperCase() === token.toUpperCase());

  if (held.length === 0) {
    const context = `User wants to sell ${token} but does NOT hold any ${token} in their portfolio. Their holdings: ${portfolio.positions.filter((p: any) => p.side === 'buy').map((p: any) => p.symbol).join(', ') || 'empty'}`;
    const text = await generateLLMResponse(userMsg, context, history);
    return {
      text, intent: 'sell', cards: [], suggestions: ['portfolio', 'trending'],
    };
  }

  return handleSell(token, userMsg, history);
}

async function handleLimitOrder(token: string | null, userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const context = `User wants to set a conditional/limit order (take-profit, stop-loss, or limit sell/buy)${token ? ` for ${token}` : ''}.

IMPORTANT: Limit orders, take-profit, and stop-loss are NOT yet supported in this version. Tell the user:
1. You understand what they want (acknowledge the specific order type)
2. This feature is coming soon — currently only market buys and sells are available
3. Offer to execute a market sell now instead if they want to take profit immediately
4. Or offer to set a price alert (manual check) as a workaround`;

  const text = await generateLLMResponse(userMsg, context, history);

  const suggestions: string[] = [];
  if (token) {
    suggestions.push(`sell ${token}`, `${token} price`);
  }
  suggestions.push('portfolio');

  return { text, intent: 'limit_order', cards: [], suggestions, token: token ?? undefined };
}

async function handleLeaderboard(userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const traders = await fetchTopTraders('7d', 'pnl_7d');
  if (traders.length === 0) {
    return { text: 'Could not load the leaderboard right now. Try again shortly.', intent: 'leaderboard', cards: [], suggestions: ['trending'] };
  }

  const top = traders.slice(0, 10);
  const context = `Top 10 Solana traders (7d) from GMGN leaderboard:\n` +
    top.map((t, i) => {
      const addr = t.walletAddress;
      const label = t.name || t.twitterUsername || `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      return `${i + 1}. ${label} — PnL $${t.realizedProfit7d.toLocaleString(undefined, { maximumFractionDigits: 0 })} | WR ${(t.winRate7d * 100).toFixed(0)}% | ${t.buys7d}B/${t.sells7d}S | Tags: ${t.tags.join(',')}`;
    }).join('\n');

  const text = await generateLLMResponse(userMsg, context, history);

  return {
    text,
    intent: 'leaderboard',
    cards: [{
      type: 'leaderboard',
      data: {
        traders: top.map((t, i) => ({
          rank: i + 1,
          walletAddress: t.walletAddress,
          name: t.name || t.twitterUsername || '',
          twitterUsername: t.twitterUsername,
          tags: t.tags,
          avatar: t.avatar,
          pnl7d: t.realizedProfit7d,
          winRate7d: t.winRate7d,
          buys7d: t.buys7d,
          sells7d: t.sells7d,
          volume7d: t.volume7d,
          trades5xPlus: t.trades5xPlus,
          trades2x5x: t.trades2x5x,
        })),
      },
    }],
    suggestions: ['copy trade #1', 'top traders 30d', 'trending'],
  };
}

async function handleKOL(userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const kols = await fetchKOLs();
  if (kols.length === 0) {
    return { text: 'Could not load KOL data right now. Try again shortly.', intent: 'kol', cards: [], suggestions: ['leaderboard'] };
  }

  const top = kols.slice(0, 10);
  const context = `Top KOLs (Key Opinion Leaders / crypto influencers) on Solana right now:\n` +
    top.map((t, i) => {
      const name = t.name || t.twitterUsername || `${t.walletAddress.slice(0, 6)}...`;
      return `${i + 1}. @${t.twitterUsername || '?'} (${name}) — PnL $${t.realizedProfit7d.toLocaleString(undefined, { maximumFractionDigits: 0 })} | WR ${(t.winRate7d * 100).toFixed(0)}% | ${t.buys7d} buys | 5x+ trades: ${t.trades5xPlus} | Tags: ${t.tags.join(',')}`;
    }).join('\n') +
    '\n\nUser can follow/copy-trade any KOL. Explain what each tag means if relevant (kol = verified influencer, smart_degen = high-risk/high-reward trader, top_followed = most tracked wallet).';

  const text = await generateLLMResponse(userMsg, context, history);

  return {
    text,
    intent: 'kol',
    cards: [{
      type: 'leaderboard',
      data: {
        title: 'KOL Wallets',
        traders: top.map((t, i) => ({
          rank: i + 1,
          walletAddress: t.walletAddress,
          name: t.name || t.twitterUsername || '',
          twitterUsername: t.twitterUsername,
          tags: t.tags,
          avatar: t.avatar,
          pnl7d: t.realizedProfit7d,
          winRate7d: t.winRate7d,
          buys7d: t.buys7d,
          sells7d: t.sells7d,
          volume7d: t.volume7d,
          trades5xPlus: t.trades5xPlus,
          trades2x5x: t.trades2x5x,
        })),
      },
    }],
    suggestions: ['copy trade #1', 'leaderboard', 'trending'],
  };
}

async function handleCopyTrade(userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const context = `User wants to copy-trade a wallet. Copy trading lets them mirror another trader's buys/sells automatically.

Available options:
1. "copy trade #1" — Copy the #1 trader from the leaderboard
2. "copy trade <wallet address>" — Follow a specific wallet
3. Show them the leaderboard first if they haven't seen it

Note: Copy trading is in DRY_RUN mode — trades are simulated, not executed on-chain. Tell them this.`;

  const text = await generateLLMResponse(userMsg, context, history);

  return {
    text,
    intent: 'copy_trade',
    cards: [],
    suggestions: ['show leaderboard', 'portfolio', 'trending'],
  };
}

async function handleTrending(userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  const tokens = await fetchTrending();
  if (tokens.length === 0) {
    return { text: 'Could not fetch trending tokens right now. Try again in a moment.', intent: 'trending', cards: [], suggestions: ['screen SOL', 'screen ETH'] };
  }

  const context = trendingToContext(tokens);
  const text = await generateLLMResponse(userMsg, context, history);

  return {
    text, intent: 'trending',
    cards: [{ type: 'trending', data: tokens }],
    suggestions: tokens.slice(0, 3).map(t => `screen ${t.symbol}`),
  };
}

async function handleGeneralQuestion(userMsg: string, history: LLMMessage[]): Promise<ChatResponse> {
  if (!isLLMAvailable()) {
    return {
      text: 'I can help you discover and trade tokens. Try "trending", "screen SOL", or "buy ETH $200".',
      intent: 'unknown', cards: [], suggestions: ['trending', 'screen SOL', 'help'],
    };
  }

  const context = 'No specific token data was requested. The user asked a general question about crypto or the platform.';
  const text = await generateLLMResponse(userMsg, context, history);
  return { text, intent: 'unknown', cards: [], suggestions: ['trending', 'screen SOL', 'help'] };
}

function handleHelp(): ChatResponse {
  return {
    text: `Here's what I can do:\n\n• **"screen SOL"** — Full safety audit (mint, freeze, LP, holders, insiders)\n• **"buy ETH $200"** — Buy a token\n• **"sell BONK"** — Sell from your portfolio\n• **"portfolio"** — View your holdings and P&L\n• **"analyze PEPE"** — Deep analysis with audit data\n• **"trending"** — See what's hot right now\n• **"SOL price"** — Quick price check\n• Paste any contract address to auto-screen it\n\nI know what's in your wallet — ask me anything!`,
    intent: 'help', cards: [],
    suggestions: ['portfolio', 'trending', 'screen SOL'],
  };
}

// ─── Conversation memory (in-memory per session) ─────────────────────

const conversations = new Map<string, LLMMessage[]>();
let lastToken: string | null = null;

// ─── Main chat processor ─────────────────────────────────────────────

export async function processChat(message: string, conversationId?: string): Promise<ChatResponse> {
  const convId = conversationId ?? 'default';
  if (!conversations.has(convId)) conversations.set(convId, []);
  const history = conversations.get(convId)!;

  const intent = detectIntent(message);
  const token = extractToken(message) ?? lastToken;
  const contractAddress = extractContractAddress(message);

  history.push({ role: 'user', content: message });

  let resp: ChatResponse;

  if (contractAddress) {
    resp = await handleScreenAddress(contractAddress, message, history);
  } else {
    switch (intent) {
      case 'confirm_buy':
      case 'confirm_sell':
        resp = token
          ? await handleConfirmBuy(token, message, history)
          : { text: 'Which token? Try "confirm buy SOL $200".', intent: 'confirm_buy', cards: [], suggestions: ['buy SOL $200'] };
        break;
      case 'screen':
        resp = token
          ? await handleScreen(token, message, history)
          : { text: 'Which token do you want me to check? Try "screen SOL" or paste a contract address.', intent: 'screen', cards: [], suggestions: ['screen SOL', 'screen ETH', 'screen PEPE'] };
        break;
      case 'price':
        resp = token
          ? await handlePrice(token, message, history)
          : { text: 'Which token? Try "SOL price" or "ETH price".', intent: 'price', cards: [], suggestions: ['sol price', 'eth price'] };
        break;
      case 'buy':
        resp = token
          ? await handleBuy(token, message, history)
          : { text: 'Which token do you want to buy? Try "buy SOL $200".', intent: 'buy', cards: [], suggestions: ['buy SOL $200', 'buy ETH $500'] };
        break;
      case 'sell':
        resp = token
          ? await handleSellFromPortfolio(token, message, history)
          : { text: 'Which token do you want to sell? Try "sell SOL $100" or check your **portfolio** first.', intent: 'sell', cards: [], suggestions: ['portfolio', 'sell SOL $100'] };
        break;
      case 'limit_order':
        resp = await handleLimitOrder(token, message, history);
        break;
      case 'analyze':
        resp = token
          ? await handleAnalyze(token, message, history)
          : { text: 'Which token should I analyze? Try "analyze SOL".', intent: 'analyze', cards: [], suggestions: ['analyze SOL', 'analyze ETH'] };
        break;
      case 'positions':
      case 'pnl':
      case 'portfolio':
        resp = await handlePortfolio(message, history);
        break;
      case 'trending':
      case 'hot':
        resp = await handleTrending(message, history);
        break;
      case 'leaderboard':
        resp = await handleLeaderboard(message, history);
        break;
      case 'kol':
        resp = await handleKOL(message, history);
        break;
      case 'copy_trade':
        resp = await handleCopyTrade(message, history);
        break;
      case 'help':
        resp = handleHelp();
        break;
      case 'unknown':
      default:
        if (token) {
          resp = await handleAnalyze(token, message, history);
        } else {
          resp = await handleGeneralQuestion(message, history);
        }
    }
  }

  if (resp.token) lastToken = resp.token;
  history.push({ role: 'assistant', content: resp.text });

  // Keep history bounded
  if (history.length > 20) {
    conversations.set(convId, history.slice(-12));
  }

  return resp;
}

// ─── Route ────────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {
  app.post<{
    Body: { message: string; conversationId?: string };
  }>('/api/v1/chat', async (request, reply) => {
    const { message, conversationId } = request.body ?? {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      reply.code(400).send({ error: 'message is required' });
      return;
    }
    if (message.length > 10_000) {
      reply.code(400).send({ error: 'Message too long (max 10000 chars)' });
      return;
    }

    const response = await processChat(message.trim(), conversationId);
    return response;
  });
}
