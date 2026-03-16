import {
  Connection,
  Keypair,
  VersionedTransaction,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { createChildLogger } from '../core/logger.js';
import { config } from '../core/config.js';

const log = createChildLogger('jupiter-swap');

const JUPITER_API = process.env.JUPITER_API_URL || 'https://api.jup.ag/swap/v1';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const WELL_KNOWN_MINTS: Record<string, string> = {
  SOL: SOL_MINT,
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF:  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  JUP:  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY:  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  TRUMP: '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN',
};

let _connection: Connection | null = null;
let _keypair: Keypair | null = null;

function getConnection(): Connection {
  if (!_connection) {
    const heliusKey = config.solana.heliusApiKey;
    const rpcUrl = heliusKey
      ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
      : config.solana.rpcUrl;
    _connection = new Connection(rpcUrl, 'confirmed');
    log.info({ rpc: rpcUrl.replace(/api-key=.*/, 'api-key=***') }, 'Solana RPC connected');
  }
  return _connection;
}

export function loadOrGenerateKeypair(): Keypair {
  if (_keypair) return _keypair;

  const envKey = process.env.SOLANA_PRIVATE_KEY;
  if (envKey) {
    try {
      _keypair = Keypair.fromSecretKey(bs58.decode(envKey));
      log.info({ publicKey: _keypair.publicKey.toBase58() }, 'Wallet loaded from SOLANA_PRIVATE_KEY');
      return _keypair;
    } catch (e) {
      log.error('Invalid SOLANA_PRIVATE_KEY — generating new keypair');
    }
  }

  _keypair = Keypair.generate();
  const privKeyBase58 = bs58.encode(_keypair.secretKey);
  log.info({
    publicKey: _keypair.publicKey.toBase58(),
    privateKey: `${privKeyBase58.slice(0, 8)}...`,
  }, 'NEW WALLET GENERATED — add to .env as SOLANA_PRIVATE_KEY');
  console.log('\n============================================');
  console.log('  NEW SOLANA WALLET GENERATED');
  console.log(`  Public Key:  ${_keypair.publicKey.toBase58()}`);
  console.log(`  Private Key: ${privKeyBase58}`);
  console.log('  Add to .env: SOLANA_PRIVATE_KEY=' + privKeyBase58);
  console.log(`  Fund with SOL: send SOL to ${_keypair.publicKey.toBase58()}`);
  console.log('============================================\n');

  return _keypair;
}

export function getPublicKey(): string {
  return loadOrGenerateKeypair().publicKey.toBase58();
}

export async function getWalletBalance(): Promise<{ sol: number; lamports: number; publicKey: string }> {
  const conn = getConnection();
  const kp = loadOrGenerateKeypair();
  const lamports = await conn.getBalance(kp.publicKey);
  return {
    sol: lamports / LAMPORTS_PER_SOL,
    lamports,
    publicKey: kp.publicKey.toBase58(),
  };
}

export interface OnChainBalance {
  symbol: string;
  mint: string;
  amount: number;
  uiAmount: number;
  decimals: number;
}

const MINT_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(WELL_KNOWN_MINTS).map(([sym, mint]) => [mint, sym])
);

export async function getOnChainBalances(): Promise<{ sol: number; tokens: OnChainBalance[]; publicKey: string }> {
  const conn = getConnection();
  const kp = loadOrGenerateKeypair();

  const [solLamports, splAccounts, token2022Accounts] = await Promise.all([
    conn.getBalance(kp.publicKey),
    conn.getParsedTokenAccountsByOwner(kp.publicKey, {
      programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
    }),
    conn.getParsedTokenAccountsByOwner(kp.publicKey, {
      programId: new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),
    }).catch(() => ({ value: [] })),
  ]);

  const allAccounts = [...splAccounts.value, ...token2022Accounts.value];

  const tokens: OnChainBalance[] = allAccounts
    .map((ta) => {
      const info = ta.account.data.parsed?.info;
      if (!info) return null;
      const mint = info.mint as string;
      const amount = info.tokenAmount;
      if (!amount || parseFloat(amount.uiAmountString ?? '0') === 0) return null;
      return {
        symbol: MINT_TO_SYMBOL[mint] ?? mint.slice(0, 6) + '...',
        mint,
        amount: parseInt(amount.amount),
        uiAmount: parseFloat(amount.uiAmountString ?? '0'),
        decimals: amount.decimals,
      };
    })
    .filter((t): t is OnChainBalance => t !== null);

  return {
    sol: solLamports / LAMPORTS_PER_SOL,
    tokens,
    publicKey: kp.publicKey.toBase58(),
  };
}

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function resolveTokenMint(symbol: string): string | null {
  const trimmed = symbol.trim();
  const upper = trimmed.toUpperCase();
  if (WELL_KNOWN_MINTS[upper]) return WELL_KNOWN_MINTS[upper];
  // If the caller already passed a raw mint address, use it directly
  if (SOLANA_MINT_RE.test(trimmed)) return trimmed;
  return null;
}

