import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getDb, isDbConfigured } from '../db/index.js';
import { chatMessages } from '../db/schema.js';
import { trades } from '../db/schema.js';
import { positions } from '../db/schema.js';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import { TRADING_TOOLS } from '../data/intent-engine.js';
import { asc, sql } from 'drizzle-orm';

const log = createChildLogger('data-export');

const INTENT_SYSTEM_PROMPT = `You are an intent classifier for a crypto trading agent. Given the user's message, determine which action they want to perform by calling the appropriate function.`;

let _s3: S3Client | null = null;

function getS3(): S3Client {
  if (_s3) return _s3;
  _s3 = new S3Client({ region: config.sagemaker.region });
  return _s3;
}

export interface TrainingExample {
  messages: Array<{ role: string; content: string; tool_calls?: any[] }>;
}

export interface ExportStats {
  intentExamples: number;
  tradeOutcomes: number;
  s3Uri: string;
  exportedAt: string;
}

/**
 * Export chat messages as intent-classification training pairs.
 * Groups consecutive user→assistant message pairs and formats them
 * for supervised fine-tuning (SFT) on a tool-calling model.
 */
export async function exportIntentTrainingData(): Promise<ExportStats> {
  if (!isDbConfigured()) throw new Error('Database not configured');

  const db = getDb();
  const s3 = getS3();
  const bucket = config.sagemaker.s3Bucket;
  const prefix = config.sagemaker.s3Prefix;

  if (!bucket) throw new Error('SAGEMAKER_S3_BUCKET not configured');

  const allMessages = await db
    .select()
    .from(chatMessages)
    .orderBy(asc(chatMessages.userId), asc(chatMessages.createdAt));

  const examples: TrainingExample[] = [];
  let i = 0;
  while (i < allMessages.length - 1) {
    const msg = allMessages[i];
    const next = allMessages[i + 1];

    if (
      msg.role === 'user' &&
      next.role === 'assistant' &&
      msg.userId === next.userId
    ) {
      const toolCallMatch = extractToolCallFromResponse(next.content);
      const example: TrainingExample = {
        messages: [
          { role: 'system', content: INTENT_SYSTEM_PROMPT },
          { role: 'user', content: msg.content },
        ],
      };

      if (toolCallMatch) {
        example.messages.push({
          role: 'assistant',
          content: '',
          tool_calls: [toolCallMatch],
        });
      } else {
        example.messages.push({
          role: 'assistant',
          content: next.content,
        });
      }

      examples.push(example);
      i += 2;
    } else {
      i++;
    }
  }

  const jsonl = examples.map((e) => JSON.stringify(e)).join('\n');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${prefix}/intent-training/${timestamp}/train.jsonl`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: jsonl,
      ContentType: 'application/jsonl',
    }),
  );

  const toolsKey = `${prefix}/intent-training/${timestamp}/tools.json`;
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: toolsKey,
      Body: JSON.stringify(TRADING_TOOLS, null, 2),
      ContentType: 'application/json',
    }),
  );

  log.info({ examples: examples.length, s3Key: key }, 'Intent training data exported');

  return {
    intentExamples: examples.length,
    tradeOutcomes: 0,
    s3Uri: `s3://${bucket}/${key}`,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Export trade outcome data for training a trade signal classifier.
 * Each record includes trade metadata and a binary win/loss label.
 */
export async function exportTradeOutcomeData(): Promise<ExportStats> {
  if (!isDbConfigured()) throw new Error('Database not configured');

  const db = getDb();
  const s3 = getS3();
  const bucket = config.sagemaker.s3Bucket;
  const prefix = config.sagemaker.s3Prefix;

  if (!bucket) throw new Error('SAGEMAKER_S3_BUCKET not configured');

  const closedPositions = await db
    .select()
    .from(positions)
    .where(sql`${positions.status} = 'closed'`);

  const allTrades = await db.select().from(trades);

  const tradeMap = new Map(allTrades.map((t) => [t.id, t]));

  const outcomes = closedPositions.map((pos) => ({
    token: pos.tokenSymbol,
    chain: pos.chain,
    entryPrice: pos.entryPrice,
    exitPrice: pos.currentPrice,
    amount: pos.amount,
    costBasis: pos.costBasis,
    pnl: pos.unrealizedPnl,
    pnlPct: pos.unrealizedPnlPct,
    highWaterMark: pos.highWaterMark,
    holdDurationMs: pos.closedAt && pos.openedAt
      ? new Date(pos.closedAt).getTime() - new Date(pos.openedAt).getTime()
      : null,
    label: pos.unrealizedPnl > 0 ? 1 : 0,
  }));

  const jsonl = outcomes.map((o) => JSON.stringify(o)).join('\n');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const key = `${prefix}/trade-outcomes/${timestamp}/outcomes.jsonl`;

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: jsonl,
      ContentType: 'application/jsonl',
    }),
  );

  log.info({ outcomes: outcomes.length, s3Key: key }, 'Trade outcome data exported');

  return {
    intentExamples: 0,
    tradeOutcomes: outcomes.length,
    s3Uri: `s3://${bucket}/${key}`,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Full export: both intent training data and trade outcomes.
 */
export async function exportAllTrainingData(): Promise<{
  intent: ExportStats;
  trades: ExportStats;
}> {
  const [intent, tradeData] = await Promise.all([
    exportIntentTrainingData(),
    exportTradeOutcomeData(),
  ]);
  return { intent, trades: tradeData };
}

/**
 * Attempt to reconstruct tool calls from assistant response content.
 * Looks for structured patterns that indicate the original intent action.
 */
function extractToolCallFromResponse(
  content: string,
): { id: string; type: string; function: { name: string; arguments: string } } | null {
  const actionPatterns: Record<string, RegExp> = {
    execute_trade: /\b(buy|sell|bought|sold)\b.*\b(SOL|ETH|BTC|BONK|PEPE|WIF)\b/i,
    screen_token: /\b(screen|safety|rug\s*check|audit)\b/i,
    get_price: /\bcurrent\s+price\b/i,
    get_portfolio: /\b(portfolio|holdings|positions|balance)\b/i,
    get_trending: /\b(trending|hot|popular)\b/i,
    setup_dca: /\bDCA\b/i,
    set_limit_order: /\b(limit|stop.?loss|take.?profit)\b/i,
    copy_trade: /\bcopy\s*trad/i,
    get_leaderboard: /\b(leaderboard|top\s*trader)/i,
  };

  for (const [action, pattern] of Object.entries(actionPatterns)) {
    if (pattern.test(content)) {
      return {
        id: `reconstructed_${Date.now()}`,
        type: 'function',
        function: { name: action, arguments: '{}' },
      };
    }
  }

  return null;
}