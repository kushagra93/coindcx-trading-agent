import type { FastifyInstance } from 'fastify';
import type { LeadTrader, CopyConfig } from '../../core/types.js';
import { v4 as uuid } from 'uuid';

// In-memory stores (production: PostgreSQL)
const leadTraders = new Map<string, LeadTrader>();
const copyConfigs = new Map<string, CopyConfig>(); // key: `${userId}:${leadTraderId}`

// Seed sample lead traders for development
function seedLeadTraders() {
  if (leadTraders.size > 0) return;

  const samples: LeadTrader[] = [
    {
      id: 'lt-001',
      name: 'SolanaWhale',
      walletAddresses: { solana: 'DummyAddress1', ethereum: '', polygon: '', base: '', arbitrum: '', hyperliquid: '' },
      pnl30d: 18.5,
      pnl90d: 42.3,
      winRate: 0.72,
      maxDrawdown: -8.2,
      sharpeRatio: 2.1,
      copiersCount: 234,
      aumUsd: 1_500_000,
      trackRecordDays: 120,
      verified: true,
    },
    {
      id: 'lt-002',
      name: 'DeFiMaster',
      walletAddresses: { solana: '', ethereum: 'DummyAddress2', polygon: 'DummyAddress3', base: '', arbitrum: '', hyperliquid: '' },
      pnl30d: 12.1,
      pnl90d: 35.8,
      winRate: 0.68,
      maxDrawdown: -12.5,
      sharpeRatio: 1.8,
      copiersCount: 156,
      aumUsd: 800_000,
      trackRecordDays: 90,
      verified: true,
    },
  ];

  for (const trader of samples) {
    leadTraders.set(trader.id, trader);
  }
}

export async function leaderboardRoutes(app: FastifyInstance) {
  seedLeadTraders();

  // Get leaderboard (ranked by Sharpe ratio)
  app.get<{ Querystring: { sort?: string; page?: string; limit?: string } }>(
    '/api/v1/leaderboard',
    async (request) => {
      const sort = request.query.sort ?? 'sharpe';
      const page = parseInt(request.query.page ?? '1');
      const limit = Math.min(parseInt(request.query.limit ?? '20'), 50);

      let traders = Array.from(leadTraders.values())
        .filter(t => t.verified && t.trackRecordDays >= 30);

      // Sort
      switch (sort) {
        case 'pnl30d': traders.sort((a, b) => b.pnl30d - a.pnl30d); break;
        case 'pnl90d': traders.sort((a, b) => b.pnl90d - a.pnl90d); break;
        case 'winRate': traders.sort((a, b) => b.winRate - a.winRate); break;
        case 'copiers': traders.sort((a, b) => b.copiersCount - a.copiersCount); break;
        default: traders.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
      }

      const start = (page - 1) * limit;
      const paginated = traders.slice(start, start + limit);

      return {
        traders: paginated.map(t => ({
          id: t.id,
          name: t.name,
          pnl30d: t.pnl30d,
          pnl90d: t.pnl90d,
          winRate: t.winRate,
          maxDrawdown: t.maxDrawdown,
          sharpeRatio: t.sharpeRatio,
          copiersCount: t.copiersCount,
          aumUsd: t.aumUsd,
          verified: t.verified,
        })),
        pagination: { page, limit, total: traders.length },
      };
    }
  );

  // Get trader profile
  app.get<{ Params: { id: string } }>('/api/v1/leaderboard/:id', async (request) => {
    const trader = leadTraders.get(request.params.id);
    if (!trader) {
      return { error: 'Trader not found' };
    }
    return { trader };
  });

  // One-click copy
  app.post<{
    Params: { leaderId: string };
    Body: { budgetUsd: number; maxPerTradePct?: number };
  }>('/api/v1/copy/:leaderId', async (request) => {
    const userId = (request as any).userId as string;
    const leader = leadTraders.get(request.params.leaderId);

    if (!leader) {
      return { error: 'Leader not found' };
    }

    const key = `${userId}:${leader.id}`;
    const copyConfig: CopyConfig = {
      userId,
      leadTraderId: leader.id,
      budgetUsd: request.body.budgetUsd,
      maxPerTradePct: request.body.maxPerTradePct ?? 10,
      enabled: true,
      createdAt: new Date(),
    };

    copyConfigs.set(key, copyConfig);

    return { message: 'Copy trading started', config: copyConfig };
  });

  // Stop copying
  app.delete<{ Params: { leaderId: string } }>('/api/v1/copy/:leaderId', async (request) => {
    const userId = (request as any).userId as string;
    const key = `${userId}:${request.params.leaderId}`;

    if (!copyConfigs.has(key)) {
      return { error: 'Not copying this leader' };
    }

    copyConfigs.delete(key);
    return { message: 'Copy trading stopped' };
  });
}
