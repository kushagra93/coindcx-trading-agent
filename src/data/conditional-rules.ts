import { createChildLogger } from '../core/logger.js';
import { getTokenBySymbol, fetchTrending, type TokenMetrics } from './token-screener.js';
import { fetchOHLCV, calculateRSI, calculateMACD, detectVolumeSpike, detectGoldenCross, detectDeathCross, computeTASnapshot, type TASnapshot } from './ohlcv.js';

const log = createChildLogger('conditional-rules');

export type ConditionType =
  | 'price_below' | 'price_above'
  | 'pct_drop_from' | 'pct_rise_from'
  | 'rsi_below' | 'rsi_above'
  | 'macd_bullish_cross' | 'macd_bearish_cross'
  | 'golden_cross' | 'death_cross'
  | 'volume_spike'
  | 'top_by_volume'
  | 'cross_token_trigger';

export type ActionType = 'buy' | 'sell' | 'alert';

export type RuleStatus = 'active' | 'triggered' | 'expired' | 'cancelled';

export interface ConditionalRule {
  id: string;
  token: string;
  tokenAddress?: string;
  condition: ConditionType;
  conditionParams: Record<string, any>;
  action: ActionType;
  actionParams: Record<string, any>;
  status: RuleStatus;
  oneShot: boolean;
  createdAt: number;
  expiresAt: number;
  triggeredAt?: number;
  triggerData?: Record<string, any>;
  description: string;
}

const rules: Map<string, ConditionalRule> = new Map();
let ruleCounter = 0;
let checkerInterval: ReturnType<typeof setInterval> | null = null;

export function createRule(params: {
  token: string;
  tokenAddress?: string;
  condition: ConditionType;
  conditionParams: Record<string, any>;
  action: ActionType;
  actionParams: Record<string, any>;
  oneShot?: boolean;
  ttlHours?: number;
  description: string;
}): ConditionalRule {
  ruleCounter++;
  const rule: ConditionalRule = {
    id: `rule_${ruleCounter}_${Date.now()}`,
    token: params.token.toUpperCase(),
    tokenAddress: params.tokenAddress,
    condition: params.condition,
    conditionParams: params.conditionParams,
    action: params.action,
    actionParams: params.actionParams,
    status: 'active',
    oneShot: params.oneShot ?? true,
    createdAt: Date.now(),
    expiresAt: Date.now() + (params.ttlHours ?? 168) * 3600_000,
    description: params.description,
  };

  rules.set(rule.id, rule);
  log.info({ ruleId: rule.id, condition: rule.condition, token: rule.token }, 'Conditional rule created');
  ensureCheckerRunning();
  return rule;
}

export function cancelRule(ruleId: string): ConditionalRule | null {
  const rule = rules.get(ruleId);
  if (!rule || rule.status !== 'active') return null;
  rule.status = 'cancelled';
  return rule;
}

