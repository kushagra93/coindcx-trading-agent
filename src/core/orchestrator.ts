import { config } from './config.js';
import { createChildLogger } from './logger.js';
import { recoverTrades } from '../trader/trade-memory.js';

const log = createChildLogger('orchestrator');

let running = false;
let cycleCount = 0;

const DEFAULT_CYCLE_INTERVAL_MS = 15_000; // 15 seconds

/**
 * Start the orchestrator loop for signal workers or executors.
 */
export async function startOrchestrator(
  runCycle: () => Promise<void>,
  cycleIntervalMs: number = DEFAULT_CYCLE_INTERVAL_MS
): Promise<void> {
  log.info({
    serviceMode: config.serviceMode,
    dryRun: config.dryRun,
    cycleIntervalMs,
  }, 'Starting orchestrator');

  // Crash recovery: reconcile any stuck trades
  if (config.serviceMode === 'executor') {
    const recovered = await recoverTrades(async (trade) => {
      // TODO: Check on-chain status of trade
      log.info({ tradeId: trade.id, state: trade.state }, 'Checking trade for recovery');
      // For now, mark stuck ORDER_SUBMITTED as failed
      if (trade.state === 'ORDER_SUBMITTED') return 'ORDER_FAILED';
      if (trade.state === 'FEE_RESERVED') return 'FEE_REFUNDED';
      return trade.state;
    });
    log.info({ recovered }, 'Crash recovery complete');
  }

  running = true;

  while (running) {
    try {
      cycleCount++;
      await runCycle();
    } catch (err) {
      log.error({ err, cycle: cycleCount }, `Cycle ${cycleCount} failed`);
    }

    await sleep(cycleIntervalMs);
  }

  log.info({ totalCycles: cycleCount }, 'Orchestrator stopped');
}

/**
 * Stop the orchestrator gracefully.
 */
export function stopOrchestrator(): void {
  log.info('Stopping orchestrator...');
  running = false;
}

/**
 * Check if orchestrator is running.
 */
export function isRunning(): boolean {
  return running;
}

/**
 * Get current cycle count.
 */
export function getCycleCount(): number {
  return cycleCount;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
