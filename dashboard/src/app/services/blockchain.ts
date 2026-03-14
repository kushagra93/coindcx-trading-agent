/**
 * Blockchain service layer — integrates war-narrative-agent learnings
 * for token screening (age, volume, price), position management,
 * and exit strategies (ladder exits, trailing stops, micro stop-loss).
 *
 * In paper-trading mode, uses simulated data with realistic patterns.
 * Architecture is ready to swap in real API calls via api client.
 */

// ─── Types ───────────────────────────────────────────────────────────

export type EvmChain = 'ethereum' | 'base' | 'arbitrum' | 'polygon' | 'bsc' | 'optimism' | 'avalanche' | 'blast' | 'zksync' | 'fantom' | 'linea' | 'scroll' | 'mantle' | 'celo' | 'gnosis' | 'monad' | 'megaeth';
export type MoveChain = 'sui' | 'aptos';
export type Chain = 'solana' | EvmChain | MoveChain | 'perps';

/** Per-chain config: DEX router, explorer, native token */
export const CHAIN_CONFIG: Record<Chain, { name: string; dex: string; explorer: string; native: string; type: 'evm' | 'svm' | 'move' | 'perps' }> = {
  solana:    { name: 'Solana',    dex: 'Jupiter v6',     explorer: 'solscan.io',           native: 'SOL',   type: 'svm' },
  ethereum:  { name: 'Ethereum',  dex: 'Uniswap V3',     explorer: 'etherscan.io',         native: 'ETH',   type: 'evm' },
  base:      { name: 'Base',      dex: 'Aerodrome',      explorer: 'basescan.org',         native: 'ETH',   type: 'evm' },
  arbitrum:  { name: 'Arbitrum',  dex: 'Camelot / GMX',  explorer: 'arbiscan.io',          native: 'ETH',   type: 'evm' },
  polygon:   { name: 'Polygon',   dex: 'QuickSwap V3',   explorer: 'polygonscan.com',      native: 'POL',   type: 'evm' },
  bsc:       { name: 'BNB Chain', dex: 'PancakeSwap V3', explorer: 'bscscan.com',          native: 'BNB',   type: 'evm' },
  optimism:  { name: 'Optimism',  dex: 'Velodrome',      explorer: 'optimistic.etherscan.io', native: 'ETH', type: 'evm' },
  avalanche: { name: 'Avalanche', dex: 'Trader Joe V2',  explorer: 'snowscan.xyz',         native: 'AVAX',  type: 'evm' },
  blast:     { name: 'Blast',     dex: 'Thruster',       explorer: 'blastscan.io',         native: 'ETH',   type: 'evm' },
  zksync:    { name: 'zkSync Era',dex: 'SyncSwap',       explorer: 'era.zksync.network',   native: 'ETH',   type: 'evm' },
  fantom:    { name: 'Fantom',    dex: 'SpookySwap',     explorer: 'ftmscan.com',          native: 'FTM',   type: 'evm' },
  linea:     { name: 'Linea',     dex: 'Lynex',          explorer: 'lineascan.build',      native: 'ETH',   type: 'evm' },
  scroll:    { name: 'Scroll',    dex: 'Ambient',        explorer: 'scrollscan.com',       native: 'ETH',   type: 'evm' },
  mantle:    { name: 'Mantle',    dex: 'Agni Finance',   explorer: 'mantlescan.xyz',       native: 'MNT',   type: 'evm' },
  celo:      { name: 'Celo',      dex: 'Ubeswap',        explorer: 'celoscan.io',          native: 'CELO',  type: 'evm' },
  gnosis:    { name: 'Gnosis',    dex: 'SushiSwap',      explorer: 'gnosisscan.io',        native: 'xDAI',  type: 'evm' },
  monad:     { name: 'Monad',     dex: 'Kuru',            explorer: 'monadexplorer.com',    native: 'MON',   type: 'evm' },
  megaeth:   { name: 'MegaETH',  dex: 'GTE',             explorer: 'megaexplorer.xyz',     native: 'ETH',   type: 'evm' },
  sui:       { name: 'Sui',       dex: 'Cetus',           explorer: 'suiscan.xyz',          native: 'SUI',   type: 'move' },
  aptos:     { name: 'Aptos',     dex: 'Liquidswap',      explorer: 'aptoscan.com',         native: 'APT',   type: 'move' },
  perps:     { name: 'Perps',     dex: 'Hyperliquid',    explorer: 'hyperliquid.xyz',      native: 'USDC',  type: 'perps' },
};

export const EVM_CHAINS = Object.entries(CHAIN_CONFIG)
  .filter(([, c]) => c.type === 'evm')
  .map(([k]) => k as EvmChain);

export const MOVE_CHAINS = Object.entries(CHAIN_CONFIG)
  .filter(([, c]) => c.type === 'move')
  .map(([k]) => k as MoveChain);

export interface TokenMetrics {
  symbol: string;
  name: string;
  chain: Chain;
  price: number;
  priceChange5m: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  ageMinutes: number;
  holders: number;
  topHolderPct: number;
  lpLocked: boolean;
  lpLockPct: number;
  rugScore: number; // 0-100, higher = safer
  ctScore: number;  // crypto twitter score 0-100
}

export interface DataSource {
  name: string;       // Photon, Axiom, FOMO, RugCheck, DexScreener
  metric: string;     // what was checked
  value: string;      // result
  verdict: 'safe' | 'warn' | 'danger';
}

export interface ScreeningResult {
  token: TokenMetrics;
  passed: boolean;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  reasons: string[];
  warnings: string[];
  recommendation: string;
  dataSources: DataSource[];
  overallScore: number; // 0-100
  rugProbability: number; // 0-100 (lower = safer)
}

export type ExitType = 'ladder' | 'trailing_stop' | 'micro_stop' | 'time_stop' | 'take_profit' | 'stop_loss';

export interface ExitStrategy {
  type: ExitType;
  label: string;
  triggerPct: number;
  sellPct?: number; // % of position to sell
  active: boolean;
  triggered: boolean;
}

export interface Position {
  id: string;
  symbol: string;
  chain: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  size: number;       // USD value
  quantity: number;
  leverage: number;
  pnl: number;
  pnlPct: number;
  entryTime: number;
  highWaterMark: number;
  exitStrategies: ExitStrategy[];
  status: 'open' | 'partial_exit' | 'closed';
  dex: string;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  chain: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  usdValue: number;
  time: number;
  reason: string;
  exitType?: ExitType;
}

// ─── Token Database (simulated live data) ────────────────────────────

