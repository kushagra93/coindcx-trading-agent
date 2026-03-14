import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import type { StrategyConfig, StrategyType, RiskLevel, Chain } from '../../core/types.js';
import { PARAMETER_BOUNDS, clampPositionSize } from '../../risk/parameter-bounds.js';
import { VALID_CHAINS } from '../../core/chain-registry.js';
import { getDb } from '../../db/index.js';
import { strategies as strategiesTable } from '../../db/schema.js';
import { v4 as uuid } from 'uuid';

const VALID_STRATEGY_TYPES: Set<string> = new Set(['dca', 'momentum', 'mean-reversion', 'grid', 'copy-trade', 'custom']);
const VALID_RISK_LEVELS: Set<string> = new Set(['conservative', 'moderate', 'aggressive']);
const UPDATABLE_FIELDS = new Set(['name', 'tokens', 'budgetUsd', 'riskLevel', 'maxPerTradePct', 'params', 'enabled']);

function validateStrategyInput(body: any): string | null {
  if (!body || typeof body !== 'object') return 'Request body is required';
  if (!VALID_STRATEGY_TYPES.has(body.type)) return `Invalid strategy type. Must be one of: ${[...VALID_STRATEGY_TYPES].join(', ')}`;
  if (!VALID_CHAINS.has(body.chain)) return `Invalid chain. Must be one of: ${[...VALID_CHAINS].join(', ')}`;
  if (!VALID_RISK_LEVELS.has(body.riskLevel)) return `Invalid riskLevel. Must be one of: ${[...VALID_RISK_LEVELS].join(', ')}`;
  if (!Array.isArray(body.tokens) || body.tokens.length === 0) return 'tokens must be a non-empty array';
  if (body.tokens.length > 20) return 'tokens array cannot exceed 20 items';
  if (typeof body.budgetUsd !== 'number' || body.budgetUsd <= 0) return 'budgetUsd must be a positive number';
  if (body.budgetUsd > 10_000_000) return 'budgetUsd cannot exceed 10,000,000';
  if (body.maxPerTradePct !== undefined) {
    if (typeof body.maxPerTradePct !== 'number' || body.maxPerTradePct <= 0) return 'maxPerTradePct must be a positive number';
  }
  for (const token of body.tokens) {
    if (typeof token !== 'string' || token.length < 1 || token.length > 100) {
      return 'Each token must be a string between 1 and 100 characters';
    }
    if (/[\/\\\.]{2,}/.test(token)) return 'Token contains invalid characters';
  }
  return null;
}

