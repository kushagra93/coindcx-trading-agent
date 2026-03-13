/**
 * Notification Helper — sends human-readable notifications to users.
 * Task types: trade-confirmation, risk-alert, compliance-alert, pnl-update.
 * Uses Redis for persistent notification storage (state, not messaging).
 */

import type { Redis } from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { WsClient } from '../core/ws-client.js';
import { BaseHelper } from './base-helper.js';
import type { HelperTask, HelperResult } from './types.js';

const log = createChildLogger('notification-agent');

export type NotificationType =
  | 'trade-confirmation'
  | 'risk-alert'
  | 'compliance-alert'
  | 'pnl-update'
  | 'system-alert'
  | 'agent-status';

export class NotificationAgent extends BaseHelper {
  constructor(
    wsClient: WsClient,
    private redis: Redis,
  ) {
    super(wsClient, 'notification');
  }

  async processTask(task: HelperTask): Promise<HelperResult> {
    const { payload, corr_id, taskId } = task;

    try {
      const notificationType = payload.notificationType as NotificationType;
      const userId = task.userId;

      const message = this.formatNotification(notificationType, payload);

      const notifKey = `ns:${userId}:notifications`;
      await this.redis.lpush(notifKey, JSON.stringify({
        id: taskId,
        type: notificationType,
        message,
        timestamp: new Date().toISOString(),
        read: false,
        corr_id,
      }));
      await this.redis.ltrim(notifKey, 0, 199);

      log.info({ userId, type: notificationType, corrId: corr_id }, 'Notification sent');

      return {
        taskId,
        success: true,
        result: { delivered: true, channel: 'in-app', message },
        processingTimeMs: 0,
        corr_id,
      };
    } catch (err) {
      return {
        taskId,
        success: false,
        result: {},
        processingTimeMs: 0,
        error: (err as Error).message,
        corr_id,
      };
    }
  }

  private formatNotification(type: NotificationType, payload: Record<string, unknown>): string {
    switch (type) {
      case 'trade-confirmation':
        return `Trade ${payload.side} ${payload.asset}: $${payload.amountUsd} on ${payload.chain}. TX: ${(payload.txHash as string)?.substring(0, 10)}...`;
      case 'risk-alert':
        return `Risk Alert: ${payload.message || 'Risk threshold exceeded'}. Score: ${payload.riskScore}/100`;
      case 'compliance-alert':
        return `Compliance: ${payload.message || 'Trade blocked by compliance rules'}`;
      case 'pnl-update':
        return `PnL Update: $${payload.unrealizedPnlUsd} unrealized. Portfolio: $${payload.portfolioValueUsd}`;
      case 'system-alert':
        return `System: ${payload.message || 'System notification'}`;
      case 'agent-status':
        return `Agent ${payload.agentId}: ${payload.status}`;
      default:
        return `Notification: ${JSON.stringify(payload)}`;
    }
  }
}