export const TOKEN_DB: Record<string, TokenMetrics> = {
  FARTCOIN: {
    symbol: 'FARTCOIN', name: 'Fartcoin', chain: 'solana',
    price: 0.0041, priceChange5m: +2.3, priceChange1h: +18.5, priceChange24h: +142.5,
    volume24h: 4_200_000, marketCap: 41_000_000, liquidity: 520_000,
    ageMinutes: 4320, holders: 12500, topHolderPct: 3.2,
    lpLocked: true, lpLockPct: 95, rugScore: 82, ctScore: 94,
  },
  POPCAT: {
    symbol: 'POPCAT', name: 'Popcat', chain: 'solana',
    price: 0.26, priceChange5m: +0.8, priceChange1h: +5.2, priceChange24h: +67.3,
    volume24h: 8_500_000, marketCap: 260_000_000, liquidity: 1_200_000,
    ageMinutes: 21600, holders: 45000, topHolderPct: 2.1,
    lpLocked: true, lpLockPct: 98, rugScore: 88, ctScore: 85,
  },
  MYRO: {
    symbol: 'MYRO', name: 'Myro', chain: 'solana',
    price: 0.017, priceChange5m: -0.5, priceChange1h: +3.1, priceChange24h: +34.8,
    volume24h: 1_800_000, marketCap: 17_000_000, liquidity: 180_000,
    ageMinutes: 8640, holders: 8200, topHolderPct: 4.5,
    lpLocked: true, lpLockPct: 90, rugScore: 75, ctScore: 72,
  },
  GIGA: {
    symbol: 'GIGA', name: 'GigaChad', chain: 'solana',
    price: 0.032, priceChange5m: +1.1, priceChange1h: +8.7, priceChange24h: +89.2,
    volume24h: 3_100_000, marketCap: 32_000_000, liquidity: 340_000,
    ageMinutes: 5760, holders: 9800, topHolderPct: 3.8,
    lpLocked: true, lpLockPct: 92, rugScore: 79, ctScore: 88,
  },
  WIF: {
    symbol: 'WIF', name: 'dogwifhat', chain: 'solana',
    price: 0.80, priceChange5m: +0.3, priceChange1h: +1.2, priceChange24h: +8.7,
    volume24h: 12_000_000, marketCap: 800_000_000, liquidity: 4_500_000,
    ageMinutes: 43200, holders: 120000, topHolderPct: 1.8,
    lpLocked: true, lpLockPct: 99, rugScore: 92, ctScore: 78,
  },
  BONK: {
    symbol: 'BONK', name: 'Bonk', chain: 'solana',
    price: 0.000025, priceChange5m: +0.1, priceChange1h: +2.3, priceChange24h: +18.4,
    volume24h: 25_000_000, marketCap: 1_500_000_000, liquidity: 8_000_000,
    ageMinutes: 86400, holders: 680000, topHolderPct: 1.2,
    lpLocked: true, lpLockPct: 99, rugScore: 95, ctScore: 65,
  },
  SOL: {
    symbol: 'SOL', name: 'Solana', chain: 'solana',
    price: 144.0, priceChange5m: +0.05, priceChange1h: +0.8, priceChange24h: +5.2,
    volume24h: 2_800_000_000, marketCap: 62_000_000_000, liquidity: 500_000_000,
    ageMinutes: 999999, holders: 5000000, topHolderPct: 0.3,
    lpLocked: true, lpLockPct: 100, rugScore: 99, ctScore: 90,
  },
  DEGEN: {
    symbol: 'DEGEN', name: 'Degen', chain: 'base',
    price: 0.004, priceChange5m: +0.6, priceChange1h: +4.1, priceChange24h: +28.5,
    volume24h: 2_200_000, marketCap: 40_000_000, liquidity: 280_000,
    ageMinutes: 14400, holders: 35000, topHolderPct: 2.9,
    lpLocked: true, lpLockPct: 88, rugScore: 80, ctScore: 76,
  },
  TOSHI: {
    symbol: 'TOSHI', name: 'Toshi', chain: 'base',
    price: 0.00015, priceChange5m: -0.2, priceChange1h: +1.8, priceChange24h: +19.2,
    volume24h: 950_000, marketCap: 15_000_000, liquidity: 120_000,
    ageMinutes: 10080, holders: 18000, topHolderPct: 5.1,
    lpLocked: true, lpLockPct: 85, rugScore: 72, ctScore: 68,
  },
  BRETT: {
    symbol: 'BRETT', name: 'Brett', chain: 'base',
    price: 0.09, priceChange5m: +0.2, priceChange1h: +1.5, priceChange24h: +12.3,
    volume24h: 5_500_000, marketCap: 90_000_000, liquidity: 650_000,
    ageMinutes: 28800, holders: 42000, topHolderPct: 2.4,
    lpLocked: true, lpLockPct: 94, rugScore: 85, ctScore: 70,
  },
  AERO: {
    symbol: 'AERO', name: 'Aerodrome', chain: 'base',
    price: 1.20, priceChange5m: -0.1, priceChange1h: -0.5, priceChange24h: -3.1,
    volume24h: 8_000_000, marketCap: 450_000_000, liquidity: 3_200_000,
    ageMinutes: 43200, holders: 55000, topHolderPct: 1.5,
    lpLocked: true, lpLockPct: 97, rugScore: 90, ctScore: 62,
  },
  ETH: {
    symbol: 'ETH', name: 'Ethereum', chain: 'ethereum',
    price: 3200, priceChange5m: +0.02, priceChange1h: +0.4, priceChange24h: +2.1,
    volume24h: 18_000_000_000, marketCap: 385_000_000_000, liquidity: 999_000_000,
    ageMinutes: 999999, holders: 10000000, topHolderPct: 0.1,
    lpLocked: true, lpLockPct: 100, rugScore: 99, ctScore: 88,
  },
  PEPE: {
    symbol: 'PEPE', name: 'Pepe', chain: 'ethereum',
    price: 0.000009, priceChange5m: -0.3, priceChange1h: -0.8, priceChange24h: -1.5,
    volume24h: 15_000_000, marketCap: 3_800_000_000, liquidity: 12_000_000,
    ageMinutes: 86400, holders: 250000, topHolderPct: 1.0,
    lpLocked: true, lpLockPct: 99, rugScore: 93, ctScore: 72,
  },
  MOG: {
    symbol: 'MOG', name: 'Mog Coin', chain: 'ethereum',
    price: 0.0000008, priceChange5m: +0.5, priceChange1h: +3.2, priceChange24h: +22.1,
    volume24h: 3_500_000, marketCap: 416_000_000, liquidity: 280_000,
    ageMinutes: 21600, holders: 14000, topHolderPct: 3.5,
    lpLocked: true, lpLockPct: 91, rugScore: 78, ctScore: 74,
  },
  MEW: {
    symbol: 'MEW', name: 'cat in a dogs world', chain: 'solana',
    price: 0.0085, priceChange5m: +0.7, priceChange1h: +2.8, priceChange24h: +15.3,
    volume24h: 6_200_000, marketCap: 85_000_000, liquidity: 420_000,
    ageMinutes: 14400, holders: 28000, topHolderPct: 2.8,
    lpLocked: true, lpLockPct: 93, rugScore: 81, ctScore: 77,
  },
  // ── Arbitrum tokens ──
  ARB: {
    symbol: 'ARB', name: 'Arbitrum', chain: 'arbitrum',
    price: 1.18, priceChange5m: +0.1, priceChange1h: +0.9, priceChange24h: +4.2,
    volume24h: 320_000_000, marketCap: 3_800_000_000, liquidity: 45_000_000,
    ageMinutes: 999999, holders: 850000, topHolderPct: 0.8,
    lpLocked: true, lpLockPct: 100, rugScore: 97, ctScore: 80,
  },
  GMX: {
    symbol: 'GMX', name: 'GMX', chain: 'arbitrum',
    price: 35.40, priceChange5m: -0.2, priceChange1h: +1.5, priceChange24h: +6.8,
    volume24h: 28_000_000, marketCap: 340_000_000, liquidity: 12_000_000,
    ageMinutes: 999999, holders: 42000, topHolderPct: 2.1,
    lpLocked: true, lpLockPct: 98, rugScore: 94, ctScore: 75,
  },
  MAGIC: {
    symbol: 'MAGIC', name: 'Magic', chain: 'arbitrum',
    price: 0.72, priceChange5m: +0.4, priceChange1h: +3.2, priceChange24h: +12.5,
    volume24h: 8_500_000, marketCap: 210_000_000, liquidity: 3_200_000,
    ageMinutes: 999999, holders: 35000, topHolderPct: 3.5,
    lpLocked: true, lpLockPct: 95, rugScore: 88, ctScore: 71,
  },
  PENDLE: {
    symbol: 'PENDLE', name: 'Pendle', chain: 'arbitrum',
    price: 4.85, priceChange5m: +0.3, priceChange1h: +2.1, priceChange24h: +9.3,
    volume24h: 42_000_000, marketCap: 780_000_000, liquidity: 8_500_000,
    ageMinutes: 999999, holders: 28000, topHolderPct: 2.8,
    lpLocked: true, lpLockPct: 97, rugScore: 91, ctScore: 82,
  },
  // ── Polygon tokens ──
  POL: {
    symbol: 'POL', name: 'Polygon', chain: 'polygon',
    price: 0.58, priceChange5m: +0.05, priceChange1h: +0.6, priceChange24h: +3.1,
    volume24h: 180_000_000, marketCap: 5_800_000_000, liquidity: 85_000_000,
    ageMinutes: 999999, holders: 1200000, topHolderPct: 0.5,
    lpLocked: true, lpLockPct: 100, rugScore: 98, ctScore: 72,
  },
  AAVE: {
    symbol: 'AAVE', name: 'Aave', chain: 'polygon',
    price: 92.50, priceChange5m: -0.1, priceChange1h: +0.8, priceChange24h: +2.5,
    volume24h: 95_000_000, marketCap: 1_380_000_000, liquidity: 22_000_000,
    ageMinutes: 999999, holders: 180000, topHolderPct: 1.2,
    lpLocked: true, lpLockPct: 100, rugScore: 97, ctScore: 68,
  },
  QUICK: {
    symbol: 'QUICK', name: 'QuickSwap', chain: 'polygon',
    price: 0.042, priceChange5m: +0.2, priceChange1h: +1.8, priceChange24h: +8.7,
    volume24h: 3_200_000, marketCap: 32_000_000, liquidity: 1_800_000,
    ageMinutes: 999999, holders: 15000, topHolderPct: 4.2,
    lpLocked: true, lpLockPct: 92, rugScore: 82, ctScore: 58,
  },
  // ── BNB Chain tokens ──
  BNB: {
    symbol: 'BNB', name: 'BNB', chain: 'bnb',
    price: 610.20, priceChange5m: +0.04, priceChange1h: +0.5, priceChange24h: +2.8,
    volume24h: 1_200_000_000, marketCap: 91_000_000_000, liquidity: 500_000_000,
    ageMinutes: 999999, holders: 5000000, topHolderPct: 0.2,
    lpLocked: true, lpLockPct: 100, rugScore: 99, ctScore: 85,
  },
  CAKE: {
    symbol: 'CAKE', name: 'PancakeSwap', chain: 'bnb',
    price: 2.45, priceChange5m: +0.1, priceChange1h: +1.2, priceChange24h: +5.4,
    volume24h: 42_000_000, marketCap: 680_000_000, liquidity: 18_000_000,
    ageMinutes: 999999, holders: 320000, topHolderPct: 1.5,
    lpLocked: true, lpLockPct: 99, rugScore: 95, ctScore: 70,
  },
  BAKE: {
    symbol: 'BAKE', name: 'BakeryToken', chain: 'bnb',
    price: 0.28, priceChange5m: +0.3, priceChange1h: +2.5, priceChange24h: +11.2,
    volume24h: 5_800_000, marketCap: 52_000_000, liquidity: 2_400_000,
    ageMinutes: 999999, holders: 45000, topHolderPct: 3.8,
    lpLocked: true, lpLockPct: 90, rugScore: 80, ctScore: 55,
  },
  // ── Optimism tokens ──
  OP: {
    symbol: 'OP', name: 'Optimism', chain: 'optimism',
    price: 2.15, priceChange5m: +0.08, priceChange1h: +1.1, priceChange24h: +5.8,
    volume24h: 145_000_000, marketCap: 2_600_000_000, liquidity: 32_000_000,
    ageMinutes: 999999, holders: 420000, topHolderPct: 0.9,
    lpLocked: true, lpLockPct: 100, rugScore: 97, ctScore: 78,
  },
  VELO: {
    symbol: 'VELO', name: 'Velodrome', chain: 'optimism',
    price: 0.085, priceChange5m: +0.2, priceChange1h: +1.8, priceChange24h: +7.2,
    volume24h: 8_200_000, marketCap: 72_000_000, liquidity: 4_500_000,
    ageMinutes: 999999, holders: 22000, topHolderPct: 3.1,
    lpLocked: true, lpLockPct: 95, rugScore: 86, ctScore: 65,
  },
  // ── Avalanche tokens ──
  AVAX: {
    symbol: 'AVAX', name: 'Avalanche', chain: 'avalanche',
    price: 38.50, priceChange5m: +0.06, priceChange1h: +0.7, priceChange24h: +3.5,
    volume24h: 280_000_000, marketCap: 14_200_000_000, liquidity: 120_000_000,
    ageMinutes: 999999, holders: 1500000, topHolderPct: 0.4,
    lpLocked: true, lpLockPct: 100, rugScore: 98, ctScore: 76,
  },
  JOE: {
    symbol: 'JOE', name: 'Trader Joe', chain: 'avalanche',
    price: 0.42, priceChange5m: +0.15, priceChange1h: +2.3, priceChange24h: +9.8,
    volume24h: 12_000_000, marketCap: 142_000_000, liquidity: 5_200_000,
    ageMinutes: 999999, holders: 28000, topHolderPct: 2.5,
    lpLocked: true, lpLockPct: 96, rugScore: 89, ctScore: 62,
  },
  // ── Blast tokens ──
  BLAST: {
    symbol: 'BLAST', name: 'Blast', chain: 'blast',
    price: 0.012, priceChange5m: +0.5, priceChange1h: +4.2, priceChange24h: +18.5,
    volume24h: 35_000_000, marketCap: 320_000_000, liquidity: 8_000_000,
    ageMinutes: 43200, holders: 85000, topHolderPct: 2.2,
    lpLocked: true, lpLockPct: 94, rugScore: 84, ctScore: 73,
  },
  // ── Sonic tokens (formerly Fantom) ──
  S: {
    symbol: 'S', name: 'Sonic', chain: 'sonic',
    price: 0.58, priceChange5m: +0.12, priceChange1h: +1.8, priceChange24h: +9.5,
    volume24h: 65_000_000, marketCap: 1_800_000_000, liquidity: 25_000_000,
    ageMinutes: 999999, holders: 450000, topHolderPct: 0.6,
    lpLocked: true, lpLockPct: 100, rugScore: 96, ctScore: 72,
  },
  FTM: {
    symbol: 'FTM', name: 'Fantom (Legacy)', chain: 'sonic',
    price: 0.72, priceChange5m: +0.1, priceChange1h: +1.5, priceChange24h: +6.2,
    volume24h: 85_000_000, marketCap: 2_000_000_000, liquidity: 28_000_000,
    ageMinutes: 999999, holders: 650000, topHolderPct: 0.7,
    lpLocked: true, lpLockPct: 100, rugScore: 96, ctScore: 64,
  },
  // ── Monad tokens ──
  MON: {
    symbol: 'MON', name: 'Monad', chain: 'monad',
    price: 2.85, priceChange5m: +0.3, priceChange1h: +2.8, priceChange24h: +15.2,
    volume24h: 180_000_000, marketCap: 4_200_000_000, liquidity: 65_000_000,
    ageMinutes: 999999, holders: 380000, topHolderPct: 1.2,
    lpLocked: true, lpLockPct: 100, rugScore: 95, ctScore: 92,
  },
  KURU: {
    symbol: 'KURU', name: 'Kuru', chain: 'monad',
    price: 0.85, priceChange5m: +0.5, priceChange1h: +4.2, priceChange24h: +22.5,
    volume24h: 28_000_000, marketCap: 120_000_000, liquidity: 8_500_000,
    ageMinutes: 43200, holders: 42000, topHolderPct: 3.2,
    lpLocked: true, lpLockPct: 95, rugScore: 85, ctScore: 88,
  },
  MOYAKI: {
    symbol: 'MOYAKI', name: 'Moyaki', chain: 'monad',
    price: 0.042, priceChange5m: +1.2, priceChange1h: +8.5, priceChange24h: +65.3,
    volume24h: 12_000_000, marketCap: 42_000_000, liquidity: 3_200_000,
    ageMinutes: 14400, holders: 18000, topHolderPct: 4.5,
    lpLocked: true, lpLockPct: 90, rugScore: 78, ctScore: 85,
  },
  // ── Sui tokens ──
  SUI: {
    symbol: 'SUI', name: 'Sui', chain: 'sui',
    price: 1.62, priceChange5m: +0.08, priceChange1h: +1.2, priceChange24h: +7.8,
    volume24h: 420_000_000, marketCap: 5_200_000_000, liquidity: 95_000_000,
    ageMinutes: 999999, holders: 920000, topHolderPct: 0.6,
    lpLocked: true, lpLockPct: 100, rugScore: 97, ctScore: 84,
  },
  CETUS: {
    symbol: 'CETUS', name: 'Cetus Protocol', chain: 'sui',
    price: 0.18, priceChange5m: +0.2, priceChange1h: +3.1, priceChange24h: +14.5,
    volume24h: 35_000_000, marketCap: 280_000_000, liquidity: 12_000_000,
    ageMinutes: 999999, holders: 65000, topHolderPct: 2.8,
    lpLocked: true, lpLockPct: 96, rugScore: 88, ctScore: 75,
  },
  TURBOS: {
    symbol: 'TURBOS', name: 'Turbos Finance', chain: 'sui',
    price: 0.025, priceChange5m: +0.4, priceChange1h: +5.2, priceChange24h: +28.3,
    volume24h: 8_500_000, marketCap: 45_000_000, liquidity: 3_800_000,
    ageMinutes: 86400, holders: 22000, topHolderPct: 4.1,
    lpLocked: true, lpLockPct: 92, rugScore: 82, ctScore: 71,
  },
  NAVX: {
    symbol: 'NAVX', name: 'NAVI Protocol', chain: 'sui',
    price: 0.12, priceChange5m: +0.15, priceChange1h: +2.4, priceChange24h: +11.2,
    volume24h: 15_000_000, marketCap: 95_000_000, liquidity: 5_500_000,
    ageMinutes: 999999, holders: 35000, topHolderPct: 3.5,
    lpLocked: true, lpLockPct: 94, rugScore: 86, ctScore: 69,
  },
  // ── Aptos tokens ──
  APT: {
    symbol: 'APT', name: 'Aptos', chain: 'aptos',
    price: 9.20, priceChange5m: +0.05, priceChange1h: +0.9, priceChange24h: +4.8,
    volume24h: 280_000_000, marketCap: 4_100_000_000, liquidity: 72_000_000,
    ageMinutes: 999999, holders: 780000, topHolderPct: 0.8,
    lpLocked: true, lpLockPct: 100, rugScore: 97, ctScore: 78,
  },
  THALA: {
    symbol: 'THALA', name: 'Thala', chain: 'aptos',
    price: 0.52, priceChange5m: +0.3, priceChange1h: +2.8, priceChange24h: +12.8,
    volume24h: 12_000_000, marketCap: 85_000_000, liquidity: 4_200_000,
    ageMinutes: 999999, holders: 18000, topHolderPct: 3.8,
    lpLocked: true, lpLockPct: 93, rugScore: 84, ctScore: 66,
  },
  GUI: {
    symbol: 'GUI', name: 'GUI Inu', chain: 'aptos',
    price: 0.00085, priceChange5m: +0.8, priceChange1h: +6.5, priceChange24h: +45.2,
    volume24h: 5_200_000, marketCap: 18_000_000, liquidity: 1_800_000,
    ageMinutes: 21600, holders: 12000, topHolderPct: 5.2,
    lpLocked: true, lpLockPct: 88, rugScore: 74, ctScore: 80,
  },
  // ── Berachain tokens ──
  BERA: {
    symbol: 'BERA', name: 'Berachain', chain: 'berachain',
    price: 0.62, priceChange5m: +0.15, priceChange1h: +2.1, priceChange24h: +8.5,
    volume24h: 85_000_000, marketCap: 330_000_000, liquidity: 18_000_000,
    ageMinutes: 999999, holders: 185000, topHolderPct: 1.5,
    lpLocked: true, lpLockPct: 100, rugScore: 94, ctScore: 82,
  },
  HONEY: {
    symbol: 'HONEY', name: 'Honey', chain: 'berachain',
    price: 1.00, priceChange5m: +0.01, priceChange1h: +0.05, priceChange24h: +0.1,
    volume24h: 42_000_000, marketCap: 500_000_000, liquidity: 120_000_000,
    ageMinutes: 999999, holders: 95000, topHolderPct: 0.8,
    lpLocked: true, lpLockPct: 100, rugScore: 98, ctScore: 60,
  },
  KODIAK: {
    symbol: 'KODIAK', name: 'Kodiak', chain: 'berachain',
    price: 0.18, priceChange5m: +0.4, priceChange1h: +3.8, priceChange24h: +22.1,
    volume24h: 12_000_000, marketCap: 48_000_000, liquidity: 4_200_000,
    ageMinutes: 43200, holders: 28000, topHolderPct: 3.5,
    lpLocked: true, lpLockPct: 92, rugScore: 82, ctScore: 76,
  },
  // ── Linea tokens ──
  LINEA: {
    symbol: 'LINEA', name: 'Linea', chain: 'linea',
    price: 0.045, priceChange5m: +0.08, priceChange1h: +1.5, priceChange24h: +6.8,
    volume24h: 18_000_000, marketCap: 180_000_000, liquidity: 8_500_000,
    ageMinutes: 999999, holders: 65000, topHolderPct: 2.2,
    lpLocked: true, lpLockPct: 100, rugScore: 90, ctScore: 68,
  },
  NILE: {
    symbol: 'NILE', name: 'Nile Exchange', chain: 'linea',
    price: 0.022, priceChange5m: +0.3, priceChange1h: +2.8, priceChange24h: +15.4,
    volume24h: 5_200_000, marketCap: 22_000_000, liquidity: 2_800_000,
    ageMinutes: 86400, holders: 15000, topHolderPct: 4.1,
    lpLocked: true, lpLockPct: 90, rugScore: 80, ctScore: 62,
  },
  // ── Scroll tokens ──
  SCR: {
    symbol: 'SCR', name: 'Scroll', chain: 'scroll',
    price: 0.52, priceChange5m: +0.1, priceChange1h: +1.8, priceChange24h: +7.2,
    volume24h: 32_000_000, marketCap: 520_000_000, liquidity: 15_000_000,
    ageMinutes: 999999, holders: 82000, topHolderPct: 1.8,
    lpLocked: true, lpLockPct: 100, rugScore: 92, ctScore: 72,
  },
  AMBIENT: {
    symbol: 'AMBIENT', name: 'Ambient Finance', chain: 'scroll',
    price: 0.085, priceChange5m: +0.2, priceChange1h: +3.2, priceChange24h: +12.5,
    volume24h: 4_800_000, marketCap: 35_000_000, liquidity: 2_500_000,
    ageMinutes: 86400, holders: 12000, topHolderPct: 4.5,
    lpLocked: true, lpLockPct: 88, rugScore: 78, ctScore: 65,
  },
  // ── MegaETH (Real-time EVM L2) ──
  MEGA: {
    symbol: 'MEGA', name: 'MegaETH', chain: 'megaeth',
    price: 1.85, priceChange5m: +0.6, priceChange1h: +3.2, priceChange24h: +18.5,
    volume24h: 95_000_000, marketCap: 2_800_000_000, liquidity: 42_000_000,
    ageMinutes: 518400, holders: 290000, topHolderPct: 1.8,
    lpLocked: true, lpLockPct: 100, rugScore: 96, ctScore: 94,
  },
  GTE: {
    symbol: 'GTE', name: 'GTE DEX', chain: 'megaeth',
    price: 0.42, priceChange5m: +1.1, priceChange1h: +5.8, priceChange24h: +32.4,
    volume24h: 28_000_000, marketCap: 180_000_000, liquidity: 15_000_000,
    ageMinutes: 86400, holders: 45000, topHolderPct: 4.1,
    lpLocked: true, lpLockPct: 92, rugScore: 88, ctScore: 85,
  },
  CRAB: {
    symbol: 'CRAB', name: 'MegaCrab', chain: 'megaeth',
    price: 0.0012, priceChange5m: +2.5, priceChange1h: +12.8, priceChange24h: +85.3,
    volume24h: 8_500_000, marketCap: 12_000_000, liquidity: 2_200_000,
    ageMinutes: 14400, holders: 18000, topHolderPct: 6.8,
    lpLocked: true, lpLockPct: 85, rugScore: 72, ctScore: 78,
  },
};

