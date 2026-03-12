/**
 * Per-user vector memory store scoped under ns:{userId}:memory:*
 *
 * Extends trade-memory.ts WAL pattern with per-user namespace.
 * Stores: trade decisions, chat history, user preferences, strategy outcomes.
 */

import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import { scopedRedisKey, USER_DATA_KEYS } from '../security/data-isolation.js';

const log = createChildLogger('memory-store');

export interface TradeDecision {
  id: string;
  timestamp: string;
  type: 'trade-signal' | 'risk-rejection' | 'compliance-rejection' | 'execution-result';
  strategyId: string;
  asset: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  outcome: 'executed' | 'rejected' | 'failed';
  reason?: string;
  riskScore?: number;
  pnlUsd?: number;
  corr_id: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface UserPreferences {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  preferredChains: string[];
  preferredAssets: string[];
  tradingHoursUtc?: { start: number; end: number };
  notificationPreferences: {
    tradeConfirmations: boolean;
    riskAlerts: boolean;
    pnlUpdates: boolean;
    marketAlerts: boolean;
  };
  customRules: string[];
}

const DEFAULT_PREFERENCES: UserPreferences = {
  riskTolerance: 'moderate',
  preferredChains: [],
  preferredAssets: [],
  notificationPreferences: {
    tradeConfirmations: true,
    riskAlerts: true,
    pnlUpdates: true,
    marketAlerts: false,
  },
  customRules: [],
};

export class MemoryStore {
  constructor(
    private userId: string,
    private redis: Redis,
  ) {}

  // ═══════════════════════════════════════════════
  // Trade Decisions
  // ═══════════════════════════════════════════════

  async recordDecision(decision: TradeDecision): Promise<void> {
    const key = scopedRedisKey(this.userId, USER_DATA_KEYS.memoryDecisions);
    await this.redis.lpush(key, JSON.stringify(decision));
    // Keep last 1000 decisions
    await this.redis.ltrim(key, 0, 999);
    log.debug({ userId: this.userId, type: decision.type, outcome: decision.outcome }, 'Decision recorded');
  }

  async getRecentDecisions(limit: number = 50): Promise<TradeDecision[]> {
    const key = scopedRedisKey(this.userId, USER_DATA_KEYS.memoryDecisions);
    const raw = await this.redis.lrange(key, 0, limit - 1);
    return raw.map(r => JSON.parse(r) as TradeDecision);
  }

  // ═══════════════════════════════════════════════
  // Chat History
  // ═══════════════════════════════════════════════

  async addChatMessage(message: ChatMessage): Promise<void> {
    const key = scopedRedisKey(this.userId, USER_DATA_KEYS.memoryChatHistory);
    await this.redis.lpush(key, JSON.stringify(message));
    await this.redis.ltrim(key, 0, 499); // Keep last 500 messages
  }

  async getChatHistory(limit: number = 50): Promise<ChatMessage[]> {
    const key = scopedRedisKey(this.userId, USER_DATA_KEYS.memoryChatHistory);
    const raw = await this.redis.lrange(key, 0, limit - 1);
    return raw.map(r => JSON.parse(r) as ChatMessage).reverse(); // Oldest first
  }

  // ═══════════════════════════════════════════════
  // User Preferences
  // ═══════════════════════════════════════════════

  async updatePreferences(updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.getPreferences();
    const merged = { ...current, ...updates };
    const key = scopedRedisKey(this.userId, USER_DATA_KEYS.memoryPreferences);
    await this.redis.set(key, JSON.stringify(merged));
    return merged;
  }

  async getPreferences(): Promise<UserPreferences> {
    const key = scopedRedisKey(this.userId, USER_DATA_KEYS.memoryPreferences);
    const raw = await this.redis.get(key);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    return JSON.parse(raw) as UserPreferences;
  }

  // ═══════════════════════════════════════════════
  // Serialization (for hibernation)
  // ═══════════════════════════════════════════════

  async serialize(): Promise<string> {
    const decisions = await this.getRecentDecisions(100);
    const chatHistory = await this.getChatHistory(100);
    const preferences = await this.getPreferences();

    return JSON.stringify({
      userId: this.userId,
      decisions,
      chatHistory,
      preferences,
      serializedAt: new Date().toISOString(),
    });
  }

  async deserialize(data: string): Promise<void> {
    const parsed = JSON.parse(data);

    // Restore decisions
    if (parsed.decisions?.length) {
      const key = scopedRedisKey(this.userId, USER_DATA_KEYS.memoryDecisions);
      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      for (const d of parsed.decisions.reverse()) {
        pipeline.lpush(key, JSON.stringify(d));
      }
      await pipeline.exec();
    }

    // Restore chat history
    if (parsed.chatHistory?.length) {
      const key = scopedRedisKey(this.userId, USER_DATA_KEYS.memoryChatHistory);
      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      for (const m of parsed.chatHistory.reverse()) {
        pipeline.lpush(key, JSON.stringify(m));
      }
      await pipeline.exec();
    }

    // Restore preferences
    if (parsed.preferences) {
      await this.updatePreferences(parsed.preferences);
    }

    log.info({ userId: this.userId }, 'Memory store deserialized from snapshot');
  }
}
