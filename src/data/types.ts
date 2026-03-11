import type { Chain, PriceUpdate, WalletActivity } from '../core/types.js';

export interface DataSource {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface PriceSubscription {
  token: string;
  chain: Chain;
  callback: (update: PriceUpdate) => void;
}

export interface WalletSubscription {
  walletAddress: string;
  chain: Chain;
  callback: (activity: WalletActivity) => void;
}
