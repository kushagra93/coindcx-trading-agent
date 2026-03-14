import type Redis from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { Chain, StrategyType, RiskSettings } from '../core/types.js';
import type { GlobalPolicy } from './types.js';
import { DEFAULT_POLICY, REDIS_KEYS } from './types.js';

const log = createChildLogger('policy-engine');

/**
 * Global policy management for the supervisor.
 * Persists policies in Redis and enforces constraints on agent operations.
 */
export class PolicyEngine {
  private cachedPolicy: GlobalPolicy | null = null;

  constructor(private redis: Redis) {}

  /** Load global policies from Redis (or return defaults) */
  async getPolicy(): Promise<GlobalPolicy> {
    if (this.cachedPolicy) return this.cachedPolicy;

    const data = await this.redis.hgetall(REDIS_KEYS.POLICIES_HASH);
    if (!data || Object.keys(data).length === 0) {
      this.cachedPolicy = { ...DEFAULT_POLICY };
      return this.cachedPolicy;
    }

    this.cachedPolicy = this.deserializePolicy(data);
    return this.cachedPolicy;
  }

  /** Update global policies (admin action) */
  async updatePolicy(updates: Partial<GlobalPolicy>): Promise<GlobalPolicy> {
    const current = await this.getPolicy();
    const merged: GlobalPolicy = { ...current, ...updates };

    // Validate bounds
    merged.maxAgentsPerUser = Math.max(1, Math.min(100, merged.maxAgentsPerUser));
    merged.maxTotalAgents = Math.max(1, Math.min(100_000, merged.maxTotalAgents));
    merged.globalMaxPositionSizePct = Math.max(1, Math.min(50, merged.globalMaxPositionSizePct));
    merged.globalMaxDailyLossUsd = Math.max(100, merged.globalMaxDailyLossUsd);
    merged.globalMaxLeverage = Math.max(1, Math.min(100, merged.globalMaxLeverage));

    await this.redis.hmset(REDIS_KEYS.POLICIES_HASH, this.serializePolicy(merged));
    this.cachedPolicy = merged;

    log.info({ updates }, 'Global policies updated');
    return merged;
  }

  /** Check if a new agent can be created for this user */
  async canCreateAgent(
    userId: string,
    currentUserAgentCount: number,
    totalAgentCount: number,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const policy = await this.getPolicy();

    if (policy.maintenanceMode) {
      return { allowed: false, reason: 'System is in maintenance mode' };
    }
    if (currentUserAgentCount >= policy.maxAgentsPerUser) {
      return { allowed: false, reason: `Max ${policy.maxAgentsPerUser} agents per user` };
    }
    if (totalAgentCount >= policy.maxTotalAgents) {
      return { allowed: false, reason: `Platform agent limit reached (${policy.maxTotalAgents})` };
    }

    return { allowed: true };
  }

  /** Check if a chain is allowed by policy */
  async isChainAllowed(chain: Chain): Promise<boolean> {
    const policy = await this.getPolicy();
    return policy.allowedChains.includes(chain);
  }

  /** Check if a strategy type is allowed by policy */
  async isStrategyAllowed(strategyType: StrategyType): Promise<boolean> {
    const policy = await this.getPolicy();
    return policy.allowedStrategies.includes(strategyType);
  }

  /** Check if a token is allowed (not blacklisted, and on whitelist if set) */
  async isTokenAllowed(token: string): Promise<boolean> {
    const policy = await this.getPolicy();

    if (policy.blockedTokenBlacklist.includes(token.toUpperCase())) {
      return false;
    }
    if (policy.allowedTokenWhitelist.length > 0) {
      return policy.allowedTokenWhitelist.includes(token.toUpperCase());
    }

    return true;
  }

