# Automation Coverage Report

> Generated from Istanbul/V8 coverage run on **2026-03-13T20:30:46Z** using **Vitest + @vitest/coverage-v8**

---

## Overall Coverage Summary

| Metric       | Covered | Total | Percentage |
|--------------|---------|-------|------------|
| **Statements** | 2,840   | 3,427 | **82.87%** |
| **Branches**   | 419     | 469   | **89.33%** |
| **Functions**  | 161     | 183   | **87.97%** |
| **Lines**      | 2,840   | 3,427 | **82.87%** |

---

## Module-Level Coverage

| Module         | Statements | Branches | Functions | Lines   | Rating |
|----------------|-----------|----------|-----------|---------|--------|
| **audit**      | 80.95% (153/189) | 78.12% (25/32) | 100% (7/7) | 80.95% (153/189) | High |
| **core**       | 99.02% (510/515) | 95.83% (46/48) | 95.65% (22/23) | 99.02% (510/515) | High |
| **db**         | 43.24% (16/37) | 50% (2/4) | 66.66% (2/3) | 43.24% (16/37) | Low |
| **ml**         | 95.46% (484/507) | 79.12% (72/91) | 100% (18/18) | 95.46% (484/507) | High |
| **permissions** | 100% (82/82) | 100% (11/11) | 100% (4/4) | 100% (82/82) | Full |
| **risk**       | 57.19% (155/271) | 100% (28/28) | 76.19% (16/21) | 57.19% (155/271) | Medium |
| **security**   | 98.12% (732/746) | 94% (141/150) | 100% (54/54) | 98.12% (732/746) | High |
| **supervisor** | 100% (396/396) | 87.27% (48/55) | 100% (18/18) | 100% (396/396) | Full |
| **trader**     | 45.61% (312/684) | 92% (46/50) | 57.14% (20/35) | 45.61% (312/684) | Low |

---

## File-Level Coverage Breakdown

### audit/

| File             | Statements | Branches | Functions | Lines |
|------------------|-----------|----------|-----------|-------|
| audit-logger.ts  | 80.95% (153/189) | 78.12% (25/32) | 100% (7/7) | 80.95% (153/189) |

### core/

| File              | Statements | Branches | Functions | Lines |
|-------------------|-----------|----------|-----------|-------|
| chain-registry.ts | 100% (262/262) | 100% (23/23) | 100% (5/5) | 100% (262/262) |
| config.ts         | 96.15% (125/130) | 100% (7/7) | 75% (3/4) | 96.15% (125/130) |
| state-machine.ts  | 100% (81/81) | 81.81% (9/11) | 100% (7/7) | 100% (81/81) |
| ws-types.ts       | 100% (42/42) | 100% (7/7) | 100% (7/7) | 100% (42/42) |

### db/

| File      | Statements | Branches | Functions | Lines |
|-----------|-----------|----------|-----------|-------|
| index.ts  | 43.24% (16/37) | 50% (2/4) | 66.66% (2/3) | 43.24% (16/37) |

### ml/

| File            | Statements | Branches | Functions | Lines |
|-----------------|-----------|----------|-----------|-------|
| data-export.ts  | 100% (171/171) | 93.75% (30/32) | 100% (5/5) | 100% (171/171) |
| sagemaker.ts    | 93.15% (313/336) | 71.18% (42/59) | 100% (13/13) | 93.15% (313/336) |

### permissions/

| File           | Statements | Branches | Functions | Lines |
|----------------|-----------|----------|-----------|-------|
| permissions.ts | 100% (82/82) | 100% (11/11) | 100% (4/4) | 100% (82/82) |

### risk/

