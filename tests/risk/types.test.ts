import { describe, it, expect } from 'vitest';
import { RISK_PROFILES } from '../../src/risk/types.js';

describe('risk types', () => {
  describe('RISK_PROFILES', () => {
    it('has conservative profile', () => {
      const p = RISK_PROFILES.conservative;
      expect(p.riskLevel).toBe('conservative');
      expect(p.kellyFraction).toBe(0.25);
      expect(p.maxPositionSizePct).toBe(5);
      expect(p.regimeSensitivity).toBe(2.0);
    });

    it('has moderate profile', () => {
      const p = RISK_PROFILES.moderate;
      expect(p.riskLevel).toBe('moderate');
      expect(p.kellyFraction).toBe(0.5);
      expect(p.maxPositionSizePct).toBe(15);
      expect(p.regimeSensitivity).toBe(1.0);
    });

    it('has aggressive profile', () => {
      const p = RISK_PROFILES.aggressive;
      expect(p.riskLevel).toBe('aggressive');
      expect(p.kellyFraction).toBe(0.75);
      expect(p.maxPositionSizePct).toBe(25);
      expect(p.regimeSensitivity).toBe(0.5);
    });

    it('profiles are ordered by risk level', () => {
      const c = RISK_PROFILES.conservative;
      const m = RISK_PROFILES.moderate;
      const a = RISK_PROFILES.aggressive;
      expect(c.kellyFraction).toBeLessThan(m.kellyFraction);
      expect(m.kellyFraction).toBeLessThan(a.kellyFraction);
      expect(c.maxPositionSizePct).toBeLessThan(m.maxPositionSizePct);
      expect(m.maxPositionSizePct).toBeLessThan(a.maxPositionSizePct);
      expect(c.regimeSensitivity).toBeGreaterThan(m.regimeSensitivity);
      expect(m.regimeSensitivity).toBeGreaterThan(a.regimeSensitivity);
    });
  });
});
