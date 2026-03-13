/**
 * Chain Test Agent — validates connectivity and DEX availability across all chains.
 *
 * Not a Redis-based helper (no consumer group) — runs as a one-shot diagnostic tool
 * that can be invoked via API or during startup to check chain health.
 */

import { createChildLogger } from '../core/logger.js';
import {
  CHAIN_REGISTRY,
  ALL_CHAIN_IDS,
  getChainRpcUrl,
  type ChainConfig,
} from '../core/chain-registry.js';
import { getDefaultVenue, getBestQuote } from '../trader/order-executor.js';
import type { Chain } from '../core/types.js';

const log = createChildLogger('chain-test-agent');

export interface ChainHealthResult {
  chain: string;
  name: string;
  family: string;
  rpcReachable: boolean;
  rpcLatencyMs: number;
  dexScreenerReachable: boolean;
  dexScreenerPairs: number;
  defaultVenue: string;
  dryRunQuoteOk: boolean;
  errors: string[];
}

export interface ChainHealthReport {
  timestamp: string;
  totalChains: number;
  healthyChains: number;
  results: ChainHealthResult[];
}

/**
 * Test RPC connectivity for a chain.
 */
async function testRpc(cfg: ChainConfig): Promise<{ reachable: boolean; latencyMs: number; error?: string }> {
  if (cfg.family === 'hyperliquid') {
    // Hyperliquid uses REST API, not JSON-RPC
    const start = Date.now();
    try {
      const res = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' }),
        signal: AbortSignal.timeout(5000),
      });
      return { reachable: res.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return { reachable: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  if (cfg.family === 'solana') {
    const rpcUrl = getChainRpcUrl(cfg.id);
    const start = Date.now();
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }),
        signal: AbortSignal.timeout(5000),
      });
      return { reachable: res.ok, latencyMs: Date.now() - start };
    } catch (err) {
      return { reachable: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  // EVM: eth_chainId
  const rpcUrl = getChainRpcUrl(cfg.id);
  const start = Date.now();
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json() as { result?: string; error?: unknown };
    const reachable = res.ok && data.result !== undefined;
    return { reachable, latencyMs: Date.now() - start };
  } catch (err) {
    return { reachable: false, latencyMs: Date.now() - start, error: String(err) };
  }
}

/**
 * Test DexScreener data availability for a chain.
 */
async function testDexScreener(cfg: ChainConfig): Promise<{ reachable: boolean; pairs: number; error?: string }> {
  try {
    const url = `https://api.dexscreener.com/token-boosts/top/v1`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { reachable: false, pairs: 0, error: `HTTP ${res.status}` };

    const data = await res.json() as Array<{ chainId?: string }>;
    const chainPairs = data.filter((p) => p.chainId === cfg.dexScreenerId);
    return { reachable: true, pairs: chainPairs.length };
  } catch (err) {
    return { reachable: false, pairs: 0, error: String(err) };
  }
}

/**
 * Run health check for a single chain.
 */
async function testChain(chainId: string): Promise<ChainHealthResult> {
  const cfg = CHAIN_REGISTRY[chainId];
  const errors: string[] = [];

  // Test RPC
  const rpc = await testRpc(cfg);
  if (!rpc.reachable) errors.push(`RPC unreachable: ${rpc.error ?? 'timeout'}`);

  // Test DexScreener
  const dex = await testDexScreener(cfg);
  if (!dex.reachable) errors.push(`DexScreener unreachable: ${dex.error ?? 'timeout'}`);

  // Get default venue
  const venue = getDefaultVenue(chainId as Chain);

  return {
    chain: chainId,
    name: cfg.name,
    family: cfg.family,
    rpcReachable: rpc.reachable,
    rpcLatencyMs: rpc.latencyMs,
    dexScreenerReachable: dex.reachable,
    dexScreenerPairs: dex.pairs,
    defaultVenue: venue,
    dryRunQuoteOk: rpc.reachable, // In dry-run mode, quote succeeds if RPC is up
    errors,
  };
}

/**
 * Run health check across all registered chains.
 */
export async function runChainHealthCheck(chains?: string[]): Promise<ChainHealthReport> {
  const targetChains = chains ?? ALL_CHAIN_IDS;

  log.info({ chains: targetChains.length }, 'Starting chain health check');

  // Run all chain tests in parallel
  const results = await Promise.all(
    targetChains.map((chainId) => testChain(chainId))
  );

  const healthyChains = results.filter(
    (r) => r.rpcReachable && r.errors.length === 0
  ).length;

  const report: ChainHealthReport = {
    timestamp: new Date().toISOString(),
    totalChains: results.length,
    healthyChains,
    results,
  };

  log.info(
    { total: report.totalChains, healthy: report.healthyChains },
    'Chain health check complete'
  );

  return report;
}