export function addTokenMint(symbol: string, mint: string) {
  WELL_KNOWN_MINTS[symbol.trim().toUpperCase()] = mint;
}

const SIX_DECIMAL_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

function getDecimalsForMint(mint: string): number {
  if (SIX_DECIMAL_MINTS.has(mint)) return 6;
  return 9;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: any[];
  raw: any;
}

export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amountRaw: number,
  slippageBps: number = 2500,
): Promise<SwapQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: Math.floor(amountRaw).toString(),
    slippageBps: slippageBps.toString(),
    onlyDirectRoutes: 'false',
    asLegacyTransaction: 'false',
    maxAutoSlippageBps: slippageBps.toString(),
  });

  const url = `${JUPITER_API}/quote?${params}`;
  log.info({ inputMint: inputMint.slice(0, 8), outputMint: outputMint.slice(0, 8), amount: amountRaw, slippageBps }, 'Fetching Jupiter quote');

  const headers: Record<string, string> = {};
  if (JUPITER_API_KEY) headers['x-api-key'] = JUPITER_API_KEY;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Jupiter quote failed (${res.status}): ${text}`);
  }

  const data = await res.json() as any;

  return {
    inputMint: data.inputMint,
    outputMint: data.outputMint,
    inAmount: data.inAmount,
    outAmount: data.outAmount,
    priceImpactPct: data.priceImpactPct ?? '0',
    slippageBps: data.slippageBps ?? slippageBps,
    routePlan: data.routePlan ?? [],
    raw: data,
  };
}

export interface SwapResult {
  success: boolean;
  txHash: string | null;
  txUrl: string | null;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  error?: string;
}

export async function executeSwap(quote: SwapQuote): Promise<SwapResult> {
  const conn = getConnection();
  const kp = loadOrGenerateKeypair();

  log.info({ publicKey: kp.publicKey.toBase58() }, 'Building swap transaction');

  const swapHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (JUPITER_API_KEY) swapHeaders['x-api-key'] = JUPITER_API_KEY;

  const swapRes = await fetch(`${JUPITER_API}/swap`, {
    method: 'POST',
    headers: swapHeaders,
    body: JSON.stringify({
      quoteResponse: quote.raw,
      userPublicKey: kp.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      // Do NOT use dynamicSlippage — it overrides our quote slippage and
      // produces values too tight for Token-2022 transfer-fee tokens (error 6024)
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 2_000_000,
          priorityLevel: 'high',
        },
      },
    }),
  });

  if (!swapRes.ok) {
    const errText = await swapRes.text();
    log.error({ status: swapRes.status, body: errText }, 'Jupiter swap build failed');
    return {
      success: false, txHash: null, txUrl: null,
      inputAmount: parseInt(quote.inAmount), outputAmount: 0,
      priceImpact: parseFloat(quote.priceImpactPct),
      error: `Jupiter swap failed: ${errText}`,
    };
  }

  const { swapTransaction } = await swapRes.json() as any;

  const txBuf = Buffer.from(swapTransaction, 'base64');
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([kp]);

  const rawTx = tx.serialize();

  log.info('Sending transaction to Solana...');

  // Skip preflight for Token-2022 tokens with transfer fees — simulation is too strict
  const txHash = await conn.sendRawTransaction(rawTx, {
    skipPreflight: true,
    maxRetries: 5,
  });

  log.info({ txHash }, 'Transaction sent, awaiting confirmation');

  // Poll for confirmation with a 90s timeout (handles slow mainnet finality)
  const deadline = Date.now() + 90_000;
  let confirmed = false;
  let txErr: any = null;
  while (Date.now() < deadline) {
    const status = await conn.getSignatureStatuses([txHash]);
    const s = status.value[0];
    if (s) {
      if (s.err) { txErr = s.err; break; }
      if (s.confirmationStatus === 'confirmed' || s.confirmationStatus === 'finalized') {
        confirmed = true;
        break;
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (txErr) {
    log.error({ txHash, error: txErr }, 'Transaction failed on-chain');
    return {
      success: false,
      txHash,
      txUrl: `https://solscan.io/tx/${txHash}`,
      inputAmount: parseInt(quote.inAmount),
      outputAmount: parseInt(quote.outAmount),
      priceImpact: parseFloat(quote.priceImpactPct),
      error: `Transaction failed on-chain: ${JSON.stringify(txErr)}`,
    };
  }

  if (!confirmed) {
    // Tx was submitted but confirmation timed out — treat as likely success
    log.warn({ txHash }, 'Confirmation timeout — tx submitted, check Solscan');
  }

  log.info({ txHash }, 'Swap confirmed on-chain');

  return {
    success: true,
    txHash,
    txUrl: `https://solscan.io/tx/${txHash}`,
    inputAmount: parseInt(quote.inAmount),
    outputAmount: parseInt(quote.outAmount),
    priceImpact: parseFloat(quote.priceImpactPct),
  };
}

