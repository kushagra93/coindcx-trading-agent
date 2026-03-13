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

export type ServiceMode =
  | 'api'
  | 'data-ingestion'
  | 'signal-worker'
  | 'executor'
  | 'supervisor'
  // === Multi-tier agent modes ===
  | 'master'
  | 'broker'
  | 'helper-chat'
  | 'helper-executor'
  | 'helper-risk'
  | 'helper-backtest'
  | 'helper-market'
  | 'helper-notification';

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
    privateKey: string;
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

  sagemaker: {
    region: string;
    roleArn: string;
    s3Bucket: string;
    s3Prefix: string;
    intentEndpointName: string;
    chatEndpointName: string;
    trainingInstanceType: string;
    inferenceInstanceType: string;
    baseModelId: string;
    useSageMakerInference: boolean;
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

  broker: {
    jurisdiction: string;
    maxUsers: number;
    positionLimitPerUser: number;
    maxPositionSizePct: number;
    maxLeverage: number;
  };

  security: {
    masterKeyId: string;
    messageExpiryMs: number;
    nonceWindowMs: number;
    approvalTokenExpiryMs: number;
    certificateExpiryDays: number;
  };

  hibernation: {
    idleThresholdMs: number;
    onDemandThresholdMs: number;
    archiveThresholdMs: number;
    sweepIntervalMs: number;
  };

  /** Per-chain RPC URL overrides (env: CHAIN_RPC_{CHAIN_NAME}) */
  chainRpcOverrides: Record<string, string>;
  wsHub: {
    url: string;
  };

  gateway: {
    jwtSecret: string;
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
      rpcUrl: envOrDefault('SOLANA_RPC_URL', ''),
      wsUrl: envOrDefault('SOLANA_WS_URL', ''),
      heliusApiKey: envOrDefault('HELIUS_API_KEY', ''),
      privateKey: envOrDefault('SOLANA_PRIVATE_KEY', ''),
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

    sagemaker: {
      region: envOrDefault('SAGEMAKER_REGION', envOrDefault('AWS_REGION', 'us-west-2')),
      roleArn: envOrDefault('SAGEMAKER_ROLE_ARN', ''),
      s3Bucket: envOrDefault('SAGEMAKER_S3_BUCKET', ''),
      s3Prefix: envOrDefault('SAGEMAKER_S3_PREFIX', 'cerebro-training'),
      intentEndpointName: envOrDefault('SAGEMAKER_INTENT_ENDPOINT', ''),
      chatEndpointName: envOrDefault('SAGEMAKER_CHAT_ENDPOINT', ''),
      trainingInstanceType: envOrDefault('SAGEMAKER_TRAINING_INSTANCE', 'ml.g5.2xlarge'),
      inferenceInstanceType: envOrDefault('SAGEMAKER_INFERENCE_INSTANCE', 'ml.g5.xlarge'),
      baseModelId: envOrDefault('SAGEMAKER_BASE_MODEL', 'mistralai/Mistral-7B-Instruct-v0.3'),
      useSageMakerInference: envOrDefault('SAGEMAKER_USE_INFERENCE', 'true').toLowerCase() === 'true',
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

    broker: {
      jurisdiction: envOrDefault('BROKER_JURISDICTION', 'GLOBAL'),
      maxUsers: parseInt(envOrDefault('BROKER_MAX_USERS', '100000')),
      positionLimitPerUser: parseInt(envOrDefault('BROKER_POSITION_LIMIT_PER_USER', '20')),
      maxPositionSizePct: parseFloat(envOrDefault('BROKER_MAX_POSITION_SIZE_PCT', '25')),
      maxLeverage: parseFloat(envOrDefault('BROKER_MAX_LEVERAGE', '10')),
    },

    security: {
      masterKeyId: envOrDefault('SECURITY_MASTER_KEY_ID', ''),
      messageExpiryMs: parseInt(envOrDefault('SECURITY_MESSAGE_EXPIRY_MS', '30000')),
      nonceWindowMs: parseInt(envOrDefault('SECURITY_NONCE_WINDOW_MS', '60000')),
      approvalTokenExpiryMs: parseInt(envOrDefault('SECURITY_APPROVAL_TOKEN_EXPIRY_MS', '30000')),
      certificateExpiryDays: parseInt(envOrDefault('SECURITY_CERTIFICATE_EXPIRY_DAYS', '365')),
    },

    hibernation: {
      idleThresholdMs: parseInt(envOrDefault('HIBERNATION_IDLE_THRESHOLD_MS', '1800000')),       // 30 min
      onDemandThresholdMs: parseInt(envOrDefault('HIBERNATION_ON_DEMAND_THRESHOLD_MS', '7200000')), // 2 hours
      archiveThresholdMs: parseInt(envOrDefault('HIBERNATION_ARCHIVE_THRESHOLD_MS', '86400000')),   // 24 hours
      sweepIntervalMs: parseInt(envOrDefault('HIBERNATION_SWEEP_INTERVAL_MS', '300000')),          // 5 min
    },

    chainRpcOverrides: loadChainRpcOverrides(),
    wsHub: {
      url: envOrDefault('WS_HUB_URL', 'ws://localhost:3000/ws/agents'),
    },

    gateway: {
      jwtSecret: envOrDefault('GATEWAY_JWT_SECRET', 'dev-secret-change-in-production'),
    },
  };
}

/** Scan env vars for CHAIN_RPC_* overrides */
function loadChainRpcOverrides(): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith('CHAIN_RPC_') && val) {
      const chain = key.replace('CHAIN_RPC_', '').toLowerCase();
      overrides[chain] = val;
    }
  }
  return overrides;
}

export const config = loadConfig();