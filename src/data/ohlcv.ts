import { createChildLogger } from '../core/logger.js';
import { LRUCache } from 'lru-cache';

const log = createChildLogger('ohlcv');

export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t: number;
}

export type Interval = '1m' | '5m' | '15m' | '1H' | '4H' | '1D';

const cache = new LRUCache<string, { candles: Candle[]; ts: number }>({ max: 200, ttl: 60_000 });

export async function fetchOHLCV(
  address: string,
  interval: Interval = '1H',
  limit: number = 100,
): Promise<Candle[]> {
  const key = `${address}:${interval}:${limit}`;
  const cached = cache.get(key);
  if (cached) return cached.candles;

  const apiKey = process.env.BIRDEYE_API_KEY;
  if (!apiKey) {
    log.warn('BIRDEYE_API_KEY not set, cannot fetch OHLCV');
    return [];
  }

  const now = Math.floor(Date.now() / 1000);
  const intervalSeconds: Record<Interval, number> = {
    '1m': 60, '5m': 300, '15m': 900, '1H': 3600, '4H': 14400, '1D': 86400,
  };
  const timeFrom = now - intervalSeconds[interval] * limit;

  try {
    const url = `https://public-api.birdeye.so/defi/ohlcv?address=${address}&type=${interval}&time_from=${timeFrom}&time_to=${now}`;
    const res = await fetch(url, {
      headers: { 'X-API-KEY': apiKey, 'x-chain': 'solana' },
    });

    if (!res.ok) {
      log.warn({ status: res.status }, 'Birdeye OHLCV fetch failed');
      return [];
    }

    const data = await res.json() as any;
    const items = data?.data?.items ?? [];

    const candles: Candle[] = items.map((item: any) => ({
      o: item.o ?? 0,
      h: item.h ?? 0,
      l: item.l ?? 0,
      c: item.c ?? 0,
      v: item.v ?? 0,
      t: item.unixTime ?? 0,
    }));

    cache.set(key, { candles, ts: Date.now() });
    return candles;
  } catch (err) {
    log.warn({ err }, 'OHLCV fetch error');
    return [];
  }
}

// ─── Technical Indicators ───────────────────────────────────────────

export function calculateSMA(candles: Candle[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].c;
    result.push(sum / period);
  }
  return result;
}

export function calculateEMA(candles: Candle[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { result.push(candles[i].c); continue; }
    if (i < period - 1) {
      let sum = 0;
      for (let j = 0; j <= i; j++) sum += candles[j].c;
      result.push(sum / (i + 1));
      continue;
    }
    if (i === period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) sum += candles[j].c;
      result.push(sum / period);
      continue;
    }
    result.push(candles[i].c * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function calculateRSI(candles: Candle[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { result.push(NaN); continue; }

    const change = candles[i].c - candles[i - 1].c;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);

    if (i < period) { result.push(NaN); continue; }

    if (i === period) {
      const avgGain = gains.slice(0, period).reduce((s, v) => s + v, 0) / period;
      const avgLoss = losses.slice(0, period).reduce((s, v) => s + v, 0) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result.push(100 - 100 / (1 + rs));
      continue;
    }

    const prevRsi = result[i - 1];
    if (isNaN(prevRsi)) { result.push(NaN); continue; }

    const prevAvgGain = gains.slice(i - period, i - 1).reduce((s, v) => s + v, 0) / period;
    const prevAvgLoss = losses.slice(i - period, i - 1).reduce((s, v) => s + v, 0) / period;
    const avgGain = (prevAvgGain * (period - 1) + gains[i - 1]) / period;
    const avgLoss = (prevAvgLoss * (period - 1) + losses[i - 1]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }
  return result;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

export function calculateMACD(
  candles: Candle[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult[] {
  const fastEMA = calculateEMA(candles, fastPeriod);
  const slowEMA = calculateEMA(candles, slowPeriod);

  const macdLine: number[] = fastEMA.map((f, i) => f - slowEMA[i]);

  const macdCandles = macdLine.map((v, i) => ({ o: v, h: v, l: v, c: v, v: 0, t: candles[i]?.t ?? 0 }));
  const signalLine = calculateEMA(macdCandles, signalPeriod);

  return macdLine.map((m, i) => ({
    macd: m,
    signal: signalLine[i],
    histogram: m - signalLine[i],
  }));
}

export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  bandwidth: number;
}

export function calculateBollingerBands(candles: Candle[], period = 20, stdDev = 2): BollingerResult[] {
  const sma = calculateSMA(candles, period);
  return candles.map((_, i) => {
    if (isNaN(sma[i])) return { upper: NaN, middle: NaN, lower: NaN, bandwidth: NaN };

    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const diff = candles[j].c - sma[i];
      sumSq += diff * diff;
    }
    const sd = Math.sqrt(sumSq / period);

    return {
      upper: sma[i] + stdDev * sd,
      middle: sma[i],
      lower: sma[i] - stdDev * sd,
      bandwidth: sd > 0 ? (stdDev * 2 * sd) / sma[i] * 100 : 0,
    };
  });
}

export function detectVolumeSpike(candles: Candle[], lookback = 20, threshold = 3): boolean {
  if (candles.length < lookback + 1) return false;
  const recent = candles.slice(-lookback - 1, -1);
  const avgVol = recent.reduce((s, c) => s + c.v, 0) / recent.length;
  const current = candles[candles.length - 1].v;
  return avgVol > 0 && current >= avgVol * threshold;
}

export function detectGoldenCross(candles: Candle[], shortPeriod = 20, longPeriod = 50): boolean {
  if (candles.length < longPeriod + 2) return false;
  const shortMA = calculateSMA(candles, shortPeriod);
  const longMA = calculateSMA(candles, longPeriod);
  const last = candles.length - 1;
  const prev = last - 1;
  return shortMA[prev] <= longMA[prev] && shortMA[last] > longMA[last];
}

export function detectDeathCross(candles: Candle[], shortPeriod = 20, longPeriod = 50): boolean {
  if (candles.length < longPeriod + 2) return false;
  const shortMA = calculateSMA(candles, shortPeriod);
  const longMA = calculateSMA(candles, longPeriod);
  const last = candles.length - 1;
  const prev = last - 1;
  return shortMA[prev] >= longMA[prev] && shortMA[last] < longMA[last];
}

export interface TASnapshot {
  price: number;
  rsi14: number;
  macd: MACDResult;
  bollinger: BollingerResult;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  volumeSpike: boolean;
  goldenCross: boolean;
  deathCross: boolean;
}

export function computeTASnapshot(candles: Candle[]): TASnapshot | null {
  if (candles.length < 50) return null;

  const rsiArr = calculateRSI(candles, 14);
  const macdArr = calculateMACD(candles);
  const bbArr = calculateBollingerBands(candles);
  const sma20 = calculateSMA(candles, 20);
  const sma50 = calculateSMA(candles, 50);
  const ema12 = calculateEMA(candles, 12);
  const ema26 = calculateEMA(candles, 26);
  const last = candles.length - 1;

  return {
    price: candles[last].c,
    rsi14: rsiArr[last],
    macd: macdArr[last],
    bollinger: bbArr[last],
    sma20: sma20[last],
    sma50: sma50[last],
    ema12: ema12[last],
    ema26: ema26[last],
    volumeSpike: detectVolumeSpike(candles),
    goldenCross: detectGoldenCross(candles),
    deathCross: detectDeathCross(candles),
  };
}
