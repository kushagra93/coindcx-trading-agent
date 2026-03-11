import type Redis from 'ioredis';
import { createChildLogger } from '../core/logger.js';
import type { AgentReporter } from './agent-reporter.js';
import type { SupervisorCommand } from '../supervisor/types.js';
import { REDIS_STREAMS, REDIS_CHANNELS } from '../supervisor/types.js';

const log = createChildLogger('agent-cmd-handler');

/** Interface for the agent that receives commands */
export interface CommandReceiver {
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  destroy(): Promise<void>;
  updateConfig(config: Record<string, unknown>): void;
  updateRisk(overrides: Record<string, unknown>): void;
  forceClosePositions(): Promise<void>;
}

/**
 * Listens for commands from the supervisor and routes them to the user agent.
 */
export class AgentCommandHandler {
  private running = false;
  private agent: CommandReceiver | null = null;
  private subscriber: Redis | null = null;

  constructor(
    private redis: Redis,
    private agentId: string,
    private reporter: AgentReporter,
  ) {}

  /** Set the agent reference (handles circular dependency) */
  setAgent(agent: CommandReceiver): void {
    this.agent = agent;
  }

  /** Start listening for commands on both targeted and broadcast streams + pub/sub */
  async startListening(): Promise<void> {
    this.running = true;

    // Create consumer groups
    const targetedStream = REDIS_STREAMS.agentCommands(this.agentId);
    for (const stream of [targetedStream, REDIS_STREAMS.SUPERVISOR_COMMANDS]) {
      try {
        await this.redis.xgroup('CREATE', stream, `agent-${this.agentId}`, '$', 'MKSTREAM');
      } catch (err: any) {
        if (!err.message?.includes('BUSYGROUP')) throw err;
      }
    }

    // Subscribe to Pub/Sub channels for emergency broadcasts
    this.subscriber = this.redis.duplicate();
    await this.subscriber.subscribe(
      REDIS_CHANNELS.EMERGENCY,
      REDIS_CHANNELS.POLICY_UPDATE,
    );
    this.subscriber.on('message', (_channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        if (_channel === REDIS_CHANNELS.EMERGENCY) {
          log.warn({ agentId: this.agentId }, 'Emergency broadcast received — stopping');
          this.agent?.stop();
        } else if (_channel === REDIS_CHANNELS.POLICY_UPDATE) {
          log.info({ agentId: this.agentId }, 'Policy update received');
          // Agent can react to policy changes here
        }
      } catch (err) {
        log.error({ err }, 'Error processing pub/sub message');
      }
    });

    log.info({ agentId: this.agentId }, 'Command handler started');

    // Stream consumer loop
    while (this.running) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP', `agent-${this.agentId}`, `consumer-0`,
          'COUNT', '10',
          'BLOCK', '3000',
          'STREAMS', targetedStream, REDIS_STREAMS.SUPERVISOR_COMMANDS, '>', '>',
        ) as [string, [string, string[]][]][] | null;

        if (!results) continue;

        for (const [streamName, messages] of results) {
          for (const [messageId, fields] of messages) {
            const command = this.parseCommand(fields);
            if (command) {
              await this.handleCommand(command);
            }
            await this.redis.xack(streamName, `agent-${this.agentId}`, messageId);
          }
        }
      } catch (err) {
        if (this.running) {
          log.error({ err }, 'Error reading commands');
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  }

  /** Stop listening for commands */
  async stopListening(): Promise<void> {
    this.running = false;
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      this.subscriber.disconnect();
      this.subscriber = null;
    }
    log.info({ agentId: this.agentId }, 'Command handler stopped');
  }

  /** Route a command to the appropriate agent method */
  private async handleCommand(command: SupervisorCommand): Promise<void> {
    if (!this.agent) {
      await this.reporter.reportCommandRejected(command.id, 'Agent not initialized');
      return;
    }

    // Skip broadcast commands that target a different agent
    if (command.agentId !== '*' && command.agentId !== this.agentId) return;

    log.info({ commandId: command.id, type: command.type }, 'Handling command');

    try {
      switch (command.type) {
        case 'start':
          await this.agent.start();
          break;
        case 'stop':
          await this.agent.stop();
          break;
        case 'pause':
          await this.agent.pause();
          break;
        case 'resume':
          await this.agent.resume();
          break;
        case 'destroy':
          await this.agent.destroy();
          break;
        case 'update-config':
          this.agent.updateConfig(command.payload);
          break;
        case 'update-risk':
          this.agent.updateRisk(command.payload.overrides as Record<string, unknown> ?? {});
          break;
        case 'force-close-positions':
          await this.agent.forceClosePositions();
          break;
        case 'strategy-update':
          this.agent.updateConfig(command.payload.strategy as Record<string, unknown> ?? {});
          break;
        default:
          await this.reporter.reportCommandRejected(command.id, `Unknown command type: ${command.type}`);
          return;
      }
      await this.reporter.reportCommandAck(command.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await this.reporter.reportCommandRejected(command.id, message);
      log.error({ err, commandId: command.id }, 'Command execution failed');
    }
  }

  /** Parse raw Redis stream fields into SupervisorCommand */
  private parseCommand(fields: string[]): SupervisorCommand | null {
    try {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }
      return {
        id: data.id,
        type: data.type as SupervisorCommand['type'],
        agentId: data.agentId,
        issuedBy: data.issuedBy,
        payload: data.payload ? JSON.parse(data.payload) : {},
        timestamp: parseInt(data.timestamp) || Date.now(),
        priority: (data.priority as SupervisorCommand['priority']) || 'normal',
      };
    } catch {
      log.error('Failed to parse command');
      return null;
    }
  }
}
