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
- **PostgreSQL / Redis** — all state is in-memory
- **AWS KMS** — not used in dry-run mode
- **Solana / EVM wallets** — trades are simulated
- **Docker** — runs directly with Node + Flutter
- **Paid API tiers** — free plans work for all APIs

### Chat Agent Capabilities & Triggers

The AI chat understands **18 intents** via NLP. Here's every trigger:

| Intent | Trigger Words | What Happens |
|---|---|---|
| **confirm_buy** | "confirm buy", "confirm purchase" | Executes pending buy trade |
| **confirm_sell** | "confirm sell" | Executes pending sell trade |
| **limit_order** | "take profit", "stop loss", "limit order/sell/buy", "set tp/sl", "trail" | Informs user this isn't supported yet |
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

### Project Structure

```
├── src/                          # Backend (TypeScript, Fastify)
│   ├── api/routes/
│   │   ├── chat.ts               # AI chat with 18 NLP intents + LLM
│   │   ├── tokens.ts             # Token screening & trending APIs
│   │   ├── trade.ts              # Buy/sell execution (dry-run)
│   │   ├── leaderboard.ts        # GMGN leaderboard + copy trade CRUD
│   │   └── ...
│   ├── data/
│   │   ├── token-screener.ts     # DexScreener + Birdeye + RugCheck + Helius
│   │   ├── wallet-monitor.ts     # Helius RPC polling for wallet swaps
│   │   ├── copy-engine.ts        # Copy trade filtering & simulation
│   │   └── llm.ts                # OpenRouter LLM integration
│   └── ...
├── mobile_app/                   # Flutter app
│   └── lib/
│       ├── features/
│       │   ├── chat/             # AI chat UI with rich cards
│       │   ├── discovery/        # Trending feed, hot carousel, gainers
│       │   ├── portfolio/        # Holdings & trade history
│       │   └── token_detail/     # Full audit, holder data, contract addr
│       └── core/                 # Theme, API client, providers
├── COPY_TRADE_HANDOFF.md         # Production deferred items doc
└── HANDOFF.md                    # Full feature handoff doc
```

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
| **0 - Master** | `MasterAgent` | Root CA, trade approval tokens (30s expiry), immutable fee ledger, global risk snapshot, regulatory reports, hibernation sweeps |
| **1 - Broker** | `BrokerAgent` | Regional compliance (US/EU/APAC), KYC gating, position limit enforcement, fee aggregation, dual-sig withdrawals, user agent cert issuance |
| **2 - User** | `UserAgent` | Personal trading agent (1:1 per user), strategy evaluation, 11-step trade lifecycle orchestration, portfolio/position tracking, memory store |
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

**Atomic Rule**: Fee reservation and trade execution always succeed or fail together. On failure, `FEE_REFUNDED` compensates automatically.

---

## Gateway Isolation

The Agent Economy is isolated from the host platform through two gateway boundaries:

| Gateway | Direction | Endpoint | Flow |
|---------|-----------|----------|------|
| **Deposit** | Platform -> Agent Economy | `POST /api/v1/gateway/deposit` | Validate platform sig -> verify KYC via broker -> credit wallet -> audit -> notify |
| **Withdraw** | Agent Economy -> Platform | `POST /api/v1/gateway/withdraw` | Verify dual-sig (user + broker) -> check balance -> execute -> audit -> notify |

---

## Agent Hibernation

Agents transition through 4 states based on activity to optimize resource usage:

| State | Trigger | Storage | Wake Latency |
|-------|---------|---------|-------------|
| **Active** | Currently trading (~5% of agents) | In-memory | - |
| **Idle** | No activity for 30 min (~90%) | In-memory (reduced) | Instant |
| **On-Demand** | No activity for 2 hours | Redis snapshot | <100ms |
| **Deep Archive** | No activity for 24 hours | PostgreSQL | ~500ms |

---

## Project Structure

