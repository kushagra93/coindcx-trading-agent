import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../../core/logger.js';
import { config } from '../../core/config.js';
import { getTokenBySymbol, getTokenByAddress, screenBySymbol } from '../../data/token-screener.js';

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
function isMintAddress(s: string) { return SOLANA_MINT_RE.test(s.trim()); }

/** Lookup token metrics by symbol or mint address */
async function getMetrics(symbolOrMint: string) {
  return isMintAddress(symbolOrMint)
    ? await getTokenByAddress(symbolOrMint)
    : await getTokenBySymbol(symbolOrMint);
}
import {
  swapTokens,
  getWalletBalance,
  getOnChainBalances,
  getOwnWalletHistory,
  getPublicKey,
  resolveTokenMint,
  addTokenMint,
  loadOrGenerateKeypair,
} from '../../data/jupiter-swap.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

const log = createChildLogger('trade-routes');

interface TradeRequest {
  symbol: string;
  side: 'buy' | 'sell';
  amountUsd?: number;
  chain?: string;
  slippagePct?: number;
  sellPercentage?: number; // 1-100 — resolves to amountUsd using on-chain balance
}

// Carries the exact on-chain raw token amount for percentage sells so we never
// exceed the wallet balance due to floating-point drift.
let _pendingSellRaw: number | undefined;

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
    let { symbol, side, amountUsd, slippagePct, sellPercentage } = request.body ?? {};

    if (!symbol || !side) {
      reply.code(400).send({ error: 'symbol and side are required' });
      return;
    }
    if (!['buy', 'sell'].includes(side)) {
      reply.code(400).send({ error: 'side must be "buy" or "sell"' });
      return;
    }

    // Resolve sellPercentage → amountUsd using live on-chain balance
    _pendingSellRaw = undefined;
    if (side === 'sell' && sellPercentage && sellPercentage > 0 && sellPercentage <= 100) {
      try {
        const onChain = await getOnChainBalances();
        const isSol = symbol.toUpperCase() === 'SOL';
        if (isSol) {
          // Sell % of SOL balance (keep 0.01 SOL for fees)
          const sellableSol = Math.max(0, onChain.sol - 0.01);
          const solMetrics = await getTokenBySymbol('SOL');
          const solPrice = solMetrics?.price ?? 130;
          amountUsd = Math.floor(sellableSol * (sellPercentage / 100) * solPrice * 100) / 100;
          // Pass exact lamports to avoid drift — subtract 5000 lamports for tx fee buffer
          const exactLamports = Math.floor(sellableSol * (sellPercentage / 100) * LAMPORTS_PER_SOL);
          _pendingSellRaw = Math.max(0, exactLamports - 5000);
        } else {
          const findTok = (id: string) => {
            const clean = id.replace(/\.+$/, '').toLowerCase();
            return onChain.tokens.find((t: any) =>
              t.symbol?.toUpperCase() === id.toUpperCase() ||
              t.mint?.toLowerCase() === clean ||
              (clean.length >= 6 && t.mint?.toLowerCase().startsWith(clean)),
            );
          };

          let tok = findTok(symbol);

          // If not found by ticker, look up the mint via DexScreener and retry
          if (!tok && !isMintAddress(symbol)) {
            const lookedUp = await getMetrics(symbol);
            if (lookedUp?.address) {
              tok = findTok(lookedUp.address);
              if (tok) symbol = lookedUp.address; // normalise to mint
            }
          }

          if (!tok) {
            const held = onChain.tokens.map((t: any) => t.symbol ?? t.mint?.slice(0, 8)).join(', ');
            reply.code(400).send({ error: `Token "${symbol}" not found in on-chain wallet. Holdings: ${held || 'none'}` });
            return;
          }
          // Register the mint so resolveTokenMint works downstream
          if (!resolveTokenMint(symbol)) addTokenMint(symbol, tok.mint);
          const priceMeta = await getMetrics(tok.mint);
          // Also register by ticker symbol if we got one back
          if (priceMeta?.symbol && !resolveTokenMint(priceMeta.symbol)) {
            addTokenMint(priceMeta.symbol, tok.mint);
          }
          const price = priceMeta?.price ?? 0;
          amountUsd = Math.floor(tok.uiAmount * (sellPercentage / 100) * price * 100) / 100;
          if (amountUsd < 0.001) amountUsd = 0.001; // minimum to avoid dust
          // KEY FIX: use exact raw balance from chain — avoids float drift causing 6024
          // For < 100% reduce slightly to be safe; for 100% use full balance minus 1 atom
          const rawFull = tok.amount as number;
          _pendingSellRaw = sellPercentage === 100
            ? Math.max(0, rawFull - 1)
            : Math.floor(rawFull * sellPercentage / 100);
          // Normalise symbol to the mint so swapTokens can resolve it later
          symbol = tok.mint;
        }
        log.info({ symbol, side, sellPercentage, resolvedAmountUsd: amountUsd, rawAmount: _pendingSellRaw }, 'Resolved sellPercentage → amountUsd');
      } catch (err: any) {
        reply.code(500).send({ error: `Failed to resolve sell percentage: ${err.message}` });
        return;
      }
    }

    if (!amountUsd || amountUsd <= 0) {
      reply.code(400).send({ error: 'amountUsd (or sellPercentage for sells) is required' });
      return;
    }
    if (amountUsd > 10_000) {
      reply.code(400).send({ error: 'amountUsd must be ≤ 10000' });
      return;
    }

    const metrics = await getMetrics(symbol);
    if (!metrics) {
      reply.code(404).send({ error: `Token "${symbol}" not found` });
      return;
    }

    // Register mint under both the input identifier AND the canonical ticker
    if (metrics.address) {
      if (!resolveTokenMint(symbol)) {
        addTokenMint(symbol, metrics.address);
      }
      if (metrics.symbol && !resolveTokenMint(metrics.symbol)) {
        addTokenMint(metrics.symbol, metrics.address);
        log.info({ symbol: metrics.symbol, mint: metrics.address }, 'Registered token mint for Jupiter');
      }
    }

    // If symbol is a mint address, swap using it directly
    if (isMintAddress(symbol) && !resolveTokenMint(symbol)) {
      addTokenMint(symbol, symbol);
    }

    const screening = await screenBySymbol(symbol);
    if (screening && !screening.passed) {
      log.warn({ symbol, grade: screening.grade }, 'Trade on risky token');
    }

    const isMajor = metrics.liquidity > 100_000;
    const priceImpact = isMajor ? 0.1 : Math.min(amountUsd / (metrics.liquidity || 1) * 100, 15);
    // Meme / Token-2022 sells can carry transfer taxes and volatile routing.
    // Give sells more default headroom to avoid frequent 6024 (exceeded slippage).
    const defaultSlippageBps = side === 'sell' ? 5000 : 2500;
    const slippageBps = slippagePct ? Math.floor(slippagePct * 100) : defaultSlippageBps;

    // ── LIVE ON-CHAIN TRADE ──────────────────────────────────────
    if (!config.dryRun) {
      try {
        const isSol = symbol.toUpperCase() === 'SOL';
        let fromSymbol: string;
        let toSymbol: string;
        let fromPrice: number;

        if (side === 'buy') {
          if (isSol) {
            fromSymbol = 'USDC';
            toSymbol = 'SOL';
            fromPrice = 1; // USDC is $1
          } else {
            fromSymbol = 'SOL';
            toSymbol = symbol;
            const solMetrics = await getTokenBySymbol('SOL');
            fromPrice = solMetrics?.price ?? 130;
          }
        } else {
          if (isSol) {
            fromSymbol = 'SOL';
            toSymbol = 'USDC';
            fromPrice = metrics.price;
          } else {
            fromSymbol = symbol;
            toSymbol = 'SOL';
            fromPrice = metrics.price;
          }
        }

        let swapResult;
        let executedAmountUsd = amountUsd;
        let effectiveSlippageBps = slippageBps;
        // For the first attempt use exact raw balance (avoids float drift causing 6024).
        // On retries we drop the override so swapTokens recalculates from the smaller USD amount.
        let currentOverrideRaw: number | undefined = _pendingSellRaw;

        // Retry strategy for illiquid / transfer-fee tokens:
        // if Jupiter returns 6024 (slippage exceeded), progressively reduce sell size
        // and allow higher slippage headroom to improve fill probability.
        for (let attempt = 0; attempt < 4; attempt++) {
          swapResult = await swapTokens(
            fromSymbol,
            toSymbol,
            executedAmountUsd,
            fromPrice,
            effectiveSlippageBps,
            currentOverrideRaw,
          );

          if (swapResult.success) break;

          const errMsg = String(swapResult.error ?? '');
          const isSlippageExceeded = errMsg.includes('6024') || errMsg.toLowerCase().includes('slippage');
          const canRetry = side === 'sell' && isSlippageExceeded && executedAmountUsd > 0.05;
          if (!canRetry || attempt === 3) break;

          executedAmountUsd = Math.max(0.05, Math.floor((executedAmountUsd * 0.5) * 100) / 100);
          effectiveSlippageBps = Math.min(9000, effectiveSlippageBps + 1000);
          currentOverrideRaw = undefined; // subsequent retries use smaller USD amount
          log.warn({
            symbol,
            side,
            attempt: attempt + 1,
            retryAmountUsd: executedAmountUsd,
            retrySlippageBps: effectiveSlippageBps,
            lastError: errMsg,
          }, 'Retrying sell after slippage exceeded');
        }

        // Type narrowing after retry loop
        if (!swapResult) {
          reply.code(500).send({ error: 'Swap failed before execution' });
          return;
        }

        if (!swapResult.success) {
          const errMsg = String(swapResult.error ?? 'Swap failed on-chain');
          const is6024 = errMsg.includes('6024');
          reply.code(400).send({
            error: is6024
              ? `${errMsg}. This token likely has transfer-fee/restriction mechanics; automatic retries (down to tiny size) still exceeded executable bounds.`
              : errMsg,
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
          amountUsd: executedAmountUsd,
          price: metrics.price,
          quantity: executedAmountUsd / metrics.price,
          chain: 'solana',
          status: 'executed',
          txHash: swapResult.txHash,
          txUrl: swapResult.txUrl,
          timestamp: Date.now(),
        };

        positions.set(trade.id, trade);
        log.info({
          tradeId: trade.id, symbol, side, amountUsd: executedAmountUsd,
          txHash: swapResult.txHash,
          priceImpact: swapResult.priceImpact,
        }, 'ON-CHAIN trade executed');

        return {
          trade,
          slippage: effectiveSlippageBps / 100,
          priceImpact: swapResult.priceImpact,
          txUrl: swapResult.txUrl,
          message: `${side.toUpperCase()} $${executedAmountUsd} of ${symbol} executed on-chain. View: ${swapResult.txUrl}`,
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

    // Fetch real on-chain balances + live USD values if in live mode
    let wallet: any = null;
    if (!config.dryRun) {
      try {
        const onChain = await getOnChainBalances();

        // Fetch live SOL price and token prices from Jupiter
        let solPrice = 130;
        let totalWalletUsd = 0;
        try {
          const solPriceRes = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
          if (solPriceRes.ok) {
            const pd = await solPriceRes.json() as any;
            solPrice = parseFloat(pd?.data?.['So11111111111111111111111111111111111111112']?.price ?? '130');
          }
        } catch { /* use fallback */ }

        const solUsd = onChain.sol * solPrice;
        totalWalletUsd += solUsd;

        // Price all tokens
        const mintIds = onChain.tokens.map(t => t.mint).filter(Boolean).join(',');
        let tokenPrices: Record<string, number> = {};
        if (mintIds) {
          try {
            const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${mintIds}`);
            if (priceRes.ok) {
              const pd = await priceRes.json() as any;
              for (const [mint, info] of Object.entries(pd?.data ?? {})) {
                tokenPrices[mint] = parseFloat((info as any)?.price ?? '0');
              }
            }
          } catch { /* ignore */ }
        }

        const tokensWithValue = onChain.tokens.map(t => {
          const price = tokenPrices[t.mint] ?? 0;
          const valueUsd = t.uiAmount * price;
          totalWalletUsd += valueUsd;
          return { ...t, priceUsd: price, valueUsd };
        });

        wallet = {
          publicKey: onChain.publicKey,
          sol: onChain.sol,
          solUsd,
          solPrice,
          tokens: tokensWithValue,
          totalValueUsd: totalWalletUsd,
          viewUrl: `https://solscan.io/account/${onChain.publicKey}`,
        };
      } catch (e) {
        log.warn('Could not fetch on-chain balances');
      }
    }

    // Fetch on-chain tx history (cached 60s) — non-blocking
    let onChainHistory: any[] = [];
    if (!config.dryRun) {
      try {
        onChainHistory = await getOwnWalletHistory(50);
      } catch { /* ignore */ }
    }

    return {
      totalTrades: allTrades.length,
      totalInvested,
      totalSold,
      positions: holdings,
      history,
      wallet,
      onChainHistory,
    };
  });
}
