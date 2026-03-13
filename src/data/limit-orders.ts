import { createChildLogger } from '../core/logger.js';
import { getTokenBySymbol } from './token-screener.js';

const log = createChildLogger('limit-orders');

export type OrderType = 'take_profit' | 'stop_loss' | 'limit_buy' | 'limit_sell';
export type OrderStatus = 'active' | 'triggered' | 'cancelled' | 'expired';

export interface LimitOrder {
  id: string;
  token: string;
  orderType: OrderType;
  triggerPrice: number;
  currentPriceAtCreation: number;
  amountUsd: number;
  status: OrderStatus;
  createdAt: number;
  triggeredAt?: number;
  expiresAt: number;
}

const orders: Map<string, LimitOrder> = new Map();
let orderCounter = 0;
let checkInterval: ReturnType<typeof setInterval> | null = null;

export function createLimitOrder(params: {
  token: string;
  orderType: OrderType;
  triggerPrice: number;
  currentPrice: number;
  amountUsd: number;
  expiresInHours?: number;
}): LimitOrder {
  orderCounter++;
  const order: LimitOrder = {
    id: `lo_${orderCounter}_${Date.now()}`,
    token: params.token.toUpperCase(),
    orderType: params.orderType,
    triggerPrice: params.triggerPrice,
    currentPriceAtCreation: params.currentPrice,
    amountUsd: params.amountUsd || 200,
    status: 'active',
    createdAt: Date.now(),
    expiresAt: Date.now() + (params.expiresInHours ?? 24) * 3600_000,
  };

  orders.set(order.id, order);
  log.info({ orderId: order.id, token: order.token, type: order.orderType, trigger: order.triggerPrice }, 'Limit order created');

  ensureCheckerRunning();
  return order;
}

export function cancelOrder(orderId: string): LimitOrder | null {
  const order = orders.get(orderId);
  if (!order || order.status !== 'active') return null;
  order.status = 'cancelled';
  log.info({ orderId }, 'Order cancelled');
  return order;
}

export function cancelAllOrders(token?: string): number {
  let count = 0;
  for (const order of orders.values()) {
    if (order.status !== 'active') continue;
    if (token && order.token !== token.toUpperCase()) continue;
    order.status = 'cancelled';
    count++;
  }
  return count;
}

export function getActiveOrders(token?: string): LimitOrder[] {
  const result: LimitOrder[] = [];
  for (const order of orders.values()) {
    if (order.status !== 'active') continue;
    if (token && order.token !== token.toUpperCase()) continue;
    result.push(order);
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export function getAllOrders(): LimitOrder[] {
  return Array.from(orders.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getTriggeredOrders(): LimitOrder[] {
  return Array.from(orders.values())
    .filter(o => o.status === 'triggered')
    .sort((a, b) => (b.triggeredAt ?? 0) - (a.triggeredAt ?? 0));
}

interface TriggerResult {
  order: LimitOrder;
  currentPrice: number;
  side: 'buy' | 'sell';
}

export async function checkOrders(): Promise<TriggerResult[]> {
  const triggered: TriggerResult[] = [];
  const now = Date.now();

  for (const order of orders.values()) {
    if (order.status !== 'active') continue;

    if (now >= order.expiresAt) {
      order.status = 'expired';
      log.info({ orderId: order.id }, 'Order expired');
      continue;
    }

    try {
      const metrics = await getTokenBySymbol(order.token);
      if (!metrics) continue;

      const price = metrics.price;
      let shouldTrigger = false;

      switch (order.orderType) {
        case 'take_profit':
        case 'limit_sell':
          shouldTrigger = price >= order.triggerPrice;
          break;
        case 'stop_loss':
          shouldTrigger = price <= order.triggerPrice;
          break;
        case 'limit_buy':
          shouldTrigger = price <= order.triggerPrice;
          break;
      }

      if (shouldTrigger) {
        order.status = 'triggered';
        order.triggeredAt = now;
        const side = (order.orderType === 'limit_buy') ? 'buy' : 'sell';
        triggered.push({ order, currentPrice: price, side });
        log.info({ orderId: order.id, type: order.orderType, trigger: order.triggerPrice, actual: price }, 'Order triggered');
      }
    } catch (err) {
      log.warn({ err, orderId: order.id }, 'Failed to check order price');
    }
  }

  return triggered;
}

const CHECK_INTERVAL_MS = 30_000;

function ensureCheckerRunning() {
  if (checkInterval) return;
  checkInterval = setInterval(async () => {
    const active = getActiveOrders();
    if (active.length === 0) {
      if (checkInterval) clearInterval(checkInterval);
      checkInterval = null;
      return;
    }

    const triggered = await checkOrders();
    for (const t of triggered) {
      try {
        const port = process.env.PORT ?? 3000;
        await fetch(`http://localhost:${port}/api/v1/trade/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: t.order.token,
            side: t.side,
            amountUsd: t.order.amountUsd,
            slippagePct: 2,
          }),
        });
        log.info({ orderId: t.order.id, side: t.side, price: t.currentPrice }, 'Triggered order executed');
      } catch (err) {
        log.error({ err, orderId: t.order.id }, 'Failed to execute triggered order');
      }
    }
  }, CHECK_INTERVAL_MS);
}

export function computeTriggerPrice(
  currentPrice: number,
  orderType: OrderType,
  triggerPct?: number,
  triggerPrice?: number,
): number {
  if (triggerPrice && triggerPrice > 0) return triggerPrice;
  if (triggerPct !== undefined && triggerPct !== 0) {
    return currentPrice * (1 + triggerPct / 100);
  }
  switch (orderType) {
    case 'take_profit': return currentPrice * 1.2;
    case 'stop_loss': return currentPrice * 0.9;
    case 'limit_buy': return currentPrice * 0.95;
    case 'limit_sell': return currentPrice * 1.1;
  }
}
