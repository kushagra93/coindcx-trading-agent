import { describe, it, expect } from 'vitest';
import { kellySize, detectRegime, getDefaultRiskSettings } from '../../src/risk/risk-manager.js';

describe('risk-manager', () => {
  describe('kellySize', () => {
    it('returns positive size for favorable edge', () => {
      const size = kellySize(0.6, 2.0, 0.25);
      expect(size).toBeGreaterThan(0);
      expect(size).toBeLessThanOrEqual(1);
    });

    it('returns 0 for no edge', () => {
      const size = kellySize(0.3, 1.0, 0.25);
      expect(size).toBe(0);
    });

    it('returns 0 for negative edge', () => {
      const size = kellySize(0.2, 0.5, 0.25);
      expect(size).toBe(0);
    });

    it('scales with kelly fraction', () => {
      const full = kellySize(0.6, 2.0, 1.0);
      const half = kellySize(0.6, 2.0, 0.5);
      const quarter = kellySize(0.6, 2.0, 0.25);
      expect(half).toBeCloseTo(full * 0.5, 5);
      expect(quarter).toBeCloseTo(full * 0.25, 5);
    });

    it('handles 100% win rate', () => {
      const size = kellySize(1.0, 2.0, 0.25);
      expect(size).toBeGreaterThan(0);
    });

    it('handles 0% win rate', () => {
      const size = kellySize(0, 2.0, 0.25);
      expect(size).toBe(0);
    });
  });

  describe('detectRegime', () => {
    it('returns low-volatility for small moves', () => {
      expect(detectRegime([0.01, 0.015, 0.005])).toBe('low-volatility');
    });

    it('returns high-volatility for large moves', () => {
      expect(detectRegime([0.06, 0.08, 0.07])).toBe('high-volatility');
    });

    it('returns medium-volatility for moderate moves', () => {
      expect(detectRegime([0.03, 0.04, 0.035])).toBe('medium-volatility');
    });

    it('returns medium-volatility for empty array', () => {
      expect(detectRegime([])).toBe('medium-volatility');
    });

    it('handles single value', () => {
      expect(detectRegime([0.01])).toBe('low-volatility');
      expect(detectRegime([0.10])).toBe('high-volatility');
    });

    it('handles boundary at 0.02 (low/medium)', () => {
      expect(detectRegime([0.02])).toBe('medium-volatility');
    });

    it('handles boundary at 0.05 (medium/high)', () => {
      expect(detectRegime([0.05])).toBe('medium-volatility');
      expect(detectRegime([0.051])).toBe('high-volatility');
    });
  });

  describe('getDefaultRiskSettings', () => {
    it('returns settings for conservative', () => {
      const settings = getDefaultRiskSettings('conservative');
      expect(settings.riskLevel).toBe('conservative');
      expect(settings.dailyLossLimitUsd).toBe(1000);
      expect(settings.maxPerTradePct).toBeGreaterThan(0);
    });

    it('returns settings for moderate', () => {
      const settings = getDefaultRiskSettings('moderate');
      expect(settings.riskLevel).toBe('moderate');
    });

    it('returns settings for aggressive', () => {
      const settings = getDefaultRiskSettings('aggressive');
      expect(settings.riskLevel).toBe('aggressive');
    });

    it('aggressive has higher max position than conservative', () => {
      const conservative = getDefaultRiskSettings('conservative');
      const aggressive = getDefaultRiskSettings('aggressive');
      expect(aggressive.maxPerTradePct).toBeGreaterThanOrEqual(conservative.maxPerTradePct);
    });
  });
});
