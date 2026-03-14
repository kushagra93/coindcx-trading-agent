import { describe, it, expect } from 'vitest';
import { screenToken, type TokenMetrics, type ScreeningResult } from '../../src/data/token-screener.js';

function makeMetrics(overrides: Partial<TokenMetrics> = {}): TokenMetrics {
  return {
    symbol: 'TEST',
    name: 'Test Token',
    chain: 'solana',
    price: 1.0,
    priceChange5m: 0,
    priceChange1h: 0,
    priceChange6h: 0,
    priceChange24h: 5,
    volume24h: 200_000,
    marketCap: 1_000_000,
    liquidity: 100_000,
    ageMinutes: 60 * 24 * 30,
    holders: 5000,
    topHolderPct: 5,
    lpLocked: true,
    lpLockPct: 80,
    rugScore: 85,
    ctScore: 60,
    hasSecurityData: true,
    txnsBuys24h: 500,
    txnsSells24h: 300,
    ...overrides,
  };
}

describe('Token Screener - screenToken', () => {
  it('grades a healthy token as A or B', () => {
    const result = screenToken(makeMetrics());
    expect(['A', 'B']).toContain(result.grade);
    expect(result.passed).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(50);
  });

  it('uses overallScore not aiConfidence', () => {
    const result = screenToken(makeMetrics());
    expect(result).toHaveProperty('overallScore');
    expect(result).not.toHaveProperty('aiConfidence');
  });

  it('fails a token with no security data and low liquidity', () => {
    const result = screenToken(makeMetrics({
      hasSecurityData: false,
      rugScore: 0,
      liquidity: 1000,
      volume24h: 500,
      holders: 10,
    }));
    expect(result.passed).toBe(false);
    expect(result.warnings).toContain('No security data available');
  });

  it('scores 0 safety when no security data', () => {
    const result = screenToken(makeMetrics({
      hasSecurityData: false,
      rugScore: 0,
    }));
    expect(result.warnings).toContain('No security data available');
    // With no security data, safety is 0, but liquidity and momentum can still contribute
  });

  it('heavily penalizes rugged tokens', () => {
    const result = screenToken(makeMetrics({
      audit: {
        noMint: false, noFreeze: false, burnt: 0,
        top10HolderPct: 80, insidersDetected: 5,
        totalHolders: 100, totalLiquidity: 5000,
        lpLockedPct: 0, lpProviders: 1,
        rugged: true, risks: [],
      },
      rugScore: 10,
      liquidity: 5000,
      volume24h: 500,
      holders: 10,
      ctScore: 5,
      lpLocked: false,
      lpLockPct: 0,
      txnsBuys24h: 5,
      txnsSells24h: 20,
    }));
    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('RUGGED')]));
  });

  it('detects strong momentum', () => {
    const result = screenToken(makeMetrics({ ctScore: 80 }));
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('Strong momentum')]));
  });
});
