/**
 * Types for the Helper Agent Pool (Tier 4).
 * Helpers are stateless, horizontally-scalable workers that process
 * tasks from Redis Stream consumer groups.
 */

export type HelperAgentType =
  | 'chat-nlp'
  | 'strategy-executor'
  | 'risk-analyzer'
  | 'backtesting'
  | 'market-data'
  | 'notification';

export interface HelperTask {
  taskId: string;
  type: HelperAgentType;
  requestingAgentId: string;
  userId: string;
  payload: Record<string, unknown>;
  responseStream: string;
  deadline: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  corr_id: string;
}

export interface HelperResult {
  taskId: string;
  success: boolean;
  result: Record<string, unknown>;
  processingTimeMs: number;
  error?: string;
  corr_id: string;
}

export interface HelperStatus {
  type: HelperAgentType;
  instanceId: string;
  running: boolean;
  tasksProcessed: number;
  lastTaskAt: string | null;
  avgProcessingTimeMs: number;
  errorCount: number;
  uptimeMs: number;
}
