import WebSocket from 'ws';
import { createChildLogger } from '../core/logger.js';

const log = createChildLogger('wallet-monitor');

const SOL_PRICE_CACHE_MS = 60_000;
let cachedSolPrice = 130;
let lastSolPriceFetch = 0;

async function getSolUsdPrice(): Promise<number> {
  if (Date.now() - lastSolPriceFetch < SOL_PRICE_CACHE_MS) return cachedSolPrice;
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (res.ok) {
      const data = await res.json() as { solana?: { usd?: number } };
      if (data.solana?.usd) {
        cachedSolPrice = data.solana.usd;
        lastSolPriceFetch = Date.now();
      }
    }
  } catch {
    log.warn('Failed to fetch SOL price, using cached value');
  }
  return cachedSolPrice;
}

let heliusWs: WebSocket | null = null;
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null;

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
  if (heliusWs && heliusWs.readyState === WebSocket.OPEN) {
    subscribeWallet(address);
  }
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
  // Start WebSocket as primary
  startHeliusWebSocket();
  // Polling as 30s fallback
  pollInterval = setInterval(() => pollAllWallets(), 30_000);
  log.info('Wallet monitor started (WebSocket primary, 30s poll fallback)');
  pollAllWallets();
}

async function pollAllWallets() {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey || watchedWallets.size === 0) return;

  const solPrice = await getSolUsdPrice();

  for (const wallet of watchedWallets) {
    try {
      await pollWallet(wallet, apiKey, solPrice);
    } catch (err) {
      log.warn({ err, wallet }, 'Failed to poll wallet');
    }
  }
}

async function pollWallet(wallet: string, apiKey: string, solPrice: number) {
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

  for (const tx of txData) {
    const swaps = parseSwaps(tx, wallet, solPrice);
    for (const swap of swaps) {
      log.info({ wallet: wallet.slice(0, 6), token: swap.tokenSymbol, side: swap.side, sol: swap.amountSol }, 'Swap detected');
      swapCallback?.(swap);
    }
  }
}

function parseSwaps(tx: any, walletAddress: string, solPrice: number): SwapEvent[] {
  const events: SwapEvent[] = [];
  if (!tx || tx.type !== 'SWAP') return events;

  const swapInfo = tx.events?.swap;
  if (!swapInfo) {
    // Try tokenTransfers-based detection
    return parseFromTransfers(tx, walletAddress, solPrice);
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
      tokenSymbol: resolveSymbol(tokenOut.mint, tokenOut.symbol),
      amountSol: solAmount,
      amountUsd: solAmount * solPrice,
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
      tokenSymbol: resolveSymbol(tokenIn.mint, tokenIn.symbol),
      amountSol: solAmount,
      amountUsd: solAmount * solPrice,
      timestamp: tx.timestamp * 1000,
      source: tx.source || 'unknown',
    });
  }

  return events;
}

function parseFromTransfers(tx: any, walletAddress: string, solPrice: number): SwapEvent[] {
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
      tokenSymbol: resolveSymbol(token.mint, token.symbol),
      amountSol: solOut,
      amountUsd: solOut * solPrice,
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
      tokenSymbol: resolveSymbol(token.mint, token.symbol),
      amountSol: solIn,
      amountUsd: solIn * solPrice,
      timestamp: (tx.timestamp ?? Date.now() / 1000) * 1000,
      source: tx.source || 'unknown',
    });
  }

  return events;
}

function startHeliusWebSocket() {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey || watchedWallets.size === 0) return;

  const wsUrl = `wss://atlas-mainnet.helius-rpc.com?api-key=${apiKey}`;

  try {
    heliusWs = new WebSocket(wsUrl);

    heliusWs.on('open', () => {
      log.info('Helius WebSocket connected');
      // Subscribe to all watched wallets
      for (const wallet of watchedWallets) {
        subscribeWallet(wallet);
      }
    });

    heliusWs.on('message', (data: unknown) => {
      try {
        const msg = JSON.parse(String(data)) as any;
        if (msg.method === 'accountNotification' && msg.params?.result) {
          const subscription = msg.params.subscription;
          // On notification, poll the specific wallet for details
          const wallet = subscriptionToWallet.get(subscription);
          if (wallet) {
            const apiKey = process.env.HELIUS_API_KEY;
            if (apiKey) {
              void getSolUsdPrice().then(solPrice => pollWallet(wallet, apiKey, solPrice));
            }
          }
        }
      } catch {
        log.warn('Failed to parse Helius WebSocket message');
      }
    });

    heliusWs.on('close', () => {
      log.warn('Helius WebSocket closed — reconnecting in 5s');
      heliusWs = null;
      wsReconnectTimer = setTimeout(() => startHeliusWebSocket(), 5_000);
    });

    heliusWs.on('error', (err: Error) => {
      log.warn({ err }, 'Helius WebSocket error');
    });
  } catch (err) {
    log.warn({ err }, 'Failed to create Helius WebSocket');
  }
}

const subscriptionToWallet = new Map<number, string>();
let subscriptionIdCounter = 1;

function subscribeWallet(wallet: string) {
  if (!heliusWs || heliusWs.readyState !== WebSocket.OPEN) return;

  const id = subscriptionIdCounter++;
  heliusWs.send(JSON.stringify({
    jsonrpc: '2.0',
    id,
    method: 'accountSubscribe',
    params: [wallet, { encoding: 'jsonParsed' }],
  }));

  // We'll map subscription ID when we get the response
  // For simplicity, map using the request id
  subscriptionToWallet.set(id, wallet);
}
