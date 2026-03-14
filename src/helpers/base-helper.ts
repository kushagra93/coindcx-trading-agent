/**
 * Abstract base class for all helper agents.
 * Receives tasks via WebSocket from the WS Hub (round-robin distributed)
 * and sends results back over the same connection.
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../core/logger.js';
import type { WsClient } from '../core/ws-client.js';
import type { WsMessage } from '../core/ws-types.js';
import type { HelperAgentType, HelperTask, HelperResult, HelperStatus } from './types.js';

const log = createChildLogger('base-helper');

export abstract class BaseHelper {
  protected running = false;
  protected tasksProcessed = 0;
  protected errorCount = 0;
  protected lastTaskAt: string | null = null;
  protected totalProcessingTimeMs = 0;
  protected startedAt: number = 0;
  protected instanceId: string;

  constructor(
    protected wsClient: WsClient,
    protected helperType: HelperAgentType,
  ) {
    this.instanceId = `${helperType}-${randomUUID().slice(0, 8)}`;
  }

  async start(): Promise<void> {
    this.running = true;
    this.startedAt = Date.now();

    this.wsClient.onMessage(async (message: WsMessage) => {
      if (message.type !== 'helper-task') return;

      try {
        const task = message.payload as unknown as HelperTask;
        if (!task || !task.taskId) {
          log.warn('Received helper-task with no taskId');
          return;
        }

        const startTime = Date.now();
        const result = await this.processTask(task);
        const processingTimeMs = Date.now() - startTime;

        result.processingTimeMs = processingTimeMs;
        this.totalProcessingTimeMs += processingTimeMs;
        this.tasksProcessed++;
        this.lastTaskAt = new Date().toISOString();

        const response: WsMessage = {
          type: 'helper-result',
          from: this.instanceId,
          to: message.from,
          payload: result as unknown as Record<string, unknown>,
          timestamp: Date.now(),
          corrId: message.corrId,
        };
        this.wsClient.send(response);

        log.debug({
          taskId: task.taskId,
          type: this.helperType,
          processingTimeMs,
          success: result.success,
        }, 'Task processed');
      } catch (err) {
        this.errorCount++;
        log.error({ err }, 'Task processing error');
      }
    });

    log.info({
      helperType: this.helperType,
      instanceId: this.instanceId,
    }, 'Helper agent started (WebSocket)');
  }

  async stop(): Promise<void> {
    this.running = false;
    this.wsClient.disconnect();
    log.info({ instanceId: this.instanceId }, 'Helper agent stopped');
  }

  abstract processTask(task: HelperTask): Promise<HelperResult>;

  getStatus(): HelperStatus {
    return {
      type: this.helperType,
      instanceId: this.instanceId,
      running: this.running,
      tasksProcessed: this.tasksProcessed,
      lastTaskAt: this.lastTaskAt,
      avgProcessingTimeMs: this.tasksProcessed > 0
        ? this.totalProcessingTimeMs / this.tasksProcessed
        : 0,
      errorCount: this.errorCount,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
    };
  }
}
