# Hackathon Handoff: AI Trading Agent for CoinDCX Web3

> **Status**: Working prototype (Flutter web + Node.js API). Dry-run mode. Ready for integration into CoinDCX mobile app.
> **Branch**: `feat/live-data-integration`
> **Last updated**: March 13, 2026

---

## Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22+ | Backend API |
| Flutter | 3.32+ | Mobile/web app |
| npm | 10+ | Package manager |

### 1. Backend API

```bash
cd coindcx-trading-agent

# Install deps
npm install

# Create .env file with your API keys
cat > .env << 'EOF'
OPENROUTER_API_KEY=<your-openrouter-key>
OPENROUTER_MODEL=minimax/minimax-m2.5
BIRDEYE_API_KEY=<your-birdeye-key>
HELIUS_API_KEY=<your-helius-key>
EOF

# Start the API server (port 3000)
NODE_TLS_REJECT_UNAUTHORIZED=0 SERVICE_MODE=api DRY_RUN=true PORT=3000 npx tsx src/index.ts
```

### 2. Flutter App

```bash
cd mobile_app

# Get deps
flutter pub get

# Run on Chrome (port 8080)
flutter run -d chrome --web-port 8080
```

### 3. Required API Keys

| Key | Provider | Free Tier | Used For |
|-----|----------|-----------|----------|
| `OPENROUTER_API_KEY` | [openrouter.ai](https://openrouter.ai) | Yes (limited) | LLM chat responses |
| `BIRDEYE_API_KEY` | [birdeye.so](https://birdeye.so) | Yes (300 req/min) | Solana holder data, token overview |
| `HELIUS_API_KEY` | [helius.dev](https://helius.dev) | Yes (50k credits) | Solana token holder accounts |
| (none needed) | DexScreener | Unlimited | Prices, trending, token search |
| (none needed) | RugCheck | Unlimited | Solana token safety reports |
| (none needed) | GoPlus Labs | Rate-limited | EVM token security |

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     Flutter Mobile App                         │
│                                                                │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐     │
│  │ Trade    │  │  Agent   │  │  Wallet    │  │ Leaderbd │     │
│  │(Discover)│  │ (AI Chat)│  │(Portfolio) │  │  (TODO)  │     │
│  └────┬─────┘  └────┬─────┘  └────┬───────┘  └──────────┘     │
│       │              │             │                            │
└───────┼──────────────┼─────────────┼────────────────────────────┘
        │              │             │
        ▼              ▼             ▼
┌────────────────────────────────────────────────────────────────┐
│                   Node.js + Fastify API                        │
│                                                                │
│  GET  /api/v1/tokens/trending     → DexScreener boosts API     │
│  GET  /api/v1/tokens/gainers      → filtered trending          │
│  GET  /api/v1/tokens/search?q=    → DexScreener search         │
│  POST /api/v1/tokens/screen       → RugCheck + GoPlus + audit  │
│  POST /api/v1/chat                → LLM-powered agent          │
│  POST /api/v1/trade/quote         → price + screening          │
│  POST /api/v1/trade/execute       → dry-run trade execution    │
│  GET  /api/v1/trade/portfolio     → in-memory portfolio        │
│  GET  /api/v1/proxy/image?url=    → CORS image proxy           │
│                                                                │
│  Data Sources: DexScreener, RugCheck, GoPlus, Birdeye, Helius  │
│  LLM: OpenRouter (MiniMax M2.5)                                │
└────────────────────────────────────────────────────────────────┘
```

---

## What Works Right Now

| Feature | Status | Notes |
|---------|--------|-------|
| Token discovery (trending feed) | ✅ Working | DexScreener boosts API, 100K mcap filter, sorted by % change |
| "Hot Right Now" carousel | ✅ Working | Top 5 gainers with icons, % change, buy badges |
| Timeframe sorting (15M/1H/4H/1D) | ✅ Working | Sorts by 5m/1h/6h/24h price change |
| M.Cap / Price toggle | ✅ Working | Tap column header to switch |
| Token detail page | ✅ Working | Full GMGN-style audit grid, quick buy, contract copy |
| Token icons | ✅ Working | Via backend image proxy (CORS bypass) |
| AI Chat | ✅ Working | OpenRouter LLM with intent detection |
| Chat → screen token | ✅ Working | Full RugCheck/GoPlus audit in response |
| Chat → buy/sell | ✅ Working | Preview → confirm → execute (dry-run) |
| Chat → portfolio | ✅ Working | Shows holdings, suggests sells |
| Token search | ✅ Working | DexScreener search by name/symbol/address |
| Portfolio tracking | ⚠️ In-memory | Works but resets on server restart |
| Birdeye integration | ✅ Working | Holder count, top holders, buy pressure |
| Helius integration | ✅ Working | Top holder addresses for Solana tokens |
| On-chain execution | ❌ Dry-run only | Trade logic scaffolded but not connected |
| User auth | ❌ None | No user identity system |
| Persistent storage | ❌ None | All data in-memory |

---

## Scoring Model — Current Logic & Known Issues

### How `screenToken()` works (`src/data/token-screener.ts:633-688`)

Starts at 100, subtracts penalties:

| Check | Penalty | Issue |
|-------|---------|-------|
| `rugScore < 30` | -30 | ⚠️ Default is 50 (hardcoded when no RugCheck data) — never triggers for unchecked tokens |
| `rugScore < 60` | -10 | ⚠️ Fires on the hardcoded default of 50, even when no check ran |
| `liquidity < 10K` | -25 | ✅ Good check |
| `liquidity < 50K` | -10 | ✅ Good check |
| `volume24h < 5K` | -10 | ✅ Good check |
| `topHolderPct > 20%` | -20 | ⚠️ Default is 0 — looks safe when we simply don't have data |
| `topHolderPct > 10%` | -5 | Same issue |
| LP not locked | -10 | ⚠️ Default is false/0 — penalizes unknown as if we checked |
| Token age < 60 min | -15 | ✅ Good check |

Grade mapping: A (≥80), B (≥60), C (≥40), D (≥20), F (<20)

### What's Wrong

1. **Hardcoded defaults mask missing data.** `rugScore=50`, `holders=0`, `topHolderPct=0` create a false sense of safety. The model doesn't distinguish "we checked and it's fine" from "we never checked."

2. **Audit data is ignored.** `noMint`, `noFreeze`, `burnt`, `insidersDetected`, `rugged` from RugCheck are fetched and displayed in the UI but have ZERO effect on the score. A `rugged: true` token gets the same grade.

3. **`ctScore` is dead weight.** Computed but never used in grading.

4. **No buy/sell pressure signal.** `txnsBuys24h`, `txnsSells24h`, Birdeye's `buyPressure` are available but not scored.

5. **`aiConfidence` is misleading.** It's just the penalty score renamed, not an actual ML confidence metric.

### Recommended Fix (for tech team)

```typescript
// Proposed: 3-tier scoring with data-availability awareness
interface ScoringResult {
  safetyScore: number;      // 0-100, from audit data (RugCheck/GoPlus)
  liquidityScore: number;   // 0-100, from DexScreener
  momentumScore: number;    // 0-100, from price change + volume + buy pressure
  dataCompleteness: number; // 0-100, how much data we actually have
  overallGrade: string;     // A-F, weighted combination
  flags: string[];          // Specific risk flags
}

// Key changes:
// 1. Track which data sources responded (don't assume defaults = safe)
// 2. Penalize low dataCompleteness in the grade
// 3. Incorporate audit booleans: noMint (+10), noFreeze (+10), rugged (-100)
// 4. Use insidersDetected > 0 as a major penalty (-20 per insider)
// 5. Use buyPressure < 30% as a sell-pressure warning
// 6. Use top10HolderPct from Birdeye (more accurate than RugCheck)
```

---

## User-Level Persistent Memory — Design Spec

### Current State (all ephemeral)

| Data | Storage | Lifetime | Scope |
|------|---------|----------|-------|
| Chat history | `Map<string, LLMMessage[]>` | Until restart | Per `conversationId` (client-generated) |
| Trades/Portfolio | `Map<string, TradeRecord>` | Until restart | Global (shared!) |
| Last token context | Single global variable | Until restart | Global (shared across all users!) |

### Target Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      User Memory Layer                           │
│                                                                  │
│  PostgreSQL (or Firestore)                                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ users                                                       │ │
│  │   id, coindcx_uid, wallet_addresses[], risk_tolerance,      │ │
│  │   preferred_chains[], created_at, last_active_at            │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ trades                                                      │ │
│  │   id, user_id, symbol, side, amount_usd, price, quantity,   │ │
│  │   chain, status, tx_hash, copied_from_wallet, strategy_id,  │ │
│  │   created_at                                                │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ strategies                                                  │ │
│  │   id, user_id, name, description, created_at                │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ followed_wallets                                            │ │
│  │   id, user_id, wallet_address, label, added_at              │ │
│  ├─────────────────────────────────────────────────────────────┤ │
│  │ watchlist                                                   │ │
│  │   id, user_id, token_address, chain, added_at               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Redis                                                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ chat:{userId}:history     → last 20 messages (TTL: 24h)    │ │
│  │ chat:{userId}:lastToken   → per-user context                │ │
│  │ user:{userId}:preferences → cached user prefs               │ │
│  │ leaderboard:global        → sorted set by PnL               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Migration Path (in-memory → persistent)

1. **Phase 1: Add userId to all requests.** The Flutter app should send a `userId` header (from CoinDCX auth). Backend extracts it in middleware.
2. **Phase 2: Replace in-memory Maps with PostgreSQL.** The Drizzle ORM dependency already exists in `package.json`. Define schemas in `src/core/schema.ts`.
3. **Phase 3: Move chat history to Redis.** Short-term context (last 20 msgs) in Redis with TTL. Summarized long-term memory in PostgreSQL.
4. **Phase 4: Per-user `lastToken` + preferences.** Replace the global `lastToken` variable with Redis key per user.

### Code Changes Needed

**`src/api/routes/trade.ts`:**
- Replace `positions: Map<string, TradeRecord>` with PostgreSQL `trades` table
- Add `userId` to all trade records
- Add `copied_from` field for copy trades

**`src/api/routes/chat.ts`:**
- Replace `conversations: Map` with Redis-backed store
- Replace global `lastToken` with per-user Redis key
- Add conversation summarization for long-term memory

**`src/api/server.ts`:**
- Add auth middleware that extracts `userId` from CoinDCX session token
- Pass `userId` to all route handlers

---

## KOL Tracking + Leaderboard + Copy Trade — Design Spec

### Data Sources

| Source | API | What It Gives Us |
|--------|-----|-----------------|
| Birdeye | `GET /trader/gainers` | Top performing wallets on Solana by PnL |
| Birdeye | `GET /trader/txs/seek_by_time` | Recent trades by specific wallets |
| Helius | `POST getSignaturesForAddress` | Transaction history for any wallet |
| In-app | `GET /api/v1/trade/portfolio` | Our users' trade history |

### Proposed Endpoints

```
GET  /api/v1/traders/top              → Top trader wallets (Birdeye gainers)
GET  /api/v1/traders/:address/trades  → Recent trades for a wallet (Helius)
GET  /api/v1/traders/:address/profile → Wallet stats (PnL, win rate, tokens)
POST /api/v1/traders/:address/follow  → Follow a wallet (per user)
DELETE /api/v1/traders/:address/follow → Unfollow
GET  /api/v1/traders/following        → User's followed wallets
GET  /api/v1/leaderboard             → Community leaderboard (in-app PnL)
POST /api/v1/trade/copy              → Copy a trade from a KOL
```

### Flutter Screens

**Leaderboard Tab (replaces Points page):**
```
┌───────────────────────────────┐
│ 🏆 Leaderboard               │
│ ┌───────────┬───────────────┐ │
│ │ Smart $   │  Community    │ │ ← Two tabs
│ └───────────┴───────────────┘ │
│                               │
│ 1. 🐋 Abc...xyz  +$42.1K 🔥  │ ← Birdeye top traders
│    Win rate: 73%  Trades: 156 │
│    [Follow] [View Trades]     │
│                               │
│ 2. 🐋 Def...uvw  +$28.7K     │
│    Win rate: 65%  Trades: 89  │
│    [Follow] [View Trades]     │
│                               │
│ ─────── Community ──────────  │
│                               │
│ 1. @anish     +$1,200   🥇   │ ← In-app users
│ 2. @kushagra  +$890     🥈   │
│ 3. @trader3   +$450     🥉   │
└───────────────────────────────┘
```

**KOL Profile (drill-down):**
```
┌───────────────────────────────┐
│ ← Wallet: Abc...xyz          │
│                               │
│ Total PnL: +$42,100          │
│ Win Rate: 73%  |  Trades: 156│
│ Top Tokens: SOL, BONK, WIF   │
│                               │
│ [Following ✓]                 │
│                               │
│ Recent Trades:                │
│ ┌───────────────────────────┐ │
│ │ BUY  $5K BONK    2m ago  │ │
│ │                  [COPY]  │ │ ← Copy trade button
│ ├───────────────────────────┤ │
│ │ SELL $2K WIF    18m ago  │ │
│ │                  [COPY]  │ │
│ └───────────────────────────┘ │
└───────────────────────────────┘
```

### Copy Trade Flow

```
User taps [COPY] on a KOL trade
  → Confirmation sheet: "Copy $5K BONK buy from 0xABC...?"
  → User adjusts amount (default: $200)
  → POST /api/v1/trade/copy { sourceWallet, symbol, side, amountUsd }
  → Backend executes trade + tags it as `copiedFrom: sourceWallet`
  → Appears in portfolio as "Copied from 🐋 Abc...xyz"
```

### Smart Money Feed (optional, stretch goal)

Real-time feed of notable trades by followed wallets:

```
GET /api/v1/feed/smart-money → Aggregated recent trades from followed wallets

Response:
[
  { wallet: "Abc..xyz", action: "buy", symbol: "BONK", amountUsd: 5000, timestamp: ... },
  { wallet: "Def..uvw", action: "sell", symbol: "WIF", amountUsd: 2000, timestamp: ... },
]
```

This could later be powered by Helius webhooks for real-time notifications.

---

## File Map — What's Where

### Backend (`src/`)

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/data/token-screener.ts` | Token data fetching + screening | `searchToken`, `fetchTrending`, `screenToken`, `fetchRugCheck`, `fetchGoPlus`, `fetchBirdeyeHolders`, `fetchBirdeyeOverview`, `fetchHeliusHolders` |
| `src/data/llm.ts` | OpenRouter LLM client | `chatCompletion`, `isLLMAvailable` |
| `src/api/routes/chat.ts` | AI chat endpoint with intent detection | `chatRoutes`, `processChat` |
| `src/api/routes/trade.ts` | Trade execution + portfolio | `tradeRoutes` |
| `src/api/routes/tokens.ts` | Token discovery endpoints | `tokenRoutes` |
| `src/api/server.ts` | Fastify server setup, image proxy | `createServer` |
| `src/core/config.ts` | Environment config | `config` |

### Flutter App (`mobile_app/lib/`)

| File | Purpose |
|------|---------|
| `features/discovery/presentation/discovery_screen.dart` | Trade tab — trending, hot right now, search |
| `features/chat/presentation/chat_screen.dart` | Agent tab — AI chat with cards |
| `features/portfolio/presentation/portfolio_screen.dart` | Wallet tab — positions |
| `features/token_detail/presentation/token_detail_screen.dart` | Token detail — audit, quick buy, contract |
| `core/api/api_client.dart` | HTTP client to backend |
| `core/api/models.dart` | Dart data models (TokenMetrics, ScreeningResult, etc.) |
| `core/theme/app_theme.dart` | CoinDCX design system tokens |
| `core/providers/api_providers.dart` | Riverpod providers |
| `app_shell.dart` | Bottom nav scaffold |

---

## Integration Notes for CoinDCX App

### To integrate this agent into the existing CoinDCX Web3 mobile app:

1. **Replace the Points page** with the Agent (AI Chat) tab. The chat is the primary interaction surface.

2. **Backend deployment**: The Node.js API can run as a standalone microservice. It has no database dependencies currently — just external API calls. For production, add PostgreSQL (Drizzle schemas exist) and Redis.

3. **Auth integration**: Add CoinDCX session token validation in `src/api/server.ts` middleware. Extract `userId` and pass it through to all handlers.

4. **Real trading**: Replace `DRY_RUN=true` with actual Solana/EVM execution. The executor scaffolding exists in `src/services/executor/` but uses Jupiter (Solana) and 1inch/0x (EVM). Needs KMS wallet integration.

5. **Hot Right Now curation**: Currently powered by DexScreener boosts API (community-boosted tokens). For production, combine with:
   - Birdeye trending
   - Internal analytics (most searched/traded)
   - Manual curation layer

6. **Flutter → native**: The Flutter code follows CoinDCX component patterns. Copy the feature modules into the existing app. The `core/theme/app_theme.dart` maps to your design system.

---

## TODO for Tech Team

### Must-Have (before demo)
- [ ] Fix scoring model (incorporate audit data, handle missing data)
- [ ] Add user-level persistence (PostgreSQL for trades, Redis for chat)
- [ ] Add userId to all API requests

### Should-Have
- [ ] KOL leaderboard (Birdeye top traders → Flutter leaderboard tab)
- [ ] Copy trade flow (follow wallet → copy button → tagged trade)
- [ ] Strategy tagging (name a strategy, tag trades to it, per-strategy PnL)

### Nice-to-Have
- [ ] Smart money feed (Helius webhooks for real-time wallet tracking)
- [ ] Push notifications for followed wallet activity
- [ ] Token watchlist with price alerts
- [ ] DCA automation (scheduled buys)

---

## Environment Variables Reference

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-...      # LLM for chat
BIRDEYE_API_KEY=...                    # Solana token data
HELIUS_API_KEY=...                     # Solana holder data

# Server config
SERVICE_MODE=api                       # Run as API server
PORT=3000                              # HTTP port
DRY_RUN=true                          # Simulate trades (no real execution)

# Optional
NODE_TLS_REJECT_UNAUTHORIZED=0         # Corporate proxy SSL bypass (dev only!)
OPENROUTER_MODEL=minimax/minimax-m2.5  # LLM model selection
```
