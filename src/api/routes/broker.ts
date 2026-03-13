/**
 * Broker API Routes — manage regional broker agents.
 *
 * Endpoints:
 *   GET  /api/v1/brokers           — list all brokers
 *   POST /api/v1/brokers           — register a new broker
 *   GET  /api/v1/brokers/:id       — get broker details
 *   GET  /api/v1/brokers/:id/agents     — list agents under a broker
 *   GET  /api/v1/brokers/:id/compliance — get compliance stats
 *   GET  /api/v1/brokers/:id/fees       — get fee aggregation
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { assertPermission, PermissionError } from '../../permissions/permissions.js';
import { Supervisor } from '../../supervisor/supervisor.js';
import { config } from '../../core/config.js';
import type { AuthContext } from '../../core/types.js';
import type { Jurisdiction } from '../../security/types.js';

let supervisor: Supervisor | null = null;

function getSupervisor(): Supervisor {
  if (!supervisor) {
    supervisor = new Supervisor(config.redis.url);
    supervisor.start().catch(() => { /* handled in start */ });
  }
  return supervisor;
}

function getAuthContext(request: any): AuthContext {
  return {
    userId: request.userId as string,
    tier: request.tier as 'admin' | 'broker' | 'ops' | 'user',
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

export async function brokerRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════
  // List all brokers
  // ═══════════════════════════════════════════════

  app.get('/api/v1/brokers', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const sv = getSupervisor();
    const brokers = await sv.getBrokers();
    return { brokers, total: brokers.length };
  });

  // ═══════════════════════════════════════════════
  // Register a new broker
  // ═══════════════════════════════════════════════

  app.post('/api/v1/brokers', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-agents'); } catch (err) { return handlePermissionError(err, reply); }

    const body = request.body as { jurisdiction: Jurisdiction };
    if (!body.jurisdiction) {
      return reply.code(400).send({ error: 'jurisdiction is required (US, EU, APAC, GLOBAL)' });
    }

    const validJurisdictions = new Set(['US', 'EU', 'APAC', 'GLOBAL']);
    if (!validJurisdictions.has(body.jurisdiction)) {
      return reply.code(400).send({ error: `Invalid jurisdiction. Must be one of: ${[...validJurisdictions].join(', ')}` });
    }

    const sv = getSupervisor();
    try {
      const broker = await sv.registerBroker(body.jurisdiction, ctx.userId);
      return reply.code(201).send({ broker });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════
  // Get broker details
  // ═══════════════════════════════════════════════

  app.get('/api/v1/brokers/:brokerId', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const { brokerId } = request.params as { brokerId: string };
    const sv = getSupervisor();
    const broker = await sv.getAgentDetails(brokerId);

    if (!broker) {
      return reply.code(404).send({ error: 'Broker not found' });
    }

    return { broker };
  });

  // ═══════════════════════════════════════════════
  // List agents managed by a broker
  // ═══════════════════════════════════════════════

  app.get('/api/v1/brokers/:brokerId/agents', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const { brokerId } = request.params as { brokerId: string };
    const sv = getSupervisor();

    // Get the broker to find its jurisdiction
    const broker = await sv.getAgentDetails(brokerId);
    if (!broker) {
      return reply.code(404).send({ error: 'Broker not found' });
    }

    // Get all agents, filter by those belonging to this broker's jurisdiction
    const allAgents = await sv.getAllAgents({});
    const brokerAgents = allAgents.filter(
      (a: any) => a.parentAgentId === brokerId || a.jurisdiction === broker.jurisdiction,
    );

    return { agents: brokerAgents, total: brokerAgents.length };
  });

  // ═══════════════════════════════════════════════
  // Get broker compliance stats
  // ═══════════════════════════════════════════════

  app.get('/api/v1/brokers/:brokerId/compliance', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const { brokerId } = request.params as { brokerId: string };
    const sv = getSupervisor();

    const broker = await sv.getAgentDetails(brokerId);
    if (!broker) {
      return reply.code(404).send({ error: 'Broker not found' });
    }

    // Return compliance summary (in production: from compliance engine logs)
    return {
      brokerId,
      jurisdiction: broker.jurisdiction ?? 'GLOBAL',
      totalChecks: 0,
      passed: 0,
      rejected: 0,
      flagged: 0,
    };
  });

  // ═══════════════════════════════════════════════
  // Get broker fee aggregation
  // ═══════════════════════════════════════════════

  app.get('/api/v1/brokers/:brokerId/fees', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const { brokerId } = request.params as { brokerId: string };
    const query = request.query as { from?: string; to?: string };

    const sv = getSupervisor();
    const broker = await sv.getAgentDetails(brokerId);
    if (!broker) {
      return reply.code(404).send({ error: 'Broker not found' });
    }

    try {
      const fees = await sv.reconcileBrokerFees(
        brokerId,
        query.from,
        query.to,
      );
      return { fees };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
