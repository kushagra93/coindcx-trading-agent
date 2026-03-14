import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads default config when no env vars set', async () => {
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.serviceMode).toBe('api');
    expect(cfg.port).toBe(3000);
    expect(cfg.dryRun).toBe(true);
    expect(cfg.logLevel).toBe('info');
    expect(cfg.nodeEnv).toBe('test');
  });

  it('reads SERVICE_MODE from env', async () => {
    process.env.SERVICE_MODE = 'master';
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.serviceMode).toBe('master');
  });

  it('reads PORT from env', async () => {
    process.env.PORT = '8080';
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.port).toBe(8080);
  });

  it('reads DRY_RUN=false from env', async () => {
    process.env.DRY_RUN = 'false';
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.dryRun).toBe(false);
  });

  it('reads REDIS_URL from env', async () => {
    process.env.REDIS_URL = 'redis://custom:6380';
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.redis.url).toBe('redis://custom:6380');
  });

  it('reads risk config from env', async () => {
    process.env.MAX_POSITION_SIZE_PCT = '15';
    process.env.CIRCUIT_BREAKER_LOSS_PCT = '8';
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.risk.maxPositionSizePct).toBe(15);
    expect(cfg.risk.circuitBreakerLossPct).toBe(8);
  });

  it('reads wsHub and gateway config', async () => {
    process.env.WS_HUB_URL = 'ws://hub:4000/ws';
    process.env.GATEWAY_JWT_SECRET = 'my-secret';
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.wsHub.url).toBe('ws://hub:4000/ws');
    expect(cfg.gateway.jwtSecret).toBe('my-secret');
  });

  it('reads supervisor config', async () => {
    process.env.SUPERVISOR_MAX_AGENTS_PER_USER = '10';
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.supervisor.maxAgentsPerUser).toBe(10);
  });

  it('reads broker config', async () => {
    process.env.BROKER_JURISDICTION = 'US';
    process.env.BROKER_MAX_LEVERAGE = '5';
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.broker.jurisdiction).toBe('US');
    expect(cfg.broker.maxLeverage).toBe(5);
  });

  it('has chainRpcOverrides', async () => {
    process.env.CHAIN_RPC_ETHEREUM = 'https://eth-rpc.example.com';
    process.env.CHAIN_RPC_POLYGON = 'https://polygon-rpc.example.com';
    const { loadConfig } = await import('../../src/core/config.js');
    const cfg = loadConfig();
    expect(cfg.chainRpcOverrides.ethereum).toBe('https://eth-rpc.example.com');
    expect(cfg.chainRpcOverrides.polygon).toBe('https://polygon-rpc.example.com');
  });
});