  /**
   * Compute effective risk settings by merging user settings with supervisor overrides.
   * Uses min() pattern — supervisor can only make limits stricter, not looser.
   */
  getEffectiveRiskSettings(
    userSettings: RiskSettings,
    agentOverrides: Partial<RiskSettings> | null,
  ): RiskSettings {
    const effective = { ...userSettings };

    // Apply supervisor per-agent overrides (stricter only)
    if (agentOverrides) {
      if (agentOverrides.dailyLossLimitUsd !== undefined) {
        effective.dailyLossLimitUsd = Math.min(effective.dailyLossLimitUsd, agentOverrides.dailyLossLimitUsd);
      }
      if (agentOverrides.maxPerTradePct !== undefined) {
        effective.maxPerTradePct = Math.min(effective.maxPerTradePct, agentOverrides.maxPerTradePct);
      }
      if (agentOverrides.riskLevel) {
        // Use the more conservative risk level
        const riskOrder = { conservative: 0, moderate: 1, aggressive: 2 };
        const userRisk = riskOrder[effective.riskLevel] ?? 1;
        const overrideRisk = riskOrder[agentOverrides.riskLevel] ?? 1;
        if (overrideRisk < userRisk) {
          effective.riskLevel = agentOverrides.riskLevel;
        }
      }
    }

    return effective;
  }

  /** Invalidate cache (call after external update) */
  invalidateCache(): void {
    this.cachedPolicy = null;
  }

  // ── Serialization ──

  private serializePolicy(policy: GlobalPolicy): Record<string, string> {
    return {
      maxAgentsPerUser: policy.maxAgentsPerUser.toString(),
      maxTotalAgents: policy.maxTotalAgents.toString(),
      allowedChains: JSON.stringify(policy.allowedChains),
      allowedStrategies: JSON.stringify(policy.allowedStrategies),
      globalMaxPositionSizePct: policy.globalMaxPositionSizePct.toString(),
      globalMaxDailyLossUsd: policy.globalMaxDailyLossUsd.toString(),
      globalMaxLeverage: policy.globalMaxLeverage.toString(),
      maintenanceMode: policy.maintenanceMode.toString(),
      minHeartbeatIntervalMs: policy.minHeartbeatIntervalMs.toString(),
      deadAgentTimeoutMs: policy.deadAgentTimeoutMs.toString(),
      allowedTokenWhitelist: JSON.stringify(policy.allowedTokenWhitelist),
      blockedTokenBlacklist: JSON.stringify(policy.blockedTokenBlacklist),
    };
  }

  private deserializePolicy(data: Record<string, string>): GlobalPolicy {
    return {
      maxAgentsPerUser: parseInt(data.maxAgentsPerUser) || DEFAULT_POLICY.maxAgentsPerUser,
      maxTotalAgents: parseInt(data.maxTotalAgents) || DEFAULT_POLICY.maxTotalAgents,
      allowedChains: data.allowedChains ? JSON.parse(data.allowedChains) : DEFAULT_POLICY.allowedChains,
      allowedStrategies: data.allowedStrategies ? JSON.parse(data.allowedStrategies) : DEFAULT_POLICY.allowedStrategies,
      globalMaxPositionSizePct: parseFloat(data.globalMaxPositionSizePct) || DEFAULT_POLICY.globalMaxPositionSizePct,
      globalMaxDailyLossUsd: parseFloat(data.globalMaxDailyLossUsd) || DEFAULT_POLICY.globalMaxDailyLossUsd,
      globalMaxLeverage: parseInt(data.globalMaxLeverage) || DEFAULT_POLICY.globalMaxLeverage,
      maintenanceMode: data.maintenanceMode === 'true',
      minHeartbeatIntervalMs: parseInt(data.minHeartbeatIntervalMs) || DEFAULT_POLICY.minHeartbeatIntervalMs,
      deadAgentTimeoutMs: parseInt(data.deadAgentTimeoutMs) || DEFAULT_POLICY.deadAgentTimeoutMs,
      allowedTokenWhitelist: data.allowedTokenWhitelist ? JSON.parse(data.allowedTokenWhitelist) : [],
      blockedTokenBlacklist: data.blockedTokenBlacklist ? JSON.parse(data.blockedTokenBlacklist) : [],
    };
  }
}
