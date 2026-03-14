import type { Chain } from '../core/types.js';

export interface EncryptedKey {
  userId: string;
  chain: Chain;
  encryptedData: Buffer;
  kmsKeyId: string;
  createdAt: Date;
}

export interface WalletInfo {
  address: string;
  chain: Chain;
  balance?: string;
}

export interface TransferParams {
  chain: Chain;
  to: string;
  token: string;
  amount: string;
}

export interface TransferResult {
  success: boolean;
  txHash?: string;
  error?: string;
}
