import { describe, it, expect } from 'vitest';
import {
  isValidTransition,
  isTerminalState,
  assertTransition,
  getNonTerminalStates,
  getRecoverableStates,
  getRejectionStates,
  getStateDescription,
} from '../../src/core/state-machine.js';

describe('state-machine', () => {
  describe('isValidTransition', () => {
    it('allows happy path transitions', () => {
      expect(isValidTransition('SIGNAL_GENERATED', 'RISK_ASSESSED')).toBe(true);
      expect(isValidTransition('RISK_ASSESSED', 'COMPLIANCE_CHECKED')).toBe(true);
      expect(isValidTransition('COMPLIANCE_CHECKED', 'APPROVAL_REQUESTED')).toBe(true);
      expect(isValidTransition('APPROVAL_REQUESTED', 'APPROVED')).toBe(true);
      expect(isValidTransition('APPROVED', 'FEE_RESERVED')).toBe(true);
      expect(isValidTransition('FEE_RESERVED', 'ORDER_SUBMITTED')).toBe(true);
      expect(isValidTransition('ORDER_SUBMITTED', 'ORDER_CONFIRMED')).toBe(true);
      expect(isValidTransition('ORDER_CONFIRMED', 'FEE_SETTLED')).toBe(true);
      expect(isValidTransition('FEE_SETTLED', 'FEE_LEDGER_RECORDED')).toBe(true);
      expect(isValidTransition('FEE_LEDGER_RECORDED', 'NOTIFICATION_SENT')).toBe(true);
      expect(isValidTransition('NOTIFICATION_SENT', 'POSITION_UPDATED')).toBe(true);
    });

    it('allows rejection transitions', () => {
      expect(isValidTransition('SIGNAL_GENERATED', 'RISK_REJECTED')).toBe(true);
      expect(isValidTransition('RISK_ASSESSED', 'COMPLIANCE_REJECTED')).toBe(true);
      expect(isValidTransition('APPROVAL_REQUESTED', 'APPROVAL_REJECTED')).toBe(true);
    });

    it('allows failure transitions', () => {
      expect(isValidTransition('ORDER_SUBMITTED', 'ORDER_FAILED')).toBe(true);
      expect(isValidTransition('ORDER_FAILED', 'FEE_REFUNDED')).toBe(true);
      expect(isValidTransition('FEE_RESERVED', 'FEE_REFUNDED')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(isValidTransition('SIGNAL_GENERATED', 'ORDER_CONFIRMED')).toBe(false);
      expect(isValidTransition('POSITION_UPDATED', 'SIGNAL_GENERATED')).toBe(false);
      expect(isValidTransition('RISK_REJECTED', 'RISK_ASSESSED')).toBe(false);
    });
  });

  describe('isTerminalState', () => {
    it('identifies terminal states', () => {
      expect(isTerminalState('RISK_REJECTED')).toBe(true);
      expect(isTerminalState('COMPLIANCE_REJECTED')).toBe(true);
      expect(isTerminalState('APPROVAL_REJECTED')).toBe(true);
      expect(isTerminalState('FEE_REFUNDED')).toBe(true);
      expect(isTerminalState('POSITION_UPDATED')).toBe(true);
    });

    it('identifies non-terminal states', () => {
      expect(isTerminalState('SIGNAL_GENERATED')).toBe(false);
      expect(isTerminalState('APPROVED')).toBe(false);
      expect(isTerminalState('ORDER_SUBMITTED')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw on valid transition', () => {
      expect(() => assertTransition('SIGNAL_GENERATED', 'RISK_ASSESSED', 'trade-1')).not.toThrow();
    });

    it('throws on invalid transition', () => {
      expect(() => assertTransition('SIGNAL_GENERATED', 'ORDER_CONFIRMED', 'trade-1')).toThrow(
        /Invalid trade state transition/
      );
    });
  });

  describe('getNonTerminalStates', () => {
    it('returns only non-terminal states', () => {
      const states = getNonTerminalStates();
      expect(states).toContain('SIGNAL_GENERATED');
      expect(states).toContain('ORDER_SUBMITTED');
      expect(states).not.toContain('RISK_REJECTED');
      expect(states).not.toContain('POSITION_UPDATED');
    });
  });

  describe('getRecoverableStates', () => {
    it('returns in-flight states needing crash recovery', () => {
      const states = getRecoverableStates();
      expect(states).toContain('FEE_RESERVED');
      expect(states).toContain('ORDER_SUBMITTED');
      expect(states).toContain('ORDER_CONFIRMED');
      expect(states).not.toContain('SIGNAL_GENERATED');
      expect(states).not.toContain('POSITION_UPDATED');
    });
  });

  describe('getRejectionStates', () => {
    it('returns rejection terminal states', () => {
      const states = getRejectionStates();
      expect(states).toEqual(['RISK_REJECTED', 'COMPLIANCE_REJECTED', 'APPROVAL_REJECTED']);
    });
  });

  describe('getStateDescription', () => {
    it('returns description for known states', () => {
      expect(getStateDescription('SIGNAL_GENERATED')).toBe('Strategy generated a trade signal');
      expect(getStateDescription('POSITION_UPDATED')).toBe('Portfolio position updated');
      expect(getStateDescription('ORDER_FAILED')).toBe('Order execution failed');
    });
  });
});