// US stock perps (separate pricing model)
export const PERP_DB: Record<string, TokenMetrics> = {
  'TSLA': {
    symbol: 'TSLA-PERP', name: 'Tesla Perpetual', chain: 'perps',
    price: 430.20, priceChange5m: +0.12, priceChange1h: +0.8, priceChange24h: +3.8,
    volume24h: 1_200_000_000, marketCap: 999_000_000_000, liquidity: 999_000_000,
    ageMinutes: 999999, holders: 999999, topHolderPct: 0,
    lpLocked: true, lpLockPct: 100, rugScore: 99, ctScore: 85,
  },
  'NVDA': {
    symbol: 'NVDA-PERP', name: 'NVIDIA Perpetual', chain: 'perps',
    price: 140.10, priceChange5m: +0.08, priceChange1h: +1.2, priceChange24h: +5.1,
    volume24h: 890_000_000, marketCap: 999_000_000_000, liquidity: 999_000_000,
    ageMinutes: 999999, holders: 999999, topHolderPct: 0,
    lpLocked: true, lpLockPct: 100, rugScore: 99, ctScore: 82,
  },
  'AAPL': {
    symbol: 'AAPL-PERP', name: 'Apple Perpetual', chain: 'perps',
    price: 178.50, priceChange5m: -0.05, priceChange1h: -0.3, priceChange24h: -1.2,
    volume24h: 650_000_000, marketCap: 999_000_000_000, liquidity: 999_000_000,
    ageMinutes: 999999, holders: 999999, topHolderPct: 0,
    lpLocked: true, lpLockPct: 100, rugScore: 99, ctScore: 70,
  },
  'AMZN': {
    symbol: 'AMZN-PERP', name: 'Amazon Perpetual', chain: 'perps',
    price: 185.30, priceChange5m: +0.04, priceChange1h: +0.6, priceChange24h: +2.3,
    volume24h: 520_000_000, marketCap: 999_000_000_000, liquidity: 999_000_000,
    ageMinutes: 999999, holders: 999999, topHolderPct: 0,
    lpLocked: true, lpLockPct: 100, rugScore: 99, ctScore: 68,
  },
};

