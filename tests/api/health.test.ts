import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing server
vi.mock('../../src/core/redis.js', () => ({
  getRedis: vi.fn(() => ({ ping: vi.fn().mockResolvedValue('PONG') })),
  closeRedis: vi.fn(),
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

vi.mock('../../src/core/config.js', () => ({
  config: {
    serviceMode: 'api',
    nodeEnv: 'test',
    port: 3999,
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

describe('Health Routes', () => {
  it('GET /health returns 200 with status ok', async () => {
    const { createServer } = await import('../../src/api/server.js');
    const app = await createServer();

    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);

    await app.close();
  });

  it('GET /ready returns 200 when all services healthy', async () => {
    const { createServer } = await import('../../src/api/server.js');
    const app = await createServer();

    const res = await app.inject({ method: 'GET', url: '/ready' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ready');
    expect(body.checks.redis).toBe('ok');
    expect(body.checks.database).toBe('ok');

    await app.close();
  });
});
