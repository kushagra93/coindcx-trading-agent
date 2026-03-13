import type { FastifyInstance } from 'fastify';
import { fetchTopTraders, fetchKOLs, type TopTrader } from '../../data/token-screener.js';
import {
  startCopyTrading,
  stopCopyTrading,
  pauseCopyTrading,
  resumeCopyTrading,
  getCopyConfigs,
  getCopyConfig,
  getRecentActivity,
  type CopyTradeConfig,
  type BuyMode,
  type SellMethod,
} from '../../data/copy-engine.js';

export async function leaderboardRoutes(app: FastifyInstance) {

  // Live leaderboard powered by GMGN
  app.get<{ Querystring: { sort?: string; period?: string; limit?: string } }>(
    '/api/v1/leaderboard',
    async (request) => {
      const period = (request.query.period === '30d' ? '30d' : '7d') as '7d' | '30d';
      const sortMap: Record<string, any> = {
        pnl: period === '30d' ? 'pnl_30d' : 'pnl_7d',
        winrate: period === '30d' ? 'winrate_30d' as any : 'winrate_7d' as any,
        profit: 'realized_profit_7d',
      };
      const orderBy = sortMap[request.query.sort ?? 'pnl'] ?? 'pnl_7d';
      const limit = Math.min(parseInt(request.query.limit ?? '30'), 50);

      const traders = await fetchTopTraders(period, orderBy);

      return {
        traders: traders.slice(0, limit),
        period,
        total: traders.length,
      };
    }
  );

  // KOL-only leaderboard
  app.get('/api/v1/leaderboard/kols', async () => {
    const kols = await fetchKOLs();
    return { traders: kols, total: kols.length };
  });

  // Start copy trading with full config
  app.post<{
    Body: {
      walletAddress: string;
      walletName?: string;
      buyMode?: BuyMode;
      buyAmount?: number;
      sellMethod?: SellMethod;
    };
  }>('/api/v1/copy', async (request) => {
    const { walletAddress, walletName, buyMode, buyAmount, sellMethod } = request.body ?? {};
    if (!walletAddress) return { error: 'walletAddress is required' };

    const config: CopyTradeConfig = {
      walletAddress,
      walletName: walletName || `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      buyMode: buyMode || 'fixed_buy',
      buyAmount: buyAmount ?? 50,
      sellMethod: sellMethod || 'mirror_sell',
      enabled: true,
      createdAt: Date.now(),
      totalCopied: 0,
      totalPnl: 0,
    };

    const result = startCopyTrading(config);
    return { message: 'Copy trading started', config: result };
  });

  // Stop copying a wallet
  app.delete<{ Params: { wallet: string } }>('/api/v1/copy/:wallet', async (request) => {
    const wallet = request.params.wallet;
    const stopped = stopCopyTrading(wallet);
    if (!stopped) return { error: 'Not copying this wallet' };
    return { message: 'Stopped copy-trading', wallet };
  });

  // Pause copy trading
  app.post<{ Params: { wallet: string } }>('/api/v1/copy/:wallet/pause', async (request) => {
    const paused = pauseCopyTrading(request.params.wallet);
    if (!paused) return { error: 'Not copying this wallet' };
    return { message: 'Copy trading paused', wallet: request.params.wallet };
  });

  // Resume copy trading
  app.post<{ Params: { wallet: string } }>('/api/v1/copy/:wallet/resume', async (request) => {
    const resumed = resumeCopyTrading(request.params.wallet);
    if (!resumed) return { error: 'Not copying this wallet' };
    return { message: 'Copy trading resumed', wallet: request.params.wallet };
  });

  // List all copy trade configs
  app.get('/api/v1/copy', async () => {
    const configs = getCopyConfigs();
    return { following: configs, total: configs.length };
  });

  // Get single copy config
  app.get<{ Params: { wallet: string } }>('/api/v1/copy/:wallet', async (request) => {
    const config = getCopyConfig(request.params.wallet);
    if (!config) return { error: 'Not copying this wallet' };
    return { config };
  });

  // Recent copy trade activity feed
  app.get<{ Querystring: { limit?: string; wallet?: string } }>(
    '/api/v1/copy/activity',
    async (request) => {
      const limit = Math.min(parseInt(request.query.limit ?? '20'), 50);
      const activities = getRecentActivity(limit, request.query.wallet);
      return { activities, total: activities.length };
    }
  );
}