// ─── Contract Address → Token Name Lookup ─────────────────────────────

const CONTRACT_DB: Record<string, { symbol: string; name: string; chain: Chain }> = {
  // ── Ethereum ──
  '0x6982508145454Ce325dDbE47a25d4ec3d2311933': { symbol: 'PEPE', name: 'Pepe', chain: 'ethereum' },
  '0xb131f4A55907B10d1F0A50d8ab8FA09EC342cd74': { symbol: 'MEME', name: 'Memecoin', chain: 'ethereum' },
  '0x4d224452801ACEd8B2F0aebE155379bb5D594381': { symbol: 'APE', name: 'ApeCoin', chain: 'ethereum' },
  '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE': { symbol: 'SHIB', name: 'Shiba Inu', chain: 'ethereum' },
  '0x6B175474E89094C44Da98b954EedeAC495271d0F': { symbol: 'DAI', name: 'Dai Stablecoin', chain: 'ethereum' },
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': { symbol: 'USDC', name: 'USD Coin', chain: 'ethereum' },
  '0xdAC17F958D2ee523a2206206994597C13D831ec7': { symbol: 'USDT', name: 'Tether USD', chain: 'ethereum' },
  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': { symbol: 'WBTC', name: 'Wrapped Bitcoin', chain: 'ethereum' },
  '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984': { symbol: 'UNI', name: 'Uniswap', chain: 'ethereum' },
  '0x514910771AF9Ca656af840dff83E8264EcF986CA': { symbol: 'LINK', name: 'Chainlink', chain: 'ethereum' },
  '0xaea46A60368A7bD060eec7DF8CBa43b7EF41Ad85': { symbol: 'FET', name: 'Fetch.ai', chain: 'ethereum' },
  '0xaaeE1A9723aaDB7afA2810263653A34bA2C21C7a': { symbol: 'MOG', name: 'Mog Coin', chain: 'ethereum' },
  // ── Base ──
  '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed': { symbol: 'DEGEN', name: 'Degen', chain: 'base' },
  '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4': { symbol: 'TOSHI', name: 'Toshi', chain: 'base' },
  '0x532f27101965dd16442E59d40670FaF5eBB142E4': { symbol: 'BRETT', name: 'Brett', chain: 'base' },
  '0x940181a94A35A4569E4529A3CDfB74e38FD98631': { symbol: 'AERO', name: 'Aerodrome', chain: 'base' },
  // ── Arbitrum ──
  '0x912CE59144191C1204E64559FE8253a0e49E6548': { symbol: 'ARB', name: 'Arbitrum', chain: 'arbitrum' },
  '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a': { symbol: 'GMX', name: 'GMX', chain: 'arbitrum' },
  '0x539bdE0d7Dbd336b79148AA742883198BBF60342': { symbol: 'MAGIC', name: 'Magic', chain: 'arbitrum' },
  '0x18c11FD286C5EC11c3b683Caa813B77f5163A122': { symbol: 'GNS', name: 'Gains Network', chain: 'arbitrum' },
  '0x6985884C4392D348587B19cb9eAAf157F13271cd': { symbol: 'ZRO', name: 'LayerZero', chain: 'arbitrum' },
  '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8': { symbol: 'PENDLE', name: 'Pendle', chain: 'arbitrum' },
  // ── Polygon ──
  '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270': { symbol: 'WPOL', name: 'Wrapped POL', chain: 'polygon' },
  '0xd6DF932A45C0f255f85145f286eA0b292B21C90B': { symbol: 'AAVE', name: 'Aave', chain: 'polygon' },
  '0xa3Fa99A148fA48D14Ed51d610c367C61876997F1': { symbol: 'miMATIC', name: 'MAI Stablecoin', chain: 'polygon' },
  '0xB7b31a6BC18e48888545CE79e83E06003bE70930': { symbol: 'APE', name: 'ApeCoin', chain: 'polygon' },
  // ── BNB Chain (BSC) ──
  '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c': { symbol: 'WBNB', name: 'Wrapped BNB', chain: 'bsc' },
  '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82': { symbol: 'CAKE', name: 'PancakeSwap', chain: 'bsc' },
  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8': { symbol: 'ETH', name: 'Binance-Peg ETH', chain: 'bsc' },
  '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c': { symbol: 'BTCB', name: 'Binance-Peg BTC', chain: 'bsc' },
  '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE': { symbol: 'XRP', name: 'Binance-Peg XRP', chain: 'bsc' },
  // ── Optimism ──
  '0x4200000000000000000000000000000000000042': { symbol: 'OP', name: 'Optimism', chain: 'optimism' },
  '0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db': { symbol: 'VELO', name: 'Velodrome', chain: 'optimism' },
  '0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4': { symbol: 'SNX', name: 'Synthetix', chain: 'optimism' },
  // ── Avalanche ──
  '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': { symbol: 'WAVAX', name: 'Wrapped AVAX', chain: 'avalanche' },
  '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd': { symbol: 'JOE', name: 'Trader Joe', chain: 'avalanche' },
  '0x152b9d0FdC40C096DE20232Db4820c70066dbbA5': { symbol: 'GMX', name: 'GMX', chain: 'avalanche' },
  // ── Blast ──
  '0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad': { symbol: 'BLAST', name: 'Blast', chain: 'blast' },
  '0x4300000000000000000000000000000000000004': { symbol: 'WETH', name: 'Wrapped ETH', chain: 'blast' },
  // ── Fantom ──
  '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83': { symbol: 'WFTM', name: 'Wrapped FTM', chain: 'fantom' },
  '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE': { symbol: 'BOO', name: 'SpookyToken', chain: 'fantom' },
  // ── zkSync Era ──
  '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E': { symbol: 'ZK', name: 'zkSync', chain: 'zksync' },
  // ── Monad ──
  '0x3a98e4cFfC26c70B4b43507bD2B4a2a4C8B6E4dA': { symbol: 'MON', name: 'Monad', chain: 'monad' },
  '0x8bE7dB2F9C3Bf4a68cE1A2B5dF93D17E85cA21F7': { symbol: 'KURU', name: 'Kuru', chain: 'monad' },
  '0xf1A9c7E2D3b4F56a89B0cE3d2F1a4c7E9D3B5f8A': { symbol: 'MOYAKI', name: 'Moyaki', chain: 'monad' },
  // ── Sui (0x + 64 hex) ──
  '0x2::sui::SUI': { symbol: 'SUI', name: 'Sui', chain: 'sui' },
  '0x06864a6f921804860930db6ddbe2e16acdf8504495ea7481637a1c8b9a8fe54b': { symbol: 'CETUS', name: 'Cetus Protocol', chain: 'sui' },
  '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf': { symbol: 'USDC', name: 'USD Coin (Sui)', chain: 'sui' },
  '0x76cb819b01abed502bee8a702b4c2d547532c12f25001c9dea795a5e631c26f1': { symbol: 'NAVX', name: 'NAVI Protocol', chain: 'sui' },
  '0x0b4bfc7e4b5e2a7e8c9d1f6a3b8e5c2d4f7a9e1b3c5d7f9a2b4c6d8e0f1a2b': { symbol: 'TURBOS', name: 'Turbos Finance', chain: 'sui' },
  // ── Aptos (0x + 64 hex) ──
  '0x1::aptos_coin::AptosCoin': { symbol: 'APT', name: 'Aptos', chain: 'aptos' },
  '0x7fd500c11216f0fe3095d0c4b8aa4d64a4e2e04f83758462f2b127255643615': { symbol: 'THALA', name: 'Thala', chain: 'aptos' },
  '0xe4ccb6d39136469f376242c31b34d10515c8eaaa38092f804db8e08a8f53c5b2': { symbol: 'GUI', name: 'GUI Inu', chain: 'aptos' },
  // ── MegaETH (EVM) ──
  '0x4d65676145544800000000000000000000000001': { symbol: 'MEGA', name: 'MegaETH', chain: 'megaeth' },
  '0x4d65676145544800000000000000000000000002': { symbol: 'GTE', name: 'GTE DEX', chain: 'megaeth' },
  '0x4d65676145544800000000000000000000000003': { symbol: 'CRAB', name: 'MegaCrab', chain: 'megaeth' },
  // ── Solana (base58) ──
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk', chain: 'solana' },
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': { symbol: 'WIF', name: 'dogwifhat', chain: 'solana' },
  'HLwEJQVzs7SvMeeSY3gRTaWEGnCbELJJunRSGwbwNzjR': { symbol: 'MYRO', name: 'Myro', chain: 'solana' },
  '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr': { symbol: 'POPCAT', name: 'Popcat', chain: 'solana' },
  '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump': { symbol: 'FARTCOIN', name: 'Fartcoin', chain: 'solana' },
  'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5': { symbol: 'MEW', name: 'cat in a dogs world', chain: 'solana' },
};

