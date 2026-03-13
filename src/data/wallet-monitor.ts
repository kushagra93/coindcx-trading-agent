import { createChildLogger } from '../core/logger.js';

const log = createChildLogger('wallet-monitor');

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
      params: [wallet, { limit: 5 }],
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

  for (const tx of txData) {
    const swaps = parseSwaps(tx, wallet);
    for (const swap of swaps) {
      log.info({ wallet: wallet.slice(0, 6), token: swap.tokenSymbol, side: swap.side, sol: swap.amountSol }, 'Swap detected');
      swapCallback?.(swap);
    }
  }
}

function parseSwaps(tx: any, walletAddress: string): SwapEvent[] {
  const events: SwapEvent[] = [];
  if (!tx || tx.type !== 'SWAP') return events;

  const swapInfo = tx.events?.swap;
  if (!swapInfo) {
    // Try tokenTransfers-based detection
    return parseFromTransfers(tx, walletAddress);
  }

  const nativeIn = swapInfo.nativeInput;
  const nativeOut = swapInfo.nativeOutput;
  const tokenIn = swapInfo.tokenInputs?.[0];
  const tokenOut = swapInfo.tokenOutputs?.[0];

  // Buy: SOL in, Token out
  if (nativeIn && nativeIn.amount > 0 && tokenOut) {
    const solAmount = nativeIn.amount / 1e9;
    events.push({
      walletAddress,
      signature: tx.signature,
      side: 'buy',
      tokenAddress: tokenOut.mint,
      tokenSymbol: tokenOut.tokenStandard === 'Fungible' ? (tokenOut.symbol || tokenOut.mint.slice(0, 6)) : tokenOut.mint.slice(0, 6),
      amountSol: solAmount,
      amountUsd: solAmount * 130, // rough SOL price estimate
      timestamp: tx.timestamp * 1000,
      source: tx.source || 'unknown',
    });
  }

  // Sell: Token in, SOL out
  if (tokenIn && nativeOut && nativeOut.amount > 0) {
    const solAmount = nativeOut.amount / 1e9;
    events.push({
      walletAddress,
      signature: tx.signature,
      side: 'sell',
      tokenAddress: tokenIn.mint,
      tokenSymbol: tokenIn.tokenStandard === 'Fungible' ? (tokenIn.symbol || tokenIn.mint.slice(0, 6)) : tokenIn.mint.slice(0, 6),
      amountSol: solAmount,
      amountUsd: solAmount * 130,
      timestamp: tx.timestamp * 1000,
      source: tx.source || 'unknown',
    });
  }

  return events;
}

function parseFromTransfers(tx: any, walletAddress: string): SwapEvent[] {
  const events: SwapEvent[] = [];
  const transfers = tx.tokenTransfers ?? [];
  const nativeTransfers = tx.nativeTransfers ?? [];

  // SOL spent by this wallet
  const solOut = nativeTransfers
    .filter((t: any) => t.fromUserAccount === walletAddress)
    .reduce((s: number, t: any) => s + (t.amount ?? 0), 0) / 1e9;

  // SOL received by this wallet
  const solIn = nativeTransfers
    .filter((t: any) => t.toUserAccount === walletAddress)
    .reduce((s: number, t: any) => s + (t.amount ?? 0), 0) / 1e9;

  // Tokens received (buy)
  const tokensReceived = transfers.filter((t: any) => t.toUserAccount === walletAddress && t.mint);
  // Tokens sent (sell)
  const tokensSent = transfers.filter((t: any) => t.fromUserAccount === walletAddress && t.mint);

  if (solOut > 0.001 && tokensReceived.length > 0) {
    const token = tokensReceived[0];
    events.push({
      walletAddress,
      signature: tx.signature,
      side: 'buy',
      tokenAddress: token.mint,
      tokenSymbol: token.mint.slice(0, 6),
      amountSol: solOut,
      amountUsd: solOut * 130,
      timestamp: (tx.timestamp ?? Date.now() / 1000) * 1000,
      source: tx.source || 'unknown',
    });
  }

  if (solIn > 0.001 && tokensSent.length > 0) {
    const token = tokensSent[0];
    events.push({
      walletAddress,
      signature: tx.signature,
      side: 'sell',
      tokenAddress: token.mint,
      tokenSymbol: token.mint.slice(0, 6),
      amountSol: solIn,
      amountUsd: solIn * 130,
      timestamp: (tx.timestamp ?? Date.now() / 1000) * 1000,
      source: tx.source || 'unknown',
    });
  }

  return events;
}
