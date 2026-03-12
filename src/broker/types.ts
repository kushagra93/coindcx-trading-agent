/**
 * Types for the Regional Broker Agent tier.
 * Brokers operate per-jurisdiction (US/EU/APAC) and handle:
 *   - Compliance pre-filtering (SEC, FCA, MAS)
 *   - Dual-signature fund movements
 *   - Fee aggregation from user agents
 *   - Position limit enforcement
 *   - KYC gating
 */

import type { Chain } from '../core/types.js';
import type { Jurisdiction } from '../security/types.js';

// ===== Broker Configuration =====

export interface BrokerConfig {
  brokerId: string;
  jurisdiction: Jurisdiction;
  maxUsers: number;
  positionLimits: {
    maxPositionsPerUser: number;
    maxPositionSizePct: number;
    maxTotalExposureUsd: number;
  };
  restrictedAssets: string[];
  kycRequirements: {
    minLevel: number;
    eddThresholdUsd: number;
  };
  complianceRules: ComplianceRule[];
  feeAggregationIntervalMs: number;
}

export const DEFAULT_BROKER_CONFIG: Omit<BrokerConfig, 'brokerId' | 'jurisdiction'> = {
  maxUsers: 100_000,
  positionLimits: {
    maxPositionsPerUser: 20,
    maxPositionSizePct: 25,
    maxTotalExposureUsd: 1_000_000,
  },
  restrictedAssets: [],
  kycRequirements: {
    minLevel: 1,
    eddThresholdUsd: 10_000,
  },
  complianceRules: [],
  feeAggregationIntervalMs: 60_000,
};

// ===== Compliance =====

export type ComplianceRuleType =
  | 'asset-restriction'
  | 'volume-limit'
  | 'time-restriction'
  | 'kyc-level'
  | 'jurisdiction-block'
  | 'leverage-limit';

export type ComplianceAction = 'block' | 'flag' | 'limit';

export interface ComplianceRule {
  id: string;
  type: ComplianceRuleType;
  params: Record<string, unknown>;
  action: ComplianceAction;
  description: string;
  enabled: boolean;
}

export interface ComplianceCheckResult {
  passed: boolean;
  violations: ComplianceViolation[];
  restrictions?: {
    maxAmountUsd?: number;
    blockedAssets?: string[];
    requiredKycLevel?: number;
  };
  checkedAt: string;
  brokerId: string;
}

export interface ComplianceViolation {
  ruleId: string;
  ruleType: ComplianceRuleType;
  action: ComplianceAction;
  description: string;
  details: Record<string, unknown>;
}

// ===== Fee Aggregation =====

export interface FeeReceipt {
  receiptId: string;
  userId: string;
  agentId: string;
  tradeId: string;
  feeAmountUsd: number;
  feeToken: string;
  feeAmountToken: string;
  chain: Chain;
  feeRate: number;
  timestamp: string;
  corr_id: string;
}

export interface AggregatedFees {
  brokerId: string;
  jurisdiction: Jurisdiction;
  receipts: FeeReceipt[];
  totalFeesUsd: number;
  aggregatedAt: string;
  periodStart: string;
  periodEnd: string;
}

// ===== KYC =====

export interface KYCProfile {
  userId: string;
  verified: boolean;
  level: number;
  verifiedAt?: string;
  expiresAt?: string;
  jurisdiction: Jurisdiction;
  eddRequired: boolean;
  eddCompletedAt?: string;
}

// ===== Dual Signature =====

export interface DualSignatureRequest {
  requestId: string;
  userId: string;
  userAgentSignature: string;
  brokerSignature?: string;
  type: 'withdrawal' | 'large-transfer';
  amountUsd: number;
  chain: Chain;
  toAddress: string;
  status: 'pending-broker' | 'dual-signed' | 'rejected';
  createdAt: string;
}