/** Look up a token name from a known contract address, or simulate an on-chain fetch */
function resolveContractName(address: string): { symbol: string; name: string } | null {
  // Exact match in known DB (case-insensitive for EVM)
  for (const [addr, info] of Object.entries(CONTRACT_DB)) {
    if (addr.toLowerCase() === address.toLowerCase()) return info;
  }
  return null;
}

// ─── Contract Address Detection ──────────────────────────────────────

/** Check if an address is a valid EVM address (0x + 40 hex chars) */
export function isEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/** Check if an address is a valid Solana address (base58, 32-44 chars) */
export function isSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/** Check if an address is a Sui/Aptos Move address (0x + 64 hex, or Move module paths like 0x2::sui::SUI) */
export function isMoveAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address) || /^0x[a-fA-F0-9]{1,4}::.+::.+$/.test(address);
}

/** Detect chain from contract address — checks known DB first, then falls back to heuristic */
export function detectChainFromAddress(address: string, hintChain?: Chain): Chain | null {
  // Known contracts always win
  const known = resolveContractName(address);
  if (known) {
    for (const [addr, info] of Object.entries(CONTRACT_DB)) {
      if (addr.toLowerCase() === address.toLowerCase()) return info.chain;
    }
  }

  // User-specified chain hint (e.g., "screen 0x... on arbitrum")
  if (hintChain && CHAIN_CONFIG[hintChain]) return hintChain;

  // Move module paths (0x2::sui::SUI) → Sui/Aptos
  if (/^0x[a-fA-F0-9]{1,4}::.+::.+$/.test(address)) return 'sui'; // default Move to Sui

  // 0x + 64 hex → Move chain (Sui default, override with "on aptos")
  if (/^0x[a-fA-F0-9]{64}$/.test(address)) return 'sui';

  // 0x + 40 hex → EVM (default ethereum)
  if (isEvmAddress(address)) return 'ethereum';

  // Solana (base58)
  if (isSolanaAddress(address)) return 'solana';

  return null;
}

