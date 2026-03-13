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
import { eq, and, sql, desc } from 'drizzle-orm';
import type { LeadTrader, CopyConfig, Chain } from '../../core/types.js';
import { getDb, isDbConfigured } from '../../db/index.js';
import { leadTraders as leadTradersTable, copyConfigs as copyConfigsTable } from '../../db/schema.js';

async function seedLeadTraders() {
  if (!isDbConfigured()) return;
  const db = getDb();
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leadTradersTable);

  if ((existing?.count ?? 0) > 0) return;

  const samples = [
    {
      id: 'lt-001', name: 'SolanaWhale',
      walletAddresses: { solana: 'DummyAddress1', ethereum: '', polygon: '', base: '', arbitrum: '', hyperliquid: '' },
      pnl30d: 18.5, pnl90d: 42.3, winRate: 0.72, maxDrawdown: -8.2, sharpeRatio: 2.1,
      copiersCount: 234, aumUsd: 1_500_000, trackRecordDays: 120, verified: true,
    },
    {
      id: 'lt-002', name: 'DeFiMaster',
      walletAddresses: { solana: '', ethereum: 'DummyAddress2', polygon: 'DummyAddress3', base: '', arbitrum: '', hyperliquid: '' },
      pnl30d: 12.1, pnl90d: 35.8, winRate: 0.68, maxDrawdown: -12.5, sharpeRatio: 1.8,
      copiersCount: 156, aumUsd: 800_000, trackRecordDays: 90, verified: true,
    },
  ];

  await db.insert(leadTradersTable).values(samples).onConflictDoNothing();
}

function rowToLeadTrader(row: typeof leadTradersTable.$inferSelect): LeadTrader {
  return {
    id: row.id,
    name: row.name,
    walletAddresses: (row.walletAddresses ?? {}) as Record<Chain, string>,
    pnl30d: row.pnl30d,
    pnl90d: row.pnl90d,
    winRate: row.winRate,
    maxDrawdown: row.maxDrawdown,
    sharpeRatio: row.sharpeRatio,
    copiersCount: row.copiersCount,
    aumUsd: row.aumUsd,
    trackRecordDays: row.trackRecordDays,
    verified: row.verified,
  };
}

