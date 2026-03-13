import { createChildLogger } from '../core/logger.js';

const log = createChildLogger('dca-engine');

export type DCAStatus = 'active' | 'paused' | 'completed' | 'stopped';

export interface DCAPlan {
  id: string;
  token: string;
  amountPerBuy: number;
  intervalMs: number;
  totalBuys: number;
  completedBuys: number;
  totalSpent: number;
  avgPrice: number;
  status: DCAStatus;
  createdAt: number;
  nextBuyAt: number;
  lastBuyAt?: number;
}

const plans: Map<string, DCAPlan> = new Map();
let planCounter = 0;
let dcaInterval: ReturnType<typeof setInterval> | null = null;

export function createDCAPlan(params: {
  token: string;
  amountPerBuy?: number;
  intervalHours?: number;
  totalBuys?: number;
}): DCAPlan {
  planCounter++;
  const intervalMs = (params.intervalHours ?? 24) * 3600_000;

  const plan: DCAPlan = {
    id: `dca_${planCounter}_${Date.now()}`,
    token: params.token.toUpperCase(),
    amountPerBuy: params.amountPerBuy ?? 50,
    intervalMs,
    totalBuys: params.totalBuys ?? 10,
    completedBuys: 0,
    totalSpent: 0,
    avgPrice: 0,
    status: 'active',
    createdAt: Date.now(),
    nextBuyAt: Date.now() + intervalMs,
  };

  plans.set(plan.id, plan);
  log.info({ planId: plan.id, token: plan.token, amount: plan.amountPerBuy, interval: params.intervalHours ?? 24 }, 'DCA plan created');

  ensureDCARunning();
  return plan;
}

export function pauseDCA(planId: string): DCAPlan | null {
  const plan = plans.get(planId);
  if (!plan || plan.status !== 'active') return null;
  plan.status = 'paused';
  return plan;
}

export function resumeDCA(planId: string): DCAPlan | null {
  const plan = plans.get(planId);
  if (!plan || plan.status !== 'paused') return null;
  plan.status = 'active';
  plan.nextBuyAt = Date.now() + plan.intervalMs;
  return plan;
}

export function stopDCA(planId: string): DCAPlan | null {
  const plan = plans.get(planId);
  if (!plan || (plan.status !== 'active' && plan.status !== 'paused')) return null;
  plan.status = 'stopped';
  return plan;
}

export function getActivePlans(token?: string): DCAPlan[] {
  const result: DCAPlan[] = [];
  for (const plan of plans.values()) {
    if (plan.status !== 'active' && plan.status !== 'paused') continue;
    if (token && plan.token !== token.toUpperCase()) continue;
    result.push(plan);
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export function getAllPlans(): DCAPlan[] {
  return Array.from(plans.values()).sort((a, b) => b.createdAt - a.createdAt);
}

const DCA_CHECK_MS = 60_000;

function ensureDCARunning() {
  if (dcaInterval) return;
  dcaInterval = setInterval(async () => {
    const active = getActivePlans();
    if (active.length === 0) {
      if (dcaInterval) clearInterval(dcaInterval);
      dcaInterval = null;
      return;
    }

    const now = Date.now();
    for (const plan of active) {
      if (plan.status !== 'active') continue;
      if (now < plan.nextBuyAt) continue;

      try {
        const port = process.env.PORT ?? 3000;
        const res = await fetch(`http://localhost:${port}/api/v1/trade/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: plan.token,
            side: 'buy',
            amountUsd: plan.amountPerBuy,
          }),
        });

        if (res.ok) {
          const data = await res.json() as any;
          const price = data.trade?.price ?? 0;
          plan.completedBuys++;
          plan.totalSpent += plan.amountPerBuy;
          plan.avgPrice = plan.totalSpent / (plan.totalSpent / (plan.avgPrice || price));
          plan.lastBuyAt = now;
          plan.nextBuyAt = now + plan.intervalMs;

          if (plan.completedBuys >= plan.totalBuys) {
            plan.status = 'completed';
            log.info({ planId: plan.id }, 'DCA plan completed all buys');
          } else {
            log.info({ planId: plan.id, buy: plan.completedBuys, total: plan.totalBuys, price }, 'DCA buy executed');
          }
        }
      } catch (err) {
        log.warn({ err, planId: plan.id }, 'DCA buy failed, will retry next interval');
        plan.nextBuyAt = now + plan.intervalMs;
      }
    }
  }, DCA_CHECK_MS);
}
