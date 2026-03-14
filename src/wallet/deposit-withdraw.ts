import { createChildLogger } from '../core/logger.js';
import type { Chain } from '../core/types.js';
import { getChainFamily } from '../core/types.js';
import { transferSolana } from './solana-wallet.js';
import { transferEvm } from './evm-wallet.js';
import type { EncryptedKey, TransferResult } from './types.js';

const log = createChildLogger('deposit-withdraw');

export interface WithdrawParams {
  userId: string;
  chain: Chain;
  token: string;
  amount: string;
  toAddress: string;
}

/**
 * Get the deposit address for a user on a specific chain.
 * The deposit address is the agent's wallet address for that user.
 */
export function getDepositAddress(walletAddresses: Record<Chain, string>, chain: Chain): string {
  const address = walletAddresses[chain];
  if (!address) {
    throw new Error(`No wallet address found for chain: ${chain}`);
  }
  return address;
}

/**
 * Withdraw funds from the agent wallet back to the user's host app wallet.
 * Only transfers to verified addresses (the user's CoinDCX wallet or equivalent).
 */
export async function withdraw(
  encryptedKey: EncryptedKey,
  params: WithdrawParams
): Promise<TransferResult> {
  log.info({
    userId: params.userId,
    chain: params.chain,
    token: params.token,
    amount: params.amount,
    to: params.toAddress,
  }, 'Processing withdrawal');

  const family = getChainFamily(params.chain);

  if (family === 'solana') {
    return transferSolana(encryptedKey, {
      chain: params.chain,
      to: params.toAddress,
      token: params.token,
      amount: params.amount,
    });
  }

  if (family === 'evm' || family === 'hyperliquid') {
    return transferEvm(encryptedKey, {
      chain: params.chain,
      to: params.toAddress,
      token: params.token,
      amount: params.amount,
    });
  }

  return { success: false, error: `Unsupported chain family: ${family}` };
}
