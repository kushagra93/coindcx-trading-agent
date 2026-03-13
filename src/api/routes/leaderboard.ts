import type { FastifyInstance } from 'fastify';
import { fetchTopTraders, fetchKOLs, type TopTrader } from '../../data/token-screener.js';

// In-memory copy-trade config store (production: PostgreSQL)
const copyConfigs = new Map<string, { walletAddress: string; budgetUsd: number; enabled: boolean; createdAt: Date }>();

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

  // Copy a wallet (start following)
  app.post<{
    Body: { walletAddress: string; budgetUsd?: number };
  }>('/api/v1/copy', async (request) => {
    const { walletAddress, budgetUsd = 200 } = request.body ?? {};
    if (!walletAddress) return { error: 'walletAddress is required' };

    copyConfigs.set(walletAddress, {
      walletAddress,
      budgetUsd,
      enabled: true,
      createdAt: new Date(),
    });

    return { message: 'Now copy-trading this wallet', walletAddress, budgetUsd };
  });

  // Stop copying a wallet
  app.delete<{ Params: { wallet: string } }>('/api/v1/copy/:wallet', async (request) => {
    const wallet = request.params.wallet;
    if (!copyConfigs.has(wallet)) {
      return { error: 'Not copying this wallet' };
    }
    copyConfigs.delete(wallet);
    return { message: 'Stopped copy-trading', wallet };
  });

  // List wallets being copy-traded
  app.get('/api/v1/copy', async () => {
    return {
      following: Array.from(copyConfigs.values()),
    };
  });
}
