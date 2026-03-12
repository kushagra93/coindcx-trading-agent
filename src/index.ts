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

    case 'supervisor':
      await startSupervisorMode();
      break;

    // === Multi-tier agent modes ===

    case 'master':
      await startMasterMode();
      break;

    case 'broker':
      await startBrokerMode();
      break;

    case 'helper-chat':
    case 'helper-executor':
    case 'helper-risk':
    case 'helper-backtest':
    case 'helper-market':
    case 'helper-notification':
      await startHelperMode(config.serviceMode);
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
    // 1. Fetch price feeds (CoinGecko, Jupiter, DexScreener)
    // 2. Process wallet tracker events (Helius, Alchemy WebSocket)
    // 3. Publish events to Redis Streams
    log.debug('Data ingestion cycle');
  }, 30_000); // 30 second cycle for price feeds
}

async function startSignalWorkerMode() {
  log.info('Starting in Signal Worker mode');

  await startOrchestrator(async () => {
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

async function startSupervisorMode() {
  log.info('Starting in Supervisor mode (legacy — use "master" for multi-tier)');

  const { Supervisor } = await import('./supervisor/supervisor.js');
  const supervisor = new Supervisor(config.redis.url, config.supervisor.deadAgentTimeoutMs);
  await supervisor.start();

  // Start API server with supervisor routes
  await startServer();
  log.info('Supervisor mode started — master agent controlling all user agents');
}

// ===== Multi-Tier Agent Modes =====

async function startMasterMode() {
  log.info('Starting in Master Agent mode');

  const { MasterAgent } = await import('./supervisor/supervisor.js');
  const master = new MasterAgent(config.redis.url, config.supervisor.deadAgentTimeoutMs);
  await master.start();

  // Start API server with all routes (supervisor, broker, gateway)
  await startServer();
  log.info('Master Agent mode started — root of trust chain, trade approval, fee ledger');
}

async function startBrokerMode() {
  const jurisdiction = config.broker.jurisdiction as 'US' | 'EU' | 'APAC' | 'GLOBAL';
  log.info({ jurisdiction }, 'Starting in Broker Agent mode');

  const Redis = (await import('ioredis')).default;
  const redis = new Redis(config.redis.url);

  const { BrokerAgent } = await import('./broker/broker-agent.js');

  const broker = new BrokerAgent(
    redis,
    `broker-${jurisdiction.toLowerCase()}`,
    jurisdiction,
    {
      maxUsers: config.broker.maxUsers,
      positionLimits: {
        maxPositionsPerUser: config.broker.positionLimitPerUser,
        maxPositionSizePct: config.broker.maxPositionSizePct,
        maxTotalExposureUsd: config.broker.maxUsers * 1000, // derived limit
      },
    },
  );

  await broker.start();
  log.info({ jurisdiction }, 'Broker Agent mode started — compliance, KYC, fee aggregation');
}

async function startHelperMode(mode: ServiceMode) {
  const helperType = mode.replace('helper-', '');
  log.info({ helperType }, 'Starting in Helper Agent mode');

  const Redis = (await import('ioredis')).default;
  const redis = new Redis(config.redis.url);

  switch (mode) {
    case 'helper-market': {
      const { MarketDataAgent } = await import('./helpers/market-data-agent.js');
      const agent = new MarketDataAgent(redis);
      await agent.start();
      // Start continuous market data publishing
      agent.startPublishing(30_000); // 30s intervals
      log.info('Market Data Helper started — publishing to stream:market:data');
      break;
    }

    case 'helper-risk': {
      const { RiskAnalyzerAgent } = await import('./helpers/risk-analyzer-agent.js');
      const agent = new RiskAnalyzerAgent(redis);
      await agent.start();
      log.info('Risk Analyzer Helper started — consuming risk analysis tasks');
      break;
    }

    case 'helper-executor': {
      const { StrategyExecutorAgent } = await import('./helpers/strategy-executor-agent.js');
      const agent = new StrategyExecutorAgent(redis);
      await agent.start();
      log.info('Strategy Executor Helper started — consuming trade execution tasks');
      break;
    }

    case 'helper-notification': {
      const { NotificationAgent } = await import('./helpers/notification-agent.js');
      const agent = new NotificationAgent(redis);
      await agent.start();
      log.info('Notification Helper started — consuming notification tasks');
      break;
    }

    case 'helper-chat': {
      log.info('Chat/NLP Helper started — consuming NLP tasks (uses Anthropic API)');
      // Chat NLP agent would be implemented in helpers/chat-nlp-agent.ts
      // Uses config.ai.anthropicApiKey for Claude API calls
      await startOrchestrator(async () => {
        log.debug('Chat/NLP helper cycle');
      }, 5_000);
      break;
    }

    case 'helper-backtest': {
      log.info('Backtesting Helper started — consuming backtest tasks');
      // Backtesting agent would be implemented in helpers/backtesting-agent.ts
      await startOrchestrator(async () => {
        log.debug('Backtesting helper cycle');
      }, 10_000);
      break;
    }

    default:
      log.error({ mode }, 'Unknown helper mode');
      process.exit(1);
  }
}

main().catch(err => {
  logger.error({ err }, 'Fatal error');
  process.exit(1);
});
