import type Redis from 'ioredis';
import { v4 as uuid } from 'uuid';
import { createChildLogger } from '../core/logger.js';
import type { SupervisorCommand, SupervisorCommandType, GlobalPolicy } from './types.js';
import { REDIS_STREAMS, REDIS_CHANNELS } from './types.js';

const log = createChildLogger('command-bus');

/**
 * Dispatches commands from supervisor to agents via Redis Streams + Pub/Sub.
 */
export class CommandBus {
  constructor(private redis: Redis) {}

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

    log.info({ commandId: command.id, type, issuedBy }, 'Broadcast command sent');
    return command;
  }

  /** Emergency broadcast via Pub/Sub (instant, fire-and-forget) */
  async emergencyBroadcast(payload: Record<string, unknown>): Promise<void> {
    await this.redis.publish(
      REDIS_CHANNELS.EMERGENCY,
      JSON.stringify({ type: 'emergency-halt', timestamp: Date.now(), ...payload }),
    );
    log.warn(payload, 'Emergency broadcast sent');
  }

  /** Publish global policy update via Pub/Sub */
  async policyBroadcast(policy: GlobalPolicy): Promise<void> {
    await this.redis.publish(
      REDIS_CHANNELS.POLICY_UPDATE,
      JSON.stringify({ policy, timestamp: Date.now() }),
    );
    log.info('Policy broadcast sent');
  }
}