| File               | Statements | Branches | Functions | Lines |
|--------------------|-----------|----------|-----------|-------|
| circuit-breaker.ts | 61.53% (64/104) | 100% (13/13) | 80% (8/10) | 61.53% (64/104) |
| parameter-bounds.ts| 100% (39/39) | 100% (6/6) | 100% (5/5) | 100% (39/39) |
| risk-manager.ts    | 29.62% (32/108) | 100% (9/9) | 50% (3/6) | 29.62% (32/108) |
| types.ts           | 100% (20/20) | 100% (0/0) | 100% (0/0) | 100% (20/20) |

### security/

| File               | Statements | Branches | Functions | Lines |
|--------------------|-----------|----------|-----------|-------|
| approval-token.ts  | 97.88% (185/189) | 95.55% (43/45) | 100% (8/8) | 97.88% (185/189) |
| data-isolation.ts  | 100% (186/186) | 100% (31/31) | 100% (16/16) | 100% (186/186) |
| message-signer.ts  | 98.78% (162/164) | 92.68% (38/41) | 100% (13/13) | 98.78% (162/164) |
| trust-chain.ts     | 95.72% (179/187) | 85.71% (24/28) | 100% (12/12) | 95.72% (179/187) |
| types.ts           | 100% (20/20) | 100% (5/5) | 100% (5/5) | 100% (20/20) |

### supervisor/

| File               | Statements | Branches | Functions | Lines |
|--------------------|-----------|----------|-----------|-------|
| command-bus.ts     | 100% (134/134) | 100% (12/12) | 100% (9/9) | 100% (134/134) |
| event-collector.ts | 100% (75/75) | 90.9% (20/22) | 100% (3/3) | 100% (75/75) |
| fee-ledger.ts      | 100% (187/187) | 76.19% (16/21) | 100% (6/6) | 100% (187/187) |

### trader/

| File                | Statements | Branches | Functions | Lines |
|---------------------|-----------|----------|-----------|-------|
| fee-manager.ts      | 13.44% (32/238) | 88.88% (8/9) | 25% (3/12) | 13.44% (32/238) |
| nonce-manager.ts    | 82.45% (47/57) | 90.9% (10/11) | 80% (4/5) | 82.45% (47/57) |
| position-manager.ts | 44.49% (101/227) | 91.66% (11/12) | 63.63% (7/11) | 44.49% (101/227) |
| trade-memory.ts     | 81.48% (132/162) | 94.44% (17/18) | 85.71% (6/7) | 81.48% (132/162) |

---

## Test Suite Summary

**29 test files** | **25 source files covered** | **9 modules tested**

### Test Files by Module

| # | Module | Test File | Test Cases | Status |
|---|--------|-----------|------------|--------|
| 1 | audit | audit-logger.test.ts | 7 | Pass |
| 2 | core | config.test.ts | 9 | Pass |
| 3 | core | state-machine.test.ts | 11 | Pass |
| 4 | core | chain-registry.test.ts | 17 | Pass |
| 5 | core | ws-types.test.ts | 12 | Pass |
| 6 | db | index.test.ts | 2 | Pass |
| 7 | ml | data-export.test.ts | 16 | Pass |
| 8 | ml | sagemaker.test.ts | 19 | Pass |
| 9 | risk | circuit-breaker.test.ts | 10 | Pass |
| 10 | risk | risk-manager.test.ts | 11 | Pass |
| 11 | risk | parameter-bounds.test.ts | 14 | Pass |
| 12 | risk | types.test.ts | 4 | Pass |
| 13 | security | approval-token.test.ts | 11 | Pass |
| 14 | security | data-isolation.test.ts | 11 | Pass |
| 15 | security | message-signer.test.ts | 19 | Pass |
| 16 | security | trust-chain.test.ts | 7 | Pass |
| 17 | security | permissions.test.ts | 11 | Pass |
| 18 | security | types.test.ts | 9 | Pass |
| 19 | security | approval-token-redis.test.ts | 11 | Pass |
| 20 | security | data-isolation-redis.test.ts | 16 | Pass |
| 21 | security | message-signer-redis.test.ts | 11 | Pass |
| 22 | security | trust-chain-redis.test.ts | 9 | Pass |
| 23 | supervisor | command-bus.test.ts | 10 | Pass |
| 24 | supervisor | event-collector.test.ts | 13 | Pass |
| 25 | supervisor | fee-ledger.test.ts | 7 | Pass |
| 26 | trader | fee-manager.test.ts | 11 | Pass |
| 27 | trader | nonce-manager.test.ts | 7 | Pass |
| 28 | trader | position-manager.test.ts | 8 | Pass |
| 29 | trader | trade-memory.test.ts | 7 | Pass |

