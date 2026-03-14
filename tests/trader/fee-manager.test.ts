import { describe, it, expect } from 'vitest';
import {
  getFeeRate,
  calculateFee,
  calculateProfitShare,
} from '../../src/trader/fee-manager.js';

describe('fee-manager', () => {
  describe('getFeeRate', () => {
    it('returns 0.15% for AUM >= $10k', () => {
      expect(getFeeRate(10_000)).toBe(0.0015);
      expect(getFeeRate(100_000)).toBe(0.0015);
    });

    it('returns 0.20% for AUM >= $1k and < $10k', () => {
      expect(getFeeRate(1_000)).toBe(0.0020);
      expect(getFeeRate(5_000)).toBe(0.0020);
    });

    it('returns 0.25% for AUM < $1k', () => {
      expect(getFeeRate(0)).toBe(0.0025);
      expect(getFeeRate(500)).toBe(0.0025);
      expect(getFeeRate(999)).toBe(0.0025);
    });

    it('handles boundary at $10k', () => {
      expect(getFeeRate(9_999)).toBe(0.0020);
      expect(getFeeRate(10_000)).toBe(0.0015);
    });

    it('handles boundary at $1k', () => {
      expect(getFeeRate(999)).toBe(0.0025);
      expect(getFeeRate(1_000)).toBe(0.0020);
    });
  });

  describe('calculateFee', () => {
    it('calculates fee for normal amount', () => {
      const result = calculateFee('100', 10_000);
      expect(result.feeRate).toBe(0.0015);
      expect(parseFloat(result.feeAmount)).toBeCloseTo(0.15, 4);
    });

    it('returns 0 fee for zero amount', () => {
      const result = calculateFee('0', 10_000);
      expect(result.feeAmount).toBe('0');
    });

    it('returns 0 fee for negative amount', () => {
      const result = calculateFee('-100', 10_000);
      expect(result.feeAmount).toBe('0');
    });

    it('returns 0 fee for invalid amount', () => {
      const result = calculateFee('not-a-number', 10_000);
      expect(result.feeAmount).toBe('0');
    });

    it('uses appropriate tier for smaller AUM', () => {
      const result = calculateFee('100', 500);
      expect(result.feeRate).toBe(0.0025);
      expect(parseFloat(result.feeAmount)).toBeCloseTo(0.25, 4);
    });

    it('returns fee as 8-decimal string', () => {
      const result = calculateFee('1000', 10_000);
      expect(result.feeAmount).toMatch(/^\d+\.\d{8}$/);
    });
  });

  describe('calculateProfitShare', () => {
    it('returns 10% for positive profit', () => {
      expect(calculateProfitShare(1000)).toBeCloseTo(100, 5);
    });

    it('returns 0 for zero profit', () => {
      expect(calculateProfitShare(0)).toBe(0);
    });

    it('returns 0 for negative profit', () => {
      expect(calculateProfitShare(-500)).toBe(0);
    });

    it('handles small profit', () => {
      expect(calculateProfitShare(1)).toBeCloseTo(0.1, 5);
    });
  });
});
