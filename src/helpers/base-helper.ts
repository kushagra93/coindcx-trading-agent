/**
 * Abstract base class for all helper agents.
 * Consumes tasks from Redis Stream via consumer groups → processes → ACKs → sends result.
 *
 * Reuses orchestrator.ts pattern: while(running) loop, graceful shutdown.
 */

import type { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../core/logger.js';
import type { HelperAgentType, HelperTask, HelperResult, HelperStatus } from './types.js';
import { REDIS_STREAMS } from '../supervisor/types.js';

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
    protected redis: Redis,
    protected helperType: HelperAgentType,
    protected consumerGroup: string = `helper-${Date.now()}`,
  ) {
    this.instanceId = `${helperType}-${randomUUID().slice(0, 8)}`;
  }

  /**
   * Start the helper agent processing loop.
   */
  async start(): Promise<void> {
    this.running = true;
    this.startedAt = Date.now();
    const streamKey = REDIS_STREAMS.helperTasks(this.helperType);

    // Ensure consumer group exists
    try {
      await this.redis.xgroup('CREATE', streamKey, this.consumerGroup, '0', 'MKSTREAM');
    } catch (err: any) {
      if (!err.message?.includes('BUSYGROUP')) throw err;
      // Group already exists — OK
    }

    log.info({
      helperType: this.helperType,
      instanceId: this.instanceId,
      streamKey,
    }, 'Helper agent started');

    while (this.running) {
      try {
        // Read tasks from stream with consumer group
        const results = await this.redis.xreadgroup(
          'GROUP', this.consumerGroup, this.instanceId,
          'COUNT', 1,
          'BLOCK', 2000,
          'STREAMS', streamKey, '>',
        );

        if (!results || results.length === 0) continue;

        for (const [, messages] of results as [string, [string, string[]][]][]) {
          for (const [messageId, fields] of messages) {
            try {
              const task = this.parseTask(fields);
              if (!task) {
                await this.redis.xack(streamKey, this.consumerGroup, messageId);
                continue;
              }

              const startTime = Date.now();
              const result = await this.processTask(task);
              const processingTimeMs = Date.now() - startTime;

              result.processingTimeMs = processingTimeMs;
              this.totalProcessingTimeMs += processingTimeMs;
              this.tasksProcessed++;
              this.lastTaskAt = new Date().toISOString();

              // Send result to response stream
              await this.sendResult(result);

              // ACK the message
              await this.redis.xack(streamKey, this.consumerGroup, messageId);

              log.debug({
                taskId: task.taskId,
                type: this.helperType,
                processingTimeMs,
                success: result.success,
              }, 'Task processed');

            } catch (err) {
              this.errorCount++;
              log.error({ err, messageId }, 'Task processing error');
              // Still ACK to prevent reprocessing of broken messages
              await this.redis.xack(streamKey, this.consumerGroup, messageId);
            }
          }
        }
      } catch (err) {
        if (this.running) {
          log.error({ err }, 'Helper stream read error');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    log.info({ instanceId: this.instanceId }, 'Helper agent stopped');
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  /**
   * Abstract method — each helper implements its own task processing.
   */
  abstract processTask(task: HelperTask): Promise<HelperResult>;

  /**
   * Send a result to the result stream.
   */
  private async sendResult(result: HelperResult): Promise<void> {
    const resultStream = REDIS_STREAMS.helperResults(this.helperType);
    await this.redis.xadd(
      resultStream, '*',
      'result', JSON.stringify(result),
    );
  }

  /**
   * Parse task from stream message fields.
   */
  private parseTask(fields: string[]): HelperTask | null {
    try {
      // Fields come as flat array: ['key1', 'val1', 'key2', 'val2', ...]
      const map: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        map[fields[i]] = fields[i + 1];
      }

      // Check for signed envelope format
      if (map.envelope) {
        const envelope = JSON.parse(map.envelope);
        if (envelope.payload) {
          return envelope.payload as HelperTask;
        }
      }

      // Direct task format
      if (map.payload) {
        return JSON.parse(map.payload) as HelperTask;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get the current status of this helper instance.
   */
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
