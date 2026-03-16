import { createChildLogger } from '../core/logger.js';

const log = createChildLogger('wallet-monitor');

const KNOWN_MINTS: Record<string, string> = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
  '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN': 'TRUMP',
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
  'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE': 'ORCA',
  'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof': 'RENDER',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'PYTH',
  'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'JITO',
  '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ': 'W',
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'MSOL',
};

function resolveSymbol(mint: string, heliusSymbol?: string): string {
  if (KNOWN_MINTS[mint]) return KNOWN_MINTS[mint];
  if (heliusSymbol && heliusSymbol.length > 0 && heliusSymbol.length < 12) return heliusSymbol;
  return mint.slice(0, 6);
}

export interface SwapEvent {
  walletAddress: string;
  signature: string;
  side: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  amountSol: number;
  amountUsd: number;
  timestamp: number;
  source: string; // jupiter, raydium, pump, etc.
}

type SwapCallback = (event: SwapEvent) => void;

const HELIUS_ENHANCED_TX_URL = 'https://api.helius.xyz/v0/transactions';

const STABLECOIN_MINTS_SET = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

let cachedSolPrice = 94;
let solPriceLastFetched = 0;

async function getSolPrice(): Promise<number> {
  if (Date.now() - solPriceLastFetched < 60_000) return cachedSolPrice;
  try {
    const res = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
    if (res.ok) {
      const data = await res.json() as any;
      const price = parseFloat(data?.data?.['So11111111111111111111111111111111111111112']?.price);
      if (price > 0) { cachedSolPrice = price; solPriceLastFetched = Date.now(); }
    }
  } catch { /* use cached */ }
  return cachedSolPrice;
}

const watchedWallets = new Set<string>();
const lastSignatures = new Map<string, string>();
let pollInterval: ReturnType<typeof setInterval> | null = null;
let swapCallback: SwapCallback | null = null;

export function onSwapDetected(cb: SwapCallback) {
  swapCallback = cb;
}

export function addWallet(address: string) {
  watchedWallets.add(address);
  if (!pollInterval) startPolling();
  log.info({ address, total: watchedWallets.size }, 'Watching wallet');
}

export function removeWallet(address: string) {
  watchedWallets.delete(address);
  lastSignatures.delete(address);
  if (watchedWallets.size === 0 && pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  log.info({ address, total: watchedWallets.size }, 'Stopped watching wallet');
}

export function getWatchedWallets(): string[] {
  return Array.from(watchedWallets);
}

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(() => pollAllWallets(), 15_000);
  log.info('Wallet monitor polling started (15s interval)');
  // Run immediately on start
  pollAllWallets();
}

async function pollAllWallets() {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey || watchedWallets.size === 0) return;

  for (const wallet of watchedWallets) {
    try {
      await pollWallet(wallet, apiKey);
    } catch (err) {
      log.warn({ err, wallet }, 'Failed to poll wallet');
    }
  }
}