**Total Test Cases: ~303**

---

## Detailed Test Case Inventory

### 1. audit/audit-logger.test.ts (7 tests)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | creates an audit entry with hash chain | Verifies SHA-256 hash-chained audit entry creation |
| 2 | records error entries | Validates error-level audit logging |
| 3 | returns audit entries | Tests audit log retrieval |
| 4 | returns filtered entries | Tests filtered audit queries |
| 5 | returns zero hash when no entries | Verifies chain head for empty log |
| 6 | returns last entry hash and sequence | Validates chain head state |
| 7 | queries by correlation ID | Tests audit trail by correlation |

### 2. core/config.test.ts (9 tests)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | loads default config when no env vars set | Default configuration loading |
| 2 | reads SERVICE_MODE from env | Environment variable parsing |
| 3 | reads PORT from env | Port configuration |
| 4 | reads DRY_RUN=false from env | Boolean env var parsing |
| 5 | reads REDIS_URL from env | Redis URL configuration |
| 6 | reads risk config from env | Risk settings from environment |
| 7 | reads wsHub and gateway config | WebSocket config loading |
| 8 | reads supervisor config | Supervisor settings |
| 9 | has chainRpcOverrides | Chain RPC override support |

### 3. core/state-machine.test.ts (11 tests)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | allows happy path transitions | Valid 15-state lifecycle transitions |
| 2 | allows rejection transitions | Risk/compliance/approval rejection paths |
| 3 | allows failure transitions | Fee refund failure path |
| 4 | rejects invalid transitions | Invalid state transition detection |
| 5 | identifies terminal states | Terminal state classification |
| 6 | identifies non-terminal states | Non-terminal state classification |
| 7 | does not throw on valid transition | Assertion for valid transitions |
| 8 | throws on invalid transition | Error on invalid state changes |
| 9 | returns only non-terminal states | Non-terminal state enumeration |
| 10 | returns in-flight states needing crash recovery | Recoverable state identification |
| 11 | returns rejection terminal states | Rejection state enumeration |

### 4. core/chain-registry.test.ts (17 tests)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | has solana entry | Solana chain configuration |
| 2 | has ethereum entry with chain ID | Ethereum config with numeric chain ID |
| 3 | has hyperliquid entry | Hyperliquid perps configuration |
| 4 | all entries have required fields | Schema validation for all 14 chains |
| 5 | ALL_CHAIN_IDS contains all registry keys | Chain ID enumeration |
| 6 | EVM_CHAINS only contains EVM chains | EVM chain filtering |
| 7 | VALID_CHAINS is a Set of all chain IDs | Chain validation set |
| 8 | EVM_CHAIN_IDS maps chain name to numeric ID | EVM chain ID mapping |
| 9 | CHAIN_ID_TO_NAME reverse-maps numeric ID to name | Reverse chain lookup |
| 10 | DEXSCREENER_TO_CHAIN maps dexscreener slugs | DexScreener integration |
| 11 | NATIVE_TOKEN_SYMBOLS contains expected symbols | Native token identification |
| 12 | returns config for known chain | Chain config retrieval |
| 13 | throws for unknown chain | Error for invalid chain |
| 14 | returns default RPC for chain | Default RPC URLs |
| 15 | returns env override if set | RPC URL environment overrides |
| 16 | returns numeric chain ID for EVM chain | EVM chain ID lookup |
| 17 | throws for non-EVM chain | Error for non-EVM chain ID |