```
coindcx-trading-agent/
├── src/
│   ├── agent/               # User Personal Agent (Tier 2)
│   │   ├── user-agent.ts        # 11-step trade lifecycle, per-user agent
│   │   ├── strategy-engine.ts   # DCA, momentum, mean-reversion, grid, copy-trade
│   │   ├── memory-store.ts      # Per-user vector memory (trades, decisions, chat)
│   │   ├── system-prompt.ts     # Dynamic prompt with user context injection
│   │   ├── agent-command-handler.ts
│   │   └── agent-reporter.ts
│   ├── api/                 # Fastify REST + WebSocket API
│   │   ├── routes/
│   │   │   ├── supervisor.ts    # Master agent management endpoints
│   │   │   ├── broker.ts        # Broker CRUD, compliance, fees
│   │   │   ├── gateway.ts       # Deposit/withdraw gateway
│   │   │   ├── leaderboard.ts   # Copy trading leaderboard
│   │   │   └── ...
│   │   └── server.ts
│   ├── broker/              # Regional Broker Agents (Tier 1)
│   │   ├── broker-agent.ts      # Long-running broker process
│   │   ├── compliance-engine.ts # Per-jurisdiction compliance rules
│   │   ├── fee-aggregator.ts    # Batch fee collection from user agents
│   │   ├── kyc-gate.ts          # KYC verification + Enhanced Due Diligence
│   │   └── types.ts
│   ├── core/                # Shared infrastructure
│   │   ├── config.ts            # 8 service modes, all config sections
│   │   ├── state-machine.ts     # 15-state trade lifecycle FSM
│   │   ├── orchestrator.ts      # Configurable interval loop
│   │   ├── types.ts             # TradeState, Chain, Strategy types
│   │   └── logger.ts
│   ├── gateway/             # Platform <-> Agent Economy boundary
│   │   ├── deposit-gateway.ts   # Inbound funds (platform -> agent economy)
│   │   ├── withdraw-gateway.ts  # Outbound funds (dual-sig required)
│   │   ├── trade-lifecycle.ts   # 11-step saga orchestrator
│   │   └── types.ts
│   ├── helpers/             # Helper Agent Pool (Tier 3)
│   │   ├── base-helper.ts       # Abstract base: Redis Stream consumer group
│   │   ├── market-data-agent.ts # CoinGecko + Jupiter + DexScreener feeds
│   │   ├── risk-analyzer-agent.ts   # Kelly sizing, regime detection, circuit breaker
│   │   ├── strategy-executor-agent.ts # Jupiter/1inch/0x/Hyperliquid execution
│   │   ├── notification-agent.ts    # Trade confirmations, alerts
│   │   └── types.ts
│   ├── security/            # 6-layer security framework
│   │   ├── message-signer.ts    # HMAC-SHA256 signed envelopes
│   │   ├── trust-chain.ts       # ECDSA P-256 certificate hierarchy
│   │   ├── approval-token.ts    # One-time trade approval tokens (30s TTL)
│   │   ├── data-isolation.ts    # Per-user namespace enforcement
│   │   └── types.ts             # SignedMessage, ApprovalToken, AgentCertificate
│   ├── supervisor/          # Master Agent (Tier 0)
│   │   ├── supervisor.ts        # MasterAgent: root CA, approvals, fee ledger
│   │   ├── approval-engine.ts   # Trade approval with policy checks
│   │   ├── fee-ledger.ts        # Append-only fee records
│   │   ├── hibernation-manager.ts # 4-state agent lifecycle
│   │   ├── agent-registry.ts    # Redis-backed agent CRUD
│   │   ├── command-bus.ts       # Signed Redis Streams + Pub/Sub
│   │   ├── heartbeat-monitor.ts # Dead agent detection
│   │   ├── event-collector.ts   # Consumer groups, at-least-once
│   │   ├── policy-engine.ts     # Global limits, chain/token allowlists
│   │   └── types.ts
│   ├── audit/               # Immutable audit trail
│   ├── data/                # Market data ingestion (price feeds)
│   ├── permissions/         # RBAC (admin/broker/ops/user, 30+ actions)
│   ├── risk/                # Risk engine (circuit breaker, parameter bounds)
│   ├── trader/              # Order execution (Jupiter, 1inch, 0x, Hyperliquid)
│   ├── wallet/              # KMS-backed wallet management
│   └── index.ts             # Entry point (8 service modes)
├── dashboard/               # React 19 + Vite supervisor dashboard
│   └── src/
│       ├── pages/
│       │   └── SupervisorPage.tsx  # 9 tabs: Agents, Brokers, Lifecycle, Helpers, ...
│       └── api/
│           └── client.ts          # Full API client (supervisor, brokers, gateway)
├── docker-compose.yml       # Master + 3 brokers + 6 helpers + infra
└── Dockerfile
```

---

## Service Modes

The application runs in one of 8 service modes, set via `SERVICE_MODE` environment variable:

| Mode | Port | Description |
|------|------|-------------|
| `master` | 3001 | Master Agent — root of trust, trade approvals, fee ledger |
| `broker` | - | Broker Agent — regional compliance (set `BROKER_JURISDICTION`) |
| `helper-market` | - | Market Data Helper — price feed publishing |
| `helper-risk` | - | Risk Analyzer Helper — trade risk assessment |
| `helper-executor` | - | Strategy Executor Helper — DEX trade execution |
| `helper-notification` | - | Notification Helper — alerts and confirmations |
| `helper-chat` | - | Chat/NLP Helper — Claude API for natural language |
| `helper-backtest` | - | Backtesting Helper — strategy simulation |
| `api` | 3000 | Standalone API server |
| `data-ingestion` | - | Price feeds + wallet tracker |
| `signal-worker` | - | Strategy evaluation |
| `executor` | - | Direct trade execution (legacy) |

---

## Features

### AI Trading Agent (Chat Interface)
- **Natural language trading** — "buy FARTCOIN $200", "screen POPCAT", "long TSLA 3x", "screen MON"
- **16+ intent types** — buy, sell, screen, analyze, snipe, DCA, copy, trending, positions, P&L
- **Contract address screening** — paste any EVM (0x...), Solana (base58), Sui/Aptos (0x + 64 hex), or Move module path to auto-screen
- **Token name resolution** — 40+ known contracts auto-resolve across all supported chains

### On-Chain Screening (War Agent)
- **6-factor scoring** — Age, Volume, Liquidity, Holder concentration, LP Lock, RugCheck score
- **5 intelligence sources** — Photon (bundles/LP), Axiom (smart money), FOMO (social), RugCheck (audit), DexScreener (liquidity)
- **AI Confidence & Rug Probability** — composite scores from multi-source data
- **Grade system** — A through F with actionable recommendations

### Multi-Chain Execution (21 Chains)
| Chain | DEX | Assets |
|-------|-----|--------|
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
| Perps | Hyperliquid | US stocks (TSLA, NVDA, AAPL, AMZN) |

*Also supports: Blast, zkSync, Fantom, Linea, Scroll, Mantle, Celo, Gnosis*

### Risk Management (Auto Exit Strategies)
- **Meme coins**: Micro SL (-25%/30s) + Ladder exit (sell 40% at 2.5x) + Trailing (-30%)
- **Blue chips**: SL (-5%) + TP (+20%) + Trailing (-8%)
- **Perps**: SL (-8%) + TP (+15%) + Trailing (-6%)

### US Stock Perps (Hyperliquid)
- **Dedicated perps section** — separated from crypto holdings with LONG/SHRT badges
- **Leverage display** — 2x/3x leverage with entry price and P&L per position
- **Supported stocks** — TSLA, NVDA, AAPL, AMZN with auto exit strategies

### Mobile UI
- **3-tab unified layout** — Portfolio | Signals | Chat
- **12 chain filters** — scrollable chain pills (Solana, Base, Ethereum, Arbitrum, Polygon, BSC, Optimism, Avalanche, Monad, Sui, Aptos)
- **Phone frame simulator** — 375x812 desktop preview with notch
- **Paste & copy** — clipboard paste button for addresses, copy buttons on results
- **Buy buttons** — one-tap $50/$200/$500 buy after screening
- **Color-coded responses** — green (safe), yellow (warn), red (danger) for all data

### Supervisor Dashboard (9 Tabs)
- **Agents** — full agent CRUD, lifecycle management, status monitoring
- **Brokers** — regional broker cards (US/EU/APAC) with compliance and leverage details
- **Policies** — global risk settings, chain/token allowlists
- **Events** — real-time agent event stream
- **Trade Lifecycle** — visual 12-step pipeline with 3 rejection states
- **Helpers** — helper agent health, queue depth, processed count
- **Hibernation** — 4-state distribution, threshold configuration
- **Security** — trust chain visualization, 6 security layers, approval token config
- **Audit** — tamper-evident audit log viewer

---

## API Endpoints

### Supervisor (Master Agent)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/supervisor/agents` | List all managed agents |
| POST | `/api/v1/supervisor/agents` | Create new agent |
| POST | `/api/v1/supervisor/approvals` | Request trade approval |
| GET | `/api/v1/supervisor/fees` | Fee summary by date range |
| POST | `/api/v1/supervisor/fees` | Record fee in ledger |
| GET | `/api/v1/supervisor/risk-snapshot` | Global risk snapshot |
| POST | `/api/v1/supervisor/agents/:id/hibernate` | Hibernate agent |
| POST | `/api/v1/supervisor/agents/:id/wake` | Wake hibernated agent |
| GET | `/api/v1/supervisor/regulatory/report` | Regulatory compliance report |

