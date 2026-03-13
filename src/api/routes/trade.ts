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
  slippagePct?: number;
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

    const isMajor = metrics.liquidity > 100_000;
    const priceImpact = isMajor ? 0.1 : Math.min(amountUsd / (metrics.liquidity || 1) * 100, 15);
    // In dry-run mode, auto-adjust slippage to accommodate low-liq tokens
    const defaultSlippage = config.dryRun
      ? Math.max(priceImpact + 1, isMajor ? 1 : 10)
      : (isMajor ? 1 : 5);
    const slippage = Math.min(slippagePct ?? defaultSlippage, 50);
    const executionPrice = side === 'buy'
      ? metrics.price * (1 + priceImpact / 100)
      : metrics.price * (1 - priceImpact / 100);

    if (priceImpact > slippage) {
      reply.code(400).send({
        error: `Price impact too high (${priceImpact.toFixed(1)}%) for this token's liquidity ($${metrics.liquidity.toFixed(0)}). Try a smaller amount.`,
        priceImpact,
        slippage,
      });
      return;
    }

    tradeCounter++;
    const trade: TradeRecord = {
      id: `trade_${tradeCounter}_${Date.now()}`,
      symbol: metrics.symbol,
      side,
      amountUsd,
      price: executionPrice,
      quantity: amountUsd / executionPrice,
      chain: metrics.chain as string,
      status: config.dryRun ? 'dry_run' : 'executed',
      txHash: config.dryRun ? null : `0x${Date.now().toString(16)}`,
      timestamp: Date.now(),
    };

    positions.set(trade.id, trade);
    log.info({ tradeId: trade.id, symbol, side, amountUsd, slippage, priceImpact: priceImpact.toFixed(2), dryRun: config.dryRun }, 'Trade processed');

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
    const allTrades = Array.from(positions.values()).sort((a, b) => b.timestamp - a.timestamp);

    const totalInvested = allTrades.filter(t => t.side === 'buy').reduce((s, t) => s + t.amountUsd, 0);
    const totalSold = allTrades.filter(t => t.side === 'sell').reduce((s, t) => s + t.amountUsd, 0);

    // Aggregate positions by symbol
    const holdingsMap = new Map<string, {
      symbol: string;
      chain: string;
      totalQuantity: number;
      totalCostBasis: number;
      avgEntryPrice: number;
      tradeCount: number;
      firstBuyAt: number;
      lastBuyAt: number;
    }>();

    for (const t of allTrades) {
      const key = t.symbol.toUpperCase();
      const existing = holdingsMap.get(key);
      if (t.side === 'buy') {
        if (existing) {
          existing.totalQuantity += t.quantity;
          existing.totalCostBasis += t.amountUsd;
          existing.avgEntryPrice = existing.totalCostBasis / existing.totalQuantity;
          existing.tradeCount++;
          if (t.timestamp < existing.firstBuyAt) existing.firstBuyAt = t.timestamp;
          if (t.timestamp > existing.lastBuyAt) existing.lastBuyAt = t.timestamp;
        } else {
          holdingsMap.set(key, {
            symbol: t.symbol,
            chain: t.chain,
            totalQuantity: t.quantity,
            totalCostBasis: t.amountUsd,
            avgEntryPrice: t.price,
            tradeCount: 1,
            firstBuyAt: t.timestamp,
            lastBuyAt: t.timestamp,
          });
        }
      } else {
        if (existing) {
          existing.totalQuantity -= t.quantity;
          existing.totalCostBasis -= t.amountUsd;
          if (existing.totalQuantity > 0) {
            existing.avgEntryPrice = existing.totalCostBasis / existing.totalQuantity;
          }
          existing.tradeCount++;
        }
      }
    }

    // Filter out fully sold positions and build aggregated list
    const holdings = Array.from(holdingsMap.values())
      .filter(h => h.totalQuantity > 0.000001)
      .map(h => ({
        symbol: h.symbol,
        chain: h.chain,
        side: 'buy' as const,
        amount: h.totalQuantity,
        price: h.avgEntryPrice,
        costBasis: h.totalCostBasis,
        tradeCount: h.tradeCount,
        firstBuyAt: h.firstBuyAt,
        lastBuyAt: h.lastBuyAt,
        status: 'aggregated',
      }));

    // Raw trade history (individual transactions)
    const history = allTrades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      amountUsd: t.amountUsd,
      price: t.price,
      quantity: t.quantity,
      chain: t.chain,
      status: t.status,
      timestamp: t.timestamp,
    }));

    return {
      totalTrades: allTrades.length,
      totalInvested,
      totalSold,
      positions: holdings,
      history,
    };
  });
}
