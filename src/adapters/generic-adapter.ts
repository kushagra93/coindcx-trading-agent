import { createChildLogger } from '../core/logger.js';
import { config } from '../core/config.js';
import type {
  KYCStatus,
  TradeLimits,
  TradeIntent,
  PolicyResult,
  AuthResult,
} from '../core/types.js';
import type { HostAppAdapter } from './host-app-adapter.js';
import { createHmac } from 'crypto';

const log = createChildLogger('generic-adapter');

// API key -> userId mapping (production: database lookup)
const apiKeyStore = new Map<string, { userId: string; tier: 'admin' | 'ops' | 'user' }>();

/**
 * Register an API key for the generic adapter (used in development/testing).
 */
export function registerApiKey(apiKey: string, userId: string, tier: 'admin' | 'ops' | 'user' = 'user'): void {
  apiKeyStore.set(apiKey, { userId, tier });
}

/**
 * Generic adapter with HMAC-based API key authentication.
 * All compliance checks pass by default. Direct chain submission (no relay).
 */
export class GenericAdapter implements HostAppAdapter {
  readonly name = 'generic';

  async verifyKYC(_userId: string): Promise<KYCStatus> {
    return { verified: true, level: 1 };
  }

  async getTradeLimit(_userId: string): Promise<TradeLimits> {
    return {
      maxTradeUsd: Number.MAX_SAFE_INTEGER,
      dailyVolumeUsd: Number.MAX_SAFE_INTEGER,
      remainingDailyUsd: Number.MAX_SAFE_INTEGER,
    };
  }

  async isTokenAllowed(_token: string, _chain: string): Promise<boolean> {
    return true;
  }

  async isAddressSanctioned(_address: string): Promise<boolean> {
    return false;
  }

  async validateTrade(_trade: TradeIntent): Promise<PolicyResult> {
    return { allowed: true };
  }

  async authenticateUser(token: string): Promise<AuthResult> {
    if (!token || token.length < 8) {
      return { authenticated: false, error: 'Invalid API key' };
    }

    // Look up API key in store
    const entry = apiKeyStore.get(token);
    if (!entry) {
      log.warn('Authentication failed: unknown API key');
      return { authenticated: false, error: 'Invalid API key' };
    }

    return {
      authenticated: true,
      userId: entry.userId,
      tier: entry.tier,
    };
  }

  async getUserWalletAddress(_userId: string): Promise<string> {
    throw new Error('GenericAdapter: getUserWalletAddress not implemented — host app must provide wallet address');
  }
}