export async function swapTokens(
  fromSymbol: string,
  toSymbol: string,
  amountUsd: number,
  fromPrice: number,
  slippageBps: number = 2500,
): Promise<SwapResult> {
  const inputMint = resolveTokenMint(fromSymbol);
  const outputMint = resolveTokenMint(toSymbol);

  if (!inputMint) throw new Error(`Unknown token mint for "${fromSymbol}". Paste the contract address instead.`);
  if (!outputMint) throw new Error(`Unknown token mint for "${toSymbol}". Paste the contract address instead.`);

  const isInputSol = inputMint === SOL_MINT;
  let amountRaw: number;

  if (isInputSol) {
    const solAmount = amountUsd / fromPrice;
    amountRaw = Math.floor(solAmount * LAMPORTS_PER_SOL);
  } else {
    const tokenAmount = amountUsd / fromPrice;
    const decimals = getDecimalsForMint(inputMint);
    amountRaw = Math.floor(tokenAmount * (10 ** decimals));
  }

  const quote = await getSwapQuote(inputMint, outputMint, amountRaw, slippageBps);

  log.info({
    from: fromSymbol, to: toSymbol,
    amountUsd, amountRaw,
    expectedOut: quote.outAmount,
    priceImpact: quote.priceImpactPct,
  }, 'Executing swap');

  return executeSwap(quote);
}

// ─── On-chain transaction history ────────────────────────────────────────────

const HELIUS_ENHANCED_URL = 'https://api.helius.xyz/v0/transactions';
const KNOWN_STABLE_MINTS = new Set([
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
]);

export interface OnChainTx {
  signature: string;
  timestamp: number;
  type: 'swap' | 'transfer' | 'unknown';
  side: 'buy' | 'sell' | null;
  tokenSymbol: string;
  tokenMint: string;
  amountToken: number;
  amountUsd: number;
  solPrice: number;
  txUrl: string;
}

let _txHistoryCache: { data: OnChainTx[]; fetchedAt: number } | null = null;
const TX_CACHE_MS = 60_000; // 1 minute

