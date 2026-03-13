import type { FastifyInstance } from 'fastify';
import {
  searchToken,
  lookupByAddress,
  fetchTrending,
  fetchGainers,
  fetchNewPairs,
  screenBySymbol,
  screenByAddress,
  getTokenBySymbol,
} from '../../data/token-screener.js';

export async function tokenRoutes(app: FastifyInstance) {

  app.get<{ Querystring: { q: string } }>('/api/v1/tokens/search', async (request, reply) => {
    const query = request.query.q;
    if (!query || query.trim().length === 0) {
      reply.code(400).send({ error: 'Query parameter "q" is required' });
      return;
    }

    const result = await searchToken(query.trim());
    if (!result) {
      reply.code(404).send({ error: `No token found for "${query}"` });
      return;
    }
    return result;
  });

  app.get('/api/v1/tokens/trending', async () => {
    const tokens = await fetchTrending();
    return { tokens };
  });

  app.get('/api/v1/tokens/gainers', async () => {
    const tokens = await fetchGainers();
    return { tokens };
  });

  app.get('/api/v1/tokens/new-pairs', async () => {
    const tokens = await fetchNewPairs();
    return { tokens };
  });

  app.get<{ Params: { symbol: string } }>('/api/v1/tokens/symbol/:symbol', async (request, reply) => {
    const metrics = await getTokenBySymbol(request.params.symbol);
    if (!metrics) {
      reply.code(404).send({ error: `Token "${request.params.symbol}" not found` });
      return;
    }
    return metrics;
  });

  app.get<{
    Params: { address: string };
    Querystring: { chain?: string };
  }>('/api/v1/tokens/address/:address', async (request, reply) => {
    const result = await lookupByAddress(request.params.address);
    if (!result) {
      reply.code(404).send({ error: 'Token not found for this address' });
      return;
    }
    return result;
  });

  app.get<{
    Params: { symbol: string };
  }>('/api/v1/tokens/screen/:symbol', async (request, reply) => {
    const result = await screenBySymbol(request.params.symbol);
    if (!result) {
      reply.code(404).send({ error: `Could not screen "${request.params.symbol}"` });
      return;
    }
    return result;
  });

  app.post<{
    Body: { address: string; chain?: string };
  }>('/api/v1/tokens/screen-address', async (request, reply) => {
    const { address, chain } = request.body ?? {};
    if (!address) {
      reply.code(400).send({ error: 'address is required' });
      return;
    }

    const result = await screenByAddress(address, chain);
    if (!result) {
      reply.code(404).send({ error: 'Could not screen this address' });
      return;
    }
    return result;
  });
}
