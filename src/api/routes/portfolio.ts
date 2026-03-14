import type { FastifyInstance } from 'fastify';
import { getUserPositions, getUserStats, getUserClosedTrades } from '../../trader/position-manager.js';
import { getUnsettledFees } from '../../trader/fee-manager.js';

export async function portfolioRoutes(app: FastifyInstance) {
  app.get('/api/v1/portfolio', async (request) => {
    const userId = (request as any).userId as string;
    const stats = await getUserStats(userId);
    const unsettledFees = await getUnsettledFees(userId);

    const feesObj: Record<string, number> = {};
    for (const [key, value] of unsettledFees) {
      feesObj[key] = value;
    }

    return {
      userId,
      stats: {
        totalPnl: stats.totalPnl,
        totalTrades: stats.totalTrades,
        winRate: stats.winRate,
        openPositions: stats.openPositions,
      },
      unsettledFees: feesObj,
    };
  });

  app.get('/api/v1/positions', async (request) => {
    const userId = (request as any).userId as string;
    const positions = await getUserPositions(userId);

    return {
      positions: positions.map(p => ({
        id: p.id,
        chain: p.chain,
        token: p.token,
        tokenSymbol: p.tokenSymbol,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        amount: p.amount,
        costBasis: p.costBasis,
        unrealizedPnl: p.unrealizedPnl,
        unrealizedPnlPct: p.unrealizedPnlPct,
        status: p.status,
        strategyId: p.strategyId,
        openedAt: p.openedAt,
      })),
    };
  });

  app.get<{ Params: { id: string } }>('/api/v1/positions/:id', async (request) => {
    const userId = (request as any).userId as string;
    const positions = await getUserPositions(userId);
    const position = positions.find(p => p.id === request.params.id);

    if (!position) {
      return { error: 'Position not found' };
    }

    return {
      position,
      explanation: 'Trade executed based on strategy rules',
    };
  });

  app.get<{ Querystring: { page?: string; limit?: string } }>('/api/v1/trades', async (request) => {
    const userId = (request as any).userId as string;
    const page = parseInt(request.query.page ?? '1');
    const limit = Math.min(parseInt(request.query.limit ?? '20'), 100);

    const trades = await getUserClosedTrades(userId);
    const start = (page - 1) * limit;
    const paginated = trades.slice(start, start + limit);

    return {
      trades: paginated,
      pagination: {
        page,
        limit,
        total: trades.length,
        totalPages: Math.ceil(trades.length / limit),
      },
    };
  });
}
