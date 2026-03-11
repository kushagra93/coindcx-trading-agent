import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import type { TradeIntent, TradeResult, Quote, QuoteParams, Chain } from '../core/types.js';
import { EVM_CHAIN_IDS } from '../core/types.js';
import type { OrderExecutor } from './types.js';
import type { EncryptedKey } from '../wallet/types.js';
import { getWallet } from '../wallet/evm-wallet.js';

const log = createChildLogger('0x-executor');

const ZEROX_API = 'https://api.0x.org';

interface ZeroXQuoteResponse {
  buyAmount: string;
  sellAmount: string;
  estimatedPriceImpact: string;
  transaction: {
    to: string;
    data: string;
    value: string;
    gas: string;
    gasPrice: string;
  };
}

function getChainId(chain: Chain): number {
  return EVM_CHAIN_IDS[chain] ?? config.evm.defaultChainId;
}

function getChainName(chain: Chain): string {
  const names: Record<string, string> = {
    ethereum: 'ethereum',
    polygon: 'polygon',
    base: 'base',
    arbitrum: 'arbitrum',
  };
  return names[chain] ?? 'polygon';
}

export class ZeroXExecutor implements OrderExecutor {
  readonly venue = '0x';

  async getQuote(params: QuoteParams): Promise<Quote> {
    const chainName = getChainName(params.chain);
    const url = `${ZEROX_API}/swap/permit2/quote?sellToken=${params.inputToken}&buyToken=${params.outputToken}&sellAmount=${params.amountIn}&chainId=${getChainId(params.chain)}`;

    const res = await fetch(url, {
      headers: {
        '0x-api-key': config.dex.zeroXApiKey,
        '0x-chain-id': getChainId(params.chain).toString(),
      },
    });

    if (!res.ok) {
      throw new Error(`0x quote failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as ZeroXQuoteResponse;

    return {
      venue: '0x',
      inputToken: params.inputToken,
      outputToken: params.outputToken,
      amountIn: data.sellAmount,
      amountOut: data.buyAmount,
      priceImpactBps: Math.round(parseFloat(data.estimatedPriceImpact || '0') * 100),
      route: data.transaction,
      expiresAt: new Date(Date.now() + 30_000),
    };
  }

  async execute(intent: TradeIntent, encryptedKey?: EncryptedKey): Promise<TradeResult> {
    if (config.dryRun) {
      log.info({ intentId: intent.id }, 'DRY_RUN: Would execute 0x swap');
      return { success: true, txHash: 'dry-run-0x-' + Date.now(), amountOut: '0' };
    }

    if (!encryptedKey) {
      return { success: false, error: 'No encrypted key provided for signing' };
    }

    try {
      const chainId = getChainId(intent.chain);
      const wallet = await getWallet(encryptedKey, chainId);

      // Get swap quote with transaction data
      const quote = await this.getQuote({
        chain: intent.chain,
        inputToken: intent.inputToken,
        outputToken: intent.outputToken,
        amountIn: intent.amountIn,
        slippageBps: intent.maxSlippageBps,
      });

      const txData = quote.route as ZeroXQuoteResponse['transaction'];

      const tx = await wallet.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: BigInt(txData.value),
        gasLimit: BigInt(txData.gas),
      });

      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) {
        throw new Error('Transaction reverted');
      }

      log.info({ txHash: receipt.hash, intentId: intent.id }, '0x swap confirmed');

      return {
        success: true,
        txHash: receipt.hash,
        amountOut: quote.amountOut,
        gasUsed: receipt.gasUsed.toString(),
        priceImpactBps: quote.priceImpactBps,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error({ error, intentId: intent.id }, '0x swap failed');
      return { success: false, error };
    }
  }
}