/** Parse "on <chain>" suffix from user text, e.g. "screen 0x... on arbitrum" */
export function parseChainHint(text: string): Chain | null {
  const match = text.match(/\bon\s+([\w-]+)\s*$/i);
  if (!match) return null;
  const hint = match[1].toLowerCase();
  // Match against chain keys and display names
  for (const [key, config] of Object.entries(CHAIN_CONFIG)) {
    if (key === hint || config.name.toLowerCase() === hint) return key as Chain;
  }
  // Common aliases
  const aliases: Record<string, Chain> = {
    eth: 'ethereum', arb: 'arbitrum', poly: 'polygon', matic: 'polygon',
    op: 'optimism', avax: 'avalanche', bnb: 'bsc', ftm: 'fantom',
    zk: 'zksync', 'zksync': 'zksync',
    mon: 'monad', apt: 'aptos', mega: 'megaeth',
  };
  return aliases[hint] ?? null;
}

/** Generate deterministic-looking metrics from a contract address (simulated RPC/API call) */
export function screenByAddress(address: string, hintChain?: Chain): ScreeningResult {
  const chain = detectChainFromAddress(address, hintChain);
  if (!chain) {
    return {
      token: {
        symbol: address.slice(0, 6).toUpperCase(), name: 'Unknown', chain: 'solana',
        price: 0, priceChange5m: 0, priceChange1h: 0, priceChange24h: 0,
        volume24h: 0, marketCap: 0, liquidity: 0, ageMinutes: 0, holders: 0,
        topHolderPct: 100, lpLocked: false, lpLockPct: 0, rugScore: 0, ctScore: 0,
      },
      passed: false, grade: 'F',
      reasons: ['Invalid contract address format'],
      warnings: [],
      recommendation: 'SKIP — Not a valid contract address (EVM/Solana/Sui/Aptos).',
      dataSources: [],
      overallScore: 0,
      rugProbability: 100,
    };
  }

  // If known contract maps to a token in our DB, use real metrics
  const knownInfo = resolveContractName(address);
  if (knownInfo && TOKEN_DB[knownInfo.symbol]) {
    return screenTokenMetrics(TOKEN_DB[knownInfo.symbol]);
  }

  // Derive deterministic pseudo-random values from the address hash
  const hash = Array.from(address).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const abs = Math.abs(hash);
  const rand = (min: number, max: number) => min + (abs % (max - min + 1));
  const randf = (min: number, max: number) => min + ((abs % 10000) / 10000) * (max - min);

  // Try to resolve actual token name from known contracts
  const knownToken = resolveContractName(address);
  const isMoveModule = /^0x[a-fA-F0-9]{1,4}::.+::.+$/.test(address);
  const shortAddr = isMoveModule
    ? address
    : chain === 'solana'
      ? address.slice(0, 4) + '..' + address.slice(-4)
      : '0x' + address.slice(2, 6) + '..' + address.slice(-4);
  const symbol = knownToken?.symbol ?? (isMoveModule ? address.split('::').pop()! : address.slice(chain === 'solana' ? 0 : 2, chain === 'solana' ? 6 : 8).toUpperCase());

  const ageMinutes = rand(5, 14400);
  const volume24h = randf(500, 8_000_000);
  const liquidity = randf(200, 1_200_000);
  const marketCap = randf(5000, 120_000_000);
  const price = randf(0.0000001, 2.5);
  const holders = rand(10, 50000);
  const topHolderPct = randf(0.5, 45);
  const lpLocked = abs % 3 !== 0; // 2/3 chance LP is locked
  const lpLockPct = lpLocked ? rand(40, 99) : 0;
  const rugScore = rand(5, 98);
  const ctScore = rand(5, 95);

  const token: TokenMetrics = {
    symbol,
    name: knownToken?.name ?? `${shortAddr}`,
    chain: knownToken?.chain ?? chain,
    price,
    priceChange5m: randf(-15, 25),
    priceChange1h: randf(-30, 80),
    priceChange24h: randf(-50, 300),
    volume24h,
    marketCap,
    liquidity,
    ageMinutes,
    holders,
    topHolderPct,
    lpLocked,
    lpLockPct,
    rugScore,
    ctScore,
  };

  // Run through standard screening logic
  return screenTokenMetrics(token);
}

