import type {
  KYCStatus,
  TradeLimits,
  TradeIntent,
  PolicyResult,
  SignedTransaction,
  TxResult,
  AuthResult,
} from '../core/types.js';

/**
 * Host App Adapter Interface
 *
 * All host-app-specific logic (compliance, relay, policy) lives behind this interface.
 * CoinDCX is the first implementation; any finance app implements the same interface.
 *
 * To integrate a new finance app:
 *   1. Implement this interface
 *   2. Register it in the adapter factory
 *   3. Set HOST_APP_ADAPTER env var to the adapter name
 */
export interface HostAppAdapter {
  readonly name: string;

  // Compliance
  verifyKYC(userId: string): Promise<KYCStatus>;
  getTradeLimit(userId: string): Promise<TradeLimits>;

  // Policy control
  isTokenAllowed(token: string, chain: string): Promise<boolean>;
  isAddressSanctioned(address: string): Promise<boolean>;
  validateTrade(trade: TradeIntent): Promise<PolicyResult>;

  // Relay (optional — direct chain submission if no relay)
  submitTransaction?(signedTx: SignedTransaction): Promise<TxResult>;

  // User identity
  authenticateUser(token: string): Promise<AuthResult>;
  getUserWalletAddress(userId: string): Promise<string>;
}
