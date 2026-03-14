import type { FastifyInstance } from 'fastify';
import { getRedis, closeRedis } from '../../core/redis.js';
import { getDb, isDbConfigured } from '../../db/index.js';
import { sql } from 'drizzle-orm';
import { config } from '../../core/config.js';

const startTime = Date.now();

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startTime) / 1000),
      version: process.env.npm_package_version ?? '0.1.0',
    };
  });

  app.get('/ready', async (request, reply) => {
    const checks: Record<string, 'ok' | 'error'> = {};

    // Redis check
    try {
      const redis = getRedis();
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
    }

    // Database check
    if (isDbConfigured()) {
      try {
        const db = getDb();
        await db.execute(sql`SELECT 1`);
        checks.database = 'ok';
      } catch {
        checks.database = 'error';
      }
    } else {
      checks.database = 'ok'; // DB not required in dev
    }

    const allOk = Object.values(checks).every(v => v === 'ok');
    reply.code(allOk ? 200 : 503).send({
      status: allOk ? 'ready' : 'degraded',
      checks,
    });
  });
}
