# CoinDCX Permissioned Trading Agent

A mobile-first, embeddable AI trading agent platform with a 4-tier multi-agent architecture, on-chain screening, multi-chain execution, and risk-managed exit strategies.

![Demo](demo.gif)

---

## Quick Start (Hackathon Mode)

### Prerequisites

| Dependency | Version | Install |
|---|---|---|
| **Node.js** | v20+ | `nvm install 20` or [nodejs.org](https://nodejs.org) |
| **Flutter** | 3.32.x stable | [flutter.dev/docs/get-started/install](https://flutter.dev/docs/get-started/install) |
| **Chrome** | Any recent | For `flutter run -d chrome` |

No Docker, Redis, PostgreSQL, or AWS needed — everything runs in-memory for the hackathon.

### API Keys (all free tier)

| Key | Purpose | Get it at |
|---|---|---|
| `OPENROUTER_API_KEY` | LLM chat (MiniMax M2.5) | [openrouter.ai](https://openrouter.ai) |
| `BIRDEYE_API_KEY` | Token data, holder distribution | [birdeye.so](https://birdeye.so) |
| `HELIUS_API_KEY` | Solana holders, wallet monitoring | [dashboard.helius.dev](https://dashboard.helius.dev) |

DexScreener, RugCheck, GoPlus, and GMGN use public endpoints — no keys needed.

### Setup

```bash
# 1. Clone & install
git clone https://github.com/kushagra93/coindcx-trading-agent.git
cd coindcx-trading-agent
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — replace with your actual keys:
```

**.env** (minimum required):
```env
SERVICE_MODE=api
DRY_RUN=true
PORT=3000
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=minimax/minimax-m2.5
BIRDEYE_API_KEY=your-birdeye-key
HELIUS_API_KEY=your-helius-key
```

```bash
# 3. Start backend (Terminal 1)
npx tsx src/index.ts

# 4. Start Flutter web app (Terminal 2)
cd mobile_app
flutter pub get
flutter run -d chrome --web-port 8080
```

The app opens at `http://localhost:8080` with backend on `http://localhost:3000`.

### What's NOT needed for hackathon
- **PostgreSQL / Redis** — the app starts gracefully without them (guarded with `isDbConfigured()`)
- **AWS KMS** — not used in dry-run mode
- **Solana / EVM wallets** — trades are simulated
- **Docker** — runs directly with Node + Flutter
- **Paid API tiers** — free plans work for all APIs

---

## Chat Agent Capabilities & Triggers

The AI chat understands **18 intents** via NLP. Here's every trigger:

| Intent | Trigger Words | What Happens |
|---|---|---|
| **confirm_buy** | "confirm buy", "confirm purchase" | Executes pending buy trade |
| **confirm_sell** | "confirm sell" | Executes pending sell trade |
| **limit_order** | "take profit", "stop loss", "limit order/sell/buy", "set tp/sl", "trail" | Configures limit/TP/SL orders |
| **kol** | "kol", "influencer", "follow kol", "kol buy/trade" | Shows KOL wallets with PnL & Twitter |
| **copy_manage** | "my copy trades", "manage copies", "stop/pause/resume copy" | Shows copy trade manager card |
| **copy_trade** | "copy trade", "follow wallet", "mirror trade", "copy trade #1" | Opens copy trade config modal |
| **leaderboard** | "leaderboard", "top trader", "smart money", "whales", "best trader" | Shows GMGN top Solana traders |
| **screen** | "screen SOL", "is it safe", "rug check", "check" | Full safety audit (mint, freeze, LP, holders, insiders) |
| **price** | "SOL price", "how much is ETH", "what does X cost" | Quick price lookup |
| **sell** | "sell SOL", "sell $100" | Sells token from portfolio |
| **buy** | "buy ETH $200", "ape into SOL", "grab BONK" | Shows trade preview → confirm to execute |
| **analyze** | "analyze PEPE", "research SOL", "tell me about ETH" | Deep analysis with audit + price data |
| **recommend** | "recommend", "suggest", "give me picks", "best sol tokens", "alpha", "gems", "what should I buy" | Filtered top SOL picks by momentum + volume + liquidity |
| **portfolio** | "portfolio", "balance", "wallet", "positions", "holdings", "pnl", "performance" | Shows portfolio with holdings & P&L |
| **trending** | "trending", "hot", "popular" | Shows all trending tokens |
| **help** | "help", "what can you do" | Lists all capabilities |
| **Contract address** | Any Solana (32-44 char) or EVM (0x...) address | Auto-screens the token |

---

## Multi-Tier Agent Architecture

The system implements a hierarchical 4-tier agent economy with isolation boundaries, signed inter-agent messaging, and a 15-state trade lifecycle.

```
                        +------------------+
                        |   Master Agent   |   Root of trust, trade approval,
                        |   (Tier 0)       |   fee ledger, cert authority
                        +--------+---------+
                                 |
              +------------------+------------------+
              |                  |                  |
     +--------v-------+ +-------v--------+ +-------v--------+
     | Broker Agent US | | Broker Agent EU| | Broker APAC    |  Compliance,
     | (Tier 1)        | | (Tier 1)       | | (Tier 1)       |  KYC, fee agg
     +--------+--------+ +-------+--------+ +-------+--------+
              |                  |                  |
         +----v----+        +---v----+         +---v----+
         |User     |        |User    |         |User    |  Personal agents
         |Agents   |        |Agents  |         |Agents  |  (1 per user)
         |(Tier 2) |        |(Tier 2)|         |(Tier 2)|
         +---------+        +--------+         +--------+
              \                  |                  /
               +--------+-------+---------+--------+
                        |  Helper Pool    |
                        |  (Tier 3)       |  Stateless, shared
                        +-----------------+
```

### Tier Responsibilities

| Tier | Agent | Responsibilities |
|------|-------|-----------------|
| **0 - Master** | `MasterAgent` | Root CA, trade approval tokens (30s expiry), immutable fee ledger, global risk snapshot, regulatory reports, hibernation sweeps, HMAC-signed command dispatch |
| **1 - Broker** | `BrokerAgent` | Regional compliance (US/EU/APAC), KYC gating, position limit enforcement, fee aggregation, dual-sig withdrawals, user agent cert issuance |
| **2 - User** | `UserAgent` | Personal trading agent (1:1 per user), strategy evaluation, 15-state trade lifecycle orchestration, portfolio/position tracking, memory store |
| **3 - Helper** | `BaseHelper` subclasses | Stateless task workers: market data, risk analysis, trade execution, notifications, chat/NLP, backtesting |

### Helper Agent Pool

| Helper | Stream | Function |
|--------|--------|----------|
| **Market Data** | `stream:helper:market-data:tasks` | CoinGecko + Jupiter + DexScreener price feeds, 30s publish cycle |
| **Risk Analyzer** | `stream:helper:risk-analyzer:tasks` | Kelly Criterion sizing, regime detection, circuit breaker, parameter bounds |
| **Strategy Executor** | `stream:helper:strategy-executor:tasks` | Jupiter (Solana), 1inch (EVM), 0x (fallback), Hyperliquid (perps) |
| **Notification** | `stream:helper:notification:tasks` | Trade confirmations, risk alerts, compliance alerts, PnL updates |
| **Chat/NLP** | `stream:helper:chat-nlp:tasks` | Natural language strategy parsing, trade explanations (Claude API) |
| **Backtesting** | `stream:helper:backtesting:tasks` | Historical strategy simulation, Sharpe ratio, max drawdown |

### Inter-Agent Communication

All agents communicate through Redis — no direct agent-to-agent connections.

| Direction | Mechanism | Message Types |
|-----------|-----------|---------------|
| **Downstream** (Master → Agents) | Redis Pub/Sub channels per gateway + broadcast channel | `command`, `emergency`, `policy-update`, `trade-approval`, `compliance-result`, `helper-task` |
| **Upstream** (Agents → Master) | Redis Streams with consumer groups (at-least-once delivery) | `ack`, `event`, `heartbeat`, `helper-result` |
| **Offline Delivery** | Redis Lists (`q:{agentId}`, max 200, 24h TTL) | Queued for reconnection |

All messages are HMAC-SHA256 signed with UUID nonces and 30-second timestamp freshness checks.

---

## Security Model (6 Layers)

1. **Network Isolation** — Each tier runs as a separate service with distinct Redis stream boundaries
2. **Signed Messaging** — All inter-agent messages use HMAC-SHA256 signed envelopes with UUID nonces (30s expiry, replay prevention)
3. **Trust Chain** — ECDSA P-256 certificate hierarchy: Master (root CA) signs Broker certs, Brokers sign User certs
4. **Per-User Namespace Isolation** — All user data scoped under `ns:{userId}:*` with cross-access assertion
5. **Dual-Signature Fund Custody** — Withdrawals require co-signatures from both User Agent and Broker Agent
6. **Immutable Audit Trail** — SHA-256 hash-chained audit entries (append-only, tamper-evident)

### Trade Approval Flow

Every trade requires a one-time `ApprovalToken` from the Master Agent:
1. User Agent generates trade signal from strategy
2. Risk Analyzer Helper validates (Kelly sizing + circuit breaker + parameter bounds)
3. Broker Agent performs compliance check (jurisdiction-specific)
4. Master Agent issues signed `ApprovalToken` (30s expiry, single-use)
5. Strategy Executor Helper validates token before execution
6. Fee reserved atomically with trade execution

---

## 15-State Trade Lifecycle

```
SIGNAL_GENERATED ──> RISK_ASSESSED ──> COMPLIANCE_CHECKED ──> APPROVAL_REQUESTED
       |                   |                   |                       |
       v                   v                   v                       v
   (strategy          RISK_REJECTED     COMPLIANCE_REJECTED     APPROVAL_REJECTED
    evaluation)

APPROVAL_REQUESTED ──> APPROVED ──> FEE_RESERVED ──> ORDER_SUBMITTED
                                                           |
ORDER_SUBMITTED ──> ORDER_CONFIRMED ──> FEE_SETTLED ──> FEE_LEDGER_RECORDED
                          |
                          v
                   FEE_REFUNDED (on failure)

FEE_LEDGER_RECORDED ──> NOTIFICATION_SENT ──> POSITION_UPDATED (terminal)
```

**Terminal states:** `RISK_REJECTED`, `COMPLIANCE_REJECTED`, `APPROVAL_REJECTED`, `FEE_REFUNDED`, `POSITION_UPDATED`

**Recoverable states:** `FEE_RESERVED`, `ORDER_SUBMITTED`, `ORDER_CONFIRMED`, `FEE_SETTLED`, `FEE_LEDGER_RECORDED`, `NOTIFICATION_SENT` — resumed automatically on crash recovery.

**Atomic Rule**: Fee reservation and trade execution always succeed or fail together. On failure, `FEE_REFUNDED` compensates automatically.

---

## Gateway Isolation

The Agent Economy is isolated from the host platform through two gateway boundaries:

| Gateway | Direction | Endpoint | Flow |
|---------|-----------|----------|------|
| **Deposit** | Platform → Agent Economy | `POST /api/v1/gateway/deposit` | Validate platform sig → verify KYC via broker → credit wallet → audit → notify |
| **Withdraw** | Agent Economy → Platform | `POST /api/v1/gateway/withdraw` | Verify dual-sig (user + broker) → check balance → execute → audit → notify |

---

## Agent Hibernation

Agents transition through 4 states based on activity to optimize resource usage:

| State | Trigger | Storage | Wake Latency |
|-------|---------|---------|-------------|
| **Active** | Currently trading (~5% of agents) | In-memory | — |
| **Idle** | No activity for 30 min (~90%) | In-memory (reduced) | Instant |
| **On-Demand** | No activity for 2 hours | Redis snapshot | <100ms |
| **Deep Archive** | No activity for 24 hours | PostgreSQL | ~500ms |

---

## Features

### AI Trading Agent (Chat Interface)
- **Natural language trading** — "buy FARTCOIN $200", "screen POPCAT", "long TSLA 3x", "screen MON"
- **18 intent types** — buy, sell, screen, analyze, copy, DCA, limit orders, trending, positions, P&L
- **Dual LLM backend** — OpenRouter (MiniMax M2.5 / Gemini Flash) with SageMaker fine-tuned model fallback
- **Contract address screening** — paste any EVM (0x...), Solana (base58), Sui/Aptos (0x + 64 hex), or Move module path to auto-screen
- **Token name resolution** — 40+ known contracts auto-resolve across all supported chains

### On-Chain Screening
- **6-factor scoring** — Age, Volume, Liquidity, Holder concentration, LP Lock, RugCheck score
- **5 intelligence sources** — Photon (bundles/LP), Axiom (smart money), FOMO (social), RugCheck (audit), DexScreener (liquidity)
- **AI Confidence & Rug Probability** — composite scores from multi-source data
- **Grade system** — A through F with actionable recommendations

### Multi-Chain Execution

| Chain | DEX / Venue | Assets |
|-------|-------------|--------|
| Solana | Jupiter v6 | Memecoins (FARTCOIN, POPCAT, WIF, BONK, MYRO) |
| Base | Aerodrome | Base tokens (DEGEN, BRETT, TOSHI, AERO) |
| Ethereum | Uniswap V3 | ETH, PEPE, MOG, blue chips |
| Arbitrum | Camelot / GMX | ARB, GMX, PENDLE, DeFi |
| Polygon | QuickSwap | POL, AAVE, QI |
| BSC | PancakeSwap | BNB, CAKE |
| Optimism | Velodrome | OP, VELO |
| Avalanche | Trader Joe | AVAX, JOE |
| Monad | Kuru DEX | MON, KURU, MOYAKI |
| Sui | Cetus | SUI, CETUS, TURBOS, NAVX |
| Aptos | Liquidswap | APT, THALA, GUI |
| Hyperliquid | Perps | US stocks (TSLA, NVDA, AAPL, AMZN), crypto perps |

*Also supports: Sonic, Berachain, Linea, Scroll, MegaETH*

### Copy Trading
- **GMGN Leaderboard** — live top Solana trader rankings
- **KOL Wallets** — follow influencer wallets with PnL and Twitter links
- **Wallet Monitoring** — Helius RPC polling detects swap events in real-time
- **Configurable Modes** — fixed_buy, max_buy, or fixed_ratio buy sizing
- **Sell Methods** — mirror_sell (auto) or manual
- **Full CRUD** — start, pause, resume, stop via chat or API

### DCA, Limit Orders & Conditional Rules
- **DCA Engine** — recurring buys at configurable intervals and amounts
- **Limit Orders** — take_profit, stop_loss, limit_buy, limit_sell with 30s price checks
- **Conditional Rules** — price thresholds, RSI/MACD signals, golden/death cross, volume spikes, cross-token triggers

### Risk Management (Auto Exit Strategies)
- **Meme coins**: Micro SL (-25%/30s) + Ladder exit (sell 40% at 2.5x) + Trailing (-30%)
- **Blue chips**: SL (-5%) + TP (+20%) + Trailing (-8%)
- **Perps**: SL (-8%) + TP (+15%) + Trailing (-6%)
- **Circuit Breaker** — automatic trading halt when losses exceed threshold
- **Kelly Criterion** — optimal position sizing based on win probability
- **Regime Detection** — trending/ranging/volatile market classification

### US Stock Perps (Hyperliquid)
- **Dedicated perps section** — separated from crypto holdings with LONG/SHRT badges
- **Leverage display** — 2x/3x leverage with entry price and P&L per position
- **Supported stocks** — TSLA, NVDA, AAPL, AMZN with auto exit strategies

### Mobile UI (Flutter)
- **3-tab unified layout** — Portfolio | Signals | Chat
- **12 chain filters** — scrollable chain pills (Solana, Base, Ethereum, Arbitrum, Polygon, BSC, Optimism, Avalanche, Monad, Sui, Aptos)
- **Phone frame simulator** — 375x812 desktop preview with notch
- **Paste & copy** — clipboard paste button for addresses, copy buttons on results
- **Buy buttons** — one-tap $50/$200/$500 buy after screening
- **Color-coded responses** — green (safe), yellow (warn), red (danger) for all data

### ML Pipeline (SageMaker Fine-Tuning)
- **Training data export** — extracts intent-classification pairs and trade outcome data from PostgreSQL to S3
- **LoRA fine-tuning** — launches SageMaker training jobs using HuggingFace containers with QLoRA (Mistral-7B base)
- **Model deployment** — deploys fine-tuned models as SageMaker real-time endpoints (HuggingFace TGI)
- **Automatic fallback** — SageMaker inference with OpenRouter fallback if endpoint is unavailable
- **Full pipeline** — one-click export → train → deploy via `POST /api/v1/ml/pipeline`

### Supervisor Dashboard (React, 9 Tabs)
- **Agents** — full agent CRUD, lifecycle management, status monitoring
- **Brokers** — regional broker cards (US/EU/APAC) with compliance and leverage details
- **Policies** — global risk settings, chain/token allowlists
- **Events** — real-time agent event stream
- **Trade Lifecycle** — visual 15-step pipeline with 4 terminal states
- **Helpers** — helper agent health, queue depth, processed count
- **Hibernation** — 4-state distribution, threshold configuration
- **Security** — trust chain visualization, 6 security layers, approval token config
- **Audit** — tamper-evident audit log viewer

---

## Project Structure

```
coindcx-trading-agent/
├── src/
│   ├── adapters/            # Host app integration adapters
│   │   ├── host-app-adapter.ts  # Interface: KYC, policy, relay, auth
│   │   ├── coindcx-adapter.ts   # CoinDCX-specific implementation
│   │   └── generic-adapter.ts   # Default/generic implementation
│   ├── agent/               # User Personal Agent (Tier 2)
│   │   ├── user-agent.ts        # Per-user agent, strategy cycles, heartbeats
│   │   ├── strategy-engine.ts   # DCA, momentum, mean-reversion, grid, copy-trade
│   │   ├── memory-store.ts      # Per-user vector memory (trades, decisions, chat)
│   │   ├── system-prompt.ts     # Dynamic prompt with user context injection
│   │   ├── agent-command-handler.ts  # start/stop/pause/resume/destroy commands
│   │   └── agent-reporter.ts    # Heartbeat and metric reports
│   ├── api/                 # Fastify REST + WebSocket API
│   │   ├── server.ts            # Fastify setup, CORS, JWT WebSocket auth
│   │   └── routes/
│   │       ├── health.ts        # /health, /ready
│   │       ├── chat.ts          # AI chat with 18 NLP intents + LLM
│   │       ├── trade.ts         # Buy/sell quote + execution
│   │       ├── portfolio.ts     # Positions, P&L, trade history
│   │       ├── perps.ts         # Hyperliquid perps (US stocks)
│   │       ├── tokens.ts        # Token search, trending, screening
│   │       ├── leaderboard.ts   # GMGN leaderboard + copy trade CRUD
│   │       ├── config.ts        # Strategy templates and CRUD
│   │       ├── control.ts       # Agent start/stop, risk settings
│   │       ├── admin.ts         # System overview
│   │       ├── supervisor.ts    # Master agent management endpoints
│   │       ├── broker.ts        # Broker CRUD, compliance, fees
│   │       ├── gateway.ts       # Deposit/withdraw gateway
│   │       └── ml.ts            # ML pipeline (export, train, deploy, inference)
│   ├── audit/               # Immutable audit trail
│   │   └── audit-logger.ts      # SHA-256 hash-chained entries (PostgreSQL)
│   ├── broker/              # Regional Broker Agents (Tier 1)
│   │   ├── broker-agent.ts      # Long-running broker process
│   │   ├── compliance-engine.ts # US (SEC/FinCEN), EU (MiFID), APAC (MAS)
│   │   ├── kyc-gate.ts          # KYC verification + Enhanced Due Diligence
│   │   └── fee-aggregator.ts    # Batch fee collection from user agents
│   ├── core/                # Shared infrastructure
│   │   ├── config.ts            # All env vars, 12 service modes
│   │   ├── types.ts             # Chain, TradeState, Position, Strategy types
│   │   ├── state-machine.ts     # 15-state trade lifecycle FSM
│   │   ├── chain-registry.ts    # 14 chain configs (RPC, tokens, explorers)
│   │   ├── orchestrator.ts      # Configurable interval loop + graceful shutdown
│   │   ├── redis.ts             # Singleton ioredis client
│   │   ├── logger.ts            # Pino structured JSON logging
│   │   ├── ws-hub.ts            # Master-side Redis interface (send/broadcast/consume)
│   │   ├── ws-gateway.ts        # WebSocket Gateway Instance (connections + Redis routing)
│   │   ├── ws-client.ts         # Auto-reconnecting WebSocket client (JWT auth)
│   │   └── ws-types.ts          # Message types, Redis keys, direction validation
│   ├── data/                # Market data & intelligence
│   │   ├── price-feed.ts        # CoinGecko + Jupiter + DexScreener, LRU cache
│   │   ├── token-screener.ts    # 6-factor scoring from 5 intelligence sources
│   │   ├── intent-engine.ts     # LLM function-calling for 18 intents
│   │   ├── copy-engine.ts       # Wallet monitor → copy trade simulation
│   │   ├── wallet-monitor.ts    # Helius RPC polling (15s) for swap events
│   │   ├── dca-engine.ts        # Dollar-cost averaging plans
│   │   ├── limit-orders.ts      # TP/SL/limit buy/sell (30s check loop)
│   │   ├── conditional-rules.ts # RSI, MACD, volume, cross-token triggers
│   │   ├── llm.ts               # Dual LLM: OpenRouter + SageMaker fallback
│   │   ├── ohlcv.ts             # OHLCV candlestick data
│   │   └── price-alerts.ts      # Price alert notifications
│   ├── ml/                  # ML pipeline (SageMaker fine-tuning)
│   │   ├── data-export.ts       # Export training data (intents + trade outcomes) to S3
│   │   └── sagemaker.ts         # SageMaker training, deployment, inference
│   ├── db/                  # Database layer
│   │   ├── schema.ts            # 17 Drizzle ORM table definitions
│   │   └── index.ts             # DB client init, isDbConfigured() guard
│   ├── gateway/             # Platform ↔ Agent Economy boundary
│   │   ├── trade-lifecycle.ts   # 11-step saga orchestrator
│   │   ├── deposit-gateway.ts   # Inbound funds (platform → agent economy)
│   │   └── withdraw-gateway.ts  # Outbound funds (dual-sig required)
│   ├── helpers/             # Helper Agent Pool (Tier 3)
│   │   ├── base-helper.ts       # Abstract base: Redis Stream consumer group
│   │   ├── market-data-agent.ts # Price feeds, 30s publish cycle
│   │   ├── risk-analyzer-agent.ts   # Kelly sizing, regime detection
│   │   ├── strategy-executor-agent.ts # DEX execution (Jupiter/1inch/0x/HL)
│   │   └── notification-agent.ts    # Trade confirmations, alerts
│   ├── permissions/         # RBAC (admin/broker/ops/user, 30+ actions)
│   │   └── permissions.ts
│   ├── risk/                # Risk engine
│   │   ├── circuit-breaker.ts   # Rolling loss window, emergency halt (PostgreSQL)
│   │   ├── risk-manager.ts      # Kelly Criterion, regime detection (Redis)
│   │   └── parameter-bounds.ts  # Position size clamping, parameter limits
│   ├── security/            # 6-layer security framework
│   │   ├── message-signer.ts    # HMAC-SHA256 signed envelopes + nonce mgmt
│   │   ├── trust-chain.ts       # ECDSA P-256 certificate hierarchy
│   │   ├── approval-token.ts    # One-time trade approval tokens (30s TTL)
│   │   └── data-isolation.ts    # Per-user namespace enforcement (ns:{userId})
│   ├── supervisor/          # Master Agent (Tier 0)
│   │   ├── supervisor.ts        # MasterAgent: root CA, WsHub, manifest
│   │   ├── approval-engine.ts   # Multi-factor trade approval
│   │   ├── policy-engine.ts     # Global limits, chain/token allowlists
│   │   ├── agent-registry.ts    # Redis-backed agent CRUD + metrics
│   │   ├── command-bus.ts       # Signed command dispatch (Redis Pub/Sub)
│   │   ├── event-collector.ts   # Upstream event consumer (Redis Streams)
│   │   ├── fee-ledger.ts        # Append-only fee records (PostgreSQL)
│   │   └── hibernation-manager.ts # 4-state agent lifecycle
│   ├── trader/              # Order execution
│   │   ├── order-executor.ts    # Routes to venue-specific executor
│   │   ├── jupiter-executor.ts  # Solana swaps (Jupiter v6)
│   │   ├── oneinch-executor.ts  # EVM swaps (1inch Fusion)
│   │   ├── zerox-executor.ts    # EVM swaps (0x, fallback)
│   │   ├── hyperliquid-executor.ts  # Perpetuals (Hyperliquid)
│   │   ├── trade-memory.ts      # Trade record CRUD (PostgreSQL)
│   │   ├── position-manager.ts  # Position lifecycle (PostgreSQL)
│   │   ├── fee-manager.ts       # Fee calculation + reservation lifecycle
│   │   ├── nonce-manager.ts     # Distributed nonce management (Redis INCR)
│   │   └── gas-manager.ts       # EVM gas estimation
│   ├── wallet/              # KMS-backed wallet management
│   │   ├── key-manager.ts       # AWS KMS key encryption
│   │   ├── solana-wallet.ts     # Solana transaction signing
│   │   ├── evm-wallet.ts        # EVM transaction signing
│   │   └── deposit-withdraw.ts  # Balance checks + transfers
│   └── index.ts             # Entry point (12 service modes)
├── tests/                   # Unit tests (Vitest, 80%+ coverage)
│   ├── helpers/mock-db.ts       # Proxy-based Drizzle ORM + Redis mock utilities
│   ├── core/                    # config, ws-types, state-machine, chain-registry
│   ├── security/                # message-signer, trust-chain, approval-token, data-isolation
│   ├── risk/                    # circuit-breaker, risk-manager, parameter-bounds
│   ├── trader/                  # fee-manager, nonce-manager, trade-memory, position-manager
│   ├── supervisor/              # command-bus, event-collector, fee-ledger
│   ├── ml/                      # data-export, sagemaker
│   ├── audit/                   # audit-logger
│   └── db/                      # db client
├── dashboard/               # React 19 + Vite supervisor dashboard
│   └── src/
│       ├── pages/               # 11 pages: Supervisor, Admin, Dashboard, etc.
│       ├── app/
│       │   ├── screens/         # Mobile-embedded screens (Chat, Home, Portfolio, etc.)
│       │   ├── components/      # ChatBubble, TraderCard, StrategyTemplateCard, etc.
│       │   ├── context/         # AppContext, TradingDataContext
│       │   ├── services/        # blockchain.ts, chatEngine.ts, liveData.ts
│       │   └── layouts/         # PhoneFrame, MobileLayout
│       ├── components/          # Shared UI (Button, Card, Badge, StatCard)
│       └── api/client.ts        # Full API client (supervisor, brokers, gateway)
├── mobile_app/              # Flutter mobile app
│   └── lib/
│       ├── features/
│       │   ├── chat/            # AI chat UI with rich cards
│       │   ├── discovery/       # Trending feed, hot carousel, gainers
│       │   ├── portfolio/       # Holdings & trade history
│       │   └── token_detail/    # Full audit, holder data, contract addr
│       └── core/                # Theme, API client, providers
├── vitest.config.ts         # Test configuration (V8 coverage)
├── docker-compose.yml       # Master + 3 brokers + 6 helpers + infra
├── Dockerfile
├── TRD.md                   # Technical Requirements Document (HLD + LLD)
└── COPY_TRADE_HANDOFF.md    # Production deferred items
```

---

## Service Modes

The application runs in one of 12 service modes, set via `SERVICE_MODE` environment variable:

| Mode | Port | Dependencies | Description |
|------|------|-------------|-------------|
| `api` | 3000 | None (in-memory OK) | Standalone API server |
| `master` | 3001 | PostgreSQL, Redis | Master Agent + WebSocket Gateway + API |
| `broker` | — | Redis | Regional Broker Agent (set `BROKER_JURISDICTION`) |
| `helper-market` | — | Redis | Market Data Helper — price feed publishing |
| `helper-risk` | — | Redis | Risk Analyzer Helper — trade risk assessment |
| `helper-executor` | — | Redis | Strategy Executor Helper — DEX execution |
| `helper-notification` | — | Redis | Notification Helper — alerts and confirmations |
| `helper-chat` | — | Redis | Chat/NLP Helper — LLM integration |
| `helper-backtest` | — | Redis | Backtesting Helper — strategy simulation |
| `data-ingestion` | — | Redis | Price feeds + wallet tracker |
| `signal-worker` | — | Redis, PostgreSQL | Strategy evaluation (15s cycle) |
| `executor` | — | Redis | Direct trade execution (2s cycle) |
| `supervisor` | 3000 | PostgreSQL, Redis | Legacy single-tier supervisor + API |

---

## Database Schema (PostgreSQL)

17 tables managed by Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `trades` | Full trade records with 15-state lifecycle, idempotency |
| `positions` | Open/closed positions with P&L and high water mark |
| `user_stats` | Aggregated per-user performance (PnL, win rate) |
| `audit_log` | SHA-256 hash-chained tamper-evident audit trail |
| `fee_ledger` | Append-only fee records per trade |
| `fee_reservations` | Atomic fee lifecycle (reserved → settled / refunded) |
| `builder_fees` | DEX builder fee tracking (Hyperliquid) |
| `circuit_breaker_losses` | Rolling loss window for circuit breaker |
| `circuit_breaker_trips` | Active circuit breaker trips |
| `global_settings` | Global halt flag, system settings |
| `strategies` | User strategy configurations |
| `agent_instances` | Active agent records |
| `risk_settings` | Per-user risk configuration |
| `chat_messages` | Chat conversation history |
| `lead_traders` | Copy trading leaderboard |
| `copy_configs` | User copy trading configurations |

---

## API Endpoints

### Health & System
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe |
| GET | `/ready` | Readiness probe |

### AI Chat
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/chat` | Send chat message with AI intent detection |
| POST | `/api/v1/chat/copy-confirm` | Confirm copy trade config from modal |

### Trading
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/trade/quote` | Get trade quote |
| POST | `/api/v1/trade/execute` | Execute trade (dry-run or live) |
| GET | `/api/v1/trade/portfolio` | Portfolio summary |

### Perpetuals (Hyperliquid)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/perps/assets` | List perp assets |
| POST | `/api/v1/perps/quote` | Perps quote with leverage |
| POST | `/api/v1/perps/trade` | Open perps position |
| POST | `/api/v1/perps/close` | Close perps position |
| GET | `/api/v1/perps/positions` | List open perps positions |

### Tokens & Discovery
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/chains` | Supported chains |
| GET | `/api/v1/chains/health` | Chain RPC health |
| GET | `/api/v1/tokens/search?q=` | Search tokens |
| GET | `/api/v1/tokens/trending` | DexScreener trending |
| GET | `/api/v1/tokens/gainers` | Top gainers |
| GET | `/api/v1/tokens/new-pairs` | New pairs |
| GET | `/api/v1/tokens/symbol/:symbol` | By symbol |
| GET | `/api/v1/tokens/address/:address` | By contract address |

### Portfolio
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/portfolio` | Full portfolio |
| GET | `/api/v1/portfolio/positions` | All positions |
| GET | `/api/v1/portfolio/positions/:id` | Single position |
| GET | `/api/v1/portfolio/trades` | Trade history |

### Copy Trading & Leaderboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/leaderboard/live` | GMGN live leaderboard |
| GET | `/api/v1/leaderboard/kols` | KOL wallets |
| GET | `/api/v1/leaderboard` | Lead traders (DB) |
| POST | `/api/v1/copy/:leaderId` | Start copying |
| DELETE | `/api/v1/copy/:leaderId` | Stop copying |
| POST | `/api/v1/copy/wallet` | Copy by wallet |
| POST | `/api/v1/copy/:wallet/pause` | Pause |
| POST | `/api/v1/copy/:wallet/resume` | Resume |
| GET | `/api/v1/copy/wallet` | List active configs |
| GET | `/api/v1/copy/activity` | Recent activity |

### Strategies
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/templates` | Strategy templates |
| POST | `/api/v1/strategies` | Create strategy |
| GET | `/api/v1/strategies` | List strategies |
| PUT | `/api/v1/strategies/:id` | Update strategy |
| DELETE | `/api/v1/strategies/:id` | Delete strategy |

### Supervisor (Master Agent)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/supervisor/agents` | List all agents |
| POST | `/api/v1/supervisor/agents` | Create agent |
| POST | `/api/v1/supervisor/agents/:id/start` | Start agent |
| POST | `/api/v1/supervisor/agents/:id/stop` | Stop agent |
| POST | `/api/v1/supervisor/agents/:id/pause` | Pause agent |
| POST | `/api/v1/supervisor/agents/:id/resume` | Resume agent |
| POST | `/api/v1/supervisor/agents/:id/destroy` | Destroy agent |
| POST | `/api/v1/supervisor/agents/:id/force-close` | Force close positions |
| POST | `/api/v1/supervisor/agents/:id/hibernate` | Hibernate agent |
| POST | `/api/v1/supervisor/agents/:id/wake` | Wake agent |
| POST | `/api/v1/supervisor/approvals` | Request trade approval |
| GET | `/api/v1/supervisor/fees` | Fee summary |
| GET | `/api/v1/supervisor/risk-snapshot` | Global risk snapshot |
| POST | `/api/v1/supervisor/emergency-halt` | Emergency halt |
| POST | `/api/v1/supervisor/resume-all` | Resume from halt |
| GET | `/api/v1/supervisor/policies` | Global policies |
| PUT | `/api/v1/supervisor/policies` | Update policies |
| GET | `/api/v1/supervisor/events` | Event stream |
| GET | `/api/v1/supervisor/regulatory/report` | Regulatory report |

### Brokers
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/brokers` | List brokers |
| POST | `/api/v1/brokers` | Register broker |
| GET | `/api/v1/brokers/:id` | Broker details |
| GET | `/api/v1/brokers/:id/agents` | Agents under broker |
| GET | `/api/v1/brokers/:id/compliance` | Compliance stats |
| GET | `/api/v1/brokers/:id/fees` | Fee aggregation |

### Gateway
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/gateway/deposit` | Deposit funds |
| POST | `/api/v1/gateway/withdraw` | Withdraw (dual-sig) |
| GET | `/api/v1/gateway/transactions` | Transaction history |

### ML Pipeline
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/ml/status` | ML status (inference backend, endpoints, recent jobs) |
| POST | `/api/v1/ml/export` | Export training data to S3 (intent / trades / all) |
| POST | `/api/v1/ml/train` | Start SageMaker fine-tuning job |
| GET | `/api/v1/ml/train/:jobName` | Training job status |
| POST | `/api/v1/ml/deploy` | Deploy model as SageMaker endpoint |
| GET | `/api/v1/ml/endpoints/:name` | Endpoint status |
| DELETE | `/api/v1/ml/endpoints/:name` | Tear down endpoint |
| POST | `/api/v1/ml/pipeline` | Full pipeline: export → train |

### Agent Control
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/agent/start` | Start personal agent |
| POST | `/api/v1/agent/stop` | Stop personal agent |
| POST | `/api/v1/agent/emergency-stop` | Emergency stop |
| GET | `/api/v1/agent/status` | Agent status |
| GET | `/api/v1/risk` | Risk settings |
| PUT | `/api/v1/risk` | Update risk settings |
| POST | `/api/v1/admin/emergency-halt` | Global halt |
| POST | `/api/v1/admin/resume` | Resume from halt |
| GET | `/api/v1/admin/circuit-breakers` | Circuit breaker status |
| GET | `/api/v1/admin/overview` | System overview |

---

## Getting Started

### Prerequisites

- **Node.js 20+** (via nvm)
- **Flutter 3.32+** (for the mobile app)
- npm

### Quick Start — Mobile App + Backend API

```bash
# 1. Clone and install
git clone https://github.com/kushagra93/coindcx-trading-agent.git
cd coindcx-trading-agent
npm install

# 2. Create .env
cat > .env << 'EOF'
SERVICE_MODE=api
DRY_RUN=true
PORT=3000
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=minimax/minimax-m2.5
BIRDEYE_API_KEY=your_birdeye_key_here
HELIUS_API_KEY=your_helius_key_here
EOF

# 3. Start backend (Terminal 1)
npm run dev

# 4. Start Flutter app (Terminal 2)
cd mobile_app
flutter pub get
flutter run -d chrome --web-port 8080

# Open http://localhost:8080
```

### Quick Start — Supervisor Dashboard

```bash
npm install
cd dashboard && npm install && cd ..
npm run dashboard
# Open http://localhost:5174/app/home
```

### Full Multi-Tier Deployment

```bash
docker-compose up -d

# Services started:
#   master        - Master Agent (port 3001)
#   broker-us     - US Broker Agent
#   broker-eu     - EU Broker Agent
#   broker-apac   - APAC Broker Agent
#   helper-market - Market Data Helper
#   helper-risk   - Risk Analyzer Helper
#   helper-exec   - Strategy Executor Helper
#   helper-notify - Notification Helper
#   helper-chat   - Chat/NLP Helper
#   helper-bt     - Backtesting Helper
#   postgres      - PostgreSQL
#   redis         - Redis
```

### API Keys

| Variable | Required | Where to get | Purpose |
|----------|----------|-------------|---------|
| `OPENROUTER_API_KEY` | **Yes** (for AI chat) | [openrouter.ai](https://openrouter.ai) | LLM-powered chat responses |
| `OPENROUTER_MODEL` | No | — | Defaults to `minimax/minimax-m2.5` |
| `BIRDEYE_API_KEY` | No | [birdeye.so](https://birdeye.so) | Token holder distribution data |
| `HELIUS_API_KEY` | No | [helius.dev](https://helius.dev) | Solana token holder counts |

> **Note**: The app works without any API keys — trending tokens, screening, and trading all use DexScreener (free, no key needed). The OpenRouter key enables AI-powered chat. Birdeye/Helius keys add richer holder data to screening results.

### Environment Variables (Full Backend)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SERVICE_MODE` | Yes | `api` | Service mode (see table above) |
| `DRY_RUN` | No | `true` | Paper trading (no on-chain execution) |
| `PORT` | No | `3000` | HTTP server port |
| `DATABASE_URL` | For production | — | PostgreSQL connection string |
| `REDIS_URL` | For production | `redis://localhost:6379` | Redis connection string |
| `BROKER_JURISDICTION` | For broker mode | `GLOBAL` | `US`, `EU`, `APAC`, or `GLOBAL` |
| `SOLANA_RPC_URL` | For live trading | `https://api.devnet.solana.com` | Solana JSON-RPC |
| `EVM_RPC_URL` | For live trading | — | EVM RPC endpoint |
| `GATEWAY_JWT_SECRET` | For production | dev default | JWT secret for WebSocket auth |
| `SECURITY_MASTER_KEY_ID` | For production | — | Master HMAC signing key ID |
| `SAGEMAKER_REGION` | For ML | `us-west-2` | AWS region for SageMaker |
| `SAGEMAKER_ROLE_ARN` | For ML | — | IAM role for SageMaker jobs |
| `SAGEMAKER_S3_BUCKET` | For ML | — | S3 bucket for training data |
| `SAGEMAKER_BASE_MODEL` | For ML | `mistralai/Mistral-7B-Instruct-v0.3` | Base model for fine-tuning |
| `SAGEMAKER_USE_INFERENCE` | For ML | `true` | Use SageMaker for inference (fallback to OpenRouter) |
| `SAGEMAKER_INTENT_ENDPOINT` | For ML | — | SageMaker endpoint for intent classification |
| `SAGEMAKER_CHAT_ENDPOINT` | For ML | — | SageMaker endpoint for chat completion |

See `TRD.md` §4.9 for the complete list of 60+ environment variables.

---

## Development

### Project Scripts

```bash
# Backend
npm run dev              # Start with hot reload (tsx watch)
npm run build            # Compile TypeScript
npm run start            # Start without watch
npm run typecheck        # Type check without emit
npm run lint             # ESLint

# Testing
npm run test             # Run unit tests (vitest)
npm run test:coverage    # Run with V8 coverage report
npm run test:watch       # Watch mode

# Database (requires DATABASE_URL)
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run migrations
npm run db:push          # Push schema to DB
npm run db:studio        # Open Drizzle Studio

# Dashboard
npm run dashboard        # Start Vite dev server on :5174
cd dashboard && npm run build   # Production build
```

### Test Suite

Unit tests across 29 test files with **80%+ statement coverage**:

| Domain | Tests | Coverage Areas |
|--------|-------|----------------|
| Core | 4 files | config, ws-types, state-machine, chain-registry |
| Security | 8 files | message-signer, trust-chain, approval-token, data-isolation, permissions (pure + Redis) |
| Risk | 4 files | circuit-breaker, risk-manager, parameter-bounds, types |
| Trader | 4 files | fee-manager, nonce-manager, trade-memory, position-manager |
| Supervisor | 3 files | command-bus, event-collector, fee-ledger |
| ML | 2 files | data-export (training data extraction, tool call parsing), sagemaker (schema building, text parsing) |
| Audit | 1 file | audit-logger |
| DB | 1 file | db client + isDbConfigured |

Mock infrastructure uses a Proxy-based Drizzle ORM mock and ioredis mock in `tests/helpers/mock-db.ts`.

### Host App Adapter Pattern

The system integrates with any finance app through the `HostAppAdapter` interface:

```typescript
interface HostAppAdapter {
  verifyKYC(userId: string): Promise<KYCStatus>;
  getTradeLimit(userId: string): Promise<TradeLimits>;
  isTokenAllowed(token: string, chain: string): Promise<boolean>;
  authenticateRequest(token: string): Promise<AuthResult>;
  // ...
}
```

Set `HOST_APP_ADAPTER=coindcx` or `HOST_APP_ADAPTER=generic` to switch implementations.

### Adding a New Helper Agent

1. Create `src/helpers/my-agent.ts` extending `BaseHelper`
2. Implement `processTask(task: HelperTask): Promise<HelperResult>`
3. Add type to `HelperAgentType` union in `src/helpers/types.ts`
4. Add case to `startHelperMode()` in `src/index.ts`
5. Add `SERVICE_MODE=helper-myagent` to docker-compose

### Adding a New Chat Command

1. Add intent type to the `Intent` union in `chatEngine.ts`
2. Add detection pattern in `detectIntent()`
3. Create handler function `handle<Intent>()`
4. Add case to the switch in `processMessage()`

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | TypeScript, Fastify, Drizzle ORM, PostgreSQL, Redis (Streams + Pub/Sub), Pino, AWS SageMaker |
| **Dashboard** | React 19, Vite, TypeScript, Recharts, Lucide Icons |
| **Mobile** | Flutter 3.32, Dart, Riverpod, CoinDCX Design System |
| **Blockchain** | @solana/web3.js, ethers.js, Jupiter v6 API, Hyperliquid SDK |
| **Security** | ECDSA P-256 trust chain, HMAC-SHA256 signing, AWS KMS, hash-chained audit |
| **Communication** | Redis Streams (consumer groups), Redis Pub/Sub (signed envelopes), WebSocket (JWT auth) |
| **Testing** | Vitest, V8 coverage, Proxy-based mocking |
| **Infra** | Docker, docker-compose, Kubernetes-ready |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and ensure `npm run typecheck` passes
4. Run tests: `npm run test`
5. Test the dashboard: `npm run dashboard`
6. Commit with descriptive messages
7. Push and open a PR

### Code Style
- TypeScript strict mode
- Functional components with hooks (React/Dashboard)
- No new dependencies unless necessary
- Inline CSS-in-JS (dashboard — matches existing pattern)

---

## Documentation

| Document | Description |
|----------|-------------|
| `TRD.md` | Technical Requirements Document with full HLD and LLD |
| `COPY_TRADE_HANDOFF.md` | Copy trading production deferred items |
| `architecture-deviations.mdc` | Documented deviations from target architecture |
| `CHANGES.md` | Changelog of all uncommitted architectural changes |

---

## Changelog

### v0.6.0 — ML Pipeline + SageMaker Fine-Tuning (2026-03-13)
- **ML training pipeline**: Export chat intents and trade outcomes to S3 as JSONL for supervised fine-tuning
- **SageMaker integration**: Launch LoRA/QLoRA training jobs on HuggingFace containers (Mistral-7B base)
- **Model deployment**: Deploy fine-tuned models as SageMaker real-time endpoints with HuggingFace TGI
- **Dual inference**: SageMaker endpoint for intent classification and chat, with automatic OpenRouter fallback
- **ML API routes**: 8 endpoints for status, export, train, deploy, delete, and full pipeline orchestration
- **Separate intent model**: Gemini 2.5 Flash for intent classification, MiniMax M2.5 for chat responses

### v0.5.0 — Stateless Architecture + Security + Tests (2026-03-13)
- **Stateless refactor**: Migrated all in-memory state to PostgreSQL (durable) and Redis (ephemeral) for horizontal scalability
- **Redis communication backbone**: WebSocket Gateway Cluster pattern with Redis Pub/Sub and Streams for inter-agent messaging
- **HMAC-SHA256 message signing**: All inter-agent messages are cryptographically signed with nonce and timestamp freshness
- **Host app adapters**: Pluggable `HostAppAdapter` interface for CoinDCX or any finance app integration
- **Database schema**: 17 PostgreSQL tables via Drizzle ORM with migrations
- **Graceful degradation**: App starts without PostgreSQL/Redis using `isDbConfigured()` guards
- **Unit test suite**: 29 test files with 80%+ statement coverage (Vitest + V8)

### v0.4.0 — DexScreener Trending Feed (2026-03-12)
- **Discovery overhaul**: Replaced hardcoded token list with DexScreener Token Boosts API (`/token-boosts/top/v1`)
- **Table layout**: Discovery screen now shows ranked tokens in a DexScreener-style table
- **Added 6h price change**: Backend and Flutter models now carry 5m, 1h, 6h, and 24h price changes

### v0.3.0 — Trending, Sell Flow, Push (2026-03-12)
- **Trending filter**: Show top volume tokens that are green on 24h timeframe
- **Sell flow**: Added sell functionality in chat and portfolio screen
- **Portfolio refresh**: Auto-refresh portfolio data when navigating to the Portfolio tab

### v0.2.0 — LLM Chat, Trade Execution, Birdeye/Helius (2026-03-12)
- **LLM integration**: Connected OpenRouter (MiniMax M2.5) for AI-powered chat responses with context injection
- **Chat UI cards**: Rich rendering for trending, screening, price, trade preview, and trade executed cards
- **End-to-end trade flow**: Buy/sell from chat with confirm button, dry-run execution, portfolio tracking
- **Birdeye + Helius**: Optional API integrations for richer token holder data

### v0.1.0 — Flutter Mobile App + Backend API (2026-03-11)
- **Flutter mobile app**: CoinDCX design system, Riverpod state management, 4-tab navigation
- **Backend API routes**: Token search, trending, screening, chat, trade quote/execute, portfolio
- **Live data**: DexScreener for market data, RugCheck for Solana safety, GoPlus for EVM security

## License

MIT