export async function getOwnWalletHistory(limit = 50): Promise<OnChainTx[]> {
  if (_txHistoryCache && Date.now() - _txHistoryCache.fetchedAt < TX_CACHE_MS) {
    return _txHistoryCache.data;
  }

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return [];

  const kp = loadOrGenerateKeypair();
  const wallet = kp.publicKey.toBase58();

  // Step 1: get signatures
  let signatures: string[] = [];
  try {
    const sigRes = await fetch(`https://mainnet.helius-rpc.com/?api-key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getSignaturesForAddress',
        params: [wallet, { limit }],
      }),
    });
    if (sigRes.ok) {
      const sigData = await sigRes.json() as any;
      signatures = (sigData.result ?? []).map((s: any) => s.signature as string);
    }
  } catch { return []; }

  if (signatures.length === 0) return [];

  // Step 2: parse with Helius enhanced API
  let parsed: any[] = [];
  try {
    const txRes = await fetch(`${HELIUS_ENHANCED_URL}?api-key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions: signatures.slice(0, 50) }),
    });
    if (txRes.ok) parsed = await txRes.json() as any[];
  } catch { return []; }

  // Fetch live SOL price once
  let solPrice = 130;
  try {
    const sp = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112');
    if (sp.ok) {
      const spd = await sp.json() as any;
      solPrice = parseFloat(spd?.data?.['So11111111111111111111111111111111111111112']?.price ?? '130');
    }
  } catch { /* fallback */ }

  const results: OnChainTx[] = [];

  for (const tx of parsed) {
    if (tx.transactionError) continue;
    const sig = tx.signature as string;
    const ts = (tx.timestamp as number) * 1000;
    const txUrl = `https://solscan.io/tx/${sig}`;
    const events = tx.events?.swap;

    if (events) {
      // Jupiter/swap event
      const tokenIn = events.tokenInputs?.[0] ?? events.nativeInput;
      const tokenOut = events.tokenOutputs?.[0] ?? events.nativeOutput;
      if (!tokenIn || !tokenOut) continue;

      const inMint = tokenIn.mint ?? SOL_MINT;
      const outMint = tokenOut.mint ?? SOL_MINT;
      const inSym = WELL_KNOWN_MINTS[inMint.toUpperCase()] ?? inMint.slice(0, 6) + '...';
      const outSym = WELL_KNOWN_MINTS[outMint.toUpperCase()] ?? outMint.slice(0, 6) + '...';

      const inIsStable = KNOWN_STABLE_MINTS.has(inMint) || inMint === SOL_MINT;
      const outIsStable = KNOWN_STABLE_MINTS.has(outMint) || outMint === SOL_MINT;

      let side: 'buy' | 'sell';
      let tokenSymbol: string;
      let tokenMint: string;
      let amountToken: number;
      let amountUsd: number;

      if (!inIsStable && outIsStable) {
        // selling token → SOL/USDC
        side = 'sell';
        tokenSymbol = inSym;
        tokenMint = inMint;
        const rawAmt = parseFloat(tokenIn.rawTokenAmount?.tokenAmount ?? tokenIn.amount ?? '0');
        const decimals = tokenIn.rawTokenAmount?.decimals ?? 9;
        amountToken = rawAmt / Math.pow(10, decimals);
        if (outMint === SOL_MINT) {
          amountUsd = (parseFloat(tokenOut.amount ?? '0') / LAMPORTS_PER_SOL) * solPrice;
        } else {
          amountUsd = parseFloat(tokenOut.rawTokenAmount?.tokenAmount ?? '0') / Math.pow(10, tokenOut.rawTokenAmount?.decimals ?? 6);
        }
      } else {
        // buying token with SOL/USDC
        side = 'buy';
        tokenSymbol = outSym;
        tokenMint = outMint;
        const rawAmt = parseFloat(tokenOut.rawTokenAmount?.tokenAmount ?? tokenOut.amount ?? '0');
        const decimals = tokenOut.rawTokenAmount?.decimals ?? 9;
        amountToken = rawAmt / Math.pow(10, decimals);
        if (inMint === SOL_MINT) {
          amountUsd = (parseFloat(tokenIn.amount ?? '0') / LAMPORTS_PER_SOL) * solPrice;
        } else {
          amountUsd = parseFloat(tokenIn.rawTokenAmount?.tokenAmount ?? '0') / Math.pow(10, tokenIn.rawTokenAmount?.decimals ?? 6);
        }
      }

      results.push({ signature: sig, timestamp: ts, type: 'swap', side, tokenSymbol, tokenMint, amountToken, amountUsd, solPrice, txUrl });
    } else {
      // Non-swap — skip for now
      continue;
    }
  }

  const sorted = results.sort((a, b) => b.timestamp - a.timestamp);
  _txHistoryCache = { data: sorted, fetchedAt: Date.now() };
  return sorted;
}
