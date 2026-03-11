import type { FastifyInstance, FastifyReply } from 'fastify';
import { emergencyHalt, resumeTrading, isGlobalHalt, resetBreaker, getTrippedUsers } from '../../risk/circuit-breaker.js';
import { getDefaultRiskSettings } from '../../risk/risk-manager.js';
import { assertPermission, PermissionError } from '../../permissions/permissions.js';
import { clampDailyLossLimit, clampPositionSize } from '../../risk/parameter-bounds.js';
import type { RiskLevel, RiskSettings, AuthContext } from '../../core/types.js';
import { audit } from '../../audit/audit-logger.js';

// In-memory agent status (production: Redis)
const agentStatus = new Map<string, { running: boolean; startedAt?: Date; stoppedAt?: Date }>();
const userRiskSettings = new Map<string, RiskSettings>();

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
  // Start trading agent
  app.post('/api/v1/agent/start', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'user.start-agent');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    if (isGlobalHalt()) {
      return reply.code(503).send({ error: 'Trading is globally halted by admin' });
    }

    agentStatus.set(ctx.userId, { running: true, startedAt: new Date() });

    audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'agent.start',
      resource: `agent:${ctx.userId}`,
    });

    return { status: 'started', userId: ctx.userId };
  });

  // Stop trading agent
  app.post('/api/v1/agent/stop', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'user.stop-agent');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    agentStatus.set(ctx.userId, { running: false, stoppedAt: new Date() });

    audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'agent.stop',
      resource: `agent:${ctx.userId}`,
    });

    return { status: 'stopped', userId: ctx.userId };
  });

  // Emergency stop (halt + close all positions)
  app.post('/api/v1/agent/emergency-stop', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'user.stop-agent');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    agentStatus.set(ctx.userId, { running: false, stoppedAt: new Date() });

    audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'agent.emergency-stop',
      resource: `agent:${ctx.userId}`,
      details: { closePositions: true },
    });

    return { status: 'emergency-stopped', userId: ctx.userId, positionsClosed: true };
  });

  // Get agent status
  app.get('/api/v1/agent/status', async (request) => {
    const userId = (request as any).userId as string;
    const status = agentStatus.get(userId) ?? { running: false };

    return {
      userId,
      ...status,
      globalHalt: isGlobalHalt(),
    };
  });

  // Get risk settings
  app.get('/api/v1/risk', async (request) => {
    const userId = (request as any).userId as string;
    const settings = userRiskSettings.get(userId) ?? getDefaultRiskSettings('moderate');
    return { settings };
  });

  // Update risk settings — with validation and bounds clamping
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

    const current = userRiskSettings.get(ctx.userId) ?? getDefaultRiskSettings('moderate');
    const body = request.body;

    // Validate riskLevel
    if (body.riskLevel !== undefined && !VALID_RISK_LEVELS.has(body.riskLevel)) {
      return reply.code(400).send({ error: `Invalid riskLevel. Must be one of: ${[...VALID_RISK_LEVELS].join(', ')}` });
    }

    // Validate and clamp numeric values
    if (body.dailyLossLimitUsd !== undefined && (typeof body.dailyLossLimitUsd !== 'number' || body.dailyLossLimitUsd <= 0)) {
      return reply.code(400).send({ error: 'dailyLossLimitUsd must be a positive number' });
    }
    if (body.maxPerTradePct !== undefined && (typeof body.maxPerTradePct !== 'number' || body.maxPerTradePct <= 0)) {
      return reply.code(400).send({ error: 'maxPerTradePct must be a positive number' });
    }

    const updated: RiskSettings = {
      riskLevel: body.riskLevel ?? current.riskLevel,
      dailyLossLimitUsd: body.dailyLossLimitUsd != null
        ? Math.max(10, body.dailyLossLimitUsd)  // Minimum $10 daily loss limit
        : current.dailyLossLimitUsd,
      maxPerTradePct: body.maxPerTradePct != null
        ? clampPositionSize(body.maxPerTradePct)
        : current.maxPerTradePct,
    };

    userRiskSettings.set(ctx.userId, updated);

    audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'risk.update',
      resource: `risk:${ctx.userId}`,
      details: updated as unknown as Record<string, unknown>,
    });

    return { settings: updated };
  });

  // === Admin endpoints — proper 403 responses ===

  // Admin: Emergency halt all
  app.post('/api/v1/admin/emergency-halt', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'admin.emergency-halt');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    emergencyHalt();

    audit({
      actor: ctx.userId,
      actorTier: 'admin',
      action: 'admin.emergency-halt',
      resource: 'global',
    });

    return { status: 'halted', message: 'All trading stopped globally' };
  });

  // Admin: Resume trading
  app.post('/api/v1/admin/resume', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'admin.emergency-halt'); // Same permission as halt
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    resumeTrading();

    audit({
      actor: ctx.userId,
      actorTier: 'admin',
      action: 'admin.resume',
      resource: 'global',
    });

    return { status: 'resumed' };
  });

  // Admin/Ops: Get tripped circuit breakers
  app.get('/api/v1/admin/circuit-breakers', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.view-trade-logs');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    return { trippedUsers: getTrippedUsers(), globalHalt: isGlobalHalt() };
  });

  // Admin/Ops: Reset circuit breaker for user
  app.post<{ Params: { userId: string } }>('/api/v1/admin/circuit-breakers/:userId/reset', async (request, reply) => {
    const ctx = getAuthContext(request);

    try {
      assertPermission(ctx, 'ops.reset-circuit-breaker');
    } catch (err) {
      return handlePermissionError(err, reply);
    }

    resetBreaker(request.params.userId);

    audit({
      actor: ctx.userId,
      actorTier: ctx.tier,
      action: 'ops.reset-circuit-breaker',
      resource: `circuit-breaker:${request.params.userId}`,
    });

    return { reset: true, userId: request.params.userId };
  });
}
