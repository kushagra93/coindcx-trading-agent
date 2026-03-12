import dotenv from 'dotenv';
import type { Chain } from './types.js';

dotenv.config();

function envOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function envOrDefault(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export type ServiceMode = 'api' | 'data-ingestion' | 'signal-worker' | 'executor' | 'supervisor';

export interface AppConfig {
  serviceMode: ServiceMode;
  nodeEnv: string;
  port: number;
  logLevel: string;
  dryRun: boolean;

  database: {
    url: string;
  };

  redis: {
    url: string;
  };

  kms: {
    region: string;
    keyId: string;
  };

  solana: {
    rpcUrl: string;
    wsUrl: string;
    heliusApiKey: string;
  };

  evm: {
    rpcUrl: string;
    wsUrl: string;
    alchemyApiKey: string;
    defaultChainId: number;
  };

  hyperliquid: {
    mainnet: boolean;
    builderCode: string;
    builderFeeBps: number;
  };

  dex: {
    jupiterApiUrl: string;
    oneInchApiKey: string;
    zeroXApiKey: string;
  };

  marketData: {
    coinGeckoApiKey: string;
  };

  ai: {
    anthropicApiKey: string;
  };

  hostApp: {
    adapter: string;
    coinDcx: {
      apiUrl: string;
      apiKey: string;
      relayUrl: string;
    };
  };

  fees: {
    walletAddressSol: string;
    walletAddressEvm: string;
    settlementThresholdUsd: number;
  };

  risk: {
    maxPositionSizePct: number;
    circuitBreakerLossPct: number;
    circuitBreakerWindowHours: number;
  };

  supervisor: {
    heartbeatIntervalMs: number;
    deadAgentTimeoutMs: number;
    maxAgentsPerUser: number;
    eventBatchSize: number;
  };
}

export function loadConfig(): AppConfig {
  return {
    serviceMode: envOrDefault('SERVICE_MODE', 'api') as ServiceMode,
    nodeEnv: envOrDefault('NODE_ENV', 'development'),
    port: parseInt(envOrDefault('PORT', '3000')),
    logLevel: envOrDefault('LOG_LEVEL', 'info'),
    dryRun: envOrDefault('DRY_RUN', 'true').toLowerCase() === 'true',

    database: {
      url: envOrDefault('DATABASE_URL', ''),
    },

    redis: {
      url: envOrDefault('REDIS_URL', 'redis://localhost:6379'),
    },

    kms: {
      region: envOrDefault('AWS_REGION', 'ap-south-1'),
      keyId: envOrDefault('AWS_KMS_KEY_ID', ''),
    },

    solana: {
      rpcUrl: envOrDefault('SOLANA_RPC_URL', 'https://api.devnet.solana.com'),
      wsUrl: envOrDefault('SOLANA_WS_URL', 'wss://api.devnet.solana.com'),
      heliusApiKey: envOrDefault('HELIUS_API_KEY', ''),
    },

    evm: {
      rpcUrl: envOrDefault('EVM_RPC_URL', ''),
      wsUrl: envOrDefault('EVM_WS_URL', ''),
      alchemyApiKey: envOrDefault('ALCHEMY_API_KEY', ''),
      defaultChainId: parseInt(envOrDefault('DEFAULT_EVM_CHAIN_ID', '137')),
    },

    hyperliquid: {
      mainnet: envOrDefault('HYPERLIQUID_MAINNET', 'false').toLowerCase() === 'true',
      builderCode: envOrDefault('HYPERLIQUID_BUILDER_CODE', '0xCoinDCXAgent'),
      builderFeeBps: parseInt(envOrDefault('HYPERLIQUID_BUILDER_FEE_BPS', '5')),
    },

    dex: {
      jupiterApiUrl: envOrDefault('JUPITER_API_URL', 'https://quote-api.jup.ag/v6'),
      oneInchApiKey: envOrDefault('ONEINCH_API_KEY', ''),
      zeroXApiKey: envOrDefault('ZEROX_API_KEY', ''),
    },

    marketData: {
      coinGeckoApiKey: envOrDefault('COINGECKO_API_KEY', ''),
    },

    ai: {
      anthropicApiKey: envOrDefault('ANTHROPIC_API_KEY', ''),
    },

    hostApp: {
      adapter: envOrDefault('HOST_APP_ADAPTER', 'generic'),
      coinDcx: {
        apiUrl: envOrDefault('COINDCX_API_URL', ''),
        apiKey: envOrDefault('COINDCX_API_KEY', ''),
        relayUrl: envOrDefault('COINDCX_RELAY_URL', ''),
      },
    },

    fees: {
      walletAddressSol: envOrDefault('FEE_WALLET_ADDRESS_SOL', ''),
      walletAddressEvm: envOrDefault('FEE_WALLET_ADDRESS_EVM', ''),
      settlementThresholdUsd: parseFloat(envOrDefault('FEE_SETTLEMENT_THRESHOLD_USD', '50')),
    },

    risk: {
      maxPositionSizePct: parseFloat(envOrDefault('MAX_POSITION_SIZE_PCT', '25')),
      circuitBreakerLossPct: parseFloat(envOrDefault('CIRCUIT_BREAKER_LOSS_PCT', '10')),
      circuitBreakerWindowHours: parseFloat(envOrDefault('CIRCUIT_BREAKER_WINDOW_HOURS', '1')),
    },

    supervisor: {
      heartbeatIntervalMs: parseInt(envOrDefault('SUPERVISOR_HEARTBEAT_INTERVAL_MS', '15000')),
      deadAgentTimeoutMs: parseInt(envOrDefault('SUPERVISOR_DEAD_AGENT_TIMEOUT_MS', '60000')),
      maxAgentsPerUser: parseInt(envOrDefault('SUPERVISOR_MAX_AGENTS_PER_USER', '5')),
      eventBatchSize: parseInt(envOrDefault('SUPERVISOR_EVENT_BATCH_SIZE', '100')),
    },
  };
}

export const config = loadConfig();
