import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/core/config.js', () => ({
  config: {
    serviceMode: 'api',
    nodeEnv: 'test',
    port: 3998,
    logLevel: 'silent',
    dryRun: true,
    database: { url: 'postgres://test', enabled: true, maxConnections: 5 },
    redis: { url: 'redis://localhost:6379' },
    kms: { region: 'us-east-1', keyId: '' },
    solana: { rpcUrl: '', wsUrl: '', heliusApiKey: '' },
    evm: { rpcUrl: '', wsUrl: '', alchemyApiKey: '', defaultChainId: 137 },
    hyperliquid: { mainnet: false, builderCode: '', builderFeeBps: 5 },
    dex: { jupiterApiUrl: '', oneInchApiKey: '', zeroXApiKey: '' },
    marketData: { coinGeckoApiKey: '' },
    ai: { anthropicApiKey: '' },
    hostApp: { adapter: 'generic', coinDcx: { apiUrl: '', apiKey: '', relayUrl: '' } },
    fees: { walletAddressSol: '', walletAddressEvm: '', settlementThresholdUsd: 50 },
    risk: { maxPositionSizePct: 25, circuitBreakerLossPct: 10, circuitBreakerWindowHours: 1 },
    supervisor: { heartbeatIntervalMs: 15000, deadAgentTimeoutMs: 60000, maxAgentsPerUser: 5, eventBatchSize: 100 },
    broker: { jurisdiction: 'GLOBAL', maxUsers: 100000, positionLimitPerUser: 20, maxPositionSizePct: 25, maxLeverage: 10 },
    security: { masterKeyId: '', messageExpiryMs: 30000, nonceWindowMs: 60000, approvalTokenExpiryMs: 30000, certificateExpiryDays: 365 },
    hibernation: { idleThresholdMs: 1800000, onDemandThresholdMs: 7200000, archiveThresholdMs: 86400000, sweepIntervalMs: 300000 },
    chainRpcOverrides: {},
    wsHub: { url: '' },
    gateway: { jwtSecret: 'test-secret' },
  },
}));

vi.mock('../../src/core/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), trace: vi.fn(),
  }),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/adapters/index.js', () => ({
  getAdapter: vi.fn(() => ({
    authenticateUser: vi.fn().mockResolvedValue({ authenticated: true, userId: 'test', tier: 'admin' }),
  })),
}));

vi.mock('../../src/adapters/generic-adapter.js', () => ({
  registerApiKey: vi.fn(),
}));

vi.mock('../../src/data/token-screener.js', () => ({
  getTokenBySymbol: vi.fn().mockResolvedValue(null),
  screenBySymbol: vi.fn().mockResolvedValue(null),
}));

function createMockDb() {
  const self: any = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') return (resolve: any) => resolve([{ count: 0 }]);
      if (prop === 'execute') return vi.fn().mockResolvedValue([{ '1': 1 }]);
      return vi.fn().mockReturnValue(self);
    },
  });
  return self;
}

vi.mock('../../src/db/index.js', () => ({
  getDb: vi.fn(() => createMockDb()),
  isDbConfigured: vi.fn(() => true),
  closeDb: vi.fn(),
  schema: {},
}));

vi.mock('../../src/core/redis.js', () => ({
  getRedis: vi.fn(() => ({ ping: vi.fn().mockResolvedValue('PONG') })),
  closeRedis: vi.fn(),
}));

// Mock modules that trigger @solana/web3.js Connection with empty URL
vi.mock('../../src/helpers/chain-test-agent.js', () => ({
  runChainHealthCheck: vi.fn().mockResolvedValue({ healthy: true }),
}));

vi.mock('../../src/trader/order-executor.js', () => ({
  default: {},
}));

vi.mock('../../src/trader/jupiter-executor.js', () => ({
  JupiterExecutor: vi.fn(),
}));

vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn(),
  PublicKey: vi.fn(),
  Keypair: { fromSecretKey: vi.fn() },
}));

describe('Trade Routes - Schema Validation', () => {
  it('POST /api/v1/trade/execute rejects missing required fields', async () => {
    const { createServer } = await import('../../src/api/server.js');
    const app = await createServer();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trade/execute',
      headers: { authorization: 'Bearer dev-test-key-2024' },
      payload: { symbol: 'SOL' }, // missing side and amountUsd
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /api/v1/trade/execute rejects invalid side', async () => {
    const { createServer } = await import('../../src/api/server.js');
    const app = await createServer();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trade/execute',
      headers: { authorization: 'Bearer dev-test-key-2024' },
      payload: { symbol: 'SOL', side: 'hold', amountUsd: 100 },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it('POST /api/v1/trade/execute rejects amount over max', async () => {
    const { createServer } = await import('../../src/api/server.js');
    const app = await createServer();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/trade/execute',
      headers: { authorization: 'Bearer dev-test-key-2024' },
      payload: { symbol: 'SOL', side: 'buy', amountUsd: 50000 },
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });
});
