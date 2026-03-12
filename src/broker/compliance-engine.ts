/**
 * Compliance Engine — per-jurisdiction rule evaluation.
 * Each broker runs compliance checks against its jurisdiction's rules
 * before forwarding trade requests to the Master Agent.
 */

import { createChildLogger } from '../core/logger.js';
import { audit } from '../audit/audit-logger.js';
import type { Jurisdiction } from '../security/types.js';
import type {
  ComplianceRule,
  ComplianceCheckResult,
  ComplianceViolation,
  KYCProfile,
} from './types.js';

const log = createChildLogger('compliance-engine');

// ===== Default Jurisdiction Rules =====

const JURISDICTION_RULES: Record<Jurisdiction, ComplianceRule[]> = {
  US: [
    {
      id: 'us-securities-check',
      type: 'asset-restriction',
      params: { blockedCategories: ['unregistered-security', 'privacy-coin'] },
      action: 'block',
      description: 'SEC: Block unregistered securities and privacy coins',
      enabled: true,
    },
    {
      id: 'us-accredited-volume',
      type: 'volume-limit',
      params: { maxDailyVolumeUsd: 50_000, requireAccreditedAbove: 25_000 },
      action: 'flag',
      description: 'SEC: Flag large volumes for accredited investor check',
      enabled: true,
    },
    {
      id: 'us-leverage-limit',
      type: 'leverage-limit',
      params: { maxLeverage: 5 },
      action: 'limit',
      description: 'CFTC: Limit leverage for retail traders',
      enabled: true,
    },
  ],
  EU: [
    {
      id: 'eu-mifid-suitability',
      type: 'kyc-level',
      params: { minKycLevel: 2, requireSuitabilityForComplex: true },
      action: 'block',
      description: 'MiFID II: Require suitability assessment for complex instruments',
      enabled: true,
    },
    {
      id: 'eu-leverage-limit',
      type: 'leverage-limit',
      params: { maxLeverage: 2 },
      action: 'limit',
      description: 'ESMA: Restrict leverage for retail clients',
      enabled: true,
    },
  ],
  APAC: [
    {
      id: 'apac-mas-restriction',
      type: 'asset-restriction',
      params: { blockedCategories: ['derivatives-unlicensed'] },
      action: 'block',
      description: 'MAS: Block unlicensed derivatives',
      enabled: true,
    },
    {
      id: 'apac-volume-reporting',
      type: 'volume-limit',
      params: { reportingThresholdUsd: 15_000 },
      action: 'flag',
      description: 'AML: Flag transactions above reporting threshold',
      enabled: true,
    },
  ],
  GLOBAL: [],
};

// ===== Compliance Evaluation =====

/**
 * Evaluate a trade request against jurisdiction-specific rules.
 */
export function evaluateCompliance(
  request: {
    asset: string;
    side: 'buy' | 'sell';
    amountUsd: number;
    chain: string;
    leverage?: number;
    userId: string;
  },
  userProfile: KYCProfile,
  jurisdiction: Jurisdiction,
  customRules: ComplianceRule[] = [],
): ComplianceCheckResult {
  const allRules = [
    ...JURISDICTION_RULES[jurisdiction],
    ...customRules,
  ].filter(r => r.enabled);

  const violations: ComplianceViolation[] = [];
  let maxAmountRestriction: number | undefined;

  for (const rule of allRules) {
    const violation = evaluateRule(rule, request, userProfile);
    if (violation) {
      violations.push(violation);

      // If any 'block' rule is violated, we fail immediately
      if (violation.action === 'block') {
        log.warn({
          userId: request.userId,
          ruleId: rule.id,
          asset: request.asset,
          jurisdiction,
        }, 'Compliance check: BLOCKED');
      }

      // Collect amount restrictions from 'limit' actions
      if (violation.action === 'limit' && violation.details.maxAmountUsd) {
        const limit = violation.details.maxAmountUsd as number;
        maxAmountRestriction = maxAmountRestriction
          ? Math.min(maxAmountRestriction, limit)
          : limit;
      }
    }
  }

  const hasBlock = violations.some(v => v.action === 'block');
  const result: ComplianceCheckResult = {
    passed: !hasBlock,
    violations,
    restrictions: maxAmountRestriction ? { maxAmountUsd: maxAmountRestriction } : undefined,
    checkedAt: new Date().toISOString(),
    brokerId: `broker-${jurisdiction.toLowerCase()}`,
  };

  audit({
    actor: `broker-${jurisdiction.toLowerCase()}`,
    actorTier: 'broker',
    action: result.passed ? 'compliance-passed' : 'compliance-blocked',
    resource: request.userId,
    details: {
      asset: request.asset,
      amountUsd: request.amountUsd,
      violationCount: violations.length,
      jurisdiction,
    },
    success: result.passed,
  });

  return result;
}

/**
 * Evaluate a single compliance rule.
 */
function evaluateRule(
  rule: ComplianceRule,
  request: { asset: string; amountUsd: number; leverage?: number; userId: string },
  userProfile: KYCProfile,
): ComplianceViolation | null {
  switch (rule.type) {
    case 'asset-restriction': {
      const blockedCategories = rule.params.blockedCategories as string[] | undefined;
      // Simplified: check if asset name matches blocked patterns
      if (blockedCategories?.some(cat => request.asset.toLowerCase().includes(cat))) {
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          action: rule.action,
          description: rule.description,
          details: { asset: request.asset, blockedCategories },
        };
      }
      return null;
    }

    case 'volume-limit': {
      const maxDailyVolumeUsd = rule.params.maxDailyVolumeUsd as number | undefined;
      if (maxDailyVolumeUsd && request.amountUsd > maxDailyVolumeUsd) {
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          action: rule.action,
          description: rule.description,
          details: { amountUsd: request.amountUsd, maxDailyVolumeUsd },
        };
      }
      return null;
    }

    case 'kyc-level': {
      const minKycLevel = rule.params.minKycLevel as number | undefined;
      if (minKycLevel && userProfile.level < minKycLevel) {
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          action: rule.action,
          description: rule.description,
          details: { currentLevel: userProfile.level, requiredLevel: minKycLevel },
        };
      }
      return null;
    }

    case 'leverage-limit': {
      const maxLeverage = rule.params.maxLeverage as number | undefined;
      if (maxLeverage && request.leverage && request.leverage > maxLeverage) {
        return {
          ruleId: rule.id,
          ruleType: rule.type,
          action: rule.action,
          description: rule.description,
          details: {
            requestedLeverage: request.leverage,
            maxLeverage,
            maxAmountUsd: request.amountUsd / request.leverage * maxLeverage,
          },
        };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Get the default rules for a jurisdiction.
 */
export function getJurisdictionRules(jurisdiction: Jurisdiction): ComplianceRule[] {
  return [...JURISDICTION_RULES[jurisdiction]];
}
