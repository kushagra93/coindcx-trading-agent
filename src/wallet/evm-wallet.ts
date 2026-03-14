import { ethers } from 'ethers';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import { generateEncryptedKey, decryptKey } from './key-manager.js';
import type { Chain } from '../core/types.js';
import type { EncryptedKey, WalletInfo, TransferParams, TransferResult } from './types.js';
import { CHAIN_REGISTRY, CHAIN_ID_TO_NAME, getChainRpcUrl, isNativeToken } from '../core/chain-registry.js';

const log = createChildLogger('evm-wallet');

const providers = new Map<number, ethers.JsonRpcProvider>();

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

export function getProvider(chainId?: number): ethers.JsonRpcProvider {
  const id = chainId ?? config.evm.defaultChainId;
  let provider = providers.get(id);
  if (!provider) {
    // Resolve per-chain RPC URL from registry + env overrides
    const chainName = CHAIN_ID_TO_NAME[id];
    const rpcUrl = chainName
      ? getChainRpcUrl(chainName)
      : (config.evm.rpcUrl || 'https://eth.llamarpc.com');
    provider = new ethers.JsonRpcProvider(rpcUrl);
    providers.set(id, provider);
  }
  return provider;
}

/**
 * Generate a new EVM wallet for a user.
 */
export async function createEvmWallet(userId: string, chain: Chain): Promise<{ encryptedKey: EncryptedKey; address: string }> {
  const wallet = ethers.Wallet.createRandom();
  const address = wallet.address;

  log.info({ userId, address, chain }, 'Created new EVM wallet');

  const privateKeyBytes = ethers.getBytes(wallet.privateKey);
  const encryptedKey = await generateEncryptedKey(userId, chain, privateKeyBytes);

  return { encryptedKey, address };
}

/**
 * Restore an ethers Wallet from an encrypted key.
 */
export async function getWallet(encryptedKey: EncryptedKey, chainId?: number): Promise<ethers.Wallet> {
  const privateKeyBytes = await decryptKey(encryptedKey);
  const privateKey = ethers.hexlify(privateKeyBytes);
  const provider = getProvider(chainId);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Get wallet info (address + native balance).
 */
export async function getWalletInfo(encryptedKey: EncryptedKey): Promise<WalletInfo> {
  const wallet = await getWallet(encryptedKey);
  const balance = await wallet.provider!.getBalance(wallet.address);

  return {
    address: wallet.address,
    chain: encryptedKey.chain,
    balance: ethers.formatEther(balance),
  };
}

/**
 * Get ERC20 token balance.
 */
export async function getTokenBalance(
  walletAddress: string,
  tokenAddress: string,
  chainId?: number
): Promise<string> {
  const provider = getProvider(chainId);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  try {
    const [balance, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.decimals(),
    ]);
    return ethers.formatUnits(balance, decimals);
  } catch {
    return '0';
  }
}

/**
 * Transfer native token or ERC20 from agent wallet.
 */
export async function transferEvm(
  encryptedKey: EncryptedKey,
  params: TransferParams
): Promise<TransferResult> {
  const wallet = await getWallet(encryptedKey);

  try {
    const isNative = isNativeToken(params.chain, params.token);

    if (isNative) {
      const value = ethers.parseEther(params.amount);

      if (config.dryRun) {
        log.info({ to: params.to, amount: params.amount }, 'DRY_RUN: Would send native EVM transfer');
        return { success: true, txHash: 'dry-run-' + Date.now() };
      }

      const tx = await wallet.sendTransaction({ to: params.to, value });
      const receipt = await tx.wait();

      log.info({ txHash: receipt!.hash, to: params.to, amount: params.amount }, 'EVM native transfer confirmed');
      return { success: true, txHash: receipt!.hash };
    } else {
      // ERC20 transfer
      const contract = new ethers.Contract(params.token, ERC20_ABI, wallet);
      const decimals = await contract.decimals();
      const amount = ethers.parseUnits(params.amount, decimals);

      if (config.dryRun) {
        log.info({ to: params.to, amount: params.amount, token: params.token }, 'DRY_RUN: Would send ERC20 transfer');
        return { success: true, txHash: 'dry-run-' + Date.now() };
      }

      const tx = await contract.transfer(params.to, amount);
      const receipt = await tx.wait();

      log.info({ txHash: receipt!.hash, to: params.to, amount: params.amount }, 'ERC20 transfer confirmed');
      return { success: true, txHash: receipt!.hash };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ error, to: params.to }, 'EVM transfer failed');
    return { success: false, error };
  }
}
