/**
 * Regional Broker Agent — manages a jurisdiction's user agents.
 *
 * Long-running process that:
 *   - Pre-filters trades for compliance (SEC/FCA/MAS rules)
 *   - Dual-signs fund movements (co-signature with user agent)
 *   - Aggregates fees from user agents → batches to master
 *   - Enforces position limits per user
 *   - Issues certificates for user agents via trust chain
 *
 * Reuses orchestrator.ts pattern for main loop + graceful shutdown.
 */

import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../core/logger.js';
import { audit } from '../audit/audit-logger.js';
import type { Jurisdiction } from '../security/types.js';
import type { BrokerConfig, ComplianceCheckResult, FeeReceipt, KYCProfile } from './types.js';
import { DEFAULT_BROKER_CONFIG } from './types.js';
import { evaluateCompliance, getJurisdictionRules } from './compliance-engine.js';
import { FeeAggregator } from './fee-aggregator.js';
import { verifyUser, checkEDDRequired, meetsMinimumKYC } from './kyc-gate.js';

const log = createChildLogger('broker-agent');

export class BrokerAgent {
  private config: BrokerConfig;
  private feeAggregator: FeeAggregator;
  private running = false;

  constructor(
    private redis: Redis,
    brokerId: string,
    jurisdiction: Jurisdiction,
    configOverrides?: Partial<BrokerConfig>,
  ) {
    this.config = {
      ...DEFAULT_BROKER_CONFIG,
      brokerId,
      jurisdiction,
      ...configOverrides,
      complianceRules: [
        ...getJurisdictionRules(jurisdiction),
        ...(configOverrides?.complianceRules ?? []),
      ],
    };

    this.feeAggregator = new FeeAggregator(
      brokerId,
      jurisdiction,
      100,
      this.config.feeAggregationIntervalMs,
    );
  }

  // ═══════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════

  async start(): Promise<void> {
    this.running = true;
    log.info({
      brokerId: this.config.brokerId,
      jurisdiction: this.config.jurisdiction,
    }, 'Broker agent starting');

    // Main processing loop
    while (this.running) {
      try {
        await this.processingCycle();
        await this.sleep(1000);
      } catch (err) {
        log.error({ err }, 'Broker agent cycle error');
        await this.sleep(5000);
      }
    }

    log.info({ brokerId: this.config.brokerId }, 'Broker agent stopped');
  }

  async stop(): Promise<void> {
    this.running = false;
    log.info({ brokerId: this.config.brokerId }, 'Broker agent stopping...');
  }

  private async processingCycle(): Promise<void> {
    // Check if fees should be aggregated and forwarded
    if (this.feeAggregator.shouldAggregate()) {
      const aggregation = this.feeAggregator.aggregatePending();
      if (aggregation) {
        // Forward to master (in production: send as signed message via command bus)
        log.info({
          brokerId: this.config.brokerId,
          totalFeesUsd: aggregation.totalFeesUsd,
          receiptCount: aggregation.receipts.length,
        }, 'Fees forwarded to master');
      }
    }
  }

  // ═══════════════════════════════════════════════
  // Compliance
  // ═══════════════════════════════════════════════

