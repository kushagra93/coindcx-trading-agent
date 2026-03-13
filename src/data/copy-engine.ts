import { createChildLogger } from '../core/logger.js';
import { loadConfig } from '../core/config.js';
import { addWallet, removeWallet, onSwapDetected, type SwapEvent } from './wallet-monitor.js';
import { addTokenMint, resolveTokenMint } from './jupiter-swap.js';

const log = createChildLogger('copy-engine');

const SOL_MINTS = new Set([
  'So11111111111111111111111111111111111111112',
  '11111111111111111111111111111111',
]);

const STABLECOIN_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

export type BuyMode = 'max_buy' | 'fixed_buy' | 'fixed_ratio';
export type SellMethod = 'mirror_sell' | 'manual';

export interface CopyTradeConfig {
  walletAddress: string;
  walletName: string;
  buyMode: BuyMode;
  buyAmount: number; // USD for fixed_buy/max_buy, ratio (0-1) for fixed_ratio
  sellMethod: SellMethod;
  enabled: boolean;
  createdAt: number;
  totalCopied: number;
  totalPnl: number;
}

export interface CopyTradeActivity {
  id: string;
  targetWallet: string;
  tokenAddress: string;
  tokenSymbol: string;
  side: 'buy' | 'sell';
  targetAmountSol: number;
  copyAmountUsd: number;
  timestamp: number;
  signature: string;
  status: 'executed' | 'simulated' | 'skipped';
  skipReason?: string;
  txHash?: string;
  txUrl?: string;
}

// In-memory stores (production: PostgreSQL)
const configs = new Map<string, CopyTradeConfig>();
const activities: CopyTradeActivity[] = [];
let engineInitialized = false;

export function initCopyEngine() {
  if (engineInitialized) return;
  engineInitialized = true;

  onSwapDetected((event: SwapEvent) => {
    handleSwapEvent(event).catch(err =>
      log.error({ err }, 'Unhandled error in copy trade handler'),
    );
  });

  log.info('Copy trade engine initialized');
}

