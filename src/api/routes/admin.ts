import type { FastifyInstance, FastifyReply } from 'fastify';
import { assertPermission, PermissionError } from '../../permissions/permissions.js';
import { getBuilderFeeSummary, getTotalAccumulatedFees } from '../../trader/fee-manager.js';
import { isGlobalHalt } from '../../risk/circuit-breaker.js';
import { config } from '../../core/config.js';
import type { AuthContext } from '../../core/types.js';

// In-memory agent registry (production: Redis/PostgreSQL)
// This tracks all active agent instances across users
interface AgentInstance {
  userId: string;
  agentId: string;
  status: 'running' | 'stopped' | 'error';
  startedAt: Date;
  stoppedAt?: Date;
  strategy: string;
  chain: string;
  tradesExecuted: number;
  volumeUsd: number;
  pnlUsd: number;
}

const activeAgents = new Map<string, AgentInstance>();

// Seed demo data for the admin panel
function seedDemoAgents(): void {
  if (activeAgents.size > 0) return;

  const demoAgents: AgentInstance[] = [
    {
      userId: 'usr_k8x92m',
      agentId: 'agt_001',
      status: 'running',
      startedAt: new Date(Date.now() - 3600_000 * 4),
      strategy: 'Meme Sniper',
      chain: 'solana',
      tradesExecuted: 47,
      volumeUsd: 12_840,
      pnlUsd: 892,
    },
    {
      userId: 'usr_p3n71q',
      agentId: 'agt_002',
      status: 'running',
      startedAt: new Date(Date.now() - 3600_000 * 12),
      strategy: 'DCA Blue Chip',
      chain: 'ethereum',
      tradesExecuted: 8,
      volumeUsd: 45_200,
      pnlUsd: 1_230,
    },
    {
      userId: 'usr_j5w88r',
      agentId: 'agt_003',
      status: 'running',
      startedAt: new Date(Date.now() - 3600_000 * 2),
      strategy: 'Perp Momentum',
      chain: 'hyperliquid',
      tradesExecuted: 23,
      volumeUsd: 68_500,
      pnlUsd: -340,
    },
    {
      userId: 'usr_m2c44x',
      agentId: 'agt_004',
      status: 'running',
      startedAt: new Date(Date.now() - 3600_000 * 8),
      strategy: 'Copy Trade',
      chain: 'base',
      tradesExecuted: 15,
      volumeUsd: 8_920,
      pnlUsd: 445,
    },
    {
      userId: 'usr_t9v66p',
      agentId: 'agt_005',
      status: 'running',
      startedAt: new Date(Date.now() - 3600_000 * 1),
      strategy: 'Perp Momentum',
      chain: 'hyperliquid',
      tradesExecuted: 6,
      volumeUsd: 22_100,
      pnlUsd: 178,
    },
    {
      userId: 'usr_a7b33n',
      agentId: 'agt_006',
      status: 'stopped',
      startedAt: new Date(Date.now() - 3600_000 * 24),
      stoppedAt: new Date(Date.now() - 3600_000 * 2),
      strategy: 'Grid Trading',
      chain: 'arbitrum',
      tradesExecuted: 112,
      volumeUsd: 34_600,
      pnlUsd: 1_890,
    },
    {
      userId: 'usr_f1d22k',
      agentId: 'agt_007',
      status: 'running',
      startedAt: new Date(Date.now() - 3600_000 * 6),
      strategy: 'Meme Sniper',
      chain: 'monad',
      tradesExecuted: 31,
      volumeUsd: 9_450,
      pnlUsd: 2_120,
    },
    {
      userId: 'usr_h8g55w',
      agentId: 'agt_008',
      status: 'error',
      startedAt: new Date(Date.now() - 3600_000 * 3),
      strategy: 'DCA Blue Chip',
      chain: 'sui',
      tradesExecuted: 4,
      volumeUsd: 3_200,
      pnlUsd: -45,
    },
  ];

  for (const agent of demoAgents) {
    activeAgents.set(agent.agentId, agent);
  }
}

seedDemoAgents();

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
  // Admin overview — agents count, total fees, builder fees
  app.get('/api/v1/admin/overview', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const agents = Array.from(activeAgents.values());
    const runningAgents = agents.filter(a => a.status === 'running');
    const stoppedAgents = agents.filter(a => a.status === 'stopped');
    const errorAgents = agents.filter(a => a.status === 'error');

    const totalVolume = agents.reduce((sum, a) => sum + a.volumeUsd, 0);
    const totalTrades = agents.reduce((sum, a) => sum + a.tradesExecuted, 0);
    const totalPnl = agents.reduce((sum, a) => sum + a.pnlUsd, 0);

    const platformFees = getTotalAccumulatedFees();
    const builderFees = getBuilderFeeSummary();

    return {
      agents: {
        total: agents.length,
        running: runningAgents.length,
        stopped: stoppedAgents.length,
        error: errorAgents.length,
      },
      volume: {
        totalUsd: totalVolume,
        totalTrades,
        totalPnlUsd: totalPnl,
      },
      fees: {
        platform: platformFees,
        builder: {
          code: builderFees.builderCode,
          totalFeeUsd: builderFees.totalFeeUsd,
          totalVolumeUsd: builderFees.totalVolumeUsd,
          tradeCount: builderFees.tradeCount,
        },
      },
      globalHalt: isGlobalHalt(),
      hyperliquid: {
        builderCode: config.hyperliquid.builderCode,
        builderFeeBps: config.hyperliquid.builderFeeBps,
        mainnet: config.hyperliquid.mainnet,
      },
    };
  });

  // List all agents
  app.get('/api/v1/admin/agents', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const agents = Array.from(activeAgents.values());

    // Sort by status (running first), then by startedAt desc
    agents.sort((a, b) => {
      if (a.status === 'running' && b.status !== 'running') return -1;
      if (a.status !== 'running' && b.status === 'running') return 1;
      return b.startedAt.getTime() - a.startedAt.getTime();
    });

    return { agents };
  });

  // Fee breakdown
  app.get('/api/v1/admin/fees', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const platformFees = getTotalAccumulatedFees();
    const builderFees = getBuilderFeeSummary();

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
