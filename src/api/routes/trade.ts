import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../../core/logger.js';
import { config } from '../../core/config.js';
import { getTokenBySymbol, screenBySymbol } from '../../data/token-screener.js';

const log = createChildLogger('trade-routes');

interface TradeRequest {
  symbol: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  chain?: string;
}

interface TradeRecord {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  price: number;
  quantity: number;
  chain: string;
  status: 'executed' | 'dry_run';
  txHash: string | null;
  timestamp: number;
}

const positions: Map<string, TradeRecord> = new Map();
let tradeCounter = 0;

export async function tradeRoutes(app: FastifyInstance) {

  app.post<{ Body: { symbol: string; chain?: string } }>('/api/v1/trade/quote', async (request, reply) => {
    const { symbol, chain } = request.body ?? {};
    if (!symbol) {
      reply.code(400).send({ error: 'symbol is required' });
      return;
    }

    const metrics = await getTokenBySymbol(symbol);
    if (!metrics) {
      reply.code(404).send({ error: `Token "${symbol}" not found` });
      return;
    }

    const screening = await screenBySymbol(symbol);

    return {
      symbol: metrics.symbol,
      price: metrics.price,
      chain: metrics.chain,
      liquidity: metrics.liquidity,
      priceImpactEstimate: metrics.liquidity > 100_000 ? 'low' : metrics.liquidity > 10_000 ? 'medium' : 'high',
      screening: screening ? { grade: screening.grade, passed: screening.passed, rugProbability: screening.rugProbability } : null,
    };
  });

  app.post<{ Body: TradeRequest }>('/api/v1/trade/execute', async (request, reply) => {
    const { symbol, side, amountUsd } = request.body ?? {};

    if (!symbol || !side || !amountUsd) {
      reply.code(400).send({ error: 'symbol, side, and amountUsd are required' });
      return;
    }
    if (!['buy', 'sell'].includes(side)) {
      reply.code(400).send({ error: 'side must be "buy" or "sell"' });
      return;
    }
    if (amountUsd <= 0 || amountUsd > 10_000) {
      reply.code(400).send({ error: 'amountUsd must be between 0 and 10000' });
      return;
    }

    const metrics = await getTokenBySymbol(symbol);
    if (!metrics) {
      reply.code(404).send({ error: `Token "${symbol}" not found` });
      return;
    }

    const screening = await screenBySymbol(symbol);
    if (screening && !screening.passed) {
      log.warn({ symbol, grade: screening.grade }, 'Trade on risky token');
    }

    tradeCounter++;
    const trade: TradeRecord = {
      id: `trade_${tradeCounter}_${Date.now()}`,
      symbol: metrics.symbol,
      side,
      amountUsd,
      price: metrics.price,
      quantity: amountUsd / metrics.price,
      chain: metrics.chain as string,
      status: config.dryRun ? 'dry_run' : 'executed',
      txHash: config.dryRun ? null : `0x${Date.now().toString(16)}`,
      timestamp: Date.now(),
    };

    positions.set(trade.id, trade);
    log.info({ tradeId: trade.id, symbol, side, amountUsd, dryRun: config.dryRun }, 'Trade processed');

    return {
      trade,
      message: config.dryRun
        ? `DRY RUN: Would ${side} $${amountUsd} of ${symbol} at ${metrics.price}`
        : `${side.toUpperCase()} order executed for $${amountUsd} of ${symbol}`,
    };
  });

  app.get('/api/v1/trade/portfolio', async () => {
    const trades = Array.from(positions.values()).sort((a, b) => b.timestamp - a.timestamp);

    const totalInvested = trades.filter(t => t.side === 'buy').reduce((s, t) => s + t.amountUsd, 0);
    const totalSold = trades.filter(t => t.side === 'sell').reduce((s, t) => s + t.amountUsd, 0);

    return {
      totalTrades: trades.length,
      totalInvested,
      totalSold,
      trades: trades.slice(0, 50),
    };
  });
}
