/**
 * KYC Gate — verifies user identity and compliance requirements
 * before allowing trading operations.
 */

import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { Jurisdiction } from '../security/types.js';
import type { KYCProfile } from './types.js';

const log = createChildLogger('kyc-gate');

/**
 * KYC verification thresholds by jurisdiction.
 */
const EDD_THRESHOLDS: Record<Jurisdiction, number> = {
  US: 10_000,
  EU: 15_000,
  APAC: 15_000,
  GLOBAL: 10_000,
};

/**
 * Verify a user's KYC status.
 */
export async function verifyUser(
  userId: string,
  jurisdiction: Jurisdiction,
  redis: Redis,
): Promise<KYCProfile> {
  const key = `kyc:${userId}`;
  const data = await redis.hgetall(key);

  if (!data || !data.userId) {
    // No KYC record — user is unverified
    return {
      userId,
      verified: false,
      level: 0,
      jurisdiction,
      eddRequired: false,
    };
  }

  return {
    userId: data.userId,
    verified: data.verified === 'true',
    level: parseInt(data.level) || 0,
    verifiedAt: data.verifiedAt || undefined,
    expiresAt: data.expiresAt || undefined,
    jurisdiction: (data.jurisdiction as Jurisdiction) || jurisdiction,
    eddRequired: data.eddRequired === 'true',
    eddCompletedAt: data.eddCompletedAt || undefined,
  };
}

/**
 * Check if Enhanced Due Diligence is required for a transaction.
 */
export function checkEDDRequired(
  transactionUsd: number,
  jurisdiction: Jurisdiction,
  userProfile: KYCProfile,
): { required: boolean; reason?: string } {
  const threshold = EDD_THRESHOLDS[jurisdiction];

  if (transactionUsd >= threshold) {
    if (!userProfile.eddCompletedAt) {
      return {
        required: true,
        reason: `Transaction $${transactionUsd} exceeds EDD threshold $${threshold} for ${jurisdiction}`,
      };
    }
    // Check if EDD has expired (valid for 1 year)
    if (userProfile.eddCompletedAt) {
      const eddDate = new Date(userProfile.eddCompletedAt);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (eddDate < oneYearAgo) {
        return {
          required: true,
          reason: 'EDD verification has expired (>1 year)',
        };
      }
    }
  }

  return { required: false };
}

/**
 * Store/update a user's KYC profile.
 */
export async function updateKYCProfile(
  profile: KYCProfile,
  redis: Redis,
): Promise<void> {
  const key = `kyc:${profile.userId}`;
  await redis.hmset(key, {
    userId: profile.userId,
    verified: profile.verified.toString(),
    level: profile.level.toString(),
    verifiedAt: profile.verifiedAt ?? '',
    expiresAt: profile.expiresAt ?? '',
    jurisdiction: profile.jurisdiction,
    eddRequired: profile.eddRequired.toString(),
    eddCompletedAt: profile.eddCompletedAt ?? '',
  });

  log.info({
    userId: profile.userId,
    verified: profile.verified,
    level: profile.level,
    jurisdiction: profile.jurisdiction,
  }, 'KYC profile updated');
}

/**
 * Check if a user meets minimum KYC requirements for trading.
 */
export function meetsMinimumKYC(
  profile: KYCProfile,
  minLevel: number = 1,
): { meets: boolean; reason?: string } {
  if (!profile.verified) {
    return { meets: false, reason: 'User is not KYC verified' };
  }

  if (profile.level < minLevel) {
    return { meets: false, reason: `KYC level ${profile.level} below minimum ${minLevel}` };
  }

  // Check expiry
  if (profile.expiresAt && new Date(profile.expiresAt) < new Date()) {
    return { meets: false, reason: 'KYC verification has expired' };
  }

  return { meets: true };
}