// ─── Token Screener (War Agent Logic) ────────────────────────────────

const SCREENING_THRESHOLDS = {
  minAge: 30,           // minutes
  minVolume: 25_000,    // USD 24h
  minLiquidity: 10_000, // USD
  maxTopHolder: 15,     // %
  minRugScore: 50,
  minMomentum5m: -5,    // % (allow small dips)
};

/** Core screening logic — shared by symbol lookup and contract address lookup */
function screenTokenMetrics(token: TokenMetrics): ScreeningResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Age check
  if (token.ageMinutes < SCREENING_THRESHOLDS.minAge) {
    reasons.push(`Too new: ${token.ageMinutes}min old (min ${SCREENING_THRESHOLDS.minAge}min)`);
    score -= 30;
  } else if (token.ageMinutes < 120) {
    warnings.push(`Young token: ${token.ageMinutes}min — monitor closely`);
    score -= 10;
  }

  // Volume check
  if (token.volume24h < SCREENING_THRESHOLDS.minVolume) {
    reasons.push(`Low volume: $${fmt(token.volume24h)} (min $${fmt(SCREENING_THRESHOLDS.minVolume)})`);
    score -= 25;
  }

  // Liquidity check
  if (token.liquidity < SCREENING_THRESHOLDS.minLiquidity) {
    reasons.push(`Thin liquidity: $${fmt(token.liquidity)} (min $${fmt(SCREENING_THRESHOLDS.minLiquidity)})`);
    score -= 25;
  }

  // Holder concentration
  if (token.topHolderPct > SCREENING_THRESHOLDS.maxTopHolder) {
    reasons.push(`Top holder owns ${token.topHolderPct.toFixed(1)}% — whale dump risk`);
    score -= 20;
  } else if (token.topHolderPct > 8) {
    warnings.push(`Top holder: ${token.topHolderPct.toFixed(1)}% — moderate concentration`);
    score -= 5;
  }

  // Rug score
  if (token.rugScore < SCREENING_THRESHOLDS.minRugScore) {
    reasons.push(`RugCheck score: ${token.rugScore}/100 — unsafe`);
    score -= 30;
  } else if (token.rugScore < 70) {
    warnings.push(`RugCheck: ${token.rugScore}/100 — proceed with caution`);
    score -= 10;
  }

  // LP lock
  if (!token.lpLocked) {
    reasons.push('LP not locked — rug pull risk');
    score -= 25;
  } else if (token.lpLockPct < 80) {
    warnings.push(`Only ${token.lpLockPct}% LP locked`);
    score -= 10;
  }

  // Momentum
  if (token.priceChange5m < SCREENING_THRESHOLDS.minMomentum5m) {
    warnings.push(`Negative 5m momentum: ${token.priceChange5m.toFixed(1)}%`);
    score -= 10;
  }

  const passed = score >= 60;
  const grade: ScreeningResult['grade'] =
    score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';

  let recommendation: string;
  if (grade === 'A') recommendation = `BUY — Strong fundamentals. CT score ${token.ctScore}/100.`;
  else if (grade === 'B') recommendation = `BUY with caution — Set tight stop-loss (-15%).`;
  else if (grade === 'C') recommendation = `RISKY — Small position only ($50 max), tight SL.`;
  else if (grade === 'D') recommendation = `AVOID — Multiple red flags detected.`;
  else recommendation = `DO NOT BUY — Failed safety screening.`;

  // Build data source attribution (simulated multi-source checks)
  const dataSources: DataSource[] = [
    {
      name: 'Photon',
      metric: 'Bundle check + LP analysis',
      value: token.lpLocked ? `LP ${token.lpLockPct}% locked, no bundled buys` : 'LP UNLOCKED — bundled sells detected',
      verdict: token.lpLocked && token.lpLockPct >= 80 ? 'safe' : token.lpLocked ? 'warn' : 'danger',
    },
    {
      name: 'Axiom',
      metric: 'Smart money flow',
      value: token.volume24h > 1_000_000
        ? `${Math.floor(token.volume24h / 500_000)} smart wallets accumulated`
        : token.volume24h > 100_000
          ? 'Moderate smart money interest'
          : 'No smart money detected',
      verdict: token.volume24h > 1_000_000 ? 'safe' : token.volume24h > 100_000 ? 'warn' : 'danger',
    },
    {
      name: 'FOMO',
      metric: 'Social sentiment + trending',
      value: `CT Score: ${token.ctScore}/100 | ${token.ctScore > 75 ? 'Trending' : token.ctScore > 50 ? 'Rising mentions' : 'Low visibility'}`,
      verdict: token.ctScore > 75 ? 'safe' : token.ctScore > 50 ? 'warn' : 'danger',
    },
    {
      name: 'RugCheck',
      metric: 'Contract safety audit',
      value: `Score ${token.rugScore}/100 | Top holder ${token.topHolderPct.toFixed(1)}%`,
      verdict: token.rugScore >= 80 ? 'safe' : token.rugScore >= 50 ? 'warn' : 'danger',
    },
    {
      name: 'DexScreener',
      metric: 'Liquidity + volume profile',
      value: `Liq: ${fmt(token.liquidity)} | Vol/MCap: ${(token.volume24h / Math.max(token.marketCap, 1) * 100).toFixed(1)}%`,
      verdict: token.liquidity > 100_000 ? 'safe' : token.liquidity > 10_000 ? 'warn' : 'danger',
    },
  ];

  const rugProbability = Math.max(0, Math.min(100, 100 - score));
  const overallScore = Math.max(20, Math.min(98, score + Math.floor((token.holders + token.volume24h / 10000) % 15)));

  return { token, passed, grade, reasons, warnings, recommendation, dataSources, overallScore, rugProbability };
}

export function screenToken(symbol: string): ScreeningResult {
  const upper = symbol.toUpperCase().replace('-PERP', '');
  const token = TOKEN_DB[upper] ?? PERP_DB[upper];

  if (!token) {
    return {
      token: { symbol: upper, name: upper, chain: 'solana', price: 0, priceChange5m: 0, priceChange1h: 0, priceChange24h: 0, volume24h: 0, marketCap: 0, liquidity: 0, ageMinutes: 0, holders: 0, topHolderPct: 100, lpLocked: false, lpLockPct: 0, rugScore: 0, ctScore: 0 },
      passed: false, grade: 'F',
      reasons: ['Token not found in database — unable to verify on-chain data'],
      warnings: ['Unknown token — high risk'],
      recommendation: 'SKIP — Cannot verify token safety. Provide a valid contract address.',
      dataSources: [],
      overallScore: 0,
      rugProbability: 100,
    };
  }

  return screenTokenMetrics(token);
}

// ─── Live Screening (Real API Data) ──────────────────────────────────

import { fetchLiveTokenBySymbol, fetchLiveTokenByAddress } from './liveData';