### 5. core/ws-types.test.ts (12 tests)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | allows master-only types | Downstream message type validation |
| 2 | rejects agent-only types | Upstream-only type rejection |
| 3 | rejects shared types | Shared type classification |
| 4 | allows agent types | Upstream message type validation |
| 5 | rejects master-only types | Master type rejection from agents |
| 6 | has standard and custom codes | WebSocket close code constants |
| 7 | has sensible defaults | Default timing/size constants |
| 8 | generates agent gateway key | Redis key generation |
| 9 | generates gateway channel key | Channel key generation |
| 10 | has static broadcast channel | Broadcast channel key |
| 11 | generates offline queue key | Offline queue Redis key |
| 12 | generates strategy params key | Strategy parameter keys |

### 6. db/index.test.ts (2 tests)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | isDbConfigured returns false when DATABASE_URL is empty | DB configuration guard |
| 2 | getDb throws when DATABASE_URL is not configured | Error for unconfigured DB |

### 7. ml/data-export.test.ts (16 tests)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | exports user-assistant message pairs | Training data extraction |
| 2 | skips non-paired messages | Message pair filtering |
| 3 | skips pairs from different users | User isolation in export |
| 4 | adds tool_calls when assistant response matches action pattern | Tool call extraction |
| 5 | uses plain content when no action pattern matches | Fallback content handling |
| 6 | throws if DB is not configured (intents) | DB guard for intent export |
| 7 | handles empty chat messages | Empty data handling |
| 8 | exports closed positions with win/loss labels | Trade outcome labeling |
| 9 | handles positions with no closedAt/openedAt | Null date handling |
| 10 | throws if DB is not configured (trades) | DB guard for trade export |
| 11 | runs both exports in parallel | Parallel export execution |
| 12 | matches buy/sell patterns to execute_trade | Buy/sell pattern matching |
| 13 | matches screen patterns to screen_token | Screen pattern matching |
| 14 | matches current price pattern | Price pattern matching |
| 15 | matches portfolio/trending/DCA/limit/copy/leaderboard | Multiple pattern matching |
| 16 | returns null for unrecognized content | Unknown pattern handling |

### 8. ml/sagemaker.test.ts (19 tests)

| # | Test Case | Description |
|---|-----------|-------------|
| 1 | starts training job with defaults | SageMaker job creation |
| 2 | uses custom job name | Custom job naming |
| 3 | merges custom hyperparameters | Hyperparameter configuration |
| 4 | throws when roleArn not configured | Missing IAM role error |
| 5 | returns training job status | Job status retrieval |
| 6 | handles missing fields gracefully | Null field handling |
| 7 | returns training job summaries | Job listing |
| 8 | handles empty results | Empty job list |
| 9 | creates model, config, and endpoint | Model deployment pipeline |
| 10 | returns endpoint status | Endpoint health check |
| 11 | lists cerebro endpoints | Endpoint enumeration |
| 12 | deletes endpoint, config, and model | Cleanup pipeline |
| 13 | handles missing resources gracefully | Missing resource handling |
| 14 | returns content when no tool calls | Plain text inference |
| 15 | extracts tool calls from JSON response | Tool call parsing |
| 16 | handles non-array response format | Response format handling |
| 17 | extracts from clean/embedded JSON | JSON extraction |
| 18 | builds schema with function names | Tool call schema building |
| 19 | HF image region mapping validation | ECR image URI validation |

### 9. risk/ (39 tests across 4 files)

**circuit-breaker.test.ts** (10 tests): Loss recording, global halt/resume, trading allowed checks, tripped user queries, breaker reset.

**risk-manager.test.ts** (11 tests): Kelly Criterion sizing (positive edge, no edge, negative edge, 100%/0% win rates), regime detection (low/medium/high volatility, boundaries), risk profile defaults (conservative/moderate/aggressive).

