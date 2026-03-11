import { createChildLogger } from '../core/logger.js';
import { config } from '../core/config.js';
import type { Chain, FeeReservation } from '../core/types.js';
import { v4 as uuid } from 'uuid';

const log = createChildLogger('fee-manager');

// Fee tiers by AUM in USD
const FEE_TIERS = [
  { minAumUsd: 10_000, feePct: 0.0015 }, // 0.15%
  { minAumUsd: 1_000,  feePct: 0.0020 }, // 0.20%
  { minAumUsd: 0,      feePct: 0.0025 }, // 0.25% (base)
];

const COPY_TRADE_PROFIT_SHARE = 0.10; // 10%

// In-memory reservation ledger (production: PostgreSQL)
const reservations = new Map<string, FeeReservation>();
const accumulatedFees = new Map<string, number>(); // key: `${chain}:${token}` -> usd value

/**
 * Calculate fee rate based on user's AUM.
 */
export function getFeeRate(aumUsd: number): number {
  for (const tier of FEE_TIERS) {
    if (aumUsd >= tier.minAumUsd) {
      return tier.feePct;
    }
  }
  return FEE_TIERS[FEE_TIERS.length - 1].feePct;
}

/**
 * Calculate fee amount for a trade.
 * Guards against NaN/invalid input.
 */
export function calculateFee(amountIn: string, aumUsd: number): { feeAmount: string; feeRate: number } {
  const rate = getFeeRate(aumUsd);
  const amount = parseFloat(amountIn);

  if (isNaN(amount) || amount <= 0) {
    return { feeAmount: '0', feeRate: rate };
  }

  const fee = amount * rate;
  return { feeAmount: fee.toFixed(8), feeRate: rate };
}

/**
 * Calculate copy trade profit share.
 */
export function calculateProfitShare(profitUsd: number): number {
  if (profitUsd <= 0) return 0;
  return profitUsd * COPY_TRADE_PROFIT_SHARE;
}

/**
 * Reserve fee before placing an order.
 * Fee is deducted from the trade amount upfront.
 */
export function reserveFee(
  userId: string,
  tradeId: string,
  amount: string,
  token: string,
  chain: Chain
): FeeReservation {
  const reservation: FeeReservation = {
    id: uuid(),
    userId,
    tradeId,
    amount,
    token,
    chain,
    status: 'reserved',
    createdAt: new Date(),
  };

  reservations.set(reservation.id, reservation);

  // Track accumulated fees
  const key = `${chain}:${token}`;
  const current = accumulatedFees.get(key) ?? 0;
  accumulatedFees.set(key, current + parseFloat(amount));

  log.info({
    reservationId: reservation.id,
    userId,
    tradeId,
    amount,
    token,
  }, 'Fee reserved');

  return reservation;
}

/**
 * Refund a reserved fee (e.g., on trade failure).
 * Requires userId to verify ownership — prevents cross-user refund attacks.
 */
export function refundFee(reservationId: string, userId: string): boolean {
  const reservation = reservations.get(reservationId);
  if (!reservation) {
    log.warn({ reservationId }, 'Fee reservation not found for refund');
    return false;
  }

  // Ownership check: only the reservation owner can refund
  if (reservation.userId !== userId) {
    log.warn({ reservationId, requestedBy: userId, ownedBy: reservation.userId }, 'Fee refund denied — ownership mismatch');
    return false;
  }

  if (reservation.status !== 'reserved') {
    log.warn({ reservationId, status: reservation.status }, 'Fee refund denied — not in reserved state');
    return false;
  }

  reservation.status = 'refunded';

  // Reduce accumulated fees
  const key = `${reservation.chain}:${reservation.token}`;
  const current = accumulatedFees.get(key) ?? 0;
  accumulatedFees.set(key, Math.max(0, current - parseFloat(reservation.amount)));

  log.info({ reservationId, amount: reservation.amount }, 'Fee refunded');
  return true;
}

/**
 * Mark fee as settled (transferred to fee wallet).
 */
export function settleFee(reservationId: string): void {
  const reservation = reservations.get(reservationId);
  if (!reservation) return;

  reservation.status = 'settled';
  reservation.settledAt = new Date();

  log.info({ reservationId, amount: reservation.amount }, 'Fee settled');
}

/**
 * Check if accumulated fees for a token exceed the settlement threshold.
 */
export function shouldSettle(chain: Chain, token: string): boolean {
  const key = `${chain}:${token}`;
  const accumulated = accumulatedFees.get(key) ?? 0;
  const threshold = config.fees.settlementThresholdUsd;

  if (threshold <= 0) {
    log.warn({ threshold }, 'Settlement threshold is zero or negative — skipping');
    return false;
  }

  return accumulated >= threshold;
}

/**
 * Get total unsettled fees for a user (subtracted from withdrawable balance).
 */
export function getUnsettledFees(userId: string): Map<string, number> {
  const fees = new Map<string, number>();

  for (const reservation of reservations.values()) {
    if (reservation.userId === userId && reservation.status === 'reserved') {
      const key = `${reservation.chain}:${reservation.token}`;
      const current = fees.get(key) ?? 0;
      fees.set(key, current + parseFloat(reservation.amount));
    }
  }

  return fees;
}

/**
 * Get all pending reservations for settlement.
 */
export function getPendingSettlements(chain: Chain, token: string): FeeReservation[] {
  return Array.from(reservations.values()).filter(
    r => r.chain === chain && r.token === token && r.status === 'reserved'
  );
}
