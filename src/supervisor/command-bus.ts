import { v4 as uuid } from 'uuid';
import { createChildLogger } from '../core/logger.js';
import type { WsHub } from '../core/ws-hub.js';
import type { WsMessage } from '../core/ws-types.js';
import { signWsMessage } from '../security/message-signer.js';
import type { SupervisorCommand, SupervisorCommandType, GlobalPolicy } from './types.js';

const log = createChildLogger('command-bus');

/**
 * Dispatches commands from the Master Agent to agents via the Redis-backed WsHub.
 * All outbound messages are HMAC-SHA256 signed per MDC §Message Signing.
 */
export class CommandBus {
  private signingAgentId: string | null = null;
  private signingKey: string | null = null;

  constructor(private hub: WsHub) {}

  enableSigning(agentId: string, privateKey: string): void {
    this.signingAgentId = agentId;
    this.signingKey = privateKey;
    log.info({ agentId }, 'Message signing enabled');
  }

  private sign(msg: WsMessage): WsMessage {
    if (!this.signingKey) {
      log.warn('Signing key not set — message sent unsigned');
      return msg;
    }
    return signWsMessage(msg, this.signingKey);
  }

  async sendCommand(
    type: SupervisorCommandType,
    agentId: string,
    issuedBy: string,
    payload: Record<string, unknown> = {},
    priority: SupervisorCommand['priority'] = 'normal',
  ): Promise<SupervisorCommand> {
    const command: SupervisorCommand = {
      id: uuid(),
      type,
      agentId,
      issuedBy,
      payload,
      timestamp: Date.now(),
      priority,
    };

    const wsMsg = this.sign({
      type: 'command',
      from: 'master-agent',
      to: agentId,
      payload: { command },
      timestamp: Date.now(),
      corrId: command.id,
    });

    await this.hub.sendTo(agentId, wsMsg);
    log.info({ commandId: command.id, type, agentId, issuedBy }, 'Command sent to agent');
    return command;
  }

  async broadcastCommand(
    type: SupervisorCommandType,
    issuedBy: string,
    payload: Record<string, unknown> = {},
    priority: SupervisorCommand['priority'] = 'normal',
  ): Promise<SupervisorCommand> {
    const command: SupervisorCommand = {
      id: uuid(),
      type,
      agentId: '*',
      issuedBy,
      payload,
      timestamp: Date.now(),
      priority,
    };

    const wsMsg = this.sign({
      type: 'command',
      from: 'master-agent',
      to: '*',
      payload: { command },
      timestamp: Date.now(),
      corrId: command.id,
    });

    await this.hub.broadcast(wsMsg);
    log.info({ commandId: command.id, type, issuedBy }, 'Broadcast command sent');
    return command;
  }

  async emergencyBroadcast(payload: Record<string, unknown>): Promise<void> {
    const wsMsg = this.sign({
      type: 'emergency',
      from: 'master-agent',
      to: '*',
      payload: { ...payload, timestamp: Date.now() },
      timestamp: Date.now(),
    });

    await this.hub.broadcast(wsMsg);
    log.warn(payload, 'Emergency broadcast sent');
  }

  async policyBroadcast(policy: GlobalPolicy): Promise<void> {
    const wsMsg = this.sign({
      type: 'policy-update',
      from: 'master-agent',
      to: '*',
      payload: { policy, timestamp: Date.now() },
      timestamp: Date.now(),
    });

    await this.hub.broadcast(wsMsg);
    log.info('Policy broadcast sent');
  }

  async sendToBroker(
    brokerId: string,
    payload: Record<string, unknown>,
    corrId?: string,
  ): Promise<void> {
    const wsMsg = this.sign({
      type: 'command',
      from: 'master-agent',
      to: brokerId,
      payload,
      timestamp: Date.now(),
      corrId,
    });

    await this.hub.sendTo(brokerId, wsMsg);
    log.info({ brokerId }, 'Message sent to broker');
  }

  async sendToHelper(
    helperType: string,
    payload: Record<string, unknown>,
    corrId?: string,
  ): Promise<void> {
    const wsMsg = this.sign({
      type: 'helper-task',
      from: 'master-agent',
      to: `helper-${helperType}`,
      payload,
      timestamp: Date.now(),
      corrId,
    });

    const sent = await this.hub.sendToHelper(helperType, wsMsg);
    if (!sent) {
      log.warn({ helperType }, 'No helpers of this type connected — task queued offline');
    } else {
      log.debug({ helperType }, 'Task sent to helper pool');
    }
  }
}
