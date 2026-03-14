import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandBus } from '../../src/supervisor/command-bus.js';

function createMockHub() {
  return {
    sendTo: vi.fn().mockResolvedValue(true),
    broadcast: vi.fn().mockResolvedValue(undefined),
    sendToHelper: vi.fn().mockResolvedValue(true),
  } as any;
}

describe('CommandBus', () => {
  let hub: ReturnType<typeof createMockHub>;
  let bus: CommandBus;

  beforeEach(() => {
    hub = createMockHub();
    bus = new CommandBus(hub);
  });

  describe('sendCommand', () => {
    it('sends targeted command to hub', async () => {
      const cmd = await bus.sendCommand('start', 'agent-1', 'admin-1');
      expect(hub.sendTo).toHaveBeenCalledTimes(1);
      expect(hub.sendTo.mock.calls[0][0]).toBe('agent-1');
      const msg = hub.sendTo.mock.calls[0][1];
      expect(msg.type).toBe('command');
      expect(msg.from).toBe('master-agent');
      expect(msg.to).toBe('agent-1');
      expect(msg.payload.command.type).toBe('start');
      expect(msg.payload.command.issuedBy).toBe('admin-1');
      expect(cmd.id).toBeDefined();
      expect(cmd.type).toBe('start');
    });

    it('includes custom payload and priority', async () => {
      const cmd = await bus.sendCommand('update-risk', 'agent-1', 'admin', { maxLeverage: 5 }, 'high');
      expect(cmd.payload).toEqual({ maxLeverage: 5 });
      expect(cmd.priority).toBe('high');
    });
  });

  describe('broadcastCommand', () => {
    it('broadcasts to all via hub', async () => {
      const cmd = await bus.broadcastCommand('stop', 'admin-1', { emergency: true }, 'emergency');
      expect(hub.broadcast).toHaveBeenCalledTimes(1);
      const msg = hub.broadcast.mock.calls[0][0];
      expect(msg.type).toBe('command');
      expect(msg.to).toBe('*');
      expect(msg.from).toBe('master-agent');
      expect(cmd.agentId).toBe('*');
    });
  });

  describe('emergencyBroadcast', () => {
    it('sends emergency type', async () => {
      await bus.emergencyBroadcast({ reason: 'market crash' });
      expect(hub.broadcast).toHaveBeenCalledTimes(1);
      const msg = hub.broadcast.mock.calls[0][0];
      expect(msg.type).toBe('emergency');
      expect(msg.payload.reason).toBe('market crash');
    });
  });

  describe('policyBroadcast', () => {
    it('sends policy-update type', async () => {
      const policy = { maintenanceMode: false } as any;
      await bus.policyBroadcast(policy);
      expect(hub.broadcast).toHaveBeenCalledTimes(1);
      const msg = hub.broadcast.mock.calls[0][0];
      expect(msg.type).toBe('policy-update');
      expect(msg.payload.policy).toBe(policy);
    });
  });

  describe('sendToBroker', () => {
    it('sends to specific broker', async () => {
      await bus.sendToBroker('broker-US', { action: 'report' }, 'corr-1');
      expect(hub.sendTo).toHaveBeenCalledWith('broker-US', expect.objectContaining({
        type: 'command',
        to: 'broker-US',
        corrId: 'corr-1',
      }));
    });
  });

  describe('sendToHelper', () => {
    it('sends helper task', async () => {
      await bus.sendToHelper('risk', { analyze: true }, 'corr-2');
      expect(hub.sendToHelper).toHaveBeenCalledWith('risk', expect.objectContaining({
        type: 'helper-task',
        to: 'helper-risk',
      }));
    });

    it('handles offline helper', async () => {
      hub.sendToHelper.mockResolvedValue(false);
      await bus.sendToHelper('risk', { analyze: true });
      expect(hub.sendToHelper).toHaveBeenCalledTimes(1);
    });
  });

  describe('enableSigning', () => {
    it('signs outbound messages when enabled', async () => {
      bus.enableSigning('master-agent', 'test-private-key');
      await bus.sendCommand('start', 'agent-1', 'admin');
      const msg = hub.sendTo.mock.calls[0][1];
      expect(msg.signature).toBeDefined();
      expect(msg.nonce).toBeDefined();
      expect(typeof msg.signature).toBe('string');
      expect(msg.signature.length).toBe(64);
    });

    it('sends unsigned when signing not enabled', async () => {
      await bus.sendCommand('start', 'agent-1', 'admin');
      const msg = hub.sendTo.mock.calls[0][1];
      expect(msg.signature).toBeUndefined();
    });
  });
});
