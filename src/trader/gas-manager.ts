import { ethers } from 'ethers';
import { createChildLogger } from '../core/logger.js';
import { getProvider } from '../wallet/evm-wallet.js';
import type { Chain } from '../core/types.js';
import type { GasBudget } from './types.js';
import { CHAIN_REGISTRY } from '../core/chain-registry.js';

const log = createChildLogger('gas-manager');

/**
 * Check if current gas price is within budget for a chain.
 */
export async function isGasWithinBudget(chain: Chain, chainId?: number): Promise<{
  withinBudget: boolean;
  currentGasPrice: bigint;
  maxGasPrice: bigint;
}> {
  const budget = getGasBudget(chain);
  const provider = getProvider(chainId);

  const feeData = await provider.getFeeData();
  const currentGasPrice = feeData.gasPrice ?? 0n;

  const withinBudget = currentGasPrice <= budget.maxGasPrice;

  if (!withinBudget) {
    log.warn({
      chain,
      currentGwei: ethers.formatUnits(currentGasPrice, 'gwei'),
      maxGwei: ethers.formatUnits(budget.maxGasPrice, 'gwei'),
    }, 'Gas price exceeds budget');
  }

  return { withinBudget, currentGasPrice, maxGasPrice: budget.maxGasPrice };
}

/**
 * Estimate gas cost in USD for a transaction.
 */
export async function estimateGasCostUsd(
  chain: Chain,
  gasUnits: bigint,
  nativeTokenPriceUsd: number,
  chainId?: number
): Promise<number> {
  const provider = getProvider(chainId);
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ?? 0n;

  const gasCostWei = gasPrice * gasUnits;
  const gasCostEth = parseFloat(ethers.formatEther(gasCostWei));
  const gasCostUsd = gasCostEth * nativeTokenPriceUsd;

  return gasCostUsd;
}

/**
 * Get gas budget for a chain.
 */
export function getGasBudget(chain: Chain): GasBudget {
  const cfg = CHAIN_REGISTRY[chain];
  if (cfg) {
    return {
      maxGasPrice: cfg.gasConfig.maxGasPrice,
      maxGasUnits: cfg.gasConfig.maxGasUnits,
      maxGasCostUsd: cfg.gasConfig.maxGasCostUsd,
    };
  }
  // Fallback: conservative L2 defaults
  return {
    maxGasPrice: ethers.parseUnits('50', 'gwei'),
    maxGasUnits: 500_000n,
    maxGasCostUsd: 5,
  };
}

/**
 * Check if a trade should be skipped due to gas costs exceeding the trade value.
 */
export function shouldSkipDueToGas(gasCostUsd: number, tradeValueUsd: number, maxGasRatio: number = 0.05): boolean {
  // Skip if gas would cost more than 5% of trade value
  const skip = gasCostUsd > tradeValueUsd * maxGasRatio;
  if (skip) {
    log.warn({
      gasCostUsd: gasCostUsd.toFixed(2),
      tradeValueUsd: tradeValueUsd.toFixed(2),
      ratio: (gasCostUsd / tradeValueUsd * 100).toFixed(1) + '%',
    }, 'Skipping trade: gas cost too high relative to trade value');
  }
  return skip;
}
