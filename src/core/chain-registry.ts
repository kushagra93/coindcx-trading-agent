/**
 * Centralized Chain Registry — single source of truth for all supported chains.
 *
 * Add a new chain by adding an entry to CHAIN_REGISTRY. Everything else
 * (types, executors, screeners, API validation) derives from this registry.
 */

import { ethers } from 'ethers';
import type { ChainFamily, TradeVenue } from './types.js';

// ─── Chain Config Interface ──────────────────────────────────────────

export interface GasBudgetConfig {
  maxGasPrice: bigint;
  maxGasUnits: bigint;
  maxGasCostUsd: number;
}

export interface ChainConfig {
  /** Internal chain identifier (e.g. 'monad', 'base') */
  id: string;
  /** Display name */
  name: string;
  /** Chain family — determines wallet and executor routing */
  family: ChainFamily;
  /** EVM numeric chain ID (undefined for non-EVM) */
  chainId?: number;
  /** Native gas token symbol */
  nativeToken: string;
  /** Public RPC endpoint (fallback if no env override) */
  defaultRpcUrl: string;
  /** Block explorer URL */
  blockExplorer?: string;
  /** DexScreener chain slug for API calls */
  dexScreenerId: string;
  /** GoPlus Security API chain ID (null = not supported) */
  goPlusChainId?: string;
  /** Primary DEX aggregator */
  defaultDexVenue: TradeVenue;
  /** Fallback DEX aggregator (tried if primary fails) */
  fallbackDexVenue?: TradeVenue;
  /** Default gas budget */
  gasConfig: GasBudgetConfig;
}

// ─── Registry ────────────────────────────────────────────────────────

const gwei = (n: string) => ethers.parseUnits(n, 'gwei');