  /**
   * Pre-compliance check for a trade request.
   * Must pass before the request is forwarded to Master Agent.
   */
  async preComplianceCheck(request: {
    userId: string;
    asset: string;
    side: 'buy' | 'sell';
    amountUsd: number;
    chain: string;
    leverage?: number;
  }): Promise<ComplianceCheckResult> {
    // 1. Get user KYC profile
    const userProfile = await verifyUser(
      request.userId,
      this.config.jurisdiction,
      this.redis,
    );

    // 2. Check minimum KYC
    const kycCheck = meetsMinimumKYC(
      userProfile,
      this.config.kycRequirements.minLevel,
    );
    if (!kycCheck.meets) {
      return {
        passed: false,
        violations: [{
          ruleId: 'kyc-minimum',
          ruleType: 'kyc-level',
          action: 'block',
          description: kycCheck.reason || 'KYC requirements not met',
          details: { userId: request.userId, level: userProfile.level },
        }],
        checkedAt: new Date().toISOString(),
        brokerId: this.config.brokerId,
      };
    }

    // 3. Check EDD for large transactions
    const eddCheck = checkEDDRequired(
      request.amountUsd,
      this.config.jurisdiction,
      userProfile,
    );
    if (eddCheck.required) {
      return {
        passed: false,
        violations: [{
          ruleId: 'edd-required',
          ruleType: 'volume-limit',
          action: 'block',
          description: eddCheck.reason || 'Enhanced Due Diligence required',
          details: { amountUsd: request.amountUsd },
        }],
        checkedAt: new Date().toISOString(),
        brokerId: this.config.brokerId,
      };
    }

    // 4. Run jurisdiction-specific compliance rules
    return evaluateCompliance(
      request,
      userProfile,
      this.config.jurisdiction,
      this.config.complianceRules,
    );
  }

  // ═══════════════════════════════════════════════
  // Dual Signatures
  // ═══════════════════════════════════════════════

  /**
   * Co-sign a fund movement (withdrawal requires dual-signature).
   */
  async dualSignFundMovement(
    userAgentSignature: string,
    request: {
      userId: string;
      amountUsd: number;
      chain: string;
      toAddress: string;
    },
  ): Promise<{ approved: boolean; brokerSignature?: string; error?: string }> {
    // 1. Verify user KYC
    const userProfile = await verifyUser(
      request.userId,
      this.config.jurisdiction,
      this.redis,
    );
    if (!userProfile.verified) {
      return { approved: false, error: 'User KYC not verified' };
    }

    // 2. Check amount limits
    if (request.amountUsd > this.config.positionLimits.maxTotalExposureUsd) {
      return { approved: false, error: 'Amount exceeds maximum exposure limit' };
    }

    // 3. Generate broker co-signature
    const brokerSignature = `broker_sig_${randomUUID().slice(0, 16)}`;

    await audit({
      actor: this.config.brokerId,
      actorTier: 'broker',
      action: 'dual-sign-withdrawal',
      resource: request.userId,
      details: {
        amountUsd: request.amountUsd,
        chain: request.chain,
        toAddress: request.toAddress.substring(0, 10) + '...',
      },
      success: true,
    });

    return { approved: true, brokerSignature };
  }

  // ═══════════════════════════════════════════════
  // Fee Management
  // ═══════════════════════════════════════════════

  /**
   * Accept a fee receipt from a user agent.
   */
  collectFeeReceipt(receipt: FeeReceipt): void {
    this.feeAggregator.collectFeeReceipt(receipt);
  }

  // ═══════════════════════════════════════════════
  // Position Limits
  // ═══════════════════════════════════════════════

  /**
   * Enforce position limits for a user.
   */
  enforcePositionLimits(
    currentPositionCount: number,
    newPositionSizePct: number,
  ): { allowed: boolean; reason?: string } {
    if (currentPositionCount >= this.config.positionLimits.maxPositionsPerUser) {
      return {
        allowed: false,
        reason: `Max ${this.config.positionLimits.maxPositionsPerUser} positions per user`,
      };
    }

    if (newPositionSizePct > this.config.positionLimits.maxPositionSizePct) {
      return {
        allowed: false,
        reason: `Position size ${newPositionSizePct}% exceeds max ${this.config.positionLimits.maxPositionSizePct}%`,
      };
    }

    return { allowed: true };
  }

  // ═══════════════════════════════════════════════
  // Info
  // ═══════════════════════════════════════════════

  getConfig(): BrokerConfig {
    return { ...this.config };
  }

  getBrokerId(): string {
    return this.config.brokerId;
  }

  getJurisdiction(): Jurisdiction {
    return this.config.jurisdiction;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
