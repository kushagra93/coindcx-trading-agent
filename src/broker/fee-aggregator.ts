/**
 * Fee Aggregator — collects fee receipts from user agents
 * and batches them for forwarding to the Master Agent's fee ledger.
 *
 * Reuses fee-manager.ts shouldSettle() logic for batch thresholds.
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../core/logger.js';
import type { Jurisdiction } from '../security/types.js';
import type { FeeReceipt, AggregatedFees } from './types.js';

const log = createChildLogger('fee-aggregator');

export class FeeAggregator {
  private pendingReceipts: FeeReceipt[] = [];
  private lastAggregationAt: string = new Date().toISOString();

  constructor(
    private brokerId: string,
    private jurisdiction: Jurisdiction,
    private batchThresholdUsd: number = 100,
    private batchIntervalMs: number = 60_000,
  ) {}

  /**
   * Collect a fee receipt from a user agent.
   */
  collectFeeReceipt(receipt: FeeReceipt): void {
    this.pendingReceipts.push(receipt);
    log.debug({
      receiptId: receipt.receiptId,
      userId: receipt.userId,
      feeAmountUsd: receipt.feeAmountUsd,
      pendingCount: this.pendingReceipts.length,
    }, 'Fee receipt collected');
  }

  /**
   * Check if pending fees should be aggregated and forwarded.
   */
  shouldAggregate(): boolean {
    if (this.pendingReceipts.length === 0) return false;

    const totalPendingUsd = this.pendingReceipts.reduce(
      (sum, r) => sum + r.feeAmountUsd, 0,
    );

    // Aggregate if total exceeds threshold
    if (totalPendingUsd >= this.batchThresholdUsd) return true;

    // Aggregate if enough time has passed
    const elapsed = Date.now() - new Date(this.lastAggregationAt).getTime();
    if (elapsed >= this.batchIntervalMs && this.pendingReceipts.length > 0) return true;

    return false;
  }

  /**
   * Aggregate all pending receipts into a batch for the Master Agent.
   * Clears the pending queue.
   */
  aggregatePending(): AggregatedFees | null {
    if (this.pendingReceipts.length === 0) return null;

    const receipts = [...this.pendingReceipts];
    const totalFeesUsd = receipts.reduce((sum, r) => sum + r.feeAmountUsd, 0);

    const aggregation: AggregatedFees = {
      brokerId: this.brokerId,
      jurisdiction: this.jurisdiction,
      receipts,
      totalFeesUsd,
      aggregatedAt: new Date().toISOString(),
      periodStart: this.lastAggregationAt,
      periodEnd: new Date().toISOString(),
    };

    // Clear pending queue
    this.pendingReceipts = [];
    this.lastAggregationAt = new Date().toISOString();

    log.info({
      brokerId: this.brokerId,
      receiptCount: receipts.length,
      totalFeesUsd,
    }, 'Fees aggregated');

    return aggregation;
  }

  /**
   * Get count of pending receipts.
   */
  getPendingCount(): number {
    return this.pendingReceipts.length;
  }

  /**
   * Get total pending fees in USD.
   */
  getPendingTotalUsd(): number {
    return this.pendingReceipts.reduce((sum, r) => sum + r.feeAmountUsd, 0);
  }
}
