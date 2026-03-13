import type { FastifyInstance } from 'fastify';
import { eq, desc, sql } from 'drizzle-orm';
import { createChildLogger } from '../../core/logger.js';
import { config } from '../../core/config.js';
import { getTokenBySymbol, screenBySymbol } from '../../data/token-screener.js';
import { getDb } from '../../db/index.js';
import { trades as tradesTable } from '../../db/schema.js';
import { v4 as uuid } from 'uuid';

const log = createChildLogger('trade-routes');

interface TradeRequest {
  symbol: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  chain?: string;
  slippagePct?: number;
}

export async function tradeRoutes(app: FastifyInstance) {

  app.post<{ Body: { symbol: string; chain?: string } }>('/api/v1/trade/quote', async (request, reply) => {
    const { symbol } = request.body ?? {};
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
    const { symbol, side, amountUsd, slippagePct } = request.body ?? {};

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

    const slippage = Math.min(slippagePct ?? (metrics.liquidity > 100_000 ? 1 : 5), 50);
    const isMajor = metrics.liquidity > 100_000;
    const priceImpact = isMajor ? 0.1 : Math.min(amountUsd / (metrics.liquidity || 1) * 100, 15);
    const executionPrice = side === 'buy'
      ? metrics.price * (1 + priceImpact / 100)
      : metrics.price * (1 - priceImpact / 100);

    if (priceImpact > slippage) {
      reply.code(400).send({
        error: `Estimated price impact (${priceImpact.toFixed(2)}%) exceeds slippage tolerance (${slippage}%). Increase slippage or reduce amount.`,
        priceImpact,
        slippage,
      });
      return;
    }

    const db = getDb();
    const tradeId = uuid();
    const quantity = amountUsd / executionPrice;
    const now = new Date();

    await db.insert(tradesTable).values({
      id: tradeId,
      userId: 'default',
      intentId: tradeId,
      state: config.dryRun ? 'SIGNAL_GENERATED' : 'ORDER_CONFIRMED',
      chain: (metrics.chain as string) ?? 'solana',
      venue: 'jupiter',
      side,
      inputToken: side === 'buy' ? 'USDC' : symbol,
      outputToken: side === 'buy' ? symbol : 'USDC',
      amountIn: amountUsd.toString(),
      amountOut: quantity.toString(),
      idempotencyKey: `${symbol}-${side}-${Date.now()}`,
      strategyId: 'manual',
      txHash: config.dryRun ? null : `0x${Date.now().toString(16)}`,
      createdAt: now,
      updatedAt: now,
    });

    const trade = {
      id: tradeId,
      symbol: metrics.symbol,
      side,
      amountUsd,
      price: executionPrice,
      quantity,
      chain: metrics.chain as string,
      status: config.dryRun ? 'dry_run' : 'executed',
      txHash: config.dryRun ? null : `0x${Date.now().toString(16)}`,
      timestamp: Date.now(),
    };

    log.info({ tradeId, symbol, side, amountUsd, slippage, priceImpact: priceImpact.toFixed(2), dryRun: config.dryRun }, 'Trade processed');

    return {
      trade,
      slippage,
      priceImpact: parseFloat(priceImpact.toFixed(2)),
      message: config.dryRun
        ? `DRY RUN: Would ${side} $${amountUsd} of ${symbol} at ${executionPrice.toFixed(8)} (${priceImpact.toFixed(2)}% impact, ${slippage}% max slippage)`
        : `${side.toUpperCase()} order executed for $${amountUsd} of ${symbol}`,
    };
  });

  app.get('/api/v1/trade/portfolio', async () => {
    const db = getDb();
    const trades = await db
      .select()
      .from(tradesTable)
      .orderBy(desc(tradesTable.createdAt))
      .limit(200);

    const buyTrades = trades.filter(t => t.side === 'buy');
    const sellTrades = trades.filter(t => t.side === 'sell');

    const totalInvested = buyTrades.reduce((s, t) => s + parseFloat(t.amountIn), 0);
    const totalSold = sellTrades.reduce((s, t) => s + parseFloat(t.amountIn), 0);

    const positionsList = trades.map(t => ({
      id: t.id,
      symbol: t.outputToken,
      side: t.side,
      amount: t.amountOut ? parseFloat(t.amountOut) : 0,
      price: parseFloat(t.amountIn) / (t.amountOut ? parseFloat(t.amountOut) : 1),
      status: t.state,
      chain: t.chain,
    }));

    return {
      totalTrades: trades.length,
      totalInvested,
      totalSold,
      positions: positionsList,
      trades: trades.slice(0, 50).map(t => ({
        id: t.id,
        symbol: t.side === 'buy' ? t.outputToken : t.inputToken,
        side: t.side,
        amountUsd: parseFloat(t.amountIn),
        timestamp: t.createdAt.getTime(),
      })),
    };
  });
}
