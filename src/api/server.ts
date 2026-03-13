import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import { getAdapter } from '../adapters/index.js';
import type { WsGateway } from '../core/ws-gateway.js';
import type { WsConnectionMeta } from '../core/ws-types.js';
import type { AgentTier } from '../security/types.js';
import { healthRoutes } from './routes/health.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { configRoutes } from './routes/config.js';
import { controlRoutes } from './routes/control.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { adminRoutes } from './routes/admin.js';
import { supervisorRoutes } from './routes/supervisor.js';
import { tokenRoutes } from './routes/tokens.js';
import { chatRoutes } from './routes/chat.js';
import { tradeRoutes } from './routes/trade.js';
import { brokerRoutes } from './routes/broker.js';
import { gatewayRoutes } from './routes/gateway.js';
import { perpsRoutes } from './routes/perps.js';
import { mlRoutes } from './routes/ml.js';
import { VALID_CHAINS } from '../core/chain-registry.js';
import { registerApiKey } from '../adapters/generic-adapter.js';

const log = createChildLogger('api-server');

// Register development API keys for testing
if (config.nodeEnv !== 'production') {
  registerApiKey('dev-test-key-2024', 'user_dev_001', 'admin');
  registerApiKey('dev-user-key', 'user_dev_002', 'user');
}

const VALID_TIERS = new Set(['admin', 'broker', 'ops', 'user']);
const MAX_TOKEN_LENGTH = 4096;

const VALID_AGENT_TIERS = new Set<string>(['master', 'broker', 'user', 'helper']);

// ═══════════════════════════════════════════════
// JWT helpers (lightweight, no external dep)
// ═══════════════════════════════════════════════

interface JwtPayload {
  agentId: string;
  userId: string;
  tier: string;
  helperType?: string;
  iat?: number;
  exp?: number;
}

function base64UrlDecode(str: string): string {
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64url').toString('utf8');
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data, 'utf8').toString('base64url');
}

