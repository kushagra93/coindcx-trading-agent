import type { FastifyInstance, FastifyReply } from 'fastify';
import { assertPermission, PermissionError } from '../../permissions/permissions.js';
import { Supervisor } from '../../supervisor/supervisor.js';
import { config } from '../../core/config.js';
import type { AuthContext, Chain, RiskLevel } from '../../core/types.js';

// Create a singleton supervisor instance
let supervisor: Supervisor | null = null;

function getSupervisor(): Supervisor {
  if (!supervisor) {
    supervisor = new Supervisor(config.redis.url, config.supervisor.deadAgentTimeoutMs);
    supervisor.start().catch(() => { /* handled in start */ });
  }
  return supervisor;
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

export async function supervisorRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════
  // Aggregate Stats
  // ═══════════════════════════════════════════════

  app.get('/api/v1/supervisor/stats', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const sv = getSupervisor();
    const stats = await sv.getAggregateStats();
    const policy = await sv.policyEngine.getPolicy();

    return {
      ...stats,
      globalHalt: sv.isHalted(),
      policy: {
        maintenanceMode: policy.maintenanceMode,
        maxAgentsPerUser: policy.maxAgentsPerUser,
        maxTotalAgents: policy.maxTotalAgents,
      },
    };
  });

  // ═══════════════════════════════════════════════
  // Agent CRUD
  // ═══════════════════════════════════════════════

  // Create a new agent
  app.post('/api/v1/supervisor/agents', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-agents'); } catch (err) { return handlePermissionError(err, reply); }

    const body = request.body as { userId: string; strategy: string; chain: Chain; riskLevel?: RiskLevel };
    if (!body.userId || !body.strategy || !body.chain) {
      return reply.code(400).send({ error: 'userId, strategy, and chain are required' });
    }

    try {
      const agent = await getSupervisor().createAgent(body.userId, {
        strategy: body.strategy,
        chain: body.chain,
        riskLevel: body.riskLevel,
      }, ctx.userId);
      return reply.code(201).send({ agent });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // List all agents
  app.get('/api/v1/supervisor/agents', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const query = request.query as { userId?: string; state?: string; chain?: string; strategy?: string };
    const agents = await getSupervisor().getAllAgents(query);
    return { agents, total: agents.length };
  });

  // Get agent details
  app.get('/api/v1/supervisor/agents/:agentId', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const { agentId } = request.params as { agentId: string };
    const agent = await getSupervisor().getAgentDetails(agentId);
    if (!agent) return reply.code(404).send({ error: 'Agent not found' });
    return { agent };
  });

  // ═══════════════════════════════════════════════
  // Agent Lifecycle
  // ═══════════════════════════════════════════════

  app.post('/api/v1/supervisor/agents/:agentId/start', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-agents'); } catch (err) { return handlePermissionError(err, reply); }

    const { agentId } = request.params as { agentId: string };
    try {
      await getSupervisor().startAgent(agentId, ctx.userId);
      return { success: true, agentId };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/supervisor/agents/:agentId/stop', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-agents'); } catch (err) { return handlePermissionError(err, reply); }

    const { agentId } = request.params as { agentId: string };
    try {
      await getSupervisor().stopAgent(agentId, ctx.userId);
      return { success: true, agentId };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/supervisor/agents/:agentId/pause', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-agents'); } catch (err) { return handlePermissionError(err, reply); }

    const { agentId } = request.params as { agentId: string };
    try {
      await getSupervisor().pauseAgent(agentId, ctx.userId);
      return { success: true, agentId };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/supervisor/agents/:agentId/resume', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-agents'); } catch (err) { return handlePermissionError(err, reply); }

    const { agentId } = request.params as { agentId: string };
    try {
      await getSupervisor().resumeAgent(agentId, ctx.userId);
      return { success: true, agentId };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // Destroy agent
  app.delete('/api/v1/supervisor/agents/:agentId', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-agents'); } catch (err) { return handlePermissionError(err, reply); }

    const { agentId } = request.params as { agentId: string };
    try {
      await getSupervisor().destroyAgent(agentId, ctx.userId);
      return { success: true, agentId };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════
  // Override Controls
  // ═══════════════════════════════════════════════

  app.post('/api/v1/supervisor/agents/:agentId/force-close', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.override-risk'); } catch (err) { return handlePermissionError(err, reply); }

    const { agentId } = request.params as { agentId: string };
    try {
      await getSupervisor().forceClosePositions(agentId, ctx.userId);
      return { success: true, agentId };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.put('/api/v1/supervisor/agents/:agentId/risk', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.override-risk'); } catch (err) { return handlePermissionError(err, reply); }

    const { agentId } = request.params as { agentId: string };
    const overrides = request.body as Record<string, unknown>;
    try {
      await getSupervisor().overrideRiskSettings(agentId, overrides as any, ctx.userId);
      return { success: true, agentId };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/api/v1/supervisor/agents/:agentId/strategy', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.deploy-strategy'); } catch (err) { return handlePermissionError(err, reply); }

    const { agentId } = request.params as { agentId: string };
    const strategyUpdate = request.body as Record<string, unknown>;
    try {
      await getSupervisor().pushStrategyUpdate(agentId, strategyUpdate, ctx.userId);
      return { success: true, agentId };
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════
  // Global Operations
  // ═══════════════════════════════════════════════

  app.post('/api/v1/supervisor/emergency-halt', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.emergency-halt'); } catch (err) { return handlePermissionError(err, reply); }

    await getSupervisor().emergencyHaltAll(ctx.userId);
    return { success: true, message: 'All agents halted' };
  });

  app.post('/api/v1/supervisor/resume-all', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.emergency-halt'); } catch (err) { return handlePermissionError(err, reply); }

    await getSupervisor().resumeAll(ctx.userId);
    return { success: true, message: 'All agents resumed' };
  });

  // ═══════════════════════════════════════════════
  // Policies
  // ═══════════════════════════════════════════════

  app.get('/api/v1/supervisor/policies', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-policies'); } catch (err) { return handlePermissionError(err, reply); }

    const policy = await getSupervisor().policyEngine.getPolicy();
    return { policy };
  });

  app.put('/api/v1/supervisor/policies', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-policies'); } catch (err) { return handlePermissionError(err, reply); }

    const updates = request.body as Record<string, unknown>;
    const policy = await getSupervisor().updateGlobalPolicies(updates as any, ctx.userId);
    return { policy };
  });

  // ═══════════════════════════════════════════════
  // Events & Monitoring
  // ═══════════════════════════════════════════════

  app.get('/api/v1/supervisor/events', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const query = request.query as { limit?: string };
    const limit = parseInt(query.limit ?? '50');
    const events = getSupervisor().getRecentEvents(limit);
    return { events };
  });
}
