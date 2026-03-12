import type { FastifyInstance } from 'fastify';
import {
  screenBySymbol,
  screenByAddress,
  getTokenBySymbol,
  fetchTrending,
  type TokenMetrics,
  type ScreeningResult,
} from '../../data/token-screener.js';

// ─── Intent detection (ported from dashboard chatEngine) ──────────────

type Intent =
  | 'buy' | 'sell' | 'long' | 'short'
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
  if (t.includes('trend') || t.includes('hot') || t.includes('recommend') || t.includes('suggest')) return 'trending';
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

function formatUsd(n: number): string {
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

// ─── Handlers ─────────────────────────────────────────────────────────

async function handleScreen(token: string): Promise<ChatResponse> {
  const result = await screenBySymbol(token);
  if (!result) {
    return {
      text: `Could not find token "${token}". Try a different symbol or paste a contract address.`,
      intent: 'screen', cards: [], suggestions: ['screen SOL', 'screen ETH', 'trending'],
    };
  }

  const t = result.token;
  let text = `**${t.symbol}** (${t.chain}) — Grade ${result.grade}\n`;
  text += `Price: ${formatPrice(t.price)} | 24h: ${t.priceChange24h > 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}%\n`;
  text += `Volume: ${formatUsd(t.volume24h)} | Liquidity: ${formatUsd(t.liquidity)}\n`;
  text += `Safety: ${t.rugScore}/100 | ${result.recommendation}`;

  return {
    text, intent: 'screen',
    cards: [{ type: 'screening', data: result }],
    suggestions: result.passed
      ? [`buy ${t.symbol} $200`, `analyze ${t.symbol}`, `dca ${t.symbol}`]
      : [`analyze ${t.symbol}`, 'trending'],
    token: t.symbol,
  };
}

async function handleScreenAddress(address: string): Promise<ChatResponse> {
  const result = await screenByAddress(address);
  if (!result) {
    return {
      text: 'Could not screen this contract address. It may not be listed on any DEX yet.',
      intent: 'screen', cards: [], suggestions: ['trending', 'help'],
    };
  }
  const t = result.token;
  return {
    text: `**${t.symbol}** (${t.chain}) — Grade ${result.grade}\nPrice: ${formatPrice(t.price)} | Safety: ${t.rugScore}/100\n${result.recommendation}`,
    intent: 'screen',
    cards: [{ type: 'screening', data: result }],
    suggestions: result.passed ? [`buy ${t.symbol} $200`, `analyze ${t.symbol}`] : ['trending'],
    token: t.symbol,
  };
}

async function handlePrice(token: string): Promise<ChatResponse> {
  const metrics = await getTokenBySymbol(token);
  if (!metrics) {
    return {
      text: `Could not find price for "${token}".`,
      intent: 'price', cards: [], suggestions: ['sol price', 'eth price', 'trending'],
    };
  }
  return {
    text: `**${metrics.symbol}**: ${formatPrice(metrics.price)}\n24h: ${metrics.priceChange24h > 0 ? '+' : ''}${metrics.priceChange24h.toFixed(1)}% | Vol: ${formatUsd(metrics.volume24h)}`,
    intent: 'price',
    cards: [{ type: 'token_price', data: metrics }],
    suggestions: [`screen ${metrics.symbol}`, `buy ${metrics.symbol} $200`, `analyze ${metrics.symbol}`],
    token: metrics.symbol,
  };
}

async function handleAnalyze(token: string): Promise<ChatResponse> {
  const metrics = await getTokenBySymbol(token);
  if (!metrics) {
    return { text: `Token "${token}" not found.`, intent: 'analyze', cards: [], suggestions: ['trending'] };
  }

  const screening = await screenBySymbol(token);
  let text = `**${metrics.symbol}** Analysis\n`;
  text += `Price: ${formatPrice(metrics.price)} | MCap: ${formatUsd(metrics.marketCap)}\n`;
  text += `24h: ${metrics.priceChange24h > 0 ? '+' : ''}${metrics.priceChange24h.toFixed(1)}% | Vol: ${formatUsd(metrics.volume24h)}\n`;
  text += `Liquidity: ${formatUsd(metrics.liquidity)} | Safety: ${metrics.rugScore}/100`;
  if (screening) text += `\nGrade: ${screening.grade} — ${screening.recommendation}`;

  const cards: ChatCard[] = [{ type: 'token_price', data: metrics }];
  if (screening) cards.push({ type: 'screening', data: screening });

  return {
    text, intent: 'analyze', cards,
    suggestions: [`buy ${metrics.symbol} $200`, `screen ${metrics.symbol}`, `dca ${metrics.symbol}`],
    token: metrics.symbol,
  };
}

async function handleBuy(token: string, text: string): Promise<ChatResponse> {
  const amount = extractAmount(text);
  const metrics = await getTokenBySymbol(token);
  if (!metrics) {
    return { text: `Token "${token}" not found.`, intent: 'buy', cards: [], suggestions: ['trending'] };
  }

  const screening = await screenBySymbol(token);
  if (screening && !screening.passed && screening.grade !== 'C') {
    return {
      text: `**Buy blocked**: ${token} failed safety screening (Grade ${screening.grade}).\n${screening.reasons.join(', ')}`,
      intent: 'buy',
      cards: screening ? [{ type: 'screening', data: screening }] : [],
      suggestions: [`screen ${token}`, `buy ${token} force`, 'trending'],
      token,
    };
  }

  return {
    text: `**Trade Preview**: Buy ${formatUsd(amount)} of ${token} at ${formatPrice(metrics.price)}\nChain: ${metrics.chain} | Safety: Grade ${screening?.grade ?? '?'}`,
    intent: 'buy',
    cards: [{ type: 'trade_preview', data: { symbol: token, amount, price: metrics.price, chain: metrics.chain as string } }],
    suggestions: [`confirm buy ${token} ${formatUsd(amount)}`, 'cancel', `screen ${token}`],
    token,
  };
}

async function handleTrending(): Promise<ChatResponse> {
  const tokens = await fetchTrending();
  if (tokens.length === 0) {
    return { text: 'Could not fetch trending tokens right now.', intent: 'trending', cards: [], suggestions: ['screen SOL', 'screen ETH'] };
  }

  let text = `**Trending Tokens**\n`;
  tokens.slice(0, 5).forEach(t => {
    text += `${t.symbol} (${t.chain}): ${formatPrice(t.price)} | 24h: ${t.priceChange24h > 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}%\n`;
  });

  return {
    text, intent: 'trending',
    cards: [{ type: 'trending', data: tokens }],
    suggestions: tokens.slice(0, 3).map(t => `screen ${t.symbol}`),
  };
}

function handleHelp(): ChatResponse {
  return {
    text: `**Available Commands**\n"screen SOL" — Safety check\n"buy ETH $200" — Buy token\n"analyze PEPE" — Full analysis\n"trending" — Hot tokens\n"sol price" — Quick price check\nOr paste any contract address to screen it.`,
    intent: 'help', cards: [],
    suggestions: ['screen SOL', 'trending', 'buy ETH $200'],
  };
}

// ─── Main chat processor ─────────────────────────────────────────────

let lastToken: string | null = null;

export async function processChat(message: string): Promise<ChatResponse> {
  const intent = detectIntent(message);
  const token = extractToken(message) ?? lastToken;
  const contractAddress = extractContractAddress(message);

  if (contractAddress) {
    const resp = await handleScreenAddress(contractAddress);
    if (resp.token) lastToken = resp.token;
    return resp;
  }

  let resp: ChatResponse;

  switch (intent) {
    case 'screen':
      resp = token ? await handleScreen(token) : { text: 'Which token? Say "screen SOL" or paste a contract address.', intent: 'screen', cards: [], suggestions: ['screen SOL', 'screen ETH', 'screen PEPE'] };
      break;
    case 'price':
    case 'unknown':
      if (token) {
        resp = intent === 'price' ? await handlePrice(token) : await handleAnalyze(token);
      } else {
        resp = { text: 'I can help you discover and trade tokens. Try "trending", "screen SOL", or "buy ETH $200".', intent: 'unknown', cards: [], suggestions: ['trending', 'screen SOL', 'help'] };
      }
      break;
    case 'buy':
      resp = token ? await handleBuy(token, message) : { text: 'Which token? Say "buy SOL $200".', intent: 'buy', cards: [], suggestions: ['buy SOL $200', 'buy ETH $500'] };
      break;
    case 'analyze':
      resp = token ? await handleAnalyze(token) : { text: 'Which token? Say "analyze SOL".', intent: 'analyze', cards: [], suggestions: ['analyze SOL', 'analyze ETH'] };
      break;
    case 'trending':
    case 'hot':
      resp = await handleTrending();
      break;
    case 'help':
      resp = handleHelp();
      break;
    default:
      resp = token
        ? await handleAnalyze(token)
        : { text: 'Try "trending", "screen SOL", or "help" to see all commands.', intent: 'unknown', cards: [], suggestions: ['trending', 'screen SOL', 'help'] };
  }

  if (resp.token) lastToken = resp.token;
  return resp;
}

// ─── Route ────────────────────────────────────────────────────────────

export async function chatRoutes(app: FastifyInstance) {
  app.post<{
    Body: { message: string; conversationId?: string };
  }>('/api/v1/chat', async (request, reply) => {
    const { message } = request.body ?? {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      reply.code(400).send({ error: 'message is required' });
      return;
    }
    if (message.length > 10_000) {
      reply.code(400).send({ error: 'Message too long (max 10000 chars)' });
      return;
    }

    const response = await processChat(message.trim());
    return response;
  });
}
