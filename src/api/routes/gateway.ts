/**
 * Gateway API Routes — the only entry/exit points between Platform and Agent Economy.
 *
 * Endpoints:
 *   POST /api/v1/gateway/deposit      — process a deposit (Platform → Agent Economy)
 *   POST /api/v1/gateway/withdraw     — request a withdrawal (Agent Economy → Platform)
 *   GET  /api/v1/gateway/transactions — list gateway transactions
 */

import type { FastifyInstance, FastifyReply } from 'fastify';
import { assertPermission, PermissionError } from '../../permissions/permissions.js';
import { processDeposit } from '../../gateway/deposit-gateway.js';
import { processWithdrawal } from '../../gateway/withdraw-gateway.js';
import type { DepositEvent, WithdrawalRequest } from '../../gateway/types.js';
import type { AuthContext, Chain } from '../../core/types.js';
import { VALID_CHAINS } from '../../core/chain-registry.js';

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

export async function gatewayRoutes(app: FastifyInstance) {
  // ═══════════════════════════════════════════════
  // Process Deposit (Platform → Agent Economy)
  // ═══════════════════════════════════════════════

  app.post('/api/v1/gateway/deposit', {
    schema: {
      body: {
        type: 'object',
        required: ['user_id', 'amount', 'currency', 'tx_id'],
        properties: {
          user_id: { type: 'string', minLength: 1 },
          amount: { type: 'string', minLength: 1 },
          currency: { type: 'string', minLength: 1 },
          tx_id: { type: 'string', minLength: 1 },
          kyc_verified: { type: 'boolean' },
          region: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.manage-agents'); } catch (err) { return handlePermissionError(err, reply); }

    const body = request.body as {
      user_id: string;
      amount: string;
      currency: string;
      tx_id: string;
      kyc_verified: boolean;
      region: string;
    };

    const amountNum = parseFloat(body.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return reply.code(400).send({ error: 'Invalid amount' });
    }

    const depositEvent: DepositEvent = {
      event: 'user_deposit',
      user_id: body.user_id,
      amount: body.amount,
      currency: body.currency.toUpperCase(),
      tx_id: body.tx_id,
      kyc_verified: body.kyc_verified ?? false,
      region: body.region ?? 'GLOBAL',
      timestamp: new Date().toISOString(),
    };

    try {
      const tx = await processDeposit(depositEvent);
      const statusCode = tx.status === 'rejected' ? 422 : 201;
      return reply.code(statusCode).send({ transaction: tx });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════
  // Process Withdrawal (Agent Economy → Platform)
  // Requires dual-signature: user_agent + broker
  // ═══════════════════════════════════════════════

  app.post('/api/v1/gateway/withdraw', {
    schema: {
      body: {
        type: 'object',
        required: ['amount', 'token', 'chain', 'toAddress'],
        properties: {
          userId: { type: 'string' },
          amount: { type: 'string', minLength: 1 },
          token: { type: 'string', minLength: 1 },
          chain: { type: 'string', minLength: 1 },
          toAddress: { type: 'string', minLength: 20 },
          userAgentSignature: { type: 'string' },
          brokerSignature: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const ctx = getAuthContext(request);

    const body = request.body as {
      userId: string;
      amount: string;
      token: string;
      chain: Chain;
      toAddress: string;
      userAgentSignature: string;
      brokerSignature: string;
    };

    if (!VALID_CHAINS.has(body.chain)) {
      return reply.code(400).send({
        error: `Invalid chain. Must be one of: ${[...VALID_CHAINS].join(', ')}`,
      });
    }

    const amountNum = parseFloat(body.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return reply.code(400).send({ error: 'Invalid amount' });
    }

    // Address format validation (basic check)
    if (body.toAddress.length < 20) {
      return reply.code(400).send({ error: 'Invalid destination address' });
    }

    const withdrawalRequest: WithdrawalRequest = {
      requestId: `wdr_req_${Date.now()}`,
      userId: body.userId || ctx.userId,
      amount: body.amount,
      token: body.token.toUpperCase(),
      chain: body.chain,
      toAddress: body.toAddress,
      userAgentSignature: body.userAgentSignature || '',
    };

    try {
      const tx = await processWithdrawal(withdrawalRequest, body.brokerSignature || '');
      const statusCode = tx.status === 'rejected' ? 422 : 200;
      return reply.code(statusCode).send({ transaction: tx });
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ═══════════════════════════════════════════════
  // List Gateway Transactions
  // ═══════════════════════════════════════════════

  app.get('/api/v1/gateway/transactions', async (request, reply) => {
    const ctx = getAuthContext(request);
    try { assertPermission(ctx, 'supervisor.view-monitoring'); } catch (err) { return handlePermissionError(err, reply); }

    const query = request.query as {
      type?: 'deposit' | 'withdrawal';
      status?: string;
      userId?: string;
      limit?: string;
    };

    // In production: query from PostgreSQL/Redis
    // For now return empty list — transactions are processed in-memory
    return {
      transactions: [],
      filters: {
        type: query.type ?? 'all',
        status: query.status ?? 'all',
        userId: query.userId ?? 'all',
      },
      total: 0,
      limit: parseInt(query.limit ?? '50'),
    };
  });
}
