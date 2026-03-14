import { config } from '../core/config.js';
import { createChildLogger } from '../core/logger.js';
import type { TradeIntent, TradeResult, Quote, QuoteParams } from '../core/types.js';
import type { OrderExecutor } from './types.js';
import type { EncryptedKey } from '../wallet/types.js';
import { decryptKey } from '../wallet/key-manager.js';
import { recordBuilderFee } from './fee-manager.js';

const log = createChildLogger('hyperliquid-executor');

// Hyperliquid API endpoints
const HL_INFO_API = 'https://api.hyperliquid.xyz/info';
const HL_EXCHANGE_API = 'https://api.hyperliquid.xyz/exchange';
const HL_TESTNET_INFO_API = 'https://api.hyperliquid-testnet.xyz/info';
const HL_TESTNET_EXCHANGE_API = 'https://api.hyperliquid-testnet.xyz/exchange';

function getInfoUrl(): string {
  return config.hyperliquid.mainnet ? HL_INFO_API : HL_TESTNET_INFO_API;
}

function getExchangeUrl(): string {
  return config.hyperliquid.mainnet ? HL_EXCHANGE_API : HL_TESTNET_EXCHANGE_API;
}

interface HLMeta {
  universe: Array<{
    name: string;
    szDecimals: number;
    maxLeverage: number;
  }>;
}

interface HLOrderResult {
  status: string;
  response: {
    type: string;
    data?: {
      statuses: Array<{
        resting?: { oid: number };
        filled?: { totalSz: string; avgPx: string; oid: number };
        error?: string;
      }>;
    };
  };
}

export class HyperliquidExecutor implements OrderExecutor {
  readonly venue = 'hyperliquid';

