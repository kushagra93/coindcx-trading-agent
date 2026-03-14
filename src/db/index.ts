import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import * as schema from './schema.js';

const log = createChildLogger('db');

let _pool: pg.Pool | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;

  if (!config.database.enabled) {
    throw new Error('Database is not configured. Set DATABASE_URL to enable database features.');
  }

  _pool = new pg.Pool({
    connectionString: config.database.url,
    max: config.database.maxConnections,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  _pool.on('error', (err) => {
    log.error({ err }, 'Unexpected pool error');
  });

  _db = drizzle(_pool, { schema });
  log.info({ maxConnections: config.database.maxConnections }, 'Database connection pool initialized');
  return _db;
}

export function isDbConfigured(): boolean {
  return config.database.enabled;
}

export type Db = ReturnType<typeof getDb>;

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
    log.info('Database connection pool closed');
  }
}

export { schema };
