import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/ready', async () => {
    // TODO: Check DB + Redis connectivity
    return { status: 'ready' };
  });
}
