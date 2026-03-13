import { describe, it, expect } from 'vitest';
import {
  PARAMETER_BOUNDS,
  clamp,
  clampPositionSize,
  clampSlippage,
  clampLeverage,
  clampDailyLossLimit,
} from '../../src/risk/parameter-bounds.js';

describe('parameter-bounds', () => {
  describe('PARAMETER_BOUNDS', () => {
    it('has correct position sizing bounds', () => {
      expect(PARAMETER_BOUNDS.MAX_POSITION_SIZE_PCT).toBe(25);
      expect(PARAMETER_BOUNDS.MIN_POSITION_SIZE_USD).toBe(1);
      expect(PARAMETER_BOUNDS.MAX_POSITIONS_PER_USER).toBe(20);
    });

    it('has correct slippage bounds', () => {
      expect(PARAMETER_BOUNDS.MAX_SLIPPAGE_BPS).toBe(500);
      expect(PARAMETER_BOUNDS.DEFAULT_SLIPPAGE_BPS).toBe(100);
    });

    it('has correct fee bounds', () => {
      expect(PARAMETER_BOUNDS.MIN_FEE_PCT).toBe(0.001);
      expect(PARAMETER_BOUNDS.MAX_FEE_PCT).toBe(0.01);
    });

    it('has correct risk bounds', () => {
      expect(PARAMETER_BOUNDS.MAX_DAILY_LOSS_PCT).toBe(20);
      expect(PARAMETER_BOUNDS.MIN_CIRCUIT_BREAKER_PCT).toBe(5);
      expect(PARAMETER_BOUNDS.MAX_LEVERAGE).toBe(10);
    });
  });

  describe('clamp', () => {
    it('returns value when within bounds', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamps value to min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps value to max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('handles edge at min boundary', () => {
      expect(clamp(0, 0, 10)).toBe(0);
    });

    it('handles edge at max boundary', () => {
      expect(clamp(10, 0, 10)).toBe(10);
    });
  });

  describe('clampPositionSize', () => {
    it('allows valid position sizes', () => {
      expect(clampPositionSize(10)).toBe(10);
      expect(clampPositionSize(25)).toBe(25);
    });

    it('clamps to max 25%', () => {
      expect(clampPositionSize(50)).toBe(25);
      expect(clampPositionSize(100)).toBe(25);
    });

    it('clamps negative to 0', () => {
      expect(clampPositionSize(-5)).toBe(0);
    });
  });

  describe('clampSlippage', () => {
    it('allows valid slippage', () => {
      expect(clampSlippage(100)).toBe(100);
      expect(clampSlippage(500)).toBe(500);
    });

    it('clamps excessive slippage', () => {
      expect(clampSlippage(1000)).toBe(500);
    });

    it('clamps negative slippage', () => {
      expect(clampSlippage(-50)).toBe(0);
    });
  });

  describe('clampLeverage', () => {
    it('allows valid leverage', () => {
      expect(clampLeverage(1)).toBe(1);
      expect(clampLeverage(5)).toBe(5);
      expect(clampLeverage(10)).toBe(10);
    });

    it('clamps excessive leverage', () => {
      expect(clampLeverage(20)).toBe(10);
      expect(clampLeverage(100)).toBe(10);
    });

    it('clamps sub-1x to 1x', () => {
      expect(clampLeverage(0)).toBe(1);
      expect(clampLeverage(-1)).toBe(1);
    });
  });

  describe('clampDailyLossLimit', () => {
    it('allows value within range', () => {
      expect(clampDailyLossLimit(10)).toBe(10);
      expect(clampDailyLossLimit(15)).toBe(15);
    });

    it('clamps below minimum', () => {
      expect(clampDailyLossLimit(2)).toBe(5);
    });

    it('clamps above maximum', () => {
      expect(clampDailyLossLimit(30)).toBe(20);
    });

    it('handles boundary values', () => {
      expect(clampDailyLossLimit(5)).toBe(5);
      expect(clampDailyLossLimit(20)).toBe(20);
    });
  });
});
