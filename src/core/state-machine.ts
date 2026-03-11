import type { TradeState } from './types.js';
import { createChildLogger } from './logger.js';

const log = createChildLogger('state-machine');

// Valid state transitions
const TRANSITIONS: Record<TradeState, TradeState[]> = {
  SIGNAL_GENERATED: ['FEE_RESERVED'],
  FEE_RESERVED: ['ORDER_SUBMITTED', 'FEE_REFUNDED'],
  ORDER_SUBMITTED: ['ORDER_CONFIRMED', 'ORDER_FAILED'],
  ORDER_CONFIRMED: ['POSITION_UPDATED'],
  ORDER_FAILED: ['FEE_REFUNDED'],
  FEE_REFUNDED: [],         // terminal
  POSITION_UPDATED: [],     // terminal
};

const TERMINAL_STATES: Set<TradeState> = new Set(['FEE_REFUNDED', 'POSITION_UPDATED']);

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
  return ['FEE_RESERVED', 'ORDER_SUBMITTED'];
}