### Brokers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/brokers` | List all brokers |
| POST | `/api/v1/brokers` | Register new broker |
| GET | `/api/v1/brokers/:id` | Broker details |
| GET | `/api/v1/brokers/:id/agents` | Agents under broker |
| GET | `/api/v1/brokers/:id/compliance` | Compliance stats |
| GET | `/api/v1/brokers/:id/fees` | Fee aggregation |

### Gateway
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/gateway/deposit` | Deposit funds (Platform -> Agent Economy) |
| POST | `/api/v1/gateway/withdraw` | Withdraw funds (requires dual-signature) |
| GET | `/api/v1/gateway/transactions` | List gateway transactions |

---

## Getting Started

### Prerequisites

- **Node.js 18+** (recommend v20 or v24 via nvm)
- **Flutter 3.32+** (for the mobile app)
- npm

### Quick Start — Mobile App + Backend API

This is the recommended way to run the full app (Discovery, AI Chat, Trading, Portfolio):

```bash
# 1. Clone and install backend dependencies
git clone https://github.com/kushagra93/coindcx-trading-agent.git
cd coindcx-trading-agent
npm install

# 2. Create .env file with API keys
cat > .env << 'EOF'
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=minimax/minimax-m2.5
BIRDEYE_API_KEY=your_birdeye_key_here     # optional, enriches holder data
HELIUS_API_KEY=your_helius_key_here       # optional, enriches Solana holder data
EOF

# 3. Start the backend API server (Terminal 1)
NODE_TLS_REJECT_UNAUTHORIZED=0 SERVICE_MODE=api DRY_RUN=true PORT=3000 npx tsx src/index.ts

# 4. Run the Flutter mobile app (Terminal 2)
cd mobile_app
flutter pub get
flutter run -d chrome --web-port 8080

# Open http://localhost:8080
```

### API Keys

| Variable | Required | Where to get | Purpose |
|----------|----------|-------------|---------|
| `OPENROUTER_API_KEY` | **Yes** (for AI chat) | [openrouter.ai](https://openrouter.ai) | LLM-powered chat responses |
| `OPENROUTER_MODEL` | No | — | Defaults to `minimax/minimax-m2.5` |
| `BIRDEYE_API_KEY` | No | [birdeye.so](https://birdeye.so) | Token holder distribution data |
| `HELIUS_API_KEY` | No | [helius.dev](https://helius.dev) | Solana token holder counts |

> **Note**: The app works without any API keys — trending tokens, screening, and trading all use DexScreener (free, no key needed). The OpenRouter key enables AI-powered chat. Birdeye/Helius keys add richer holder data to screening results.

### Quick Start — Supervisor Dashboard (Legacy)

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

### Environment Variables (Full Backend)

See `.env.example` for all configuration options. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `SERVICE_MODE` | Yes | One of: `master`, `broker`, `helper-*`, `api`, etc. |
| `DRY_RUN` | No | `true` for paper trading (default) |
| `BROKER_JURISDICTION` | For broker | `US`, `EU`, `APAC`, or `GLOBAL` |
| `SOLANA_RPC_URL` | For live | Helius/QuickNode Solana RPC |
| `EVM_RPC_URL` | For live | Alchemy/Infura EVM RPC |
| `DATABASE_URL` | For backend | PostgreSQL connection string (optional) |
| `REDIS_URL` | For backend | Redis for streams, pub/sub, and agent state |

---

## Development

### Project Scripts

```bash
# Backend
npm run dev          # Start backend with hot reload
npm run build        # Compile TypeScript
npm run test         # Run tests (vitest)
npm run typecheck    # Type check without emit
npm run lint         # ESLint

