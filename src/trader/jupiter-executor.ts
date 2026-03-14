import { Connection, VersionedTransaction } from '@solana/web3.js';
import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import type { TradeIntent, TradeResult, Quote, QuoteParams } from '../core/types.js';
import type { OrderExecutor } from './types.js';
import type { EncryptedKey } from '../wallet/types.js';
import { getKeypair } from '../wallet/solana-wallet.js';

const log = createChildLogger('jupiter-executor');

interface JupiterQuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: unknown[];
}

interface JupiterSwapResponse {
  swapTransaction: string;
}

export class JupiterExecutor implements OrderExecutor {
  readonly venue = 'jupiter';
  private connection: Connection;
  private apiUrl: string;

  constructor() {
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');
    this.apiUrl = config.dex.jupiterApiUrl;
  }

  async getQuote(params: QuoteParams): Promise<Quote> {
    const url = new URL(`${this.apiUrl}/quote`);
    url.searchParams.set('inputMint', params.inputToken);
    url.searchParams.set('outputMint', params.outputToken);
    url.searchParams.set('amount', params.amountIn);
    url.searchParams.set('slippageBps', params.slippageBps.toString());

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Jupiter quote failed: ${res.status} ${await res.text()}`);
    }

    const data = await res.json() as JupiterQuoteResponse;

    return {
      venue: 'jupiter',
      inputToken: data.inputMint,
      outputToken: data.outputMint,
      amountIn: data.inAmount,
      amountOut: data.outAmount,
      priceImpactBps: Math.round(parseFloat(data.priceImpactPct) * 100),
      route: data.routePlan,
      expiresAt: new Date(Date.now() + 30_000), // 30s quote validity
    };
  }

  async execute(intent: TradeIntent, encryptedKey?: EncryptedKey): Promise<TradeResult> {
    if (config.dryRun) {
      log.info({ intentId: intent.id, inputToken: intent.inputToken, outputToken: intent.outputToken }, 'DRY_RUN: Would execute Jupiter swap');
      return { success: true, txHash: 'dry-run-jup-' + Date.now(), amountOut: '0' };
    }

    if (!encryptedKey) {
      return { success: false, error: 'No encrypted key provided for signing' };
    }

    try {
      // Get quote
      const quote = await this.getQuote({
        chain: 'solana',
        inputToken: intent.inputToken,
        outputToken: intent.outputToken,
        amountIn: intent.amountIn,
        slippageBps: intent.maxSlippageBps,
      });

      // Get swap transaction
      const keypair = await getKeypair(encryptedKey);
      const swapRes = await fetch(`${this.apiUrl}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: { ...quote, route: quote.route },
          userPublicKey: keypair.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 'auto',
        }),
      });

      if (!swapRes.ok) {
        throw new Error(`Jupiter swap API failed: ${swapRes.status}`);
      }

      const swapData = await swapRes.json() as JupiterSwapResponse;

      // Deserialize and sign
      const txBuf = Buffer.from(swapData.swapTransaction, 'base64');
      const tx = VersionedTransaction.deserialize(txBuf);
      tx.sign([keypair]);

      // Send transaction
      const rawTx = tx.serialize();
      const txHash = await this.connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Confirm
      const confirmation = await this.connection.confirmTransaction(txHash, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      log.info({ txHash, intentId: intent.id }, 'Jupiter swap confirmed');

      return {
        success: true,
        txHash,
        amountOut: quote.amountOut,
        priceImpactBps: quote.priceImpactBps,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error({ error, intentId: intent.id }, 'Jupiter swap failed');
      return { success: false, error };
    }
  }
}
