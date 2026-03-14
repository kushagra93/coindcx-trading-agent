/**
 * Trade State Machine — extended to 15 states for the full trade lifecycle.
 *
 * Happy path:
 *   SIGNAL_GENERATED → RISK_ASSESSED → COMPLIANCE_CHECKED → APPROVAL_REQUESTED → APPROVED →
 *   FEE_RESERVED → ORDER_SUBMITTED → ORDER_CONFIRMED → FEE_SETTLED → FEE_LEDGER_RECORDED →
 *   NOTIFICATION_SENT → POSITION_UPDATED
 *
 * Rejection paths (terminal):
 *   RISK_REJECTED, COMPLIANCE_REJECTED, APPROVAL_REJECTED
 *
 * Failure path:
 *   ORDER_FAILED → FEE_REFUNDED (terminal)
 */

import type { TradeState } from './types.js';
import { createChildLogger } from './logger.js';

const log = createChildLogger('state-machine');

// Valid state transitions — extended from 7 to 15 states
const TRANSITIONS: Record<TradeState, TradeState[]> = {
  // === Pre-approval pipeline ===
  SIGNAL_GENERATED: ['RISK_ASSESSED', 'RISK_REJECTED'],
  RISK_ASSESSED: ['COMPLIANCE_CHECKED', 'COMPLIANCE_REJECTED'],
  RISK_REJECTED: [],             // terminal — risk score too high
  COMPLIANCE_CHECKED: ['APPROVAL_REQUESTED'],
  COMPLIANCE_REJECTED: [],       // terminal — jurisdiction/compliance violation
  APPROVAL_REQUESTED: ['APPROVED', 'APPROVAL_REJECTED'],
  APPROVED: ['FEE_RESERVED'],
  APPROVAL_REJECTED: [],         // terminal — master agent denied trade

  // === Execution pipeline (carries forward from original) ===
  FEE_RESERVED: ['ORDER_SUBMITTED', 'FEE_REFUNDED'],
  ORDER_SUBMITTED: ['ORDER_CONFIRMED', 'ORDER_FAILED'],
  ORDER_CONFIRMED: ['FEE_SETTLED'],
  ORDER_FAILED: ['FEE_REFUNDED'],
  FEE_REFUNDED: [],             // terminal — failure path

  // === Post-execution pipeline ===
  FEE_SETTLED: ['FEE_LEDGER_RECORDED'],
  FEE_LEDGER_RECORDED: ['NOTIFICATION_SENT'],
  NOTIFICATION_SENT: ['POSITION_UPDATED'],
  POSITION_UPDATED: [],         // terminal — success path
};

const TERMINAL_STATES: Set<TradeState> = new Set([
  'RISK_REJECTED',
  'COMPLIANCE_REJECTED',
  'APPROVAL_REJECTED',
  'FEE_REFUNDED',
  'POSITION_UPDATED',
]);

export function isValidTransition(from: TradeState, to: TradeState): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalState(state: TradeState): boolean {
  return TERMINAL_STATES.has(state);
}

export function assertTransition(from: TradeState, to: TradeState, tradeId: string): void {
  if (!isValidTransition(from, to)) {
    const msg = `Invalid trade state transition: ${from} -> ${to} (trade: ${tradeId})`;
    log.error(msg);
    throw new Error(msg);
  }
}

export function getNonTerminalStates(): TradeState[] {
  return Object.keys(TRANSITIONS).filter(
    (s) => !TERMINAL_STATES.has(s as TradeState)
  ) as TradeState[];
}

// States that need crash recovery reconciliation
export function getRecoverableStates(): TradeState[] {
  return [
    'FEE_RESERVED',       // fee taken but order not yet submitted
    'ORDER_SUBMITTED',    // order sent but no confirmation
    'ORDER_CONFIRMED',    // order confirmed but fee not settled
    'FEE_SETTLED',        // fee settled but not recorded in ledger
    'FEE_LEDGER_RECORDED', // recorded but notification not sent
    'NOTIFICATION_SENT',  // notified but position not updated
  ];
}

// States that are rejection terminals (not failure — no fee to refund)
export function getRejectionStates(): TradeState[] {
  return ['RISK_REJECTED', 'COMPLIANCE_REJECTED', 'APPROVAL_REJECTED'];
}

// Get human-readable description of a state
export function getStateDescription(state: TradeState): string {
  const descriptions: Record<TradeState, string> = {
    SIGNAL_GENERATED: 'Strategy generated a trade signal',
    RISK_ASSESSED: 'Risk analysis completed',
    RISK_REJECTED: 'Trade rejected by risk assessment',
    COMPLIANCE_CHECKED: 'Broker compliance check passed',
    COMPLIANCE_REJECTED: 'Trade rejected by compliance',
    APPROVAL_REQUESTED: 'Approval token requested from master',
    APPROVED: 'Master agent approved the trade',
    APPROVAL_REJECTED: 'Master agent rejected the trade',
    FEE_RESERVED: 'Fee reserved (atomic with trade)',
    ORDER_SUBMITTED: 'Order submitted to DEX/venue',
    ORDER_CONFIRMED: 'Order confirmed on-chain',
    ORDER_FAILED: 'Order execution failed',
    FEE_SETTLED: 'Fee settled to platform',
    FEE_REFUNDED: 'Fee refunded after failure',
    FEE_LEDGER_RECORDED: 'Fee recorded in immutable ledger',
    NOTIFICATION_SENT: 'User notified of trade result',
    POSITION_UPDATED: 'Portfolio position updated',
  };
  return descriptions[state] || state;
}