# Dashboard
npm run dashboard    # Start Vite dev server on :5174
cd dashboard && npm run build   # Production build
```

### Dashboard Architecture

The dashboard is a standalone React 19 + Vite app under `dashboard/`. Key files:

| File | Purpose |
|------|---------|
| `services/blockchain.ts` | Token DB, screening logic, position management, contract address lookup |
| `services/chatEngine.ts` | NLP intent detection, response generators, conversation context |
| `components/ChatBubble.tsx` | Color-coded chat messages, buy buttons, copy/paste for addresses |
| `screens/MainScreen.tsx` | Unified 3-tab screen (Portfolio, Signals, Chat) |
| `pages/SupervisorPage.tsx` | 9-tab supervisor dashboard (agents, brokers, lifecycle, helpers, security) |
| `context/AppContext.tsx` | Global state (agent status, portfolio, onboarding) |
| `layouts/PhoneFrame.tsx` | Desktop phone simulator (375x812 with notch) |

### Adding a New Token

1. Add to `TOKEN_DB` in `blockchain.ts` with full `TokenMetrics`
2. Add contract address to `CONTRACT_DB` for address-based lookup
3. Add symbol to `ALL_TOKENS` regex in `chatEngine.ts`
4. If meme coin, add to `MEME_TOKENS` set; if perp, add to `PERP_TOKENS`

### Adding a New Chat Command

1. Add intent type to the `Intent` union in `chatEngine.ts`
2. Add detection pattern in `detectIntent()`
3. Create handler function `handle<Intent>()`
4. Add case to the switch in `processMessage()`

### Adding a New Helper Agent

1. Create `src/helpers/my-agent.ts` extending `BaseHelper`
2. Implement `processTask(task: HelperTask): Promise<HelperResult>`
3. Add type to `HelperAgentType` union in `src/helpers/types.ts`
4. Add case to `startHelperMode()` in `src/index.ts`
5. Add `SERVICE_MODE=helper-myagent` to docker-compose

---

## Tech Stack

- **Backend**: TypeScript, Fastify, Drizzle ORM, PostgreSQL, Redis Streams, Pino
- **Dashboard**: React 19, Vite, TypeScript, Recharts, Lucide Icons
- **Blockchain**: @solana/web3.js, ethers.js, Jupiter v6 API, Hyperliquid SDK, Sui/Aptos Move VM
- **Security**: ECDSA P-256 trust chain, HMAC-SHA256 message signing, AWS KMS, hash-chained audit
- **Agent Communication**: Redis Streams (consumer groups), Redis Pub/Sub (signed envelopes)
- **Infra**: Docker, Kubernetes, docker-compose for local dev

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and ensure `npm run typecheck` passes
4. Test the dashboard: `npm run dashboard` and verify at `http://localhost:5174/app/home`
5. Commit with descriptive messages
6. Push and open a PR

### Code Style
- Inline CSS-in-JS (no CSS modules or Tailwind) — matches existing pattern
- No new dependencies unless necessary
- TypeScript strict mode — zero `any` types
- Functional components with hooks

---

## Changelog

### v0.4.0 — DexScreener Trending Feed (2026-03-12)
- **Discovery overhaul**: Replaced hardcoded token list with DexScreener Token Boosts API (`/token-boosts/top/v1`) — shows the same trending/boosted tokens as DexScreener's frontend
- **Table layout**: Discovery screen now shows ranked tokens in a DexScreener-style table with price, 24h change, volume, and market cap columns
- **Added 6h price change**: Backend and Flutter models now carry 5m, 1h, 6h, and 24h price changes

### v0.3.0 — Trending, Sell Flow, Push (2026-03-12)
- **Trending filter**: Show top volume tokens that are green on 24h timeframe
- **Sell flow**: Added sell functionality in chat and portfolio screen
- **Portfolio refresh**: Auto-refresh portfolio data when navigating to the Portfolio tab

### v0.2.0 — LLM Chat, Trade Execution, Birdeye/Helius (2026-03-12)
- **LLM integration**: Connected OpenRouter (MiniMax M2.5) for AI-powered chat responses with context injection
- **Chat UI cards**: Rich rendering for trending, screening, price, trade preview, and trade executed cards with suggestion chips
- **End-to-end trade flow**: Buy/sell from chat with confirm button, dry-run execution, portfolio tracking
- **Birdeye + Helius**: Optional API integrations for richer token holder data on Solana tokens
- **Merge with main**: Integrated multi-agent architecture from main branch

### v0.1.0 — Flutter Mobile App + Backend API (2026-03-11)
- **Flutter mobile app**: CoinDCX design system, Riverpod state management, 4-tab navigation (Discover, Chat, Portfolio, Settings)
- **Backend API routes**: Token search, trending, screening, chat, trade quote/execute, portfolio
- **Live data**: DexScreener for market data, RugCheck for Solana safety, GoPlus for EVM security
- **CORS + SSL fixes**: Development environment setup for corporate proxy

## License

MIT
