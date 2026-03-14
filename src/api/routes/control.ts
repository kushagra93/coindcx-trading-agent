import type { FastifyInstance, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { emergencyHalt, resumeTrading, isGlobalHalt, resetBreaker, getTrippedUsers } from '../../risk/circuit-breaker.js';
import { getDefaultRiskSettings } from '../../risk/risk-manager.js';
import { assertPermission, PermissionError } from '../../permissions/permissions.js';
import { clampPositionSize } from '../../risk/parameter-bounds.js';
import type { RiskLevel, RiskSettings, AuthContext } from '../../core/types.js';
import { audit } from '../../audit/audit-logger.js';
import { getDb } from '../../db/index.js';
import { agentInstances, riskSettings as riskSettingsTable } from '../../db/schema.js';

const VALID_RISK_LEVELS: Set<string> = new Set(['conservative', 'moderate', 'aggressive']);

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

export async function controlRoutes(app: FastifyInstance) {
  app.post('/api/v1/agent/start', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'user.start-agent');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    if (await isGlobalHalt()) {
      return reply.code(503).send({ error: 'Trading is globally halted by admin' });
    }

    const db = getDb();
    await db
      .insert(agentInstances)
      .values({ agentId: `agent_${ctx.userId}`, userId: ctx.userId, tier: 'user', running: true, startedAt: new Date() })
      .onConflictDoUpdate({
        target: agentInstances.agentId,
        set: { running: true, startedAt: new Date(), stoppedAt: null },
      });

    await audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'agent.start',
      resource: `agent:${ctx.userId}`,
    });

    return { status: 'started', userId: ctx.userId };
  });

  app.post('/api/v1/agent/stop', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'user.stop-agent');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const db = getDb();
    await db
      .update(agentInstances)
      .set({ running: false, stoppedAt: new Date() })
      .where(eq(agentInstances.agentId, `agent_${ctx.userId}`));

    await audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'agent.stop',
      resource: `agent:${ctx.userId}`,
    });

    return { status: 'stopped', userId: ctx.userId };
  });

  app.post('/api/v1/agent/emergency-stop', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'user.stop-agent');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const db = getDb();
    await db
      .update(agentInstances)
      .set({ running: false, stoppedAt: new Date() })
      .where(eq(agentInstances.agentId, `agent_${ctx.userId}`));

    await audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'agent.emergency-stop',
      resource: `agent:${ctx.userId}`,
      details: { closePositions: true },
    });

    return { status: 'emergency-stopped', userId: ctx.userId, positionsClosed: true };
  });

  app.get('/api/v1/agent/status', async (request) => {
    const userId = (request as any).userId as string;
    const db = getDb();

    const [agent] = await db
      .select()
      .from(agentInstances)
      .where(eq(agentInstances.agentId, `agent_${userId}`))
      .limit(1);

    return {
      userId,
      running: agent?.running ?? false,
      startedAt: agent?.startedAt,
      stoppedAt: agent?.stoppedAt,
      globalHalt: await isGlobalHalt(),
    };
  });

  app.get('/api/v1/risk', async (request) => {
    const userId = (request as any).userId as string;
    const db = getDb();

    const [row] = await db
      .select()
      .from(riskSettingsTable)
      .where(eq(riskSettingsTable.userId, userId))
      .limit(1);

    const settings: RiskSettings = row
      ? { riskLevel: row.riskLevel as RiskLevel, dailyLossLimitUsd: row.dailyLossLimitUsd, maxPerTradePct: row.maxPerTradePct }
      : getDefaultRiskSettings('moderate');

    return { settings };
  });

  app.put<{
    Body: {
      riskLevel?: RiskLevel;
      dailyLossLimitUsd?: number;
      maxPerTradePct?: number;
    };
  }>('/api/v1/risk', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'user.set-risk');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    const db = getDb();
    const body = request.body;

    const [currentRow] = await db
      .select()
      .from(riskSettingsTable)
      .where(eq(riskSettingsTable.userId, ctx.userId))
      .limit(1);

    const current: RiskSettings = currentRow
      ? { riskLevel: currentRow.riskLevel as RiskLevel, dailyLossLimitUsd: currentRow.dailyLossLimitUsd, maxPerTradePct: currentRow.maxPerTradePct }
      : getDefaultRiskSettings('moderate');

    if (body.riskLevel !== undefined && !VALID_RISK_LEVELS.has(body.riskLevel)) {
      return reply.code(400).send({ error: `Invalid riskLevel. Must be one of: ${[...VALID_RISK_LEVELS].join(', ')}` });
    }

    if (body.dailyLossLimitUsd !== undefined && (typeof body.dailyLossLimitUsd !== 'number' || body.dailyLossLimitUsd <= 0)) {
      return reply.code(400).send({ error: 'dailyLossLimitUsd must be a positive number' });
    }
    if (body.maxPerTradePct !== undefined && (typeof body.maxPerTradePct !== 'number' || body.maxPerTradePct <= 0)) {
      return reply.code(400).send({ error: 'maxPerTradePct must be a positive number' });
    }

    const updated: RiskSettings = {
      riskLevel: body.riskLevel ?? current.riskLevel,
      dailyLossLimitUsd: body.dailyLossLimitUsd != null
        ? Math.max(10, body.dailyLossLimitUsd)
        : current.dailyLossLimitUsd,
      maxPerTradePct: body.maxPerTradePct != null
        ? clampPositionSize(body.maxPerTradePct)
        : current.maxPerTradePct,
    };

    await db
      .insert(riskSettingsTable)
      .values({
        userId: ctx.userId,
        riskLevel: updated.riskLevel,
        dailyLossLimitUsd: updated.dailyLossLimitUsd,
        maxPerTradePct: updated.maxPerTradePct,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: riskSettingsTable.userId,
        set: {
          riskLevel: updated.riskLevel,
          dailyLossLimitUsd: updated.dailyLossLimitUsd,
          maxPerTradePct: updated.maxPerTradePct,
          updatedAt: new Date(),
        },
      });

    await audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'risk.update',
      resource: `risk:${ctx.userId}`,
      details: updated as unknown as Record<string, unknown>,
    });

    return { settings: updated };
  });

  app.post('/api/v1/admin/emergency-halt', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'admin.emergency-halt');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    await emergencyHalt();

    await audit({
      actor: ctx.userId,
      actorTier: 'admin',
      action: 'admin.emergency-halt',
      resource: 'global',
    });

    return { status: 'halted', message: 'All trading stopped globally' };
  });

  app.post('/api/v1/admin/resume', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'admin.emergency-halt');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    await resumeTrading();

    await audit({
      actor: ctx.userId,
      actorTier: 'admin',
      action: 'admin.resume',
      resource: 'global',
    });

    return { status: 'resumed' };
  });

  app.get('/api/v1/admin/circuit-breakers', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    return { trippedUsers: await getTrippedUsers(), globalHalt: await isGlobalHalt() };
  });

  app.post<{ Params: { userId: string } }>('/api/v1/admin/circuit-breakers/:userId/reset', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.reset-circuit-breaker');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    await resetBreaker(request.params.userId);

    await audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'ops.reset-circuit-breaker',
      resource: `circuit-breaker:${request.params.userId}`,
    });

    return { reset: true, userId: request.params.userId };
  });
}
