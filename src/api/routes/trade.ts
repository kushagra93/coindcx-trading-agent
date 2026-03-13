import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../../core/logger.js';
import { config } from '../../core/config.js';
import { getTokenBySymbol, screenBySymbol } from '../../data/token-screener.js';
import {
  swapTokens,
  getWalletBalance,
  getOnChainBalances,
  getPublicKey,
  resolveTokenMint,
  addTokenMint,
  loadOrGenerateKeypair,
} from '../../data/jupiter-swap.js';

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
  txUrl: string | null;
  timestamp: number;
}

const positions: Map<string, TradeRecord> = new Map();
let tradeCounter = 0;

export async function tradeRoutes(app: FastifyInstance) {

  // Initialize wallet on startup
  if (!config.dryRun) {
    try {
      const kp = loadOrGenerateKeypair();
      log.info({ publicKey: kp.publicKey.toBase58(), mode: 'LIVE' }, 'Wallet ready for on-chain trades');
    } catch (e) {
      log.warn('Could not load wallet — on-chain trades will fail until SOLANA_PRIVATE_KEY is set');
    }
  }

  // Wallet info endpoint
  app.get('/api/v1/trade/wallet', async () => {
    if (config.dryRun) {
      return { mode: 'dry_run', message: 'Set DRY_RUN=false to enable real trades' };
    }
    try {
      const balance = await getWalletBalance();
      return {
        mode: 'live',
        publicKey: balance.publicKey,
        solBalance: balance.sol,
        fundingUrl: `https://solscan.io/account/${balance.publicKey}`,
      };
    } catch (e: any) {
      return { mode: 'live', error: e.message };
    }
  });

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

    // Register the token mint address for Jupiter if not already known
    if (metrics.address && !resolveTokenMint(metrics.symbol)) {
      addTokenMint(metrics.symbol, metrics.address);
      log.info({ symbol: metrics.symbol, mint: metrics.address }, 'Registered token mint for Jupiter');
    }

    const isMajor = metrics.liquidity > 100_000;
    const priceImpact = isMajor ? 0.1 : Math.min(amountUsd / (metrics.liquidity || 1) * 100, 15);
    const slippageBps = slippagePct ? Math.floor(slippagePct * 100) : (isMajor ? 100 : 300);

    // ── LIVE ON-CHAIN TRADE ──────────────────────────────────────
    if (!config.dryRun) {
      try {
        const fromSymbol = side === 'buy' ? 'SOL' : symbol;
        const toSymbol = side === 'buy' ? symbol : 'SOL';
        const fromPrice = side === 'buy' ? metrics.price : metrics.price; // SOL price for buying, token price for selling

        // For buys, we need SOL price, not the target token price
        let solPrice = metrics.price;
        if (side === 'buy') {
          const solMetrics = await getTokenBySymbol('SOL');
          solPrice = solMetrics?.price ?? 130;
        }

        const swapResult = await swapTokens(
          fromSymbol,
          toSymbol,
          amountUsd,
          side === 'buy' ? solPrice : metrics.price,
          slippageBps,
        );

        if (!swapResult.success) {
          reply.code(400).send({
            error: swapResult.error ?? 'Swap failed on-chain',
            txHash: swapResult.txHash,
            txUrl: swapResult.txUrl,
          });
          return;
        }

        tradeCounter++;
        const trade: TradeRecord = {
          id: `trade_${tradeCounter}_${Date.now()}`,
          symbol: metrics.symbol,
          side,
          amountUsd,
          price: metrics.price,
          quantity: amountUsd / metrics.price,
          chain: 'solana',
          status: 'executed',
          txHash: swapResult.txHash,
          txUrl: swapResult.txUrl,
          timestamp: Date.now(),
        };

        positions.set(trade.id, trade);
        log.info({
          tradeId: trade.id, symbol, side, amountUsd,
          txHash: swapResult.txHash,
          priceImpact: swapResult.priceImpact,
        }, 'ON-CHAIN trade executed');

        return {
          trade,
          slippage: slippageBps / 100,
          priceImpact: swapResult.priceImpact,
          txUrl: swapResult.txUrl,
          message: `${side.toUpperCase()} $${amountUsd} of ${symbol} executed on-chain. View: ${swapResult.txUrl}`,
        };
      } catch (err: any) {
        log.error({ symbol, side, amountUsd, error: err.message }, 'On-chain trade failed');
        reply.code(500).send({
          error: err.message || 'On-chain swap failed',
        });
        return;
      }
    }

    // ── DRY RUN (simulated) ──────────────────────────────────────
    const defaultSlippage = Math.max(priceImpact + 1, isMajor ? 1 : 10);
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
      status: 'dry_run',
      txHash: null,
      txUrl: null,
      timestamp: Date.now(),
    };

    positions.set(trade.id, trade);
    log.info({ tradeId: trade.id, symbol, side, amountUsd, slippage, priceImpact: priceImpact.toFixed(2), dryRun: true }, 'DRY RUN trade');

    return {
      trade,
      slippage,
      priceImpact: parseFloat(priceImpact.toFixed(2)),
      message: `DRY RUN: Would ${side} $${amountUsd} of ${symbol} at ${executionPrice.toFixed(8)} (${priceImpact.toFixed(2)}% impact, ${slippage}% max slippage)`,
    };
  });

  app.get('/api/v1/trade/portfolio', async () => {
    const allTrades = Array.from(positions.values()).sort((a, b) => b.timestamp - a.timestamp);

    const totalInvested = allTrades.filter(t => t.side === 'buy').reduce((s, t) => s + t.amountUsd, 0);
    const totalSold = allTrades.filter(t => t.side === 'sell').reduce((s, t) => s + t.amountUsd, 0);

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

    const history = allTrades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      side: t.side,
      amountUsd: t.amountUsd,
      price: t.price,
      quantity: t.quantity,
      chain: t.chain,
      status: t.status,
      txHash: t.txHash,
      txUrl: t.txUrl,
      timestamp: t.timestamp,
    }));

    // Fetch real on-chain balances if in live mode
    let wallet: any = null;
    if (!config.dryRun) {
      try {
        const onChain = await getOnChainBalances();
        wallet = {
          publicKey: onChain.publicKey,
          sol: onChain.sol,
          tokens: onChain.tokens,
          viewUrl: `https://solscan.io/account/${onChain.publicKey}`,
        };
      } catch (e) {
        log.warn('Could not fetch on-chain balances');
      }
    }

    return {
      totalTrades: allTrades.length,
      totalInvested,
      totalSold,
      positions: holdings,
      history,
      wallet,
    };
  });
}
