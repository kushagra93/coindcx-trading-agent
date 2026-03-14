import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import type {
  KYCStatus,
  TradeLimits,
  TradeIntent,
  PolicyResult,
  SignedTransaction,
  TxResult,
  AuthResult,
} from '../core/types.js';
import type { HostAppAdapter } from './host-app-adapter.js';

const log = createChildLogger('coindcx-adapter');

async function coinDcxFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${config.hostApp.coinDcx.apiUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.hostApp.coinDcx.apiKey,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CoinDCX API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

async function relayFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${config.hostApp.coinDcx.relayUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.hostApp.coinDcx.apiKey,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`CoinDCX Relay error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export class CoinDCXAdapter implements HostAppAdapter {
  readonly name = 'coindcx';

  async verifyKYC(userId: string): Promise<KYCStatus> {
    try {
      const result = await coinDcxFetch<{ verified: boolean; level: number; expiresAt?: string }>(
        `/v1/compliance/kyc/${userId}`
      );
      return {
        verified: result.verified,
        level: result.level,
        expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
      };
    } catch (err) {
      log.error({ err, userId }, 'KYC verification failed');
      return { verified: false, level: 0 };
    }
  }

  async getTradeLimit(userId: string): Promise<TradeLimits> {
    try {
      return await coinDcxFetch<TradeLimits>(`/v1/compliance/limits/${userId}`);
    } catch (err) {
      log.error({ err, userId }, 'Failed to get trade limits');
      return { maxTradeUsd: 0, dailyVolumeUsd: 0, remainingDailyUsd: 0 };
    }
  }

  async isTokenAllowed(token: string, chain: string): Promise<boolean> {
    try {
      const result = await coinDcxFetch<{ allowed: boolean }>(
        `/v1/policy/token-check?token=${token}&chain=${chain}`
      );
      return result.allowed;
    } catch (err) {
      log.warn({ err, token, chain }, 'Token check failed, defaulting to blocked');
      return false;
    }
  }

  async isAddressSanctioned(address: string): Promise<boolean> {
    try {
      const result = await coinDcxFetch<{ sanctioned: boolean }>(
        `/v1/compliance/sanctions-check?address=${address}`
      );
      return result.sanctioned;
    } catch (err) {
      log.warn({ err, address }, 'Sanctions check failed, defaulting to sanctioned');
      return true;
    }
  }

  async validateTrade(trade: TradeIntent): Promise<PolicyResult> {
    try {
      return await coinDcxFetch<PolicyResult>('/v1/policy/validate-trade', {
        method: 'POST',
        body: JSON.stringify({
          userId: trade.userId,
          chain: trade.chain,
          side: trade.side,
          inputToken: trade.inputToken,
          outputToken: trade.outputToken,
          amountIn: trade.amountIn,
        }),
      });
    } catch (err) {
      log.error({ err, tradeId: trade.id }, 'Trade validation failed');
      return { allowed: false, reason: 'Policy validation unavailable' };
    }
  }

  async submitTransaction(signedTx: SignedTransaction): Promise<TxResult> {
    try {
      return await relayFetch<TxResult>('/v1/relay/submit', {
        method: 'POST',
        body: JSON.stringify({
          chain: signedTx.chain,
          rawTx: Buffer.from(signedTx.rawTx).toString('base64'),
        }),
      });
    } catch (err) {
      log.error({ err, chain: signedTx.chain }, 'Relay submission failed');
      return { success: false, txHash: '', error: 'Relay submission failed' };
    }
  }

  async authenticateUser(token: string): Promise<AuthResult> {
    try {
      const result = await coinDcxFetch<AuthResult>('/v1/auth/verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
      return result;
    } catch (err) {
      log.error({ err }, 'Authentication failed');
      return { authenticated: false, error: 'Authentication failed' };
    }
  }

  async getUserWalletAddress(userId: string): Promise<string> {
    const result = await coinDcxFetch<{ walletAddress: string }>(
      `/v1/users/${userId}/wallet`
    );
    return result.walletAddress;
  }
}
