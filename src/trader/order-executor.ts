import { createChildLogger } from '../core/logger.js';
import type { TradeIntent, TradeResult, Quote, QuoteParams, TradeVenue, Chain } from '../core/types.js';
import { getChainFamily } from '../core/types.js';
import { CHAIN_REGISTRY } from '../core/chain-registry.js';
import type { OrderExecutor } from './types.js';
import type { EncryptedKey } from '../wallet/types.js';
import { JupiterExecutor } from './jupiter-executor.js';
import { OneInchExecutor } from './oneinch-executor.js';
import { ZeroXExecutor } from './zerox-executor.js';
import { HyperliquidExecutor } from './hyperliquid-executor.js';

const log = createChildLogger('order-executor');

// Executor registry
const executors: Record<TradeVenue, OrderExecutor> = {
  jupiter: new JupiterExecutor(),
  '1inch': new OneInchExecutor(),
  '0x': new ZeroXExecutor(),
  hyperliquid: new HyperliquidExecutor(),
};

/**
 * Get the appropriate executor for a trade venue.
 */
export function getExecutor(venue: TradeVenue): OrderExecutor {
  const executor = executors[venue];
  if (!executor) {
    throw new Error(`Unknown trade venue: ${venue}`);
  }
  return executor;
}

/**
 * Get the default venue for a chain (from chain registry).
 */
export function getDefaultVenue(chain: Chain): TradeVenue {
  const cfg = CHAIN_REGISTRY[chain];
  if (cfg) return cfg.defaultDexVenue;
  // Fallback for unknown chains
  const family = getChainFamily(chain);
  switch (family) {
    case 'solana': return 'jupiter';
    case 'evm': return '1inch';
    case 'hyperliquid': return 'hyperliquid';
    default: return '1inch';
  }
}

/**
 * Get a quote from the best available venue (uses chain registry for venue selection).
 */
export async function getBestQuote(params: QuoteParams): Promise<Quote> {
  const cfg = CHAIN_REGISTRY[params.chain];
  const primary = cfg?.defaultDexVenue ?? getDefaultVenue(params.chain);
  const fallback = cfg?.fallbackDexVenue;

  const primaryExecutor = executors[primary];
  if (!primaryExecutor) {
    throw new Error(`No executor for venue: ${primary}`);
  }

  // If no fallback, use primary directly
  if (!fallback) {
    return primaryExecutor.getQuote(params);
  }

  // Try primary, fall back to secondary
  try {
    return await primaryExecutor.getQuote(params);
  } catch (err) {
    log.warn({ err, primary, fallback, chain: params.chain }, `${primary} quote failed, trying ${fallback}`);
    return executors[fallback].getQuote(params);
  }
}

/**
 * Execute a trade intent through the appropriate venue.
 */
export async function executeTrade(
  intent: TradeIntent,
  encryptedKey: EncryptedKey
): Promise<TradeResult> {
  const executor = getExecutor(intent.venue);

  log.info({
    intentId: intent.id,
    venue: intent.venue,
    chain: intent.chain,
    side: intent.side,
    inputToken: intent.inputToken,
    outputToken: intent.outputToken,
    amountIn: intent.amountIn,
  }, 'Executing trade');

  // Cast to access encryptedKey param (each executor accepts it)
  const result = await (executor as any).execute(intent, encryptedKey);

  if (result.success) {
    log.info({ intentId: intent.id, txHash: result.txHash }, 'Trade executed successfully');
  } else {
    log.error({ intentId: intent.id, error: result.error }, 'Trade execution failed');
  }

  return result;
}
