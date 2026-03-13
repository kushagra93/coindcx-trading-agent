import Redis from 'ioredis';
import { config } from './config.js';
import { createChildLogger } from './logger.js';

const log = createChildLogger('redis');

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;

  _redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 3000);
    },
    lazyConnect: false,
  });

  _redis.on('error', (err) => {
    log.error({ err }, 'Redis connection error');
  });

  _redis.on('connect', () => {
    log.info('Redis connected');
  });

  return _redis;
}

export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
    log.info('Redis connection closed');
  }
}
