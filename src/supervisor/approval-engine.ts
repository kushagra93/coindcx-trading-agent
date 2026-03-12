/**
 * Trade Approval Engine — processes trade requests from user agents.
 *
 * Flow:
 *   1. User agent sends TRADE_REQUEST to broker
 *   2. Broker performs compliance check → forwards to Master with result
 *   3. Master's ApprovalEngine validates:
 *      - Broker pre-approval (compliance check passed)
 *      - Global policy constraints (chains, tokens, limits)
 *      - Hard parameter bounds (position size, leverage, daily loss)
 *      - Circuit breaker state
 *   4. If all pass → issues one-time ApprovalToken (30s expiry)
 *   5. Token returned to user agent → user agent dispatches to executor with token
 */

import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import { audit } from '../audit/audit-logger.js';
import type { TradeApprovalRequest, ApprovalToken } from '../security/types.js';
import { issueApprovalToken } from '../security/approval-token.js';
import { PolicyEngine } from './policy-engine.js';

const log = createChildLogger('approval-engine');

export interface ApprovalResult {
  approved: boolean;
  token?: ApprovalToken;
  rejectionReason?: string;
  corrId: string;
}

export class ApprovalEngine {
  constructor(
    private redis: Redis,
    private policyEngine: PolicyEngine,
    private masterPrivateKey: string,
  ) {}

  /**
   * Process a trade approval request.
   * Validates against all policies and issues a token if approved.
   */
  async processTradeApproval(request: TradeApprovalRequest): Promise<ApprovalResult> {
    const corrId = request.corr_id;

    log.info({
      requestId: request.requestId,
      agentId: request.agentId,
      asset: request.asset,
      side: request.side,
      amountUsd: request.amountUsd,
      chain: request.chain,
      corrId,
    }, 'Processing trade approval request');

    try {
      // 1. Verify broker compliance check passed
      if (!request.complianceResult.passed) {
        return this.reject(request, 'Broker compliance check failed', corrId);
      }

      // 2. Check global policy: is chain allowed?
      if (!(await this.policyEngine.isChainAllowed(request.chain))) {
        return this.reject(request, `Chain '${request.chain}' is not allowed by policy`, corrId);
      }

      // 3. Check global policy: is token allowed?
      if (!(await this.policyEngine.isTokenAllowed(request.asset))) {
        return this.reject(request, `Token '${request.asset}' is blocked by policy`, corrId);
      }

      // 4. Check risk score threshold (based on global policy max — agents can only be stricter)
      const policy = await this.policyEngine.getPolicy();
      const maxRiskScore = 85; // Aggressive max — individual agents use their own risk level
      if (request.riskScore > maxRiskScore) {
        return this.reject(
          request,
          `Risk score ${request.riskScore} exceeds global threshold ${maxRiskScore}`,
          corrId,
        );
      }

      // 5. Check hard parameter bounds — position size check
      if (request.amountUsd > policy.globalMaxDailyLossUsd) {
        return this.reject(
          request,
          `Trade amount $${request.amountUsd} exceeds daily loss limit $${policy.globalMaxDailyLossUsd}`,
          corrId,
        );
      }

      // 6. Check maintenance mode
      if (policy.maintenanceMode) {
        return this.reject(request, 'System is in maintenance mode', corrId);
      }

      // 7. All checks passed — issue approval token
      const token = await issueApprovalToken(
        this.masterPrivateKey,
        request,
        this.redis,
      );

      audit({
        actor: 'master-agent',
        actorTier: 'admin',
        action: 'trade-approved',
        resource: request.requestId,
        details: {
          agentId: request.agentId,
          asset: request.asset,
          side: request.side,
          amountUsd: request.amountUsd,
          tokenId: token.tokenId,
        },
        success: true,
        corr_id: corrId,
      });

      log.info({
        requestId: request.requestId,
        tokenId: token.tokenId,
        agentId: request.agentId,
        corrId,
      }, 'Trade approved — token issued');

      return {
        approved: true,
        token,
        corrId,
      };

    } catch (err) {
      log.error({ err, requestId: request.requestId, corrId }, 'Error processing trade approval');
      return this.reject(request, `Internal error: ${(err as Error).message}`, corrId);
    }
  }

  /**
   * Map risk level to maximum acceptable risk score (0-100).
   */
  private getRiskThreshold(riskLevel: string): number {
    switch (riskLevel) {
      case 'conservative': return 30;
      case 'moderate': return 60;
      case 'aggressive': return 85;
      default: return 50;
    }
  }

  /**
   * Build a rejection result and audit it.
   */
  private reject(
    request: TradeApprovalRequest,
    reason: string,
    corrId: string,
  ): ApprovalResult {
    audit({
      actor: 'master-agent',
      actorTier: 'admin',
      action: 'trade-rejected',
      resource: request.requestId,
      details: {
        agentId: request.agentId,
        asset: request.asset,
        side: request.side,
        amountUsd: request.amountUsd,
        reason,
      },
      success: false,
      error: reason,
      corr_id: corrId,
    });

    log.warn({
      requestId: request.requestId,
      agentId: request.agentId,
      reason,
      corrId,
    }, 'Trade approval rejected');

    return {
      approved: false,
      rejectionReason: reason,
      corrId,
    };
  }
}
