import type { TradeIntent, TradeResult, Quote, QuoteParams } from '../core/types.js';

export interface OrderExecutor {
  readonly venue: string;
  execute(intent: TradeIntent): Promise<TradeResult>;
  getQuote(params: QuoteParams): Promise<Quote>;
}

export interface GasBudget {
  maxGasPrice: bigint;
  maxGasUnits: bigint;
  maxGasCostUsd: number;
}

export interface NonceInfo {
  chain: string;
  walletAddress: string;
  currentNonce: number;
  pendingNonce: number;
}
