import type { FastifyInstance } from 'fastify';
import {
  screenBySymbol,
  screenByAddress,
  getTokenBySymbol,
  fetchTrending,
  type TokenMetrics,
  type ScreeningResult,
} from '../../data/token-screener.js';
import { chatCompletion, isLLMAvailable, type LLMMessage } from '../../data/llm.js';
import { createChildLogger } from '../../core/logger.js';

const log = createChildLogger('chat');

// ─── Intent detection (regex fast-path, LLM fallback) ────────────────

type Intent =
  | 'buy' | 'sell' | 'long' | 'short'
  | 'confirm_buy' | 'confirm_sell'
  | 'screen' | 'analyze'
  | 'snipe' | 'dca'
  | 'positions' | 'pnl' | 'portfolio'
  | 'close' | 'exit'
  | 'trending' | 'hot'
  | 'help' | 'price' | 'unknown';

const ALL_TOKENS = /\b(sol|bonk|eth|wif|pepe|jup|aero|brett|btc|degen|toshi|fartcoin|popcat|myro|giga|mew|bome|mog|wen|arb|gmx|pendle|pol|aave|bnb|op|avax|shib|link|uni|sui|apt)\b/i;
const SOLANA_ADDR = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;
const EVM_ADDR = /\b0x[a-fA-F0-9]{40}\b/;

function detectIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (t.includes('confirm buy') || t.includes('confirm purchase') || (t.includes('confirm') && t.includes('buy'))) return 'confirm_buy';
  if (t.includes('confirm sell')) return 'confirm_sell';
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
  if (t.includes('p&l') || t.includes('pnl') || t.includes('profit') || t.includes('performance')) return 'pnl';
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
  | { type: 'trade_preview'; data: { symbol: string; amount: number; price: number; chain: string } };

// ─── LLM-powered response generation ─────────────────────────────────

const SYSTEM_PROMPT = `You are a crypto trading assistant for CoinDCX's Web3 platform. You help users discover, screen, and trade tokens.

You speak in a concise, knowledgeable tone — like a smart degen friend who also understands risk.

Rules:
- Keep responses SHORT (2-4 sentences max)
- Use simple language, avoid jargon unless the user uses it first
- Always mention key numbers: price, 24h change, volume, safety score
- If a token looks risky, warn clearly but don't be preachy
- Use bold (**text**) for token names and key figures
- Never make up data — only reference what's provided in the context
- Don't use emojis excessively, 1-2 max per message`;

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
  return `Token: ${t.symbol} (${t.chain})
Price: ${formatPrice(t.price)} | 24h change: ${t.priceChange24h > 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}%
Volume 24h: ${formatUsd(t.volume24h)} | Liquidity: ${formatUsd(t.liquidity)}
Market Cap: ${formatUsd(t.marketCap)}
Safety Score: ${t.rugScore}/100 | Grade: ${result.grade}
${result.passed ? 'PASSED safety checks' : 'FAILED safety checks'}
Recommendation: ${result.recommendation}
Reasons: ${result.reasons.join(', ')}`;
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
    text: `Here's what I can do:\n\n• **"screen SOL"** — Safety and rug check\n• **"buy ETH $200"** — Buy a token\n• **"analyze PEPE"** — Full analysis with safety score\n• **"trending"** — See what's hot right now\n• **"SOL price"** — Quick price check\n• Paste any contract address to screen it\n\nOr just ask me anything about crypto!`,
    intent: 'help', cards: [],
    suggestions: ['screen SOL', 'trending', 'buy ETH $200'],
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
      case 'analyze':
        resp = token
          ? await handleAnalyze(token, message, history)
          : { text: 'Which token should I analyze? Try "analyze SOL".', intent: 'analyze', cards: [], suggestions: ['analyze SOL', 'analyze ETH'] };
        break;
      case 'trending':
      case 'hot':
        resp = await handleTrending(message, history);
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