export function getActiveRules(token?: string): ConditionalRule[] {
  return Array.from(rules.values())
    .filter(r => r.status === 'active' && (!token || r.token === token.toUpperCase()))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getAllRules(): ConditionalRule[] {
  return Array.from(rules.values()).sort((a, b) => b.createdAt - a.createdAt);
}

async function evaluateCondition(rule: ConditionalRule): Promise<{ triggered: boolean; data?: Record<string, any> }> {
  const { condition, conditionParams, token, tokenAddress } = rule;

  switch (condition) {
    case 'price_below':
    case 'price_above': {
      const metrics = await getTokenBySymbol(token);
      if (!metrics) return { triggered: false };
      const target = conditionParams.target_price as number;
      const triggered = condition === 'price_below' ? metrics.price <= target : metrics.price >= target;
      return { triggered, data: { currentPrice: metrics.price, targetPrice: target } };
    }

    case 'pct_drop_from':
    case 'pct_rise_from': {
      const metrics = await getTokenBySymbol(token);
      if (!metrics) return { triggered: false };
      const referencePrice = conditionParams.reference_price as number;
      const targetPct = conditionParams.target_pct as number;
      const pctChange = ((metrics.price - referencePrice) / referencePrice) * 100;
      const triggered = condition === 'pct_drop_from'
        ? pctChange <= -Math.abs(targetPct)
        : pctChange >= Math.abs(targetPct);
      return { triggered, data: { currentPrice: metrics.price, referencePrice, pctChange: parseFloat(pctChange.toFixed(2)) } };
    }

    case 'rsi_below':
    case 'rsi_above': {
      const addr = tokenAddress || (await getTokenBySymbol(token))?.address;
      if (!addr) return { triggered: false };
      const candles = await fetchOHLCV(addr, '1H', 100);
      if (candles.length < 20) return { triggered: false };
      const rsiArr = calculateRSI(candles, 14);
      const rsi = rsiArr[rsiArr.length - 1];
      if (isNaN(rsi)) return { triggered: false };
      const threshold = conditionParams.threshold as number;
      const triggered = condition === 'rsi_below' ? rsi <= threshold : rsi >= threshold;
      return { triggered, data: { rsi: parseFloat(rsi.toFixed(1)), threshold } };
    }

    case 'macd_bullish_cross':
    case 'macd_bearish_cross': {
      const addr = tokenAddress || (await getTokenBySymbol(token))?.address;
      if (!addr) return { triggered: false };
      const candles = await fetchOHLCV(addr, '1H', 100);
      if (candles.length < 30) return { triggered: false };
      const macdArr = calculateMACD(candles);
      const last = macdArr.length - 1;
      const prev = last - 1;
      if (prev < 0) return { triggered: false };
      const triggered = condition === 'macd_bullish_cross'
        ? macdArr[prev].histogram <= 0 && macdArr[last].histogram > 0
        : macdArr[prev].histogram >= 0 && macdArr[last].histogram < 0;
      return { triggered, data: { macd: macdArr[last].macd, signal: macdArr[last].signal, histogram: macdArr[last].histogram } };
    }

    case 'golden_cross':
    case 'death_cross': {
      const addr = tokenAddress || (await getTokenBySymbol(token))?.address;
      if (!addr) return { triggered: false };
      const candles = await fetchOHLCV(addr, '1H', 100);
      const triggered = condition === 'golden_cross'
        ? detectGoldenCross(candles)
        : detectDeathCross(candles);
      return { triggered, data: { type: condition } };
    }

    case 'volume_spike': {
      const addr = tokenAddress || (await getTokenBySymbol(token))?.address;
      if (!addr) return { triggered: false };
      const candles = await fetchOHLCV(addr, '5m', 100);
      const threshold = (conditionParams.multiplier as number) || 3;
      const triggered = detectVolumeSpike(candles, 20, threshold);
      return { triggered, data: { multiplier: threshold } };
    }

    case 'top_by_volume': {
      const trending = await fetchTrending();
      const solTokens = trending.filter(t => t.chain === 'solana' || t.chain === 'sol');
      if (solTokens.length === 0) return { triggered: false };
      const sorted = solTokens.sort((a, b) => b.volume24h - a.volume24h);
      const topToken = sorted[0];
      return { triggered: true, data: { token: topToken.symbol, volume: topToken.volume24h, price: topToken.price, address: topToken.address } };
    }

    case 'cross_token_trigger': {
      const watchToken = conditionParams.watch_token as string;
      const targetPrice = conditionParams.target_price as number;
      const direction = conditionParams.direction as 'above' | 'below';
      const metrics = await getTokenBySymbol(watchToken);
      if (!metrics) return { triggered: false };
      const triggered = direction === 'above' ? metrics.price >= targetPrice : metrics.price <= targetPrice;
      return { triggered, data: { watchToken, watchPrice: metrics.price, targetPrice, direction } };
    }

    default:
      return { triggered: false };
  }
}

async function executeAction(rule: ConditionalRule, triggerData: Record<string, any>) {
  const port = process.env.PORT ?? 3000;

  if (rule.action === 'alert') {
    log.info({ ruleId: rule.id, token: rule.token, data: triggerData }, 'Rule alert triggered');
    return;
  }

  let token = rule.token;
  let amount = (rule.actionParams.amount_usd as number) || 200;

  if (rule.condition === 'top_by_volume' && triggerData.token) {
    token = triggerData.token;
  }

  try {
    await fetch(`http://localhost:${port}/api/v1/trade/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: token,
        side: rule.action,
        amountUsd: amount,
      }),
    });
    log.info({ ruleId: rule.id, action: rule.action, token, amount }, 'Rule action executed');
  } catch (err) {
    log.error({ err, ruleId: rule.id }, 'Failed to execute rule action');
  }
}

const CHECK_INTERVAL_MS = 30_000;

function ensureCheckerRunning() {
  if (checkerInterval) return;
  checkerInterval = setInterval(async () => {
    const active = getActiveRules();
    if (active.length === 0) {
      if (checkerInterval) clearInterval(checkerInterval);
      checkerInterval = null;
      return;
    }

    const now = Date.now();
    for (const rule of active) {
      if (now >= rule.expiresAt) {
        rule.status = 'expired';
        log.info({ ruleId: rule.id }, 'Rule expired');
        continue;
      }

      try {
        const result = await evaluateCondition(rule);
        if (result.triggered) {
          rule.status = 'triggered';
          rule.triggeredAt = now;
          rule.triggerData = result.data;
          log.info({ ruleId: rule.id, condition: rule.condition, data: result.data }, 'Rule triggered');
          await executeAction(rule, result.data ?? {});
        }
      } catch (err) {
        log.warn({ err, ruleId: rule.id }, 'Rule evaluation failed');
      }
    }
  }, CHECK_INTERVAL_MS);
}

export async function getTAForToken(token: string): Promise<TASnapshot | null> {
  const metrics = await getTokenBySymbol(token);
  if (!metrics?.address) return null;

  const candles = await fetchOHLCV(metrics.address, '1H', 100);
  if (candles.length < 50) return null;

  return computeTASnapshot(candles);
}
