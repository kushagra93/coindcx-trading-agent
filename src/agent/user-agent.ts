import Redis from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { Chain } from '../core/types.js';
import type { AgentLifecycleState } from '../supervisor/types.js';
import { AgentReporter } from './agent-reporter.js';
import { AgentCommandHandler, type CommandReceiver } from './agent-command-handler.js';

const log = createChildLogger('user-agent');

/**
 * A managed user agent that wraps the existing trading subsystems
 * (orchestrator, executor, risk, positions) into a supervised entity.
 *
 * Reports to the supervisor via AgentReporter and responds to commands
 * via AgentCommandHandler.
 */
export class UserAgent implements CommandReceiver {
  private running = false;
  private paused = false;
  private cycleCount = 0;
  private startedAt: number | null = null;
  private lastTradeAt: number | null = null;
  private openPositions = 0;
  private unrealizedPnlUsd = 0;

  private reporter: AgentReporter;
  private commandHandler: AgentCommandHandler;
  private redis: Redis;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private config: Record<string, unknown> = {};
  private riskOverrides: Record<string, unknown> = {};

  constructor(
    private agentId: string,
    private userId: string,
    private strategy: string,
    private chain: Chain,
    redisUrl: string,
    private cycleIntervalMs: number = 5_000,
    private heartbeatIntervalMs: number = 15_000,
  ) {
    this.redis = new Redis(redisUrl);
    this.reporter = new AgentReporter(this.redis, agentId, userId);
    this.commandHandler = new AgentCommandHandler(this.redis, agentId, this.reporter);
    this.commandHandler.setAgent(this);
  }

  // ═══════════════════════════════════════════════
  // Lifecycle (implements CommandReceiver)
  // ═══════════════════════════════════════════════

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.paused = false;
    this.startedAt = Date.now();
    this.cycleCount = 0;

    // Start heartbeat interval
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatIntervalMs);

    // Start command listener (non-blocking)
    this.commandHandler.startListening().catch(err => {
      log.error({ err, agentId: this.agentId }, 'Command handler crashed');
    });

    // Report started
    await this.reporter.sendEvent('started', { strategy: this.strategy, chain: this.chain });
    log.info({ agentId: this.agentId, strategy: this.strategy, chain: this.chain }, 'User agent started');

    // Main trading loop
    while (this.running) {
      try {
        await this.runCycle();
      } catch (err) {
        log.error({ err, agentId: this.agentId }, 'Cycle error');
        await this.reporter.reportError(err instanceof Error ? err : new Error(String(err)));
      }
      await new Promise(r => setTimeout(r, this.cycleIntervalMs));
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;
    this.paused = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    await this.commandHandler.stopListening();
    await this.reporter.sendEvent('stopped', {});
    log.info({ agentId: this.agentId }, 'User agent stopped');
  }

  async pause(): Promise<void> {
    this.paused = true;
    await this.reporter.sendEvent('paused', {});
    log.info({ agentId: this.agentId }, 'User agent paused');
  }

  async resume(): Promise<void> {
    this.paused = false;
    await this.reporter.sendEvent('resumed', {});
    log.info({ agentId: this.agentId }, 'User agent resumed');
  }

  async destroy(): Promise<void> {
    await this.forceClosePositions();
    await this.stop();
    this.redis.disconnect();
    log.info({ agentId: this.agentId }, 'User agent destroyed');
  }

  updateConfig(config: Record<string, unknown>): void {
    this.config = { ...this.config, ...config };
    log.info({ agentId: this.agentId }, 'Config updated');
  }

  updateRisk(overrides: Record<string, unknown>): void {
    this.riskOverrides = { ...this.riskOverrides, ...overrides };
    log.info({ agentId: this.agentId, overrides }, 'Risk overrides updated');
  }

  async forceClosePositions(): Promise<void> {
    log.warn({ agentId: this.agentId }, 'Force closing all positions');
    // In production: iterate open positions via position-manager and close each
    this.openPositions = 0;
    this.unrealizedPnlUsd = 0;
  }

  // ═══════════════════════════════════════════════
  // Trading Cycle
  // ═══════════════════════════════════════════════

  /** Main trading cycle — called by the event loop */
  private async runCycle(): Promise<void> {
    this.cycleCount++;

    // Skip if paused
    if (this.paused) {
      log.trace({ agentId: this.agentId }, 'Cycle skipped (paused)');
      return;
    }

    // In production, this would:
    // 1. Check circuit breaker (isTradingAllowed from circuit-breaker.ts)
    // 2. Fetch latest signals / price data
    // 3. Evaluate strategy
    // 4. Validate risk (validateTrade from risk-manager.ts)
    // 5. Execute trades (executeTrade from order-executor.ts)
    // 6. Update positions (position-manager.ts)
    // 7. Report trade events to supervisor

    log.trace({
      agentId: this.agentId,
      cycle: this.cycleCount,
      strategy: this.strategy,
      chain: this.chain,
    }, 'Trading cycle executed');
  }

  // ═══════════════════════════════════════════════
  // Heartbeat
  // ═══════════════════════════════════════════════

  private async sendHeartbeat(): Promise<void> {
    await this.reporter.sendHeartbeat({
      state: this.getState(),
      cycleCount: this.cycleCount,
      lastTradeAt: this.lastTradeAt,
      openPositions: this.openPositions,
      unrealizedPnlUsd: this.unrealizedPnlUsd,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
    });
  }

  // ═══════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════

  getState(): AgentLifecycleState {
    if (!this.running) return 'stopped';
    if (this.paused) return 'paused';
    return 'running';
  }

  getAgentId(): string { return this.agentId; }
  getUserId(): string { return this.userId; }
  getStrategy(): string { return this.strategy; }
  getChain(): Chain { return this.chain; }
  getCycleCount(): number { return this.cycleCount; }
}
