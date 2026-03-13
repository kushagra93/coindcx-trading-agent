import type { FastifyInstance, FastifyReply } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { assertPermission, PermissionError } from '../../permissions/permissions.js';
import { getBuilderFeeSummary, getTotalAccumulatedFees } from '../../trader/fee-manager.js';
import { isGlobalHalt } from '../../risk/circuit-breaker.js';
import { config } from '../../core/config.js';
import { getDb, isDbConfigured } from '../../db/index.js';
import { agentInstances } from '../../db/schema.js';
import type { AuthContext } from '../../core/types.js';

async function seedDemoAgents(): Promise<void> {
  if (!isDbConfigured()) return;
  const db = getDb();
  const [existing] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentInstances);

  if ((existing?.count ?? 0) > 0) return;

  const demoAgents = [
    { agentId: 'agt_001', userId: 'usr_k8x92m', tier: 'user', running: true, startedAt: new Date(Date.now() - 3600_000 * 4), metadata: { strategy: 'Meme Sniper', chain: 'solana', tradesExecuted: 47, volumeUsd: 12_840, pnlUsd: 892 } },
    { agentId: 'agt_002', userId: 'usr_p3n71q', tier: 'user', running: true, startedAt: new Date(Date.now() - 3600_000 * 12), metadata: { strategy: 'DCA Blue Chip', chain: 'ethereum', tradesExecuted: 8, volumeUsd: 45_200, pnlUsd: 1_230 } },
    { agentId: 'agt_003', userId: 'usr_j5w88r', tier: 'user', running: true, startedAt: new Date(Date.now() - 3600_000 * 2), metadata: { strategy: 'Perp Momentum', chain: 'hyperliquid', tradesExecuted: 23, volumeUsd: 68_500, pnlUsd: -340 } },
    { agentId: 'agt_004', userId: 'usr_m2c44x', tier: 'user', running: true, startedAt: new Date(Date.now() - 3600_000 * 8), metadata: { strategy: 'Copy Trade', chain: 'base', tradesExecuted: 15, volumeUsd: 8_920, pnlUsd: 445 } },
    { agentId: 'agt_005', userId: 'usr_t9v66p', tier: 'user', running: true, startedAt: new Date(Date.now() - 3600_000 * 1), metadata: { strategy: 'Perp Momentum', chain: 'hyperliquid', tradesExecuted: 6, volumeUsd: 22_100, pnlUsd: 178 } },
    { agentId: 'agt_006', userId: 'usr_a7b33n', tier: 'user', running: false, startedAt: new Date(Date.now() - 3600_000 * 24), stoppedAt: new Date(Date.now() - 3600_000 * 2), metadata: { strategy: 'Grid Trading', chain: 'arbitrum', tradesExecuted: 112, volumeUsd: 34_600, pnlUsd: 1_890 } },
    { agentId: 'agt_007', userId: 'usr_f1d22k', tier: 'user', running: true, startedAt: new Date(Date.now() - 3600_000 * 6), metadata: { strategy: 'Meme Sniper', chain: 'monad', tradesExecuted: 31, volumeUsd: 9_450, pnlUsd: 2_120 } },
    { agentId: 'agt_008', userId: 'usr_h8g55w', tier: 'user', running: false, startedAt: new Date(Date.now() - 3600_000 * 3), metadata: { strategy: 'DCA Blue Chip', chain: 'sui', tradesExecuted: 4, volumeUsd: 3_200, pnlUsd: -45 } },
  ];

  await db.insert(agentInstances).values(demoAgents).onConflictDoNothing();
}

function getAuthContext(request: any): AuthContext {
  return {
    userId: request.userId as string,
    tier: request.tier as 'admin' | 'ops' | 'user',
    hostApp: 'default',
  };
}

function handlePermissionError(err: unknown, reply: FastifyReply): void {
  if (err instanceof PermissionError) {
    reply.code(403).send({ error: err.message });
  } else {
    throw err;
  }
}

export async function adminRoutes(app: FastifyInstance) {
  await seedDemoAgents();

  app.get('/api/v1/admin/overview', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const db = getDb();
    const agents = await db.select().from(agentInstances);

    const runningAgents = agents.filter(a => a.running);
    const stoppedAgents = agents.filter(a => !a.running && !(a.metadata as any)?.error);
    const errorAgents = agents.filter(a => (a.metadata as any)?.status === 'error');

    const totalVolume = agents.reduce((sum, a) => sum + ((a.metadata as any)?.volumeUsd ?? 0), 0);
    const totalTrades = agents.reduce((sum, a) => sum + ((a.metadata as any)?.tradesExecuted ?? 0), 0);
    const totalPnl = agents.reduce((sum, a) => sum + ((a.metadata as any)?.pnlUsd ?? 0), 0);

    const platformFees = await getTotalAccumulatedFees();
    const builderFees = await getBuilderFeeSummary();

    return {
      agents: {
        total: agents.length,
        running: runningAgents.length,
        stopped: stoppedAgents.length,
        error: errorAgents.length,
      },
      volume: { totalUsd: totalVolume, totalTrades, totalPnlUsd: totalPnl },
      fees: {
        platform: platformFees,
        builder: {
          code: builderFees.builderCode,
          totalFeeUsd: builderFees.totalFeeUsd,
          totalVolumeUsd: builderFees.totalVolumeUsd,
          tradeCount: builderFees.tradeCount,
        },
      },
      globalHalt: await isGlobalHalt(),
      hyperliquid: {
        builderCode: config.hyperliquid.builderCode,
        builderFeeBps: config.hyperliquid.builderFeeBps,
        mainnet: config.hyperliquid.mainnet,
      },
    };
  });

  app.get('/api/v1/admin/agents', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const db = getDb();
    const agents = await db.select().from(agentInstances);

    agents.sort((a, b) => {
      if (a.running && !b.running) return -1;
      if (!a.running && b.running) return 1;
      return b.startedAt.getTime() - a.startedAt.getTime();
    });

    return {
      agents: agents.map(a => ({
        agentId: a.agentId,
        userId: a.userId,
        tier: a.tier,
        running: a.running,
        startedAt: a.startedAt,
        stoppedAt: a.stoppedAt,
        ...(a.metadata as Record<string, unknown> ?? {}),
      })),
    };
  });

  app.get('/api/v1/admin/fees', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const platformFees = await getTotalAccumulatedFees();
    const builderFees = await getBuilderFeeSummary();

    return {
      platform: platformFees,
      builder: builderFees,
      config: {
        builderCode: config.hyperliquid.builderCode,
        builderFeeBps: config.hyperliquid.builderFeeBps,
        feeTiers: [
          { minAumUsd: 10_000, feePct: 0.15 },
          { minAumUsd: 1_000, feePct: 0.20 },
          { minAumUsd: 0, feePct: 0.25 },
        ],
        copyTradeProfitShare: 10,
      },
    };
  });
}