function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const signInput = `${headerB64}.${payloadB64}`;
  const expected = createHmac('sha256', secret).update(signInput).digest('base64url');

  if (expected.length !== signatureB64.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signatureB64))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as JwtPayload;
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Utility for other services to mint gateway JWTs (e.g., when creating agents). */
export function mintGatewayJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, ttlSeconds = 86_400): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const signature = createHmac('sha256', config.gateway.jwtSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

// ═══════════════════════════════════════════════
// Server Factory
// ═══════════════════════════════════════════════

export async function createServer(gateway?: WsGateway) {
  const app = Fastify({
    logger: false,
    bodyLimit: 1_048_576,
  });

  const allowedOrigins = config.nodeEnv === 'production'
    ? ['https://coindcx.com', 'https://app.coindcx.com']
    : true;

  await app.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  await app.register(websocket);

  // ─── WebSocket endpoint with JWT verification at handshake ───
  if (gateway) {
    app.get('/ws/agents', { websocket: true }, (socket, request) => {
      const token = (request.query as Record<string, string>).token;

      if (!token) {
        socket.close(4001, 'Missing JWT token');
        return;
      }

      const jwt = verifyJwt(token, config.gateway.jwtSecret);
      if (!jwt) {
        socket.close(4001, 'Invalid or expired JWT');
        return;
      }

      if (!jwt.agentId || !jwt.tier || !VALID_AGENT_TIERS.has(jwt.tier)) {
        socket.close(4001, 'Invalid JWT claims: agentId and tier required');
        return;
      }

      const meta: WsConnectionMeta = {
        agentId: jwt.agentId,
        userId: jwt.userId ?? '',
        tier: jwt.tier as AgentTier,
        helperType: jwt.helperType,
        connectedAt: Date.now(),
      };

      void gateway.registerConnection(socket, meta);
    });
  }

  // Auth middleware
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/health' || request.url === '/ready') return;
    if (request.url.startsWith('/api/v1/tokens/') || request.url.startsWith('/api/v1/chains') || request.url.startsWith('/api/v1/chat') || request.url.startsWith('/api/v1/trade/') || request.url.startsWith('/api/v1/perps/') || request.url.startsWith('/api/v1/proxy/') || request.url.startsWith('/api/v1/leaderboard') || request.url.startsWith('/api/v1/copy')) return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Missing authorization token' });
      return;
    }

    const token = authHeader.slice(7);

    if (token.length > MAX_TOKEN_LENGTH) {
      reply.code(400).send({ error: 'Token too long' });
      return;
    }

    const adapter = getAdapter();

    try {
      const result = await adapter.authenticateUser(token);
      if (!result.authenticated) {
        reply.code(401).send({ error: result.error ?? 'Authentication failed' });
        return;
      }

      const tier = result.tier ?? 'user';
      if (!VALID_TIERS.has(tier)) {
        log.warn({ userId: result.userId, tier }, 'Invalid tier from adapter — defaulting to user');
        (request as any).tier = 'user';
      } else {
        (request as any).tier = tier;
      }

      (request as any).userId = result.userId;
    } catch (err) {
      log.error({ err }, 'Auth middleware error');
      reply.code(500).send({ error: 'Authentication service unavailable' });
    }
  });

  // Register routes
  await app.register(healthRoutes);
  await app.register(portfolioRoutes);
  await app.register(configRoutes);
  await app.register(controlRoutes);
  await app.register(leaderboardRoutes);
  await app.register(adminRoutes);
  await app.register(supervisorRoutes);
  await app.register(tokenRoutes);
  await app.register(chatRoutes);
  await app.register(tradeRoutes);
  await app.register(brokerRoutes);
  await app.register(gatewayRoutes);
  await app.register(perpsRoutes);
  await app.register(mlRoutes);

  // Image proxy
  app.get<{ Querystring: { url: string } }>('/api/v1/proxy/image', async (request, reply) => {
    const { url } = request.query;
    if (!url || !url.startsWith('https://')) {
      reply.code(400).send('Invalid URL');
      return;
    }
    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) { reply.code(imgRes.status).send('Upstream error'); return; }
      const contentType = imgRes.headers.get('content-type') ?? 'image/png';
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      reply.header('content-type', contentType);
      reply.header('cache-control', 'public, max-age=86400');
      reply.send(buffer);
    } catch {
      reply.code(502).send('Proxy error');
    }
  });

  // Wallet routes
  app.get<{ Params: { chain: string } }>('/api/v1/wallet/address/:chain', async (request, reply) => {
    const userId = (request as any).userId as string;
    const chain = request.params.chain;

    if (!VALID_CHAINS.has(chain)) {
      reply.code(400).send({ error: 'Unsupported chain' });
      return;
    }

    return { chain, address: `pending-${userId}-${chain}` };
  });

  app.post<{
    Body: { chain: string; token: string; amount: string };
  }>('/api/v1/wallet/withdraw', async (request, reply) => {
    const userId = (request as any).userId as string;
    const { chain, token, amount } = request.body ?? {};

    if (!chain || !token || !amount) {
      reply.code(400).send({ error: 'Missing required fields: chain, token, amount' });
      return;
    }

    if (!VALID_CHAINS.has(chain)) {
      reply.code(400).send({ error: 'Unsupported chain' });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      reply.code(400).send({ error: 'Invalid amount' });
      return;
    }

    return { status: 'pending', userId, chain, token, amount };
  });

  // AI chat endpoint
  app.post<{
    Body: { message: string; conversationId?: string };
  }>('/api/v1/ai/chat', async (request, reply) => {
    const userId = (request as any).userId as string;
    const { message, conversationId } = request.body ?? {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      reply.code(400).send({ error: 'Message is required' });
      return;
    }

    if (message.length > 10_000) {
      reply.code(400).send({ error: 'Message too long (max 10000 chars)' });
      return;
    }

    return {
      response: 'AI strategy builder is not yet implemented',
      conversationId: conversationId ?? 'new',
    };
  });

  // Notifications
  app.get('/api/v1/notifications', async (request) => {
    const userId = (request as any).userId as string;
    return { notifications: [] };
  });

  app.put<{
    Body: { tradeThresholdUsd?: number; pnlAlerts?: boolean };
  }>('/api/v1/notifications/settings', async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body ?? {};

    if (body.tradeThresholdUsd !== undefined) {
      if (typeof body.tradeThresholdUsd !== 'number' || body.tradeThresholdUsd < 0) {
        reply.code(400).send({ error: 'tradeThresholdUsd must be a non-negative number' });
        return;
      }
    }

    return { settings: body, userId };
  });

  return app;
}

export async function startServer(gateway?: WsGateway) {
  const app = await createServer(gateway);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  log.info({ port: config.port, gwEnabled: !!gateway }, 'API server started');

  return app;
}