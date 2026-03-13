import type { FastifyInstance } from 'fastify';
import { createChildLogger } from '../../core/logger.js';
import { config } from '../../core/config.js';
import { HyperliquidExecutor } from '../../trader/hyperliquid-executor.js';

const log = createChildLogger('perps-routes');

// ─── US Stock Perps available on Hyperliquid ───
const US_STOCK_PERPS: Record<string, {
  name: string;
  sector: string;
  hlSymbol: string; // Hyperliquid symbol
}> = {
  AAPL:  { name: 'Apple Inc.',            sector: 'Technology',    hlSymbol: 'AAPL' },
  TSLA:  { name: 'Tesla Inc.',            sector: 'Automotive',    hlSymbol: 'TSLA' },
  GOOGL: { name: 'Alphabet Inc.',         sector: 'Technology',    hlSymbol: 'GOOGL' },
  AMZN:  { name: 'Amazon.com Inc.',       sector: 'Technology',    hlSymbol: 'AMZN' },
  MSFT:  { name: 'Microsoft Corp.',       sector: 'Technology',    hlSymbol: 'MSFT' },
  NVDA:  { name: 'NVIDIA Corp.',          sector: 'Technology',    hlSymbol: 'NVDA' },
  META:  { name: 'Meta Platforms Inc.',    sector: 'Technology',    hlSymbol: 'META' },
  NFLX:  { name: 'Netflix Inc.',          sector: 'Technology',    hlSymbol: 'NFLX' },
  AMD:   { name: 'Advanced Micro Devices', sector: 'Technology',   hlSymbol: 'AMD' },
  COIN:  { name: 'Coinbase Global Inc.',  sector: 'Finance',       hlSymbol: 'COIN' },
  MSTR:  { name: 'MicroStrategy Inc.',    sector: 'Finance',       hlSymbol: 'MSTR' },
  SPY:   { name: 'S&P 500 ETF',           sector: 'Index',         hlSymbol: 'SPY' },
  QQQ:   { name: 'Nasdaq-100 ETF',        sector: 'Index',         hlSymbol: 'QQQ' },
  GLD:   { name: 'Gold ETF',              sector: 'Commodities',   hlSymbol: 'GLD' },
  SLV:   { name: 'Silver ETF',            sector: 'Commodities',   hlSymbol: 'SLV' },
};

// ─── Crypto Perps on Hyperliquid ───
const CRYPTO_PERPS: Record<string, { hlSymbol: string }> = {
  BTC:   { hlSymbol: 'BTC' },
  ETH:   { hlSymbol: 'ETH' },
  SOL:   { hlSymbol: 'SOL' },
  AVAX:  { hlSymbol: 'AVAX' },
  ARB:   { hlSymbol: 'ARB' },
  OP:    { hlSymbol: 'OP' },
  MATIC: { hlSymbol: 'MATIC' },
  DOGE:  { hlSymbol: 'DOGE' },
  LINK:  { hlSymbol: 'LINK' },
  SUI:   { hlSymbol: 'SUI' },
  APT:   { hlSymbol: 'APT' },
  INJ:   { hlSymbol: 'INJ' },
  TIA:   { hlSymbol: 'TIA' },
  SEI:   { hlSymbol: 'SEI' },
  WIF:   { hlSymbol: 'WIF' },
  BONK:  { hlSymbol: 'BONK' },
  PEPE:  { hlSymbol: 'PEPE' },
  HYPE:  { hlSymbol: 'HYPE' },
};

// Hyperliquid API for live data
const HL_INFO_API = 'https://api.hyperliquid.xyz/info';

interface HLMeta {
  universe: Array<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
  }>;
}

interface HLSpotMeta {
  tokens: Array<{
    name: string;
    index: number;
    szDecimals: number;
  }>;
  universe: Array<{
    name: string;
    tokens: number[];
  }>;
}

interface HLSpotCtx {
  midPx: string | null;
  dayNtlVlm: string;
}

interface PerpPosition {
  id: string;
  symbol: string;
  type: 'stock' | 'crypto';
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  marginUsd: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  liquidationPrice: number;
  status: 'open' | 'dry_run';
  timestamp: number;
}

const perpPositions: Map<string, PerpPosition> = new Map();
let perpCounter = 0;

