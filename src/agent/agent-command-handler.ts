import { createChildLogger } from '../core/logger.js';
import type { WsClient } from '../core/ws-client.js';
import type { WsMessage } from '../core/ws-types.js';
import type { AgentReporter } from './agent-reporter.js';
import type { SupervisorCommand } from '../supervisor/types.js';

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
 * Listens for commands from the Master Agent via WebSocket
 * and routes them to the user agent.
 */
export class AgentCommandHandler {
  private agent: CommandReceiver | null = null;

  constructor(
    private wsClient: WsClient,
    private agentId: string,
    private reporter: AgentReporter,
  ) {}

  setAgent(agent: CommandReceiver): void {
    this.agent = agent;
  }

  /** Start listening for commands via WebSocket messages */
  startListening(): void {
    this.wsClient.onMessage(async (message: WsMessage) => {
      if (message.type === 'command') {
        const command = message.payload.command as SupervisorCommand | undefined;
        if (command) {
          await this.handleCommand(command);
        }
      } else if (message.type === 'emergency') {
        log.warn({ agentId: this.agentId }, 'Emergency broadcast received — stopping');
        this.agent?.stop();
      } else if (message.type === 'policy-update') {
        log.info({ agentId: this.agentId }, 'Policy update received');
      }
    });

    log.info({ agentId: this.agentId }, 'Command handler started (WebSocket)');
  }

  /** Route a command to the appropriate agent method */
  private async handleCommand(command: SupervisorCommand): Promise<void> {
    if (!this.agent) {
      await this.reporter.reportCommandRejected(command.id, 'Agent not initialized');
      return;
    }

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
}
