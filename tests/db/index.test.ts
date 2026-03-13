import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/core/config.js', () => ({
  config: { database: { url: '' }, logLevel: 'info', nodeEnv: 'test' },
}));

vi.mock('../../src/core/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({ query: {} })),
}));

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn(() => ({
      on: vi.fn(),
      end: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

describe('db/index', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('isDbConfigured returns false when DATABASE_URL is empty', async () => {
    const { isDbConfigured } = await import('../../src/db/index.js');
    expect(isDbConfigured()).toBe(false);
  });

  it('getDb throws when DATABASE_URL is not configured', async () => {
    const { getDb } = await import('../../src/db/index.js');
    expect(() => getDb()).toThrow('DATABASE_URL is not configured');
  });
});
