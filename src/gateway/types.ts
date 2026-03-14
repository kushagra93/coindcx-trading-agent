/**
 * Gateway types — the isolation boundary between Platform and Agent Economy.
 * Only 2 touchpoints: Deposit Gateway (in) and Withdraw Gateway (out).
 */

import type { Chain } from '../core/types.js';

export type GatewayTransactionStatus =
  | 'pending'
  | 'validating'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected';

export interface GatewayTransaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  userId: string;
  chain: Chain;
  token: string;
  amount: string;
  amountUsd: number;
  fromAddress: string;
  toAddress: string;
  status: GatewayTransactionStatus;
  txHash?: string;
  dualSignature?: {
    userAgentSig: string;
    brokerSig: string;
  };
  error?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Deposit event from Platform → Agent Economy.
 * Follows the document's exact schema.
 */
export interface DepositEvent {
  event: 'user_deposit';
  user_id: string;
  amount: string;
  currency: string;
  tx_id: string;
  kyc_verified: boolean;
  region: string;
  timestamp: string;
}

/**
 * Withdrawal request from Agent Economy → Platform.
 */
export interface WithdrawalRequest {
  requestId: string;
  userId: string;
  amount: string;
  token: string;
  chain: Chain;
  toAddress: string;
  userAgentSignature: string;
}
