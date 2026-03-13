import { ethers } from 'ethers';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import type { TradeIntent, TradeResult, Quote, QuoteParams, Chain } from '../core/types.js';
import { getEvmChainId } from '../core/chain-registry.js';
import type { OrderExecutor } from './types.js';
import type { EncryptedKey } from '../wallet/types.js';
import { getWallet } from '../wallet/evm-wallet.js';

const log = createChildLogger('1inch-executor');

const ONEINCH_API = 'https://api.1inch.dev';

interface OneInchQuoteResponse {
  dstAmount: string;
  protocols: unknown[];
  gas: number;
}

interface OneInchSwapResponse {
  dstAmount: string;
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: number;
  };
}

function getChainId(chain: Chain): number {
  return getEvmChainId(chain);
}

export class OneInchExecutor implements OrderExecutor {
  readonly venue = '1inch';

  private async apiFetch<T>(path: string, chainId: number): Promise<T> {
    const url = `${ONEINCH_API}/swap/v6.0/${chainId}${path}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${config.dex.oneInchApiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`1inch API error ${res.status}: ${await res.text()}`);
    }

    return res.json() as Promise<T>;
  }

  async getQuote(params: QuoteParams): Promise<Quote> {
    const chainId = getChainId(params.chain);
    const data = await this.apiFetch<OneInchQuoteResponse>(
      `/quote?src=${params.inputToken}&dst=${params.outputToken}&amount=${params.amountIn}`,
      chainId
    );

    return {
      venue: '1inch',
      inputToken: params.inputToken,
      outputToken: params.outputToken,
      amountIn: params.amountIn,
      amountOut: data.dstAmount,
      priceImpactBps: 0, // 1inch doesn't return price impact directly
      route: data.protocols,
      expiresAt: new Date(Date.now() + 30_000),
    };
  }

  async execute(intent: TradeIntent, encryptedKey?: EncryptedKey): Promise<TradeResult> {
    if (config.dryRun) {
      log.info({ intentId: intent.id }, 'DRY_RUN: Would execute 1inch swap');
      return { success: true, txHash: 'dry-run-1inch-' + Date.now(), amountOut: '0' };
    }

    if (!encryptedKey) {
      return { success: false, error: 'No encrypted key provided for signing' };
    }

    try {
      const chainId = getChainId(intent.chain);
      const wallet = await getWallet(encryptedKey, chainId);

      // Get swap transaction data
      const slippage = intent.maxSlippageBps / 100; // convert bps to percentage
      const data = await this.apiFetch<OneInchSwapResponse>(
        `/swap?src=${intent.inputToken}&dst=${intent.outputToken}&amount=${intent.amountIn}&from=${wallet.address}&slippage=${slippage}`,
        chainId
      );

      // Send transaction
      const tx = await wallet.sendTransaction({
        to: data.tx.to,
        data: data.tx.data,
        value: BigInt(data.tx.value),
        gasLimit: BigInt(data.tx.gas),
      });

      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) {
        throw new Error('Transaction reverted');
      }

      log.info({ txHash: receipt.hash, intentId: intent.id }, '1inch swap confirmed');

      return {
        success: true,
        txHash: receipt.hash,
        amountOut: data.dstAmount,
        gasUsed: receipt.gasUsed.toString(),
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error({ error, intentId: intent.id }, '1inch swap failed');
      return { success: false, error };
    }
  }
}