function rowToStrategy(row: typeof strategiesTable.$inferSelect): StrategyConfig {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as StrategyType,
    name: row.name,
    chain: row.chain as Chain,
    tokens: (row.tokens ?? []) as string[],
    budgetUsd: row.budgetUsd,
    riskLevel: row.riskLevel as RiskLevel,
    maxPerTradePct: row.maxPerTradePct,
    params: (row.params ?? {}) as Record<string, unknown>,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function configRoutes(app: FastifyInstance) {
  app.get('/api/v1/templates', async () => {
    return {
      templates: [
        { type: 'dca', name: 'Buy the Dip (DCA)', description: 'Dollar-cost average into a token on a regular schedule', riskLevel: 'conservative', simulated90dReturn: 12, controls: ['budget', 'aggressiveness', 'token'] },
        { type: 'momentum', name: 'Ride the Trend (Momentum)', description: 'Buy tokens showing strong upward momentum', riskLevel: 'moderate', simulated90dReturn: 28, controls: ['budget', 'aggressiveness', 'token'] },
        { type: 'grid', name: 'Range Trader (Grid)', description: 'Buy low, sell high within a price range', riskLevel: 'moderate', simulated90dReturn: 18, controls: ['budget', 'aggressiveness', 'token'] },
        { type: 'mean-reversion', name: 'Mean Reversion', description: 'Buy when price drops below average, sell when above', riskLevel: 'moderate', simulated90dReturn: 15, controls: ['budget', 'aggressiveness', 'token'] },
      ],
    };
  });

  app.post<{
    Body: {
      type: StrategyType;
      name?: string;
      chain: Chain;
      tokens: string[];
      budgetUsd: number;
      riskLevel: RiskLevel;
      maxPerTradePct?: number;
      params?: Record<string, unknown>;
    };
  }>('/api/v1/strategies', async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body;

    const validationError = validateStrategyInput(body);
    if (validationError) {
      return reply.code(400).send({ error: validationError });
    }

    const maxPerTradePct = clampPositionSize(body.maxPerTradePct ?? 10);
    const db = getDb();
    const now = new Date();

    const row: typeof strategiesTable.$inferInsert = {
      id: uuid(),
      userId,
      type: body.type,
      name: typeof body.name === 'string' ? body.name.slice(0, 100) : `${body.type} strategy`,
      chain: body.chain,
      tokens: body.tokens.slice(0, 20),
      budgetUsd: body.budgetUsd,
      riskLevel: body.riskLevel,
      maxPerTradePct,
      params: body.params ?? {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    };

    const [inserted] = await db.insert(strategiesTable).values(row).returning();

    return { strategy: rowToStrategy(inserted) };
  });

  app.put<{
    Params: { id: string };
    Body: Record<string, unknown>;
  }>('/api/v1/strategies/:id', async (request, reply) => {
    const db = getDb();

    const [row] = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, request.params.id))
      .limit(1);

    if (!row) {
      return reply.code(404).send({ error: 'Strategy not found' });
    }

    const userId = (request as any).userId as string;
    if (row.userId !== userId) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    const body = request.body;

    for (const key of Object.keys(body)) {
      if (!UPDATABLE_FIELDS.has(key)) {
        return reply.code(400).send({ error: `Field '${key}' cannot be updated` });
      }
    }

    if (body.riskLevel !== undefined && !VALID_RISK_LEVELS.has(body.riskLevel as string)) {
      return reply.code(400).send({ error: 'Invalid riskLevel' });
    }
    if (body.budgetUsd !== undefined && (typeof body.budgetUsd !== 'number' || body.budgetUsd <= 0)) {
      return reply.code(400).send({ error: 'budgetUsd must be a positive number' });
    }
    if (body.maxPerTradePct !== undefined) {
      body.maxPerTradePct = clampPositionSize(body.maxPerTradePct as number);
    }
    if (body.tokens !== undefined) {
      if (!Array.isArray(body.tokens) || body.tokens.length === 0 || body.tokens.length > 20) {
        return reply.code(400).send({ error: 'tokens must be an array of 1-20 items' });
      }
    }
    if (body.name !== undefined) {
      body.name = String(body.name).slice(0, 100);
    }

    const updateFields: Partial<typeof strategiesTable.$inferInsert> = { updatedAt: new Date() };
    if (body.name !== undefined) updateFields.name = body.name as string;
    if (body.tokens !== undefined) updateFields.tokens = body.tokens as string[];
    if (body.budgetUsd !== undefined) updateFields.budgetUsd = body.budgetUsd as number;
    if (body.riskLevel !== undefined) updateFields.riskLevel = body.riskLevel as string;
    if (body.maxPerTradePct !== undefined) updateFields.maxPerTradePct = body.maxPerTradePct as number;
    if (body.params !== undefined) updateFields.params = body.params as Record<string, unknown>;
    if (body.enabled !== undefined) updateFields.enabled = body.enabled as boolean;

    const [updated] = await db
      .update(strategiesTable)
      .set(updateFields)
      .where(eq(strategiesTable.id, request.params.id))
      .returning();

    return { strategy: rowToStrategy(updated) };
  });

  app.delete<{ Params: { id: string } }>('/api/v1/strategies/:id', async (request, reply) => {
    const db = getDb();

    const [row] = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.id, request.params.id))
      .limit(1);

    if (!row) {
      return reply.code(404).send({ error: 'Strategy not found' });
    }

    const userId = (request as any).userId as string;
    if (row.userId !== userId) {
      return reply.code(403).send({ error: 'Not authorized' });
    }

    await db.delete(strategiesTable).where(eq(strategiesTable.id, request.params.id));
    return { deleted: true };
  });

  app.get('/api/v1/strategies', async (request) => {
    const userId = (request as any).userId as string;
    const db = getDb();

    const rows = await db
      .select()
      .from(strategiesTable)
      .where(eq(strategiesTable.userId, userId));

    return { strategies: rows.map(rowToStrategy) };
  });
}