/** Screen a token using live DexScreener + RugCheck/GoPlus data */
export async function screenTokenLive(symbol: string): Promise<ScreeningResult> {
  const upper = symbol.toUpperCase().replace('-PERP', '');

  // Perps always use static data (no DEX pairs to look up)
  if (PERP_DB[upper]) return screenTokenMetrics(PERP_DB[upper]);

  try {
    const liveData = await fetchLiveTokenBySymbol(upper);
    if (liveData) {
      console.log(`[LIVE] ${upper}: $${liveData.price} (24h: ${liveData.priceChange24h}%)`);
      return screenTokenMetrics(liveData);
    }
    console.warn(`[LIVE] No data for ${upper}, falling back to static`);
  } catch (e) {
    console.error(`[LIVE] API error for ${upper}:`, e);
  }

  const fallback = TOKEN_DB[upper];
  if (fallback) return screenTokenMetrics(fallback);
  return screenToken(upper);
}

/** Screen a contract address using live API data */
export async function screenByAddressLive(
  address: string,
  hintChain?: Chain
): Promise<ScreeningResult> {
  const chain = detectChainFromAddress(address, hintChain);

  const liveData = await fetchLiveTokenByAddress(address, chain ?? undefined);
  if (!liveData) {
    // Fall back to static screening
    return screenByAddress(address, hintChain);
  }

  return screenTokenMetrics(liveData);
}

/** Get live token price from DexScreener */
export async function getTokenPriceLive(symbol: string): Promise<TokenMetrics | null> {
  const upper = symbol.toUpperCase().replace('-PERP', '');
  if (PERP_DB[upper]) return PERP_DB[upper];
  const live = await fetchLiveTokenBySymbol(upper);
  return live ?? TOKEN_DB[upper] ?? null;
}

// ─── Position Manager ────────────────────────────────────────────────

let positions: Position[] = [];
let tradeHistory: TradeRecord[] = [];
let nextId = 1;

function buildExitStrategies(isMeme: boolean, isPerp: boolean): ExitStrategy[] {
  if (isPerp) {
    return [
      { type: 'stop_loss', label: 'Stop Loss', triggerPct: -8, active: true, triggered: false },
      { type: 'take_profit', label: 'Take Profit', triggerPct: 15, active: true, triggered: false },
      { type: 'trailing_stop', label: 'Trailing Stop', triggerPct: -6, active: true, triggered: false },
    ];
  }
  if (isMeme) {
    return [
      { type: 'micro_stop', label: 'Micro Stop (30s)', triggerPct: -25, active: true, triggered: false },
      { type: 'ladder', label: 'Ladder Exit (2.5x)', triggerPct: 150, sellPct: 40, active: true, triggered: false },
      { type: 'trailing_stop', label: 'Trailing Stop', triggerPct: -30, active: true, triggered: false },
      { type: 'time_stop', label: 'Time Stop (5min)', triggerPct: 10, active: true, triggered: false },
    ];
  }
  // Blue chip
  return [
    { type: 'stop_loss', label: 'Stop Loss', triggerPct: -5, active: true, triggered: false },
    { type: 'take_profit', label: 'Take Profit', triggerPct: 20, active: true, triggered: false },
    { type: 'trailing_stop', label: 'Trailing Stop', triggerPct: -8, active: true, triggered: false },
  ];
}

function getDex(chain: string): string {
  return CHAIN_CONFIG[chain as Chain]?.dex ?? 'Best DEX';
}

const MEME_TOKENS = new Set(['FARTCOIN', 'POPCAT', 'MYRO', 'GIGA', 'BONK', 'WIF', 'MEW', 'MOG', 'DEGEN', 'TOSHI', 'BRETT', 'PEPE']);
const PERP_TOKENS = new Set(['TSLA', 'NVDA', 'AAPL', 'AMZN', 'MSFT', 'GOOGL', 'META']);

export function openPosition(symbol: string, sizeUsd: number, leverage = 1, side: 'long' | 'short' = 'long'): Position {
  const upper = symbol.toUpperCase().replace('-PERP', '');
  const isPerp = PERP_TOKENS.has(upper);
  const isMeme = MEME_TOKENS.has(upper);
  const token = TOKEN_DB[upper] ?? PERP_DB[upper];
  const price = token?.price ?? 1;
  const chain = token?.chain ?? 'solana';

  const position: Position = {
    id: `pos_${nextId++}`,
    symbol: isPerp ? `${upper}-PERP` : upper,
    chain,
    side,
    entryPrice: price,
    currentPrice: price,
    size: sizeUsd,
    quantity: sizeUsd / price,
    leverage,
    pnl: 0,
    pnlPct: 0,
    entryTime: Date.now(),
    highWaterMark: price,
    exitStrategies: buildExitStrategies(isMeme, isPerp),
    status: 'open',
    dex: getDex(chain),
  };

  positions.push(position);

  tradeHistory.push({
    id: `t_${Date.now()}`,
    symbol: position.symbol,
    chain,
    side: 'buy',
    price,
    quantity: position.quantity,
    usdValue: sizeUsd,
    time: Date.now(),
    reason: `Market ${side} via ${position.dex}`,
  });

  return position;
}

export function closePosition(positionId: string, reason: string, exitType?: ExitType): TradeRecord | null {
  const pos = positions.find(p => p.id === positionId);
  if (!pos || pos.status === 'closed') return null;

  pos.status = 'closed';
  const record: TradeRecord = {
    id: `t_${Date.now()}`,
    symbol: pos.symbol,
    chain: pos.chain,
    side: 'sell',
    price: pos.currentPrice,
    quantity: pos.quantity,
    usdValue: pos.size + pos.pnl,
    time: Date.now(),
    reason,
    exitType,
  };
  tradeHistory.push(record);
  return record;
}

export function getOpenPositions(): Position[] {
  return positions.filter(p => p.status !== 'closed');
}

export function getTradeHistory(): TradeRecord[] {
  return [...tradeHistory].reverse();
}

export function getPortfolioStats() {
  const open = getOpenPositions();
  const totalValue = open.reduce((s, p) => s + p.size + p.pnl, 0);
  const totalPnl = open.reduce((s, p) => s + p.pnl, 0);
  const closed = tradeHistory.filter(t => t.side === 'sell');
  const wins = closed.filter(t => (t.usdValue - (positions.find(p => p.symbol === t.symbol)?.size ?? t.usdValue)) > 0);
  return {
    openPositions: open.length,
    totalValue: totalValue || 9500,
    totalPnl: totalPnl || 652,
    winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 74,
    totalTrades: tradeHistory.length || 38,
  };
}

// ─── Price Feed ──────────────────────────────────────────────────────

export function getTokenPrice(symbol: string): TokenMetrics | null {
  const upper = symbol.toUpperCase().replace('-PERP', '');
  return TOKEN_DB[upper] ?? PERP_DB[upper] ?? null;
}

export function getTokensByChain(chain: string): TokenMetrics[] {
  const db = { ...TOKEN_DB, ...PERP_DB };
  return Object.values(db).filter(t => t.chain === chain);
}

export function getTrendingTokens(): TokenMetrics[] {
  return Object.values(TOKEN_DB)
    .filter(t => t.priceChange24h > 15 && t.ctScore > 65)
    .sort((a, b) => b.priceChange24h - a.priceChange24h)
    .slice(0, 8);
}

export function getHotSnipes(): TokenMetrics[] {
  return Object.values(TOKEN_DB)
    .filter(t => t.marketCap < 50_000_000 && t.priceChange24h > 30 && t.rugScore >= 70)
    .sort((a, b) => b.priceChange24h - a.priceChange24h);
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

export function formatUsd(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) >= 1) return `$${n.toFixed(2)}`;
  if (Math.abs(n) >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

export function formatPrice(n: number): string {
  if (n >= 1) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 0.0001) return `$${n.toFixed(6)}`;
  return `$${n.toExponential(2)}`;
}

export { MEME_TOKENS, PERP_TOKENS, fmt, CONTRACT_DB, screenTokenMetrics };
