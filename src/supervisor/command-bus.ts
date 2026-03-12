import type Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import { createChildLogger } from '../core/logger.js';
import type { SupervisorCommand, SupervisorCommandType, GlobalPolicy } from './types.js';
import { REDIS_STREAMS, REDIS_CHANNELS } from './types.js';
import {
  createSignedMessage,
  serializeForStream,
} from '../security/message-signer.js';
import type { AgentMessageType, SignedMessage } from '../security/types.js';

const log = createChildLogger('command-bus');

/**
 * Dispatches commands from supervisor to agents via Redis Streams + Pub/Sub.
 * All messages are wrapped in signed envelopes for authenticity and integrity.
 */
export class CommandBus {
  private signingKey: string | null = null;
  private masterAgentId: string = 'master-agent';

  constructor(private redis: Redis) {}

  /**
   * Enable message signing for all outbound messages.
   * Call this after Master Agent initialization with the master's private key.
   */
  enableSigning(masterAgentId: string, privateKey: string): void {
    this.masterAgentId = masterAgentId;
    this.signingKey = privateKey;
    log.info('Command bus message signing enabled');
  }

  /** Send a targeted command to a specific agent */
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

    const streamKey = REDIS_STREAMS.agentCommands(agentId);

    // If signing is enabled, wrap in signed envelope
    if (this.signingKey) {
      const signed = await this.wrapInEnvelope(
        agentId,
        'COMMAND',
        { command },
      );
      const serialized = serializeForStream(signed);
      await this.redis.xadd(streamKey, '*', ...Object.entries(serialized).flat());
    } else {
      // Legacy: send without signing
      await this.redis.xadd(
        streamKey, '*',
        'id', command.id,
        'type', command.type,
        'agentId', command.agentId,
        'issuedBy', command.issuedBy,
        'payload', JSON.stringify(command.payload),
        'timestamp', command.timestamp.toString(),
        'priority', command.priority,
      );
    }

    log.info({ commandId: command.id, type, agentId, issuedBy }, 'Command sent to agent');
    return command;
  }

  /** Broadcast a command to all agents via the shared stream */
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

    if (this.signingKey) {
      const signed = await this.wrapInEnvelope(
        '*',
        'COMMAND',
        { command },
      );
      const serialized = serializeForStream(signed);
      await this.redis.xadd(
        REDIS_STREAMS.SUPERVISOR_COMMANDS, '*',
        ...Object.entries(serialized).flat(),
      );
    } else {
      await this.redis.xadd(
        REDIS_STREAMS.SUPERVISOR_COMMANDS, '*',
        'id', command.id,
        'type', command.type,
        'agentId', '*',
        'issuedBy', command.issuedBy,
        'payload', JSON.stringify(command.payload),
        'timestamp', command.timestamp.toString(),
        'priority', command.priority,
      );
    }

    log.info({ commandId: command.id, type, issuedBy }, 'Broadcast command sent');
    return command;
  }

  /** Emergency broadcast via Pub/Sub (instant, fire-and-forget) */
  async emergencyBroadcast(payload: Record<string, unknown>): Promise<void> {
    const message = { type: 'emergency-halt', timestamp: Date.now(), ...payload };

    if (this.signingKey) {
      const signed = await this.wrapInEnvelope('*', 'COMMAND', message);
      await this.redis.publish(REDIS_CHANNELS.EMERGENCY, JSON.stringify(signed));
    } else {
      await this.redis.publish(REDIS_CHANNELS.EMERGENCY, JSON.stringify(message));
    }

    log.warn(payload, 'Emergency broadcast sent');
  }

  /** Publish global policy update via Pub/Sub */
  async policyBroadcast(policy: GlobalPolicy): Promise<void> {
    const message = { policy, timestamp: Date.now() };

    if (this.signingKey) {
      const signed = await this.wrapInEnvelope('*', 'COMMAND', message);
      await this.redis.publish(REDIS_CHANNELS.POLICY_UPDATE, JSON.stringify(signed));
    } else {
      await this.redis.publish(
        REDIS_CHANNELS.POLICY_UPDATE,
        JSON.stringify(message),
      );
    }

    log.info('Policy broadcast sent');
  }

  /** Send a message to a broker's command stream */
  async sendToBroker(
    jurisdiction: string,
    messageType: AgentMessageType,
    payload: Record<string, unknown>,
    corrId?: string,
  ): Promise<void> {
    const streamKey = REDIS_STREAMS.brokerCommands(jurisdiction);

    if (this.signingKey) {
      const signed = await this.wrapInEnvelope(
        `broker-${jurisdiction}`,
        messageType,
        payload,
        corrId,
      );
      const serialized = serializeForStream(signed);
      await this.redis.xadd(streamKey, '*', ...Object.entries(serialized).flat());
    } else {
      await this.redis.xadd(
        streamKey, '*',
        'type', messageType,
        'payload', JSON.stringify(payload),
        'timestamp', Date.now().toString(),
      );
    }

    log.info({ jurisdiction, messageType }, 'Message sent to broker');
  }

  /** Send a task to a helper agent pool */
  async sendToHelper(
    helperType: string,
    payload: Record<string, unknown>,
    corrId?: string,
  ): Promise<void> {
    const streamKey = REDIS_STREAMS.helperTasks(helperType);

    if (this.signingKey) {
      const signed = await this.wrapInEnvelope(
        `helper-${helperType}`,
        'COMMAND',
        payload,
        corrId,
      );
      const serialized = serializeForStream(signed);
      await this.redis.xadd(streamKey, '*', ...Object.entries(serialized).flat());
    } else {
      await this.redis.xadd(
        streamKey, '*',
        'payload', JSON.stringify(payload),
        'timestamp', Date.now().toString(),
      );
    }

    log.debug({ helperType }, 'Task sent to helper pool');
  }

  /** Wrap a payload in a signed message envelope */
  private async wrapInEnvelope(
    to: string,
    type: AgentMessageType,
    payload: Record<string, unknown>,
    corrId?: string,
  ): Promise<SignedMessage> {
    if (!this.signingKey) {
      throw new Error('Signing key not configured — call enableSigning() first');
    }

    return createSignedMessage(
      this.masterAgentId,
      to,
      type,
      payload,
      this.signingKey,
      this.redis as any, // ioredis type compatibility
      corrId,
    );
  }
}