**parameter-bounds.test.ts** (14 tests): Bound constants, clamp function (within/min/max/edge), position size clamping, slippage clamping, leverage clamping, daily loss limit clamping.

**types.test.ts** (4 tests): Risk profile validation (conservative, moderate, aggressive, ordering).

### 10. security/ (68 tests across 8 files)

**approval-token.test.ts** (11 tests): Token validation, expiry, used token rejection, tampered amount detection, trade param matching (asset, side, amount, chain).

**data-isolation.test.ts** (11 tests): Namespace generation, scoped Redis keys, user ID extraction, namespace containment checks, user data key constants, DataIsolationError.

**message-signer.test.ts** (19 tests): HMAC-SHA256 signing/verification, key rejection, tamper detection, deterministic signatures, timestamp validation, WsMessage signing, nonce uniqueness.

**trust-chain.test.ts** (7 tests): ECDSA P-256 key pair generation, root certificate creation, certificate chain, signature verification, tamper detection.

**permissions.test.ts** (11 tests): RBAC permission checks (admin, user, ops, broker), permission assertion, cross-user access control, PermissionError.

**types.test.ts** (9 tests): Redis key generation, security default constants.

**approval-token-redis.test.ts** (11 tests): Token issuance/retrieval with Redis, consumption, double-consumption rejection, trade param validation.

**data-isolation-redis.test.ts** (16 tests): Namespace owner registration, access assertion (master, broker, user, task-based), user data CRUD, key listing, namespace purging, broker user management.

**message-signer-redis.test.ts** (11 tests): Nonce replay detection with Redis, signed message creation/validation, expired message rejection, WsMessage validation.

**trust-chain-redis.test.ts** (9 tests): Certificate storage/retrieval in Redis, agent key management, revocation, certificate chain verification (expired, revoked, untrusted root).

### 11. supervisor/ (30 tests across 3 files)

**command-bus.test.ts** (10 tests): Targeted/broadcast command dispatch, emergency/policy broadcasts, broker/helper routing, HMAC signing.

**event-collector.test.ts** (13 tests): Agent state tracking (started, stopped, paused, resumed, error), trade metrics (P&L, win/loss), position tracking, circuit breaker events, command ack/reject.

**fee-ledger.test.ts** (7 tests): Fee entry recording, fee summary aggregation, broker reconciliation, regulatory report generation.

### 12. trader/ (33 tests across 4 files)

**fee-manager.test.ts** (11 tests): Fee rate tiers ($10k, $1k, <$1k), fee calculation (normal, zero, negative, invalid), profit share calculation.

**nonce-manager.test.ts** (7 tests): Nonce increment, chain initialization with locking, wait for initialization, rollback, chain-specific keys.

**position-manager.test.ts** (8 tests): Position creation, user position retrieval, position lookup, open position listing, closed trade queries, position counting.

**trade-memory.test.ts** (7 tests): Trade record creation, idempotency key deduplication, state transition validation, trade retrieval, recoverable trade queries.

---

## Test Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Test Runner | Vitest | Fast, ESM-native test execution |
| Coverage | @vitest/coverage-v8 | V8 engine coverage instrumentation |
| Mocking | Proxy-based Drizzle ORM mock | Database mocking without real connections |
| Redis Mock | ioredis mock in tests/helpers/mock-db.ts | In-memory Redis simulation |
| Report Format | Istanbul LCOV + HTML | Standard coverage reporting |

---

## Coverage Thresholds

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Statements | 80% | 82.87% | PASS |
| Branches | 75% | 89.33% | PASS |
| Functions | 80% | 87.97% | PASS |
| Lines | 80% | 82.87% | PASS |

---

## How to Run

```bash
# Run all tests
npm run test

# Run with coverage report
npm run test:coverage

# Run in watch mode
npm run test:watch
```

---

*Report generated from Istanbul/V8 coverage at 2026-03-13T20:30:46Z*
