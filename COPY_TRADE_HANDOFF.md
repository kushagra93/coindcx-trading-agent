# Copy Trading — Hackathon Implementation & Production Handoff

## What's Implemented (Hackathon)

### Backend

1. **Wallet Activity Monitor** (`src/data/wallet-monitor.ts`)
   - Polls Helius RPC `getSignaturesForAddress` every 15s for watched wallets
   - Parses new transactions via Helius Enhanced Transactions API
   - Detects SWAP events (buy/sell) including SOL ↔ Token pairs
   - Falls back to token transfer analysis when structured swap data is unavailable

2. **Copy Trade Engine** (`src/data/copy-engine.ts`)
   - Receives swap events from wallet monitor
   - Applies user config: buy mode (fixed_buy / max_buy / fixed_ratio), sell method (mirror_sell / manual)
   - Simulates trades (no on-chain execution) with $500 single-trade cap
   - Tracks per-config `totalCopied` and `totalPnl`
   - In-memory activity feed (last 200 events)

3. **Enhanced Copy Trade APIs** (`src/api/routes/leaderboard.ts`)
   - `POST /api/v1/copy` — Start with full config (buyMode, buyAmount, sellMethod)
   - `POST /api/v1/copy/:wallet/pause` — Pause monitoring
   - `POST /api/v1/copy/:wallet/resume` — Resume monitoring
   - `DELETE /api/v1/copy/:wallet` — Stop and remove
   - `GET /api/v1/copy` — List all active configs
   - `GET /api/v1/copy/:wallet` — Single config details
   - `GET /api/v1/copy/activity` — Recent activity feed

4. **Chat Integration** (`src/api/routes/chat.ts`)
   - "copy trade #1" or "copy trade <address>" → returns `copy_trade_config` card
   - "my copy trades" → returns `copy_trade_manager` card
   - "stop/pause/resume copy <address>" → executes action + shows updated manager
   - `POST /api/v1/chat/copy-confirm` — Flutter modal submits config here

### Frontend (Flutter)

1. **Copy Trade Config Modal** — Bottom sheet triggered from chat card
   - Buy mode selector (Fixed Buy / Max Buy / Ratio)
   - USD amount input
   - Sell method selector (Mirror Sells / Manual Only)
   - Dry-run warning badge
   - Submits to `/api/v1/chat/copy-confirm`

2. **Copy Trade Manager Card** — Shown in chat
   - Lists all followed wallets with status (active/paused)
   - Pause/Resume toggle per wallet
   - Stop button per wallet
   - Config summary (buy mode, amount, sell method, total copied)
   - Recent activity feed (last 5 events with buy/sell/skipped indicators)

---

## NOT Implemented — Production Requirements

### Critical for Production

1. **Real On-Chain Execution**
   - Currently all trades are simulated (logged in-memory, no blockchain interaction)
   - Production needs: Jupiter SDK integration for Solana swaps, transaction signing via user's custodial wallet (AWS KMS)
   - Slippage protection, priority fees, retry logic

2. **Helius Webhooks (Replace Polling)**
   - Current: polling `getSignaturesForAddress` every 15s per wallet — doesn't scale
   - Production: Use [Helius Webhooks](https://docs.helius.dev/webhooks-and-websockets/webhooks) with `ENHANCED` type
   - Webhook receives real-time transaction data, zero latency
   - Requires public HTTPS endpoint + webhook secret validation

3. **MEV Protection**
   - Copy trades are front-runnable since they follow known wallet patterns
   - Production needs: Jito bundles, private mempool submission, randomized execution timing

4. **Persistent Storage**
   - All data is in-memory — lost on restart
   - Production: PostgreSQL for copy configs, activity logs, user preferences
   - Schema: `copy_trade_configs`, `copy_trade_activities`, `user_preferences`

5. **Transaction Amount Calculation**
   - Current: rough `solAmount * 130` USD estimate
   - Production: Real-time SOL/USD price feed (Pyth, Birdeye price API)

### Nice to Have

6. **Advanced Filters**
   - Minimum trade size filter (ignore dust trades)
   - Token whitelist/blacklist
   - Maximum daily copy budget
   - Skip if token is <X minutes old (rug avoidance)

7. **Take-Profit / Stop-Loss on Copy Positions**
   - Auto-sell at +X% profit or -X% loss
   - Requires position tracking with entry price

8. **Rate Limiting & Throttling**
   - Per-user copy trade limits (max wallets, max daily trades)
   - Helius API rate limit management (plan-dependent)

9. **Push Notifications**
   - FCM/APNS push when a followed wallet makes a trade
   - Push when copy trade executes or skips

10. **Copy Trade Analytics Dashboard**
    - Historical PnL per followed wallet
    - Win rate, avg return, best/worst trade
    - Comparison vs. direct holds

---

## Architecture Diagram

```
User Chat → "copy trade #1"
  ↓
Chat Handler → returns copy_trade_config card
  ↓
Flutter Modal → user configures buy mode / amount / sell method
  ↓
POST /api/v1/chat/copy-confirm → startCopyTrading()
  ↓
Copy Engine registers wallet → Wallet Monitor starts polling
  ↓
Helius RPC (getSignaturesForAddress) → new transactions detected
  ↓
Enhanced Transaction API → parse SWAP events
  ↓
Copy Engine → apply filters → simulate trade → log activity
  ↓
"my copy trades" → shows manager card with status + activity feed
```

## Key Files

| File | Purpose |
|------|---------|
| `src/data/wallet-monitor.ts` | Helius polling, swap event detection |
| `src/data/copy-engine.ts` | Trade filtering, simulation, config management |
| `src/api/routes/leaderboard.ts` | REST APIs for copy trade CRUD |
| `src/api/routes/chat.ts` | Chat intent handling, modal cards |
| `mobile_app/lib/features/chat/presentation/chat_screen.dart` | Config modal + manager card UI |

## Environment Variables Required

- `HELIUS_API_KEY` — Required for wallet monitoring (Helius RPC + Enhanced TX API)
- `GMGN_API_KEY` — Optional, GMGN leaderboard works without explicit key (uses public endpoints)
