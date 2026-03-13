import { createChildLogger } from '../core/logger.js';
import { addWallet, removeWallet, onSwapDetected, type SwapEvent } from './wallet-monitor.js';

const log = createChildLogger('copy-engine');

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
  status: 'simulated' | 'skipped';
  skipReason?: string;
}

// In-memory stores (production: PostgreSQL)
const configs = new Map<string, CopyTradeConfig>();
const activities: CopyTradeActivity[] = [];
let engineInitialized = false;

export function initCopyEngine() {
  if (engineInitialized) return;
  engineInitialized = true;

  onSwapDetected((event: SwapEvent) => {
    handleSwapEvent(event);
  });

  log.info('Copy trade engine initialized');
}

function handleSwapEvent(event: SwapEvent) {
  const config = configs.get(event.walletAddress);
  if (!config || !config.enabled) return;

  // Determine copy amount
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

  // Sell handling
  if (event.side === 'sell') {
    if (config.sellMethod === 'manual') {
      skipReason = 'Sell method set to manual';
      copyAmountUsd = 0;
    } else {
      copyAmountUsd = event.amountUsd * 0.5; // Mirror at 50% for safety
    }
  }

  // Min trade filter
  if (copyAmountUsd > 0 && copyAmountUsd < 1) {
    skipReason = 'Amount below minimum ($1)';
    copyAmountUsd = 0;
  }

  // Max single trade cap for hackathon safety
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

  if (!skipReason) {
    config.totalCopied += copyAmountUsd;
    log.info({ wallet: event.walletAddress.slice(0, 6), token: event.tokenSymbol, side: event.side, usd: copyAmountUsd }, 'Copy trade simulated');
  } else {
    log.info({ wallet: event.walletAddress.slice(0, 6), token: event.tokenSymbol, reason: skipReason }, 'Copy trade skipped');
  }
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