export async function leaderboardRoutes(app: FastifyInstance) {
  await seedLeadTraders();

  // Live leaderboard powered by GMGN
  app.get<{ Querystring: { sort?: string; period?: string; limit?: string } }>(
    '/api/v1/leaderboard/live',
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

  // DB-backed leaderboard (internal lead traders)
  app.get<{ Querystring: { sort?: string; page?: string; limit?: string } }>(
    '/api/v1/leaderboard',
    async (request) => {
      const sort = request.query.sort ?? 'sharpe';
      const page = parseInt(request.query.page ?? '1');
      const limit = Math.min(parseInt(request.query.limit ?? '20'), 50);
      const offset = (page - 1) * limit;

      const db = getDb();

      const orderCol = sort === 'pnl30d' ? leadTradersTable.pnl30d
        : sort === 'pnl90d' ? leadTradersTable.pnl90d
        : sort === 'winRate' ? leadTradersTable.winRate
        : sort === 'copiers' ? leadTradersTable.copiersCount
        : leadTradersTable.sharpeRatio;

      const rows = await db
        .select()
        .from(leadTradersTable)
        .where(and(eq(leadTradersTable.verified, true), sql`${leadTradersTable.trackRecordDays} >= 30`))
        .orderBy(desc(orderCol))
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(leadTradersTable)
        .where(and(eq(leadTradersTable.verified, true), sql`${leadTradersTable.trackRecordDays} >= 30`));

      return {
        traders: rows.map(t => ({
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
        pagination: { page, limit, total: countResult?.count ?? 0 },
      };
    }
  );

  app.get<{ Params: { id: string } }>('/api/v1/leaderboard/:id', async (request, reply) => {
    const db = getDb();
    const [row] = await db
      .select()
      .from(leadTradersTable)
      .where(eq(leadTradersTable.id, request.params.id))
      .limit(1);

    if (!row) {
      return reply.code(404).send({ error: 'Trader not found' });
    }
    return { trader: rowToLeadTrader(row) };
  });

  // Copy trading via wallet address (live engine)
  app.post<{
    Body: {
      walletAddress: string;
      walletName?: string;
      buyMode?: BuyMode;
      buyAmount?: number;
      sellMethod?: SellMethod;
    };
  }>('/api/v1/copy/wallet', async (request) => {
    const { walletAddress, walletName, buyMode, buyAmount, sellMethod } = request.body ?? {};
    if (!walletAddress) return { error: 'walletAddress is required' };

    const copyConfig: CopyTradeConfig = {
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

    const result = startCopyTrading(copyConfig);
    return { message: 'Copy trading started', config: result };
  });

  app.delete<{ Params: { wallet: string } }>('/api/v1/copy/wallet/:wallet', async (request) => {
    const wallet = request.params.wallet;
    const stopped = stopCopyTrading(wallet);
    if (!stopped) return { error: 'Not copying this wallet' };
    return { message: 'Stopped copy-trading', wallet };
  });

  app.post<{ Params: { wallet: string } }>('/api/v1/copy/wallet/:wallet/pause', async (request) => {
    const paused = pauseCopyTrading(request.params.wallet);
    if (!paused) return { error: 'Not copying this wallet' };
    return { message: 'Copy trading paused', wallet: request.params.wallet };
  });

  app.post<{ Params: { wallet: string } }>('/api/v1/copy/wallet/:wallet/resume', async (request) => {
    const resumed = resumeCopyTrading(request.params.wallet);
    if (!resumed) return { error: 'Not copying this wallet' };
    return { message: 'Copy trading resumed', wallet: request.params.wallet };
  });

  app.get('/api/v1/copy/wallet', async () => {
    const configs = getCopyConfigs();
    return { following: configs, total: configs.length };
  });

  app.get<{ Params: { wallet: string } }>('/api/v1/copy/wallet/:wallet', async (request) => {
    const cfg = getCopyConfig(request.params.wallet);
    if (!cfg) return { error: 'Not copying this wallet' };
    return { config: cfg };
  });

  app.get<{ Querystring: { limit?: string; wallet?: string } }>(
    '/api/v1/copy/activity',
    async (request) => {
      const limit = Math.min(parseInt(request.query.limit ?? '20'), 50);
      const activities = getRecentActivity(limit, request.query.wallet);
      return { activities, total: activities.length };
    }
  );

  // Copy trading via DB lead trader (internal)
  app.post<{
    Params: { leaderId: string };
    Body: { budgetUsd: number; maxPerTradePct?: number };
  }>('/api/v1/copy/:leaderId', async (request, reply) => {
    const userId = (request as any).userId as string;
    const db = getDb();

    const [leader] = await db
      .select()
      .from(leadTradersTable)
      .where(eq(leadTradersTable.id, request.params.leaderId))
      .limit(1);

    if (!leader) {
      return reply.code(404).send({ error: 'Leader not found' });
    }

    const [inserted] = await db
      .insert(copyConfigsTable)
      .values({
        userId,
        leadTraderId: leader.id,
        budgetUsd: request.body.budgetUsd,
        maxPerTradePct: request.body.maxPerTradePct ?? 10,
        enabled: true,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [copyConfigsTable.userId, copyConfigsTable.leadTraderId],
        set: {
          budgetUsd: request.body.budgetUsd,
          maxPerTradePct: request.body.maxPerTradePct ?? 10,
          enabled: true,
        },
      })
      .returning();

    return {
      message: 'Copy trading started',
      config: {
        userId: inserted.userId,
        leadTraderId: inserted.leadTraderId,
        budgetUsd: inserted.budgetUsd,
        maxPerTradePct: inserted.maxPerTradePct,
        enabled: inserted.enabled,
        createdAt: inserted.createdAt,
      },
    };
  });

  app.delete<{ Params: { leaderId: string } }>('/api/v1/copy/:leaderId', async (request, reply) => {
    const userId = (request as any).userId as string;
    const db = getDb();

    const deleted = await db
      .delete(copyConfigsTable)
      .where(and(
        eq(copyConfigsTable.userId, userId),
        eq(copyConfigsTable.leadTraderId, request.params.leaderId),
      ))
      .returning();

    if (deleted.length === 0) {
      return reply.code(404).send({ error: 'Not copying this leader' });
    }

    return { message: 'Copy trading stopped' };
  });
}