async function hlInfoFetch<T>(body: unknown): Promise<T> {
  const res = await fetch(HL_INFO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function perpsRoutes(app: FastifyInstance) {

  // ─── List available perps ───
  app.get('/api/v1/perps/assets', async () => {
    let hlAssets: HLMeta['universe'] = [];
    let spotTokens: HLSpotMeta['tokens'] = [];
    try {
      const [meta, spotMeta] = await Promise.all([
        hlInfoFetch<HLMeta>({ type: 'meta' }),
        hlInfoFetch<HLSpotMeta>({ type: 'spotMeta' }),
      ]);
      hlAssets = meta.universe;
      spotTokens = spotMeta.tokens;
    } catch (e) {
      log.warn({ err: e }, 'Failed to fetch Hyperliquid meta');
    }

    const stocks = Object.entries(US_STOCK_PERPS).map(([ticker, info]) => {
      const spotToken = spotTokens.find(t => t.name === info.hlSymbol);
      return {
        symbol: ticker,
        name: info.name,
        sector: info.sector,
        type: 'stock' as const,
        chain: 'hyperliquid',
        maxLeverage: 5, // Tokenized stocks typically lower leverage
        available: !!spotToken,
      };
    });

    const crypto = Object.entries(CRYPTO_PERPS).map(([ticker, info]) => {
      const hlAsset = hlAssets.find(a => a.name === info.hlSymbol);
      return {
        symbol: ticker,
        name: ticker,
        sector: 'Crypto',
        type: 'crypto' as const,
        chain: 'hyperliquid',
        maxLeverage: hlAsset?.maxLeverage ?? 50,
        available: !!hlAsset,
      };
    });

    return {
      stocks,
      crypto,
      totalAssets: stocks.length + crypto.length,
      venue: 'hyperliquid',
    };
  });

  // ─── Get perp quote with funding rate ───
  app.post<{
    Body: { symbol: string; leverage?: number };
  }>('/api/v1/perps/quote', async (request, reply) => {
    const { symbol, leverage = 1 } = request.body ?? {};
    if (!symbol) {
      reply.code(400).send({ error: 'symbol is required' });
      return;
    }

    const stockInfo = US_STOCK_PERPS[symbol.toUpperCase()];
    const cryptoInfo = CRYPTO_PERPS[symbol.toUpperCase()];
    const hlSymbol = stockInfo?.hlSymbol ?? cryptoInfo?.hlSymbol;

    if (!hlSymbol) {
      reply.code(404).send({ error: `Perp "${symbol}" not available. Use GET /api/v1/perps/assets for list.` });
      return;
    }

    try {
      // For stocks: use spot market data; for crypto: use perps data
      if (stockInfo) {
        const spotData = await hlInfoFetch<[HLSpotMeta, HLSpotCtx[]]>({ type: 'spotMetaAndAssetCtxs' });
        const spotMeta = spotData[0];
        const spotCtxs = spotData[1];
        const tokenMap = new Map(spotMeta.tokens.map(t => [t.index, t.name]));

        // Find the universe entry containing this stock token
        let midPrice = 0;
        let szDecimals = 2;
        for (let i = 0; i < spotMeta.universe.length; i++) {
          const pair = spotMeta.universe[i];
          const pairNames = pair.tokens.map(idx => tokenMap.get(idx) ?? '');
          if (pairNames.includes(hlSymbol)) {
            const ctx = spotCtxs[i];
            midPrice = ctx?.midPx ? parseFloat(ctx.midPx) : 0;
            const token = spotMeta.tokens.find(t => t.name === hlSymbol);
            szDecimals = token?.szDecimals ?? 2;
            break;
          }
        }

        if (midPrice === 0) {
          reply.code(404).send({ error: `No spot price for ${hlSymbol} on Hyperliquid` });
          return;
        }

        const maxLev = 5;
        const clampedLeverage = Math.min(Math.max(leverage, 1), maxLev);

        return {
          symbol: symbol.toUpperCase(),
          hlSymbol,
          type: 'stock' as const,
          name: stockInfo.name,
          sector: stockInfo.sector,
          markPrice: midPrice,
          maxLeverage: maxLev,
          requestedLeverage: clampedLeverage,
          szDecimals,
          fundingRate: 0,
          fundingRate8h: 0,
          venue: 'hyperliquid',
          chain: 'hyperliquid',
          market: 'spot-tokenized',
        };
      }

      // Crypto perps
      const [meta, allMids] = await Promise.all([
        hlInfoFetch<HLMeta>({ type: 'meta' }),
        hlInfoFetch<Record<string, string>>({ type: 'allMids' }),
      ]);

      const asset = meta.universe.find(u => u.name === hlSymbol);
      if (!asset) {
        reply.code(404).send({ error: `${hlSymbol} not listed on Hyperliquid` });
        return;
      }

      const midPrice = parseFloat(allMids[hlSymbol] ?? '0');
      if (midPrice === 0) {
        reply.code(404).send({ error: `No price for ${hlSymbol}` });
        return;
      }

      const clampedLeverage = Math.min(Math.max(leverage, 1), asset.maxLeverage);

      // Fetch funding rate
      let fundingRate = 0;
      try {
        const fundingData = await hlInfoFetch<Array<{ coin: string; funding: string }>>({
          type: 'metaAndAssetCtxs',
        });
        const assetCtxs = Array.isArray(fundingData) ? fundingData[1] as Array<{ funding: string }> : [];
        const assetIdx = meta.universe.findIndex(u => u.name === hlSymbol);
        if (assetIdx >= 0 && assetCtxs[assetIdx]) {
          fundingRate = parseFloat(assetCtxs[assetIdx].funding ?? '0');
        }
      } catch {
        // Funding rate is best-effort
      }

      return {
        symbol: symbol.toUpperCase(),
        hlSymbol,
        type: 'crypto' as const,
        name: symbol.toUpperCase(),
        sector: 'Crypto',
        markPrice: midPrice,
        maxLeverage: asset.maxLeverage,
        requestedLeverage: clampedLeverage,
        szDecimals: asset.szDecimals,
        fundingRate,
        fundingRate8h: fundingRate * 100,
        venue: 'hyperliquid',
        chain: 'hyperliquid',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err: msg, symbol }, 'Perp quote failed');
      reply.code(502).send({ error: `Failed to get quote: ${msg}` });
    }
  });

  // ─── Execute perp trade (long/short) ───
  app.post<{
    Body: {
      symbol: string;
      side: 'long' | 'short';
      marginUsd: number;
      leverage?: number;
    };
  }>('/api/v1/perps/trade', async (request, reply) => {
    const { symbol, side, marginUsd, leverage = 1 } = request.body ?? {};

    if (!symbol || !side || !marginUsd) {
      reply.code(400).send({ error: 'symbol, side, and marginUsd are required' });
      return;
    }
    if (!['long', 'short'].includes(side)) {
      reply.code(400).send({ error: 'side must be "long" or "short"' });
      return;
    }
    if (marginUsd <= 0 || marginUsd > 10_000) {
      reply.code(400).send({ error: 'marginUsd must be between 0 and 10000' });
      return;
    }
    if (leverage < 1 || leverage > 100) {
      reply.code(400).send({ error: 'leverage must be between 1 and 100' });
      return;
    }

    const stockInfo = US_STOCK_PERPS[symbol.toUpperCase()];
    const cryptoInfo = CRYPTO_PERPS[symbol.toUpperCase()];
    const hlSymbol = stockInfo?.hlSymbol ?? cryptoInfo?.hlSymbol;

    if (!hlSymbol) {
      reply.code(404).send({ error: `Perp "${symbol}" not available` });
      return;
    }

    try {
      let markPrice = 0;
      let szDecimals = 2;
      let maxLev = 50;

      if (stockInfo) {
        // Stock: get spot price
        const spotData = await hlInfoFetch<[HLSpotMeta, HLSpotCtx[]]>({ type: 'spotMetaAndAssetCtxs' });
        const spotMeta = spotData[0];
        const spotCtxs = spotData[1];
        const tokenMap = new Map(spotMeta.tokens.map(t => [t.index, t.name]));
        maxLev = 5;

        for (let i = 0; i < spotMeta.universe.length; i++) {
          const pair = spotMeta.universe[i];
          const pairNames = pair.tokens.map(idx => tokenMap.get(idx) ?? '');
          if (pairNames.includes(hlSymbol)) {
            const ctx = spotCtxs[i];
            markPrice = ctx?.midPx ? parseFloat(ctx.midPx) : 0;
            const token = spotMeta.tokens.find(t => t.name === hlSymbol);
            szDecimals = token?.szDecimals ?? 2;
            break;
          }
        }
      } else {
        // Crypto: get perp price
        const [meta, allMids] = await Promise.all([
          hlInfoFetch<HLMeta>({ type: 'meta' }),
          hlInfoFetch<Record<string, string>>({ type: 'allMids' }),
        ]);
        const asset = meta.universe.find(u => u.name === hlSymbol);
        if (!asset) {
          reply.code(404).send({ error: `${hlSymbol} not listed on Hyperliquid` });
          return;
        }
        markPrice = parseFloat(allMids[hlSymbol] ?? '0');
        szDecimals = asset.szDecimals;
        maxLev = asset.maxLeverage;
      }

      if (markPrice === 0) {
        reply.code(404).send({ error: `No price for ${hlSymbol}` });
        return;
      }

      const clampedLeverage = Math.min(Math.max(leverage, 1), maxLev);
      const notionalUsd = marginUsd * clampedLeverage;
      const positionSize = notionalUsd / markPrice;

      // Estimate liquidation price (simplified)
      const liqDistance = markPrice / clampedLeverage;
      const liquidationPrice = side === 'long'
        ? markPrice - liqDistance * 0.9
        : markPrice + liqDistance * 0.9;

      perpCounter++;
      const position: PerpPosition = {
        id: `perp_${perpCounter}_${Date.now()}`,
        symbol: symbol.toUpperCase(),
        type: stockInfo ? 'stock' : 'crypto',
        side,
        size: parseFloat(positionSize.toFixed(szDecimals)),
        entryPrice: markPrice,
        markPrice,
        leverage: clampedLeverage,
        marginUsd,
        unrealizedPnl: 0,
        unrealizedPnlPct: 0,
        liquidationPrice: parseFloat(liquidationPrice.toFixed(2)),
        status: config.dryRun ? 'dry_run' : 'open',
        timestamp: Date.now(),
      };

      perpPositions.set(position.id, position);

      log.info({
        id: position.id,
        symbol: position.symbol,
        side,
        margin: marginUsd,
        leverage: clampedLeverage,
        notional: notionalUsd,
        size: position.size,
        dryRun: config.dryRun,
      }, 'Perp trade executed');

      return {
        position,
        notionalUsd: parseFloat(notionalUsd.toFixed(2)),
        message: config.dryRun
          ? `DRY RUN: Would open ${side} ${symbol.toUpperCase()} perp — $${marginUsd} margin × ${clampedLeverage}x = $${notionalUsd.toFixed(2)} notional @ $${markPrice}`
          : `Opened ${side} ${symbol.toUpperCase()} perp`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err: msg, symbol, side }, 'Perp trade failed');
      reply.code(502).send({ error: `Trade failed: ${msg}` });
    }
  });

  // ─── Close perp position ───
  app.post<{
    Body: { positionId: string };
  }>('/api/v1/perps/close', async (request, reply) => {
    const { positionId } = request.body ?? {};
    if (!positionId) {
      reply.code(400).send({ error: 'positionId is required' });
      return;
    }

    const position = perpPositions.get(positionId);
    if (!position) {
      reply.code(404).send({ error: 'Position not found' });
      return;
    }

    // Fetch current price for PnL
    try {
      const hlSymbol = US_STOCK_PERPS[position.symbol]?.hlSymbol
        ?? CRYPTO_PERPS[position.symbol]?.hlSymbol
        ?? position.symbol;

      const allMids = await hlInfoFetch<Record<string, string>>({ type: 'allMids' });
      const currentPrice = parseFloat(allMids[hlSymbol] ?? '0') || position.entryPrice;

      const priceDiff = currentPrice - position.entryPrice;
      const pnlPerUnit = position.side === 'long' ? priceDiff : -priceDiff;
      const realizedPnl = pnlPerUnit * position.size;
      const realizedPnlPct = (realizedPnl / position.marginUsd) * 100;

      perpPositions.delete(positionId);

      return {
        closed: true,
        positionId,
        symbol: position.symbol,
        side: position.side,
        entryPrice: position.entryPrice,
        exitPrice: currentPrice,
        size: position.size,
        realizedPnl: parseFloat(realizedPnl.toFixed(2)),
        realizedPnlPct: parseFloat(realizedPnlPct.toFixed(2)),
        marginReturned: parseFloat((position.marginUsd + realizedPnl).toFixed(2)),
      };
    } catch {
      perpPositions.delete(positionId);
      return { closed: true, positionId, note: 'Closed without current price' };
    }
  });

  // ─── List open perp positions ───
  app.get('/api/v1/perps/positions', async () => {
    const positions = Array.from(perpPositions.values()).sort((a, b) => b.timestamp - a.timestamp);

    // Update mark prices
    try {
      const allMids = await hlInfoFetch<Record<string, string>>({ type: 'allMids' });
      for (const pos of positions) {
        const hlSymbol = US_STOCK_PERPS[pos.symbol]?.hlSymbol
          ?? CRYPTO_PERPS[pos.symbol]?.hlSymbol
          ?? pos.symbol;
        const current = parseFloat(allMids[hlSymbol] ?? '0');
        if (current > 0) {
          pos.markPrice = current;
          const priceDiff = current - pos.entryPrice;
          const pnlPerUnit = pos.side === 'long' ? priceDiff : -priceDiff;
          pos.unrealizedPnl = parseFloat((pnlPerUnit * pos.size).toFixed(2));
          pos.unrealizedPnlPct = parseFloat(((pos.unrealizedPnl / pos.marginUsd) * 100).toFixed(2));
        }
      }
    } catch {
      // Best effort price update
    }

    const totalMargin = positions.reduce((s, p) => s + p.marginUsd, 0);
    const totalPnl = positions.reduce((s, p) => s + p.unrealizedPnl, 0);

    return {
      positions,
      summary: {
        openPositions: positions.length,
        totalMarginUsd: parseFloat(totalMargin.toFixed(2)),
        totalUnrealizedPnl: parseFloat(totalPnl.toFixed(2)),
      },
    };
  });
}
