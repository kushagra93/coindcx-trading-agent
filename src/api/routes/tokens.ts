import type { FastifyInstance } from 'fastify';
import {
  searchToken,
  lookupByAddress,
  fetchTrending,
  fetchGainers,
  screenBySymbol,
  screenByAddress,
  getTokenBySymbol,
} from '../../data/token-screener.js';
import { CHAIN_REGISTRY, ALL_CHAIN_IDS, EVM_CHAINS } from '../../core/chain-registry.js';
import { runChainHealthCheck } from '../../helpers/chain-test-agent.js';

export async function tokenRoutes(app: FastifyInstance) {

  // ── Chain Registry Endpoints ──

  app.get('/api/v1/chains', async () => {
    return {
      chains: ALL_CHAIN_IDS.map((id) => ({
        id: CHAIN_REGISTRY[id].id,
        name: CHAIN_REGISTRY[id].name,
        family: CHAIN_REGISTRY[id].family,
        chainId: CHAIN_REGISTRY[id].chainId,
        nativeToken: CHAIN_REGISTRY[id].nativeToken,
        dexVenue: CHAIN_REGISTRY[id].defaultDexVenue,
        blockExplorer: CHAIN_REGISTRY[id].blockExplorer,
      })),
      total: ALL_CHAIN_IDS.length,
      evmChains: EVM_CHAINS.length,
    };
  });

  app.get('/api/v1/chains/health', async () => {
    return runChainHealthCheck();
  });

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
