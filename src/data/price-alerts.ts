import { createChildLogger } from '../core/logger.js';
import { getTokenBySymbol } from './token-screener.js';

const log = createChildLogger('price-alerts');

export type AlertDirection = 'above' | 'below';
export type AlertStatus = 'active' | 'triggered' | 'cancelled';

export interface PriceAlert {
  id: string;
  token: string;
  targetPrice: number;
  direction: AlertDirection;
  priceAtCreation: number;
  status: AlertStatus;
  createdAt: number;
  triggeredAt?: number;
  triggeredPrice?: number;
}

const alerts: Map<string, PriceAlert> = new Map();
let alertCounter = 0;
let alertInterval: ReturnType<typeof setInterval> | null = null;
const triggeredCallbacks: ((alert: PriceAlert) => void)[] = [];

export function onAlertTriggered(cb: (alert: PriceAlert) => void) {
  triggeredCallbacks.push(cb);
}

export function createPriceAlert(params: {
  token: string;
  targetPrice?: number;
  direction?: AlertDirection;
  pctChange?: number;
  currentPrice: number;
}): PriceAlert {
  alertCounter++;

  let targetPrice = params.targetPrice ?? 0;
  let direction = params.direction ?? 'above';

  if (!targetPrice && params.pctChange !== undefined) {
    targetPrice = params.currentPrice * (1 + params.pctChange / 100);
    direction = params.pctChange >= 0 ? 'above' : 'below';
  }

  if (!targetPrice) {
    targetPrice = params.currentPrice * 1.1;
    direction = 'above';
  }

  const alert: PriceAlert = {
    id: `alert_${alertCounter}_${Date.now()}`,
    token: params.token.toUpperCase(),
    targetPrice,
    direction,
    priceAtCreation: params.currentPrice,
    status: 'active',
    createdAt: Date.now(),
  };

  alerts.set(alert.id, alert);
  log.info({ alertId: alert.id, token: alert.token, target: alert.targetPrice, dir: alert.direction }, 'Price alert created');

  ensureAlertCheckerRunning();
  return alert;
}

export function cancelAlert(alertId: string): PriceAlert | null {
  const alert = alerts.get(alertId);
  if (!alert || alert.status !== 'active') return null;
  alert.status = 'cancelled';
  return alert;
}

export function getActiveAlerts(token?: string): PriceAlert[] {
  const result: PriceAlert[] = [];
  for (const alert of alerts.values()) {
    if (alert.status !== 'active') continue;
    if (token && alert.token !== token.toUpperCase()) continue;
    result.push(alert);
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export function getTriggeredAlerts(): PriceAlert[] {
  return Array.from(alerts.values())
    .filter(a => a.status === 'triggered')
    .sort((a, b) => (b.triggeredAt ?? 0) - (a.triggeredAt ?? 0));
}

const ALERT_CHECK_MS = 30_000;

function ensureAlertCheckerRunning() {
  if (alertInterval) return;
  alertInterval = setInterval(async () => {
    const active = getActiveAlerts();
    if (active.length === 0) {
      if (alertInterval) clearInterval(alertInterval);
      alertInterval = null;
      return;
    }

    for (const alert of active) {
      try {
        const metrics = await getTokenBySymbol(alert.token);
        if (!metrics) continue;

        const price = metrics.price;
        const hit = alert.direction === 'above'
          ? price >= alert.targetPrice
          : price <= alert.targetPrice;

        if (hit) {
          alert.status = 'triggered';
          alert.triggeredAt = Date.now();
          alert.triggeredPrice = price;
          log.info({ alertId: alert.id, token: alert.token, target: alert.targetPrice, actual: price }, 'Price alert triggered');
          for (const cb of triggeredCallbacks) cb(alert);
        }
      } catch (err) {
        log.warn({ err, alertId: alert.id }, 'Failed to check alert price');
      }
    }
  }, ALERT_CHECK_MS);
}
