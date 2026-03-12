/**
 * Trade Lifecycle Orchestrator — manages the 11-step trade saga.
 *
 * Steps:
 *   1. Market data → 2. Strategy eval → 3. Trade intent
 *   4. Risk assessment → 5. Risk threshold check
 *   6. Broker compliance → 7. Master approval token
 *   8. Strategy executor (with token) → 9. Atomic fee+trade
 *   10. Fee ledger recording → 11. Notification
 *
 * ATOMIC RULE: Fee deduction and trade execution are atomic —
 * both succeed or both fail. Uses compensation pattern on failure.
 *
 * Reuses: trade-memory.ts for idempotency, state-machine.ts for transitions.
 */

import { randomUUID } from 'node:crypto';
import { createChildLogger } from '../core/logger.js';
import { audit } from '../audit/audit-logger.js';

const log = createChildLogger('trade-lifecycle');

export type TradeLifecycleState =
  | 'SIGNAL_GENERATED'
  | 'RISK_ASSESSED'
  | 'RISK_REJECTED'
  | 'COMPLIANCE_CHECKED'
  | 'COMPLIANCE_REJECTED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVED'
  | 'APPROVAL_REJECTED'
  | 'FEE_RESERVED'
  | 'ORDER_SUBMITTED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_FAILED'
  | 'FEE_SETTLED'
  | 'FEE_REFUNDED'
  | 'FEE_LEDGER_RECORDED'
  | 'NOTIFICATION_SENT'
  | 'POSITION_UPDATED';

export interface LifecycleContext {
  corrId: string;
  userId: string;
  agentId: string;
  brokerId: string;
  asset: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  chain: string;
  strategyId: string;
  state: TradeLifecycleState;
  stateHistory: Array<{ state: TradeLifecycleState; timestamp: string; details?: string }>;
  riskScore?: number;
  approvalTokenId?: string;
  feeReservationId?: string;
  txHash?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

/**
 * Valid state transitions in the trade lifecycle.
 */
const VALID_TRANSITIONS: Record<TradeLifecycleState, TradeLifecycleState[]> = {
  SIGNAL_GENERATED: ['RISK_ASSESSED'],
  RISK_ASSESSED: ['COMPLIANCE_CHECKED', 'RISK_REJECTED'],
  RISK_REJECTED: [],
  COMPLIANCE_CHECKED: ['APPROVAL_REQUESTED', 'COMPLIANCE_REJECTED'],
  COMPLIANCE_REJECTED: [],
  APPROVAL_REQUESTED: ['APPROVED', 'APPROVAL_REJECTED'],
  APPROVED: ['FEE_RESERVED'],
  APPROVAL_REJECTED: [],
  FEE_RESERVED: ['ORDER_SUBMITTED'],
  ORDER_SUBMITTED: ['ORDER_CONFIRMED', 'ORDER_FAILED'],
  ORDER_CONFIRMED: ['FEE_SETTLED'],
  ORDER_FAILED: ['FEE_REFUNDED'],
  FEE_SETTLED: ['FEE_LEDGER_RECORDED'],
  FEE_REFUNDED: [],
  FEE_LEDGER_RECORDED: ['NOTIFICATION_SENT'],
  NOTIFICATION_SENT: ['POSITION_UPDATED'],
  POSITION_UPDATED: [],
};

/**
 * Start a new trade lifecycle.
 */
export function startLifecycle(params: {
  userId: string;
  agentId: string;
  brokerId: string;
  asset: string;
  side: 'buy' | 'sell';
  amountUsd: number;
  chain: string;
  strategyId: string;
}): LifecycleContext {
  const corrId = `trade_${randomUUID()}`;

  const ctx: LifecycleContext = {
    corrId,
    ...params,
    state: 'SIGNAL_GENERATED',
    stateHistory: [{
      state: 'SIGNAL_GENERATED',
      timestamp: new Date().toISOString(),
    }],
    startedAt: new Date().toISOString(),
  };

  audit({
    actor: params.agentId,
    actorTier: 'user',
    action: 'trade-lifecycle-started',
    resource: corrId,
    details: { asset: params.asset, side: params.side, amountUsd: params.amountUsd },
    success: true,
    corr_id: corrId,
  });

  return ctx;
}

/**
 * Transition to the next state in the lifecycle.
 * Validates the transition is legal.
 */
export function transitionState(
  ctx: LifecycleContext,
  newState: TradeLifecycleState,
  details?: string,
): LifecycleContext {
  const validNext = VALID_TRANSITIONS[ctx.state];

  if (!validNext.includes(newState)) {
    throw new Error(
      `Invalid state transition: ${ctx.state} → ${newState} (valid: ${validNext.join(', ')})`,
    );
  }

  ctx.state = newState;
  ctx.stateHistory.push({
    state: newState,
    timestamp: new Date().toISOString(),
    details,
  });

  // Check for terminal states
  const terminalStates: TradeLifecycleState[] = [
    'RISK_REJECTED', 'COMPLIANCE_REJECTED', 'APPROVAL_REJECTED',
    'FEE_REFUNDED', 'POSITION_UPDATED',
  ];
  if (terminalStates.includes(newState)) {
    ctx.completedAt = new Date().toISOString();
  }

  log.debug({
    corrId: ctx.corrId,
    from: ctx.stateHistory[ctx.stateHistory.length - 2]?.state,
    to: newState,
  }, 'Trade lifecycle state transition');

  return ctx;
}

/**
 * Get recoverable states (for crash recovery).
 */
export function getRecoverableStates(): TradeLifecycleState[] {
  return ['FEE_RESERVED', 'ORDER_SUBMITTED'];
}

/**
 * Check if a state is terminal.
 */
export function isTerminalState(state: TradeLifecycleState): boolean {
  return VALID_TRANSITIONS[state].length === 0;
}