  private async infoFetch<T>(body: unknown): Promise<T> {
    const res = await fetch(getInfoUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Hyperliquid info API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  async getQuote(params: QuoteParams): Promise<Quote> {
    // Get mid price from Hyperliquid
    const meta = await this.infoFetch<HLMeta>({ type: 'meta' });
    const asset = meta.universe.find(u => u.name === params.outputToken);

    if (!asset) {
      throw new Error(`Asset ${params.outputToken} not found on Hyperliquid`);
    }

    // Get current price
    const allMids = await this.infoFetch<Record<string, string>>({ type: 'allMids' });
    const midPrice = allMids[params.outputToken];

    if (!midPrice) {
      throw new Error(`No mid price for ${params.outputToken}`);
    }

    const amountInFloat = parseFloat(params.amountIn);
    const price = parseFloat(midPrice);
    const amountOut = (amountInFloat / price).toFixed(asset.szDecimals);

    return {
      venue: 'hyperliquid',
      inputToken: params.inputToken,
      outputToken: params.outputToken,
      amountIn: params.amountIn,
      amountOut,
      priceImpactBps: 0,
      expiresAt: new Date(Date.now() + 10_000),
    };
  }

  async execute(intent: TradeIntent, encryptedKey?: EncryptedKey): Promise<TradeResult> {
    if (config.dryRun) {
      log.info({ intentId: intent.id, token: intent.outputToken }, 'DRY_RUN: Would execute Hyperliquid order');
      return { success: true, txHash: 'dry-run-hl-' + Date.now(), amountOut: '0' };
    }

    if (!encryptedKey) {
      return { success: false, error: 'No encrypted key provided for signing' };
    }

    try {
      // Dynamically import hyperliquid SDK for signing
      const { ethers } = await import('ethers');
      const privateKeyBytes = await decryptKey(encryptedKey);
      const privateKey = ethers.hexlify(privateKeyBytes);

      // Get asset info
      const meta = await this.infoFetch<HLMeta>({ type: 'meta' });
      const assetIndex = meta.universe.findIndex(u => u.name === intent.outputToken);
      if (assetIndex === -1) {
        throw new Error(`Asset ${intent.outputToken} not found on Hyperliquid`);
      }

      const asset = meta.universe[assetIndex];
      const isBuy = intent.side === 'buy';

      // Get current price for limit order
      const allMids = await this.infoFetch<Record<string, string>>({ type: 'allMids' });
      const midPrice = parseFloat(allMids[intent.outputToken] ?? '0');

      // Apply slippage
      const slippageMultiplier = isBuy
        ? 1 + intent.maxSlippageBps / 10000
        : 1 - intent.maxSlippageBps / 10000;
      const limitPrice = midPrice * slippageMultiplier;

      // Calculate size
      const amountIn = parseFloat(intent.amountIn);
      const size = isBuy ? amountIn / midPrice : amountIn;

      // Round to asset's size decimals
      const roundedSize = parseFloat(size.toFixed(asset.szDecimals));
      const roundedPrice = parseFloat(limitPrice.toFixed(6)); // 6 decimal places for price

      log.info({
        intentId: intent.id,
        asset: intent.outputToken,
        side: intent.side,
        size: roundedSize,
        price: roundedPrice,
      }, 'Placing Hyperliquid order');

      // Build order action with builders code for fee sharing
      // Hyperliquid builders program: attach builder address for referral rebates
      const builderCode = config.hyperliquid.builderCode;
      const builderFeeBps = config.hyperliquid.builderFeeBps;

      const orderAction = {
        type: 'order',
        orders: [{
          a: assetIndex,
          b: isBuy,
          p: roundedPrice.toString(),
          s: roundedSize.toString(),
          r: false, // reduce only
          t: { limit: { tif: 'Ioc' } }, // immediate or cancel for market-like behavior
        }],
        grouping: 'na',
        builder: builderCode
          ? { b: builderCode, f: builderFeeBps }
          : undefined,
      };

      log.info({
        intentId: intent.id,
        builder: builderCode,
        builderFeeBps,
      }, 'Attaching builders code to order');

      // Sign with EIP-712 (Hyperliquid uses EVM signing)
      const wallet = new ethers.Wallet(privateKey);
      const nonce = Date.now();

      // Phantom agent signing for Hyperliquid
      const connectionId = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint64'],
          [wallet.address, nonce]
        )
      );

      // The actual signing implementation would use Hyperliquid's specific EIP-712 domain
      // This is a simplified version — production should use the official SDK
      const signature = await wallet.signMessage(
        ethers.getBytes(ethers.keccak256(
          ethers.toUtf8Bytes(JSON.stringify(orderAction))
        ))
      );

      const res = await fetch(getExchangeUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: orderAction,
          nonce,
          signature,
          vaultAddress: null,
        }),
      });

      if (!res.ok) {
        throw new Error(`Hyperliquid exchange error: ${res.status} ${await res.text()}`);
      }

      const result = await res.json() as HLOrderResult;

      if (result.response?.data?.statuses?.[0]?.error) {
        throw new Error(result.response.data.statuses[0].error);
      }

      const filled = result.response?.data?.statuses?.[0]?.filled;
      if (filled) {
        log.info({
          intentId: intent.id,
          oid: filled.oid,
          avgPx: filled.avgPx,
          totalSz: filled.totalSz,
        }, 'Hyperliquid order filled');

        // Record builder fee for this trade
        const filledVolumeUsd = parseFloat(filled.totalSz) * parseFloat(filled.avgPx);
        if (builderCode) {
          await recordBuilderFee(intent.id, filledVolumeUsd, builderFeeBps, builderCode);
        }

        return {
          success: true,
          txHash: `hl-${filled.oid}`,
          amountOut: filled.totalSz,
        };
      }

      // Order might be resting (limit order not filled)
      const resting = result.response?.data?.statuses?.[0]?.resting;
      if (resting) {
        log.info({ intentId: intent.id, oid: resting.oid }, 'Hyperliquid order resting');
        return {
          success: true,
          txHash: `hl-${resting.oid}`,
          amountOut: '0', // Not filled yet
        };
      }

      return { success: false, error: 'Unknown order status' };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error({ error, intentId: intent.id }, 'Hyperliquid order failed');
      return { success: false, error };
    }
  }
}