export const CHAIN_REGISTRY: Record<string, ChainConfig> = {
  // ── Non-EVM ──
  solana: {
    id: 'solana',
    name: 'Solana',
    family: 'solana',
    nativeToken: 'SOL',
    defaultRpcUrl: 'https://api.mainnet-beta.solana.com',
    blockExplorer: 'https://solscan.io',
    dexScreenerId: 'solana',
    goPlusChainId: undefined,
    defaultDexVenue: 'jupiter',
    gasConfig: { maxGasPrice: 0n, maxGasUnits: 0n, maxGasCostUsd: 1 },
  },

  // ── EVM L1s ──
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    family: 'evm',
    chainId: 1,
    nativeToken: 'ETH',
    defaultRpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    dexScreenerId: 'ethereum',
    goPlusChainId: '1',
    defaultDexVenue: '1inch',
    fallbackDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('100'), maxGasUnits: 500_000n, maxGasCostUsd: 50 },
  },
  bnb: {
    id: 'bnb',
    name: 'BNB Smart Chain',
    family: 'evm',
    chainId: 56,
    nativeToken: 'BNB',
    defaultRpcUrl: 'https://bsc-dataseed1.binance.org',
    blockExplorer: 'https://bscscan.com',
    dexScreenerId: 'bsc',
    goPlusChainId: '56',
    defaultDexVenue: '1inch',
    fallbackDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('10'), maxGasUnits: 500_000n, maxGasCostUsd: 2 },
  },
  avalanche: {
    id: 'avalanche',
    name: 'Avalanche',
    family: 'evm',
    chainId: 43114,
    nativeToken: 'AVAX',
    defaultRpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorer: 'https://snowtrace.io',
    dexScreenerId: 'avalanche',
    goPlusChainId: '43114',
    defaultDexVenue: '1inch',
    fallbackDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('50'), maxGasUnits: 500_000n, maxGasCostUsd: 5 },
  },
  sonic: {
    id: 'sonic',
    name: 'Sonic',
    family: 'evm',
    chainId: 146,
    nativeToken: 'S',
    defaultRpcUrl: 'https://rpc.soniclabs.com',
    blockExplorer: 'https://sonicscan.org',
    dexScreenerId: 'sonic',
    goPlusChainId: '146',
    defaultDexVenue: '1inch',
    fallbackDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('500'), maxGasUnits: 500_000n, maxGasCostUsd: 2 },
  },
  berachain: {
    id: 'berachain',
    name: 'Berachain',
    family: 'evm',
    chainId: 80094,
    nativeToken: 'BERA',
    defaultRpcUrl: 'https://rpc.berachain.com',
    blockExplorer: 'https://berascan.com',
    dexScreenerId: 'berachain',
    goPlusChainId: '80094',
    defaultDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('50'), maxGasUnits: 500_000n, maxGasCostUsd: 5 },
  },
  monad: {
    id: 'monad',
    name: 'Monad',
    family: 'evm',
    chainId: 143,
    nativeToken: 'MON',
    defaultRpcUrl: 'https://rpc.monad.xyz',
    blockExplorer: 'https://explorer.monad.xyz',
    dexScreenerId: 'monad',
    goPlusChainId: '143',
    defaultDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('50'), maxGasUnits: 500_000n, maxGasCostUsd: 2 },
  },

  // ── EVM L2s ──
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    family: 'evm',
    chainId: 137,
    nativeToken: 'MATIC',
    defaultRpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    dexScreenerId: 'polygon',
    goPlusChainId: '137',
    defaultDexVenue: '1inch',
    fallbackDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('500'), maxGasUnits: 500_000n, maxGasCostUsd: 5 },
  },
  base: {
    id: 'base',
    name: 'Base',
    family: 'evm',
    chainId: 8453,
    nativeToken: 'ETH',
    defaultRpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    dexScreenerId: 'base',
    goPlusChainId: '8453',
    defaultDexVenue: '1inch',
    fallbackDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('10'), maxGasUnits: 500_000n, maxGasCostUsd: 5 },
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    family: 'evm',
    chainId: 42161,
    nativeToken: 'ETH',
    defaultRpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    dexScreenerId: 'arbitrum',
    goPlusChainId: '42161',
    defaultDexVenue: '1inch',
    fallbackDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('10'), maxGasUnits: 2_000_000n, maxGasCostUsd: 5 },
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    family: 'evm',
    chainId: 10,
    nativeToken: 'ETH',
    defaultRpcUrl: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    dexScreenerId: 'optimism',
    goPlusChainId: '10',
    defaultDexVenue: '1inch',
    fallbackDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('10'), maxGasUnits: 500_000n, maxGasCostUsd: 5 },
  },
  linea: {
    id: 'linea',
    name: 'Linea',
    family: 'evm',
    chainId: 59144,
    nativeToken: 'ETH',
    defaultRpcUrl: 'https://rpc.linea.build',
    blockExplorer: 'https://lineascan.build',
    dexScreenerId: 'linea',
    goPlusChainId: '59144',
    defaultDexVenue: '1inch',
    fallbackDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('10'), maxGasUnits: 500_000n, maxGasCostUsd: 5 },
  },
  scroll: {
    id: 'scroll',
    name: 'Scroll',
    family: 'evm',
    chainId: 534352,
    nativeToken: 'ETH',
    defaultRpcUrl: 'https://rpc.scroll.io',
    blockExplorer: 'https://scrollscan.com',
    dexScreenerId: 'scroll',
    goPlusChainId: '534352',
    defaultDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('10'), maxGasUnits: 500_000n, maxGasCostUsd: 5 },
  },
  megaeth: {
    id: 'megaeth',
    name: 'MegaETH',
    family: 'evm',
    chainId: 4326,
    nativeToken: 'ETH',
    defaultRpcUrl: 'https://mainnet.megaeth.com/rpc',
    blockExplorer: 'https://megaexplorer.xyz',
    dexScreenerId: 'megaeth',
    goPlusChainId: undefined, // Not yet supported by GoPlus
    defaultDexVenue: '0x',
    gasConfig: { maxGasPrice: gwei('10'), maxGasUnits: 500_000n, maxGasCostUsd: 2 },
  },

  // ── Derivatives ──
  hyperliquid: {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    family: 'hyperliquid',
    nativeToken: 'HYPE',
    defaultRpcUrl: 'https://api.hyperliquid.xyz',
    blockExplorer: 'https://app.hyperliquid.xyz',
    dexScreenerId: 'hyperliquid',
    goPlusChainId: undefined,
    defaultDexVenue: 'hyperliquid',
    gasConfig: { maxGasPrice: 0n, maxGasUnits: 0n, maxGasCostUsd: 0 },
  },
};

