import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import { getAdapter } from '../adapters/index.js';
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

const log = createChildLogger('api-server');

const VALID_TIERS = new Set(['admin', 'broker', 'ops', 'user']);
const MAX_TOKEN_LENGTH = 4096;
const VALID_CHAINS = new Set(['solana', 'ethereum', 'polygon', 'base', 'arbitrum', 'hyperliquid']);

export async function createServer() {
  const app = Fastify({
    logger: false, // We use our own pino logger
    bodyLimit: 1_048_576, // 1MB max body size
  });

  // CORS — restrict origins in production
  const allowedOrigins = config.nodeEnv === 'production'
    ? ['https://coindcx.com', 'https://app.coindcx.com']
    : true;

  await app.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  // Auth middleware — extract user from host app token
  app.addHook('onRequest', async (request, reply) => {
    // Skip auth for health checks and public API routes (hackathon mode)
    if (request.url === '/health' || request.url === '/ready') return;
    if (request.url.startsWith('/api/v1/tokens/') || request.url.startsWith('/api/v1/chat') || request.url.startsWith('/api/v1/trade/') || request.url.startsWith('/api/v1/proxy/')) return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Missing authorization token' });
      return;
    }

    const token = authHeader.slice(7);

    // Guard against excessively long tokens
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

      // Validate tier from adapter response
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

  // Image proxy for CORS bypass in Flutter web
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

    // TODO: Look up user's wallet address for the given chain
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

    // TODO: Process withdrawal
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

    // TODO: Forward to Claude for strategy generation
    return {
      response: 'AI strategy builder is not yet implemented',
      conversationId: conversationId ?? 'new',
    };
  });

  // Notifications
  app.get('/api/v1/notifications', async (request) => {
    const userId = (request as any).userId as string;
    // TODO: Return trade notifications
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

export async function startServer() {
  const app = await createServer();

  await app.listen({ port: config.port, host: '0.0.0.0' });
  log.info({ port: config.port }, 'API server started');

  return app;
}
