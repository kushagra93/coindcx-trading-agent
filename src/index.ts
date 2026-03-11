import { config, type ServiceMode } from './core/config.js';
import { logger, createChildLogger } from './core/logger.js';
import { startOrchestrator } from './core/orchestrator.js';
import { startServer } from './api/server.js';

const log = createChildLogger('main');

async function main() {
  log.info({
    serviceMode: config.serviceMode,
    nodeEnv: config.nodeEnv,
    dryRun: config.dryRun,
  }, 'CoinDCX Trading Agent starting');

  switch (config.serviceMode) {
    case 'api':
      await startApiMode();
      break;

    case 'data-ingestion':
      await startDataIngestionMode();
      break;

    case 'signal-worker':
      await startSignalWorkerMode();
      break;

    case 'executor':
      await startExecutorMode();
      break;

    default:
      log.error({ mode: config.serviceMode }, 'Unknown service mode');
      process.exit(1);
  }
}

async function startApiMode() {
  log.info('Starting in API mode');
  await startServer();
}

async function startDataIngestionMode() {
  log.info('Starting in Data Ingestion mode');

  await startOrchestrator(async () => {
    // TODO: Phase 2 implementation
    // 1. Fetch price feeds (CoinGecko, Jupiter, DexScreener)
    // 2. Process wallet tracker events (Helius, Alchemy WebSocket)
    // 3. Publish events to Redis Streams
    log.debug('Data ingestion cycle');
  }, 30_000); // 30 second cycle for price feeds
}

async function startSignalWorkerMode() {
  log.info('Starting in Signal Worker mode');

  await startOrchestrator(async () => {
    // TODO: Phase 2 implementation
    // 1. Consume price/wallet events from Redis Streams
    // 2. Evaluate strategies for affected users
    // 3. Run risk validation
    // 4. Query host app policy engine
    // 5. Publish approved trade intents to execution queue
    log.debug('Signal worker cycle');
  }, 5_000); // 5 second cycle for signal evaluation
}

async function startExecutorMode() {
  log.info('Starting in Executor mode');

  await startOrchestrator(async () => {
    // TODO: Phase 2 implementation
    // 1. Consume trade intents from Redis Streams
    // 2. Write PENDING to DB (WAL)
    // 3. Reserve fee
    // 4. Decrypt user key from KMS
    // 5. Execute via Jupiter/1inch/Hyperliquid
    // 6. Update trade state
    // 7. Update position
    log.debug('Executor cycle');
  }, 2_000); // 2 second cycle for trade execution
}

main().catch(err => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});