// ─── Derived Constants ───────────────────────────────────────────────

/** All chain identifiers */
export const ALL_CHAIN_IDS = Object.keys(CHAIN_REGISTRY);

/** EVM-only chain identifiers */
export const EVM_CHAINS = ALL_CHAIN_IDS.filter(
  (id) => CHAIN_REGISTRY[id].family === 'evm'
);

/** Set of all valid chain names — use in API validation */
export const VALID_CHAINS = new Set(ALL_CHAIN_IDS);

/** EVM chain name → numeric chain ID mapping (backwards compat) */
export const EVM_CHAIN_IDS: Record<string, number> = {};
for (const id of EVM_CHAINS) {
  const cfg = CHAIN_REGISTRY[id];
  if (cfg.chainId !== undefined) {
    EVM_CHAIN_IDS[id] = cfg.chainId;
  }
}

/** Reverse lookup: numeric chain ID → chain name */
export const CHAIN_ID_TO_NAME: Record<number, string> = {};
for (const [name, chainId] of Object.entries(EVM_CHAIN_IDS)) {
  CHAIN_ID_TO_NAME[chainId] = name;
}

/** DexScreener slug → chain name */
export const DEXSCREENER_TO_CHAIN: Record<string, string> = {};
for (const [id, cfg] of Object.entries(CHAIN_REGISTRY)) {
  DEXSCREENER_TO_CHAIN[cfg.dexScreenerId] = id;
}

/** Chain name → DexScreener slug */
export const CHAIN_TO_DEXSCREENER: Record<string, string> = {};
for (const [id, cfg] of Object.entries(CHAIN_REGISTRY)) {
  CHAIN_TO_DEXSCREENER[id] = cfg.dexScreenerId;
}

/** Chain name → GoPlus chain ID (only chains GoPlus supports) */
export const GOPLUS_CHAIN_IDS: Record<string, string> = {};
for (const [id, cfg] of Object.entries(CHAIN_REGISTRY)) {
  if (cfg.goPlusChainId) {
    GOPLUS_CHAIN_IDS[id] = cfg.goPlusChainId;
  }
}

/** Set of native token symbols for transfer detection */
export const NATIVE_TOKEN_SYMBOLS = new Set(
  Object.values(CHAIN_REGISTRY).map((c) => c.nativeToken)
);

// ─── Helpers ─────────────────────────────────────────────────────────

/** Get chain config by name (throws if unknown) */
export function getChainConfig(chain: string): ChainConfig {
  const cfg = CHAIN_REGISTRY[chain];
  if (!cfg) throw new Error(`Unknown chain: ${chain}`);
  return cfg;
}

/** Get RPC URL — checks env override first, then registry default */
export function getChainRpcUrl(chain: string): string {
  const envKey = `CHAIN_RPC_${chain.toUpperCase()}`;
  const override = process.env[envKey];
  if (override) return override;
  return getChainConfig(chain).defaultRpcUrl;
}

/** Get numeric chain ID for EVM chain */
export function getEvmChainId(chain: string): number {
  const cfg = getChainConfig(chain);
  if (cfg.family !== 'evm' || cfg.chainId === undefined) {
    throw new Error(`${chain} is not an EVM chain`);
  }
  return cfg.chainId;
}

/** Check if a native transfer (by token symbol or 'native') */
export function isNativeToken(chain: string, token: string): boolean {
  if (token === 'native') return true;
  const cfg = CHAIN_REGISTRY[chain];
  return cfg ? cfg.nativeToken === token : false;
}