async function pollWallet(wallet: string, apiKey: string) {
  // Get recent signatures
  const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSignaturesForAddress',
      params: [wallet, { limit: 25 }],
    }),
  });

  if (!res.ok) return;
  const data = await res.json() as any;
  const sigs: Array<{ signature: string; blockTime: number }> = data.result ?? [];

  if (sigs.length === 0) return;

  const lastKnown = lastSignatures.get(wallet);
  lastSignatures.set(wallet, sigs[0].signature);

  // On first poll, just record the latest signature without processing
  if (!lastKnown) return;
  if (sigs[0].signature === lastKnown) return;

  // Collect new signatures (up to the last known)
  const newSigs = [];
  for (const s of sigs) {
    if (s.signature === lastKnown) break;
    newSigs.push(s.signature);
  }

  if (newSigs.length === 0) return;

  // Parse new transactions via Helius enhanced API
  const txRes = await fetch(`${HELIUS_ENHANCED_TX_URL}?api-key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: newSigs }),
  });

  if (!txRes.ok) return;
  const txData = await txRes.json() as any[];

  const solPrice = await getSolPrice();
  for (const tx of txData) {
    const swaps = parseSwaps(tx, wallet, solPrice);
    for (const swap of swaps) {
      log.info({ wallet: wallet.slice(0, 6), token: swap.tokenSymbol, side: swap.side, sol: swap.amountSol, usd: swap.amountUsd.toFixed(2) }, 'Swap detected');
      swapCallback?.(swap);
    }
  }
}

function parseSwaps(tx: any, walletAddress: string, solPrice: number): SwapEvent[] {
  const events: SwapEvent[] = [];
  if (!tx || tx.type !== 'SWAP') return events;

  const swapInfo = tx.events?.swap;
  if (!swapInfo) {
    return parseFromTransfers(tx, walletAddress, solPrice);
  }

  const nativeIn = swapInfo.nativeInput;
  const nativeOut = swapInfo.nativeOutput;
  const tokenIn = swapInfo.tokenInputs?.[0];
  const tokenOut = swapInfo.tokenOutputs?.[0];

  // Case 1: SOL in → Token out (buy with SOL)
  if (nativeIn && nativeIn.amount > 0 && tokenOut) {
    const solAmount = nativeIn.amount / 1e9;
    events.push({
      walletAddress, signature: tx.signature, side: 'buy',
      tokenAddress: tokenOut.mint,
      tokenSymbol: resolveSymbol(tokenOut.mint, tokenOut.symbol),
      amountSol: solAmount, amountUsd: solAmount * solPrice,
      timestamp: tx.timestamp * 1000, source: tx.source || 'unknown',
    });
  }

  // Case 2: Token in → SOL out (sell for SOL)
  if (tokenIn && nativeOut && nativeOut.amount > 0) {
    const solAmount = nativeOut.amount / 1e9;
    events.push({
      walletAddress, signature: tx.signature, side: 'sell',
      tokenAddress: tokenIn.mint,
      tokenSymbol: resolveSymbol(tokenIn.mint, tokenIn.symbol),
      amountSol: solAmount, amountUsd: solAmount * solPrice,
      timestamp: tx.timestamp * 1000, source: tx.source || 'unknown',
    });
  }

  // Case 3: Token-to-token swap (e.g. USDC → Token or Token → USDC)
  if (events.length === 0 && tokenIn && tokenOut) {
    const inIsStable = STABLECOIN_MINTS_SET.has(tokenIn.mint);
    const outIsStable = STABLECOIN_MINTS_SET.has(tokenOut.mint);

    if (inIsStable && !outIsStable) {
      // Stablecoin → Token = buy
      const usdAmount = parseFloat(tokenIn.tokenAmount ?? tokenIn.rawTokenAmount?.tokenAmount ?? '0') / (10 ** (tokenIn.decimals ?? 6));
      events.push({
        walletAddress, signature: tx.signature, side: 'buy',
        tokenAddress: tokenOut.mint,
        tokenSymbol: resolveSymbol(tokenOut.mint, tokenOut.symbol),
        amountSol: usdAmount / solPrice, amountUsd: usdAmount,
        timestamp: tx.timestamp * 1000, source: tx.source || 'unknown',
      });
    } else if (outIsStable && !inIsStable) {
      // Token → Stablecoin = sell
      const usdAmount = parseFloat(tokenOut.tokenAmount ?? tokenOut.rawTokenAmount?.tokenAmount ?? '0') / (10 ** (tokenOut.decimals ?? 6));
      events.push({
        walletAddress, signature: tx.signature, side: 'sell',
        tokenAddress: tokenIn.mint,
        tokenSymbol: resolveSymbol(tokenIn.mint, tokenIn.symbol),
        amountSol: usdAmount / solPrice, amountUsd: usdAmount,
        timestamp: tx.timestamp * 1000, source: tx.source || 'unknown',
      });
    } else if (!inIsStable && !outIsStable) {
      // Token → Token (treat as buy of output token, estimate via Jupiter later)
      events.push({
        walletAddress, signature: tx.signature, side: 'buy',
        tokenAddress: tokenOut.mint,
        tokenSymbol: resolveSymbol(tokenOut.mint, tokenOut.symbol),
        amountSol: 0, amountUsd: 1, // fallback $1 estimate for token-to-token
        timestamp: tx.timestamp * 1000, source: tx.source || 'unknown',
      });
    }
  }

  return events;
}

function parseFromTransfers(tx: any, walletAddress: string, solPrice: number): SwapEvent[] {
  const events: SwapEvent[] = [];
  const transfers = tx.tokenTransfers ?? [];
  const nativeTransfers = tx.nativeTransfers ?? [];

  const solOut = nativeTransfers
    .filter((t: any) => t.fromUserAccount === walletAddress)
    .reduce((s: number, t: any) => s + (t.amount ?? 0), 0) / 1e9;

  const solIn = nativeTransfers
    .filter((t: any) => t.toUserAccount === walletAddress)
    .reduce((s: number, t: any) => s + (t.amount ?? 0), 0) / 1e9;

  const tokensReceived = transfers.filter((t: any) => t.toUserAccount === walletAddress && t.mint);
  const tokensSent = transfers.filter((t: any) => t.fromUserAccount === walletAddress && t.mint);

  // SOL-based buys
  if (solOut > 0.001 && tokensReceived.length > 0) {
    const nonStableReceived = tokensReceived.filter((t: any) => !STABLECOIN_MINTS_SET.has(t.mint));
    const token = nonStableReceived[0] || tokensReceived[0];
    events.push({
      walletAddress, signature: tx.signature, side: 'buy',
      tokenAddress: token.mint,
      tokenSymbol: resolveSymbol(token.mint, token.symbol),
      amountSol: solOut, amountUsd: solOut * solPrice,
      timestamp: (tx.timestamp ?? Date.now() / 1000) * 1000, source: tx.source || 'unknown',
    });
  }

  // SOL-based sells
  if (solIn > 0.001 && tokensSent.length > 0) {
    const nonStableSent = tokensSent.filter((t: any) => !STABLECOIN_MINTS_SET.has(t.mint));
    const token = nonStableSent[0] || tokensSent[0];
    events.push({
      walletAddress, signature: tx.signature, side: 'sell',
      tokenAddress: token.mint,
      tokenSymbol: resolveSymbol(token.mint, token.symbol),
      amountSol: solIn, amountUsd: solIn * solPrice,
      timestamp: (tx.timestamp ?? Date.now() / 1000) * 1000, source: tx.source || 'unknown',
    });
  }

  // Stablecoin-based swaps (no SOL involved)
  if (events.length === 0) {
    const stableSent = tokensSent.filter((t: any) => STABLECOIN_MINTS_SET.has(t.mint));
    const stableReceived = tokensReceived.filter((t: any) => STABLECOIN_MINTS_SET.has(t.mint));
    const nonStableReceived = tokensReceived.filter((t: any) => !STABLECOIN_MINTS_SET.has(t.mint));
    const nonStableSent = tokensSent.filter((t: any) => !STABLECOIN_MINTS_SET.has(t.mint));

    if (stableSent.length > 0 && nonStableReceived.length > 0) {
      const usdAmount = parseFloat(stableSent[0].tokenAmount ?? '0');
      const token = nonStableReceived[0];
      events.push({
        walletAddress, signature: tx.signature, side: 'buy',
        tokenAddress: token.mint,
        tokenSymbol: resolveSymbol(token.mint, token.symbol),
        amountSol: usdAmount / solPrice, amountUsd: usdAmount,
        timestamp: (tx.timestamp ?? Date.now() / 1000) * 1000, source: tx.source || 'unknown',
      });
    }

    if (stableReceived.length > 0 && nonStableSent.length > 0) {
      const usdAmount = parseFloat(stableReceived[0].tokenAmount ?? '0');
      const token = nonStableSent[0];
      events.push({
        walletAddress, signature: tx.signature, side: 'sell',
        tokenAddress: token.mint,
        tokenSymbol: resolveSymbol(token.mint, token.symbol),
        amountSol: usdAmount / solPrice, amountUsd: usdAmount,
        timestamp: (tx.timestamp ?? Date.now() / 1000) * 1000, source: tx.source || 'unknown',
      });
    }
  }

  return events;
}
