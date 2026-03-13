import { config, type ServiceMode } from './core/config.js';
import { logger, createChildLogger } from './core/logger.js';
import { startOrchestrator } from './core/orchestrator.js';
import { startServer, mintGatewayJwt } from './api/server.js';
import { WsClient } from './core/ws-client.js';
import { WsGateway } from './core/ws-gateway.js';

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
    log.debug('Data ingestion cycle');
  }, 30_000);
}

async function startSignalWorkerMode() {
  log.info('Starting in Signal Worker mode');

  await startOrchestrator(async () => {
    log.debug('Signal worker cycle');
  }, 5_000);
}

async function startExecutorMode() {
  log.info('Starting in Executor mode');

  await startOrchestrator(async () => {
    log.debug('Executor cycle');
  }, 2_000);
}

async function startSupervisorMode() {
  log.info('Starting in Supervisor mode (legacy — use "master" for multi-tier)');

  const { Supervisor } = await import('./supervisor/supervisor.js');
  const supervisor = new Supervisor(config.redis.url);
  await supervisor.start();

  await startServer();
  log.info('Supervisor mode started — master agent controlling all user agents');
}

// ═════════════════════════════════════════════════
// Multi-Tier Agent Modes (MDC Architecture)
// ═════════════════════════════════════════════════

async function startMasterMode() {
  log.info('Starting in Master Agent mode');

  const { MasterAgent } = await import('./supervisor/supervisor.js');
  const master = new MasterAgent(config.redis.url);
  await master.start();

  const gateway = new WsGateway(config.redis.url);
  await gateway.start();

  await startServer(gateway);
  log.info({
    gatewayId: gateway.gatewayId,
  }, 'Master Agent mode started — Gateway on /ws/agents, Master uses Redis backbone');
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
        maxTotalExposureUsd: config.broker.maxUsers * 1000,
      },
    },
  );

  await broker.start();
  log.info({ jurisdiction }, 'Broker Agent mode started — compliance, KYC, fee aggregation');
}

async function startHelperMode(mode: ServiceMode) {
  const helperType = mode.replace('helper-', '');
  log.info({ helperType }, 'Starting in Helper Agent mode');

  const gatewayUrl = config.wsHub.url;

  switch (mode) {
    case 'helper-market': {
      const Redis = (await import('ioredis')).default;
      const redis = new Redis(config.redis.url);
      const agentId = `helper-market-${Date.now()}`;
      const token = mintGatewayJwt({ agentId, userId: 'system', tier: 'helper', helperType: 'market-data' });
      const wsClient = new WsClient(gatewayUrl, token, agentId, 'helper', 'market-data');
      await wsClient.connect();

      const { MarketDataAgent } = await import('./helpers/market-data-agent.js');
      const agent = new MarketDataAgent(wsClient, redis);
      await agent.start();
      agent.startPublishing(30_000);
      log.info('Market Data Helper started — publishing via WebSocket');
      break;
    }

    case 'helper-risk': {
      const agentId = `helper-risk-${Date.now()}`;
      const token = mintGatewayJwt({ agentId, userId: 'system', tier: 'helper', helperType: 'risk-analyzer' });
      const wsClient = new WsClient(gatewayUrl, token, agentId, 'helper', 'risk-analyzer');
      await wsClient.connect();

      const { RiskAnalyzerAgent } = await import('./helpers/risk-analyzer-agent.js');
      const agent = new RiskAnalyzerAgent(wsClient);
      await agent.start();
      log.info('Risk Analyzer Helper started — receiving tasks via WebSocket');
      break;
    }

    case 'helper-executor': {
      const agentId = `helper-executor-${Date.now()}`;
      const token = mintGatewayJwt({ agentId, userId: 'system', tier: 'helper', helperType: 'strategy-executor' });
      const wsClient = new WsClient(gatewayUrl, token, agentId, 'helper', 'strategy-executor');
      await wsClient.connect();

      const { StrategyExecutorAgent } = await import('./helpers/strategy-executor-agent.js');
      const agent = new StrategyExecutorAgent(wsClient);
      await agent.start();
      log.info('Strategy Executor Helper started — receiving tasks via WebSocket');
      break;
    }

    case 'helper-notification': {
      const Redis = (await import('ioredis')).default;
      const redis = new Redis(config.redis.url);
      const agentId = `helper-notification-${Date.now()}`;
      const token = mintGatewayJwt({ agentId, userId: 'system', tier: 'helper', helperType: 'notification' });
      const wsClient = new WsClient(gatewayUrl, token, agentId, 'helper', 'notification');
      await wsClient.connect();

      const { NotificationAgent } = await import('./helpers/notification-agent.js');
      const agent = new NotificationAgent(wsClient, redis);
      await agent.start();
      log.info('Notification Helper started — receiving tasks via WebSocket');
      break;
    }

    case 'helper-chat': {
      log.info('Chat/NLP Helper started — consuming NLP tasks (uses Anthropic API)');
      await startOrchestrator(async () => {
        log.debug('Chat/NLP helper cycle');
      }, 5_000);
      break;
    }

    case 'helper-backtest': {
      log.info('Backtesting Helper started — consuming backtest tasks');
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