async function handleSwapEvent(event: SwapEvent) {
  const config = configs.get(event.walletAddress);
  if (!config || !config.enabled) return;

  let copyAmountUsd = 0;
  let skipReason: string | undefined;

  switch (config.buyMode) {
    case 'fixed_buy':
      copyAmountUsd = config.buyAmount;
      break;
    case 'max_buy':
      copyAmountUsd = Math.min(config.buyAmount, event.amountUsd);
      break;
    case 'fixed_ratio':
      copyAmountUsd = event.amountUsd * config.buyAmount;
      break;
  }

  if (event.side === 'sell') {
    if (config.sellMethod === 'manual') {
      skipReason = 'Sell method set to manual';
      copyAmountUsd = 0;
    } else {
      copyAmountUsd = event.amountUsd * 0.5;
    }
  }

  if (copyAmountUsd > 0 && copyAmountUsd < 0.1) {
    skipReason = 'Amount below minimum ($0.10)';
    copyAmountUsd = 0;
  }

  if (copyAmountUsd > 500) {
    copyAmountUsd = 500;
  }

  const activity: CopyTradeActivity = {
    id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    targetWallet: event.walletAddress,
    tokenAddress: event.tokenAddress,
    tokenSymbol: event.tokenSymbol,
    side: event.side,
    targetAmountSol: event.amountSol,
    copyAmountUsd,
    timestamp: Date.now(),
    signature: event.signature,
    status: skipReason ? 'skipped' : 'simulated',
    skipReason,
  };

  activities.unshift(activity);
  if (activities.length > 200) activities.length = 200;

  if (skipReason) {
    log.info({ wallet: event.walletAddress.slice(0, 6), token: event.tokenSymbol, reason: skipReason }, 'Copy trade skipped');
    return;
  }

  if (SOL_MINTS.has(event.tokenAddress)) {
    activity.status = 'skipped';
    activity.skipReason = 'Native SOL swap (circular)';
    log.info({ wallet: event.walletAddress.slice(0, 6) }, 'Skipped SOL wrap/unwrap');
    return;
  }

  if (STABLECOIN_MINTS.has(event.tokenAddress)) {
    activity.status = 'skipped';
    activity.skipReason = 'Stablecoin movement (not a trade)';
    log.info({ wallet: event.walletAddress.slice(0, 6), token: event.tokenSymbol }, 'Skipped stablecoin swap');
    return;
  }

  // Pre-register the token mint so Jupiter can resolve it
  if (event.tokenAddress && !resolveTokenMint(event.tokenSymbol)) {
    addTokenMint(event.tokenSymbol, event.tokenAddress);
    log.info({ symbol: event.tokenSymbol, mint: event.tokenAddress }, 'Pre-registered token mint for copy trade');
  }

  const appConfig = loadConfig();
  if (!appConfig.dryRun) {
    try {
      const port = process.env.PORT ?? 3000;
      const res = await fetch(`http://localhost:${port}/api/v1/trade/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: event.tokenSymbol,
          side: event.side,
          amountUsd: copyAmountUsd,
          slippagePct: 2,
        }),
      });
      const body = await res.json() as Record<string, any>;
      if (res.ok && body.trade) {
        activity.status = 'executed';
        activity.txHash = body.trade?.txHash ?? undefined;
        activity.txUrl = body.txUrl ?? undefined;
        log.info({ wallet: event.walletAddress.slice(0, 6), token: event.tokenSymbol, side: event.side, usd: copyAmountUsd, txUrl: activity.txUrl }, 'Copy trade executed on-chain');
      } else {
        activity.skipReason = body.error ?? 'Trade API returned error';
        log.warn({ wallet: event.walletAddress.slice(0, 6), token: event.tokenSymbol, error: body.error }, 'Copy trade execution failed, recorded as simulated');
      }
    } catch (err) {
      activity.skipReason = `Execution error: ${(err as Error).message}`;
      log.error({ err, wallet: event.walletAddress.slice(0, 6), token: event.tokenSymbol }, 'Copy trade execution threw, recorded as simulated');
    }
  } else {
    log.info({ wallet: event.walletAddress.slice(0, 6), token: event.tokenSymbol, side: event.side, usd: copyAmountUsd }, 'Copy trade simulated (dry-run)');
  }

  config.totalCopied += copyAmountUsd;
}

// --- Public API ---

export function startCopyTrading(config: CopyTradeConfig): CopyTradeConfig {
  initCopyEngine();
  configs.set(config.walletAddress, config);
  addWallet(config.walletAddress);
  log.info({ wallet: config.walletAddress.slice(0, 6), buyMode: config.buyMode, amount: config.buyAmount }, 'Copy trading started');
  return config;
}

export function stopCopyTrading(walletAddress: string): boolean {
  const config = configs.get(walletAddress);
  if (!config) return false;
  configs.delete(walletAddress);
  removeWallet(walletAddress);
  log.info({ wallet: walletAddress.slice(0, 6) }, 'Copy trading stopped');
  return true;
}

export function pauseCopyTrading(walletAddress: string): boolean {
  const config = configs.get(walletAddress);
  if (!config) return false;
  config.enabled = false;
  log.info({ wallet: walletAddress.slice(0, 6) }, 'Copy trading paused');
  return true;
}

export function resumeCopyTrading(walletAddress: string): boolean {
  const config = configs.get(walletAddress);
  if (!config) return false;
  config.enabled = true;
  log.info({ wallet: walletAddress.slice(0, 6) }, 'Copy trading resumed');
  return true;
}

export function getCopyConfigs(): CopyTradeConfig[] {
  return Array.from(configs.values());
}

export function getCopyConfig(walletAddress: string): CopyTradeConfig | undefined {
  return configs.get(walletAddress);
}

export function getRecentActivity(limit = 20, walletFilter?: string): CopyTradeActivity[] {
  let result = activities;
  if (walletFilter) {
    result = result.filter(a => a.targetWallet === walletFilter);
  }
  return result.slice(0, limit);
}
