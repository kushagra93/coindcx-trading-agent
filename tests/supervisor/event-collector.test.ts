import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventCollector } from '../../src/supervisor/event-collector.js';

function createMockRegistry() {
  return {
    updateState: vi.fn().mockResolvedValue(undefined),
    updateMetrics: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(null),
  } as any;
}

describe('EventCollector', () => {
  let registry: ReturnType<typeof createMockRegistry>;
  let onEvent: ReturnType<typeof vi.fn>;
  let collector: EventCollector;

  beforeEach(() => {
    registry = createMockRegistry();
    onEvent = vi.fn().mockResolvedValue(undefined);
    collector = new EventCollector(registry, onEvent);
  });

  it('updates state to running on "started" event', async () => {
    await collector.handleEvent({ type: 'started', agentId: 'agent-1', payload: {}, timestamp: Date.now() } as any);
    expect(registry.updateState).toHaveBeenCalledWith('agent-1', 'running');
    expect(onEvent).toHaveBeenCalled();
  });

  it('updates state to stopped on "stopped" event', async () => {
    await collector.handleEvent({ type: 'stopped', agentId: 'agent-1', payload: {}, timestamp: Date.now() } as any);
    expect(registry.updateState).toHaveBeenCalledWith('agent-1', 'stopped');
  });

  it('updates state to paused on "paused" event', async () => {
    await collector.handleEvent({ type: 'paused', agentId: 'agent-1', payload: {}, timestamp: Date.now() } as any);
    expect(registry.updateState).toHaveBeenCalledWith('agent-1', 'paused');
  });

  it('updates state to running on "resumed" event', async () => {
    await collector.handleEvent({ type: 'resumed', agentId: 'agent-1', payload: {}, timestamp: Date.now() } as any);
    expect(registry.updateState).toHaveBeenCalledWith('agent-1', 'running');
  });

  it('updates state to error on "error" event', async () => {
    await collector.handleEvent({ type: 'error', agentId: 'agent-1', payload: {}, timestamp: Date.now() } as any);
    expect(registry.updateState).toHaveBeenCalledWith('agent-1', 'error');
  });

  it('updates metrics on "trade-executed" event', async () => {
    registry.get.mockResolvedValue({
      metrics: { tradesExecuted: 5, volumeUsd: 1000, pnlUsd: 50, winCount: 3, lossCount: 2 },
    });

    await collector.handleEvent({
      type: 'trade-executed',
      agentId: 'agent-1',
      payload: { volumeUsd: 200, pnlUsd: 15 },
      timestamp: Date.now(),
    } as any);

    expect(registry.updateMetrics).toHaveBeenCalledWith('agent-1', {
      tradesExecuted: 6,
      volumeUsd: 1200,
      pnlUsd: 65,
      winCount: 4,
      lossCount: 2,
    });
  });

  it('increments lossCount for negative pnl', async () => {
    registry.get.mockResolvedValue({
      metrics: { tradesExecuted: 5, volumeUsd: 1000, pnlUsd: 50, winCount: 3, lossCount: 2 },
    });

    await collector.handleEvent({
      type: 'trade-executed',
      agentId: 'agent-1',
      payload: { volumeUsd: 200, pnlUsd: -10 },
      timestamp: Date.now(),
    } as any);

    expect(registry.updateMetrics).toHaveBeenCalledWith('agent-1', {
      tradesExecuted: 6,
      volumeUsd: 1200,
      pnlUsd: 40,
      winCount: 3,
      lossCount: 3,
    });
  });

  it('skips metrics update for unknown agent', async () => {
    registry.get.mockResolvedValue(null);

    await collector.handleEvent({
      type: 'trade-executed',
      agentId: 'unknown-agent',
      payload: { volumeUsd: 200, pnlUsd: 15 },
      timestamp: Date.now(),
    } as any);

    expect(registry.updateMetrics).not.toHaveBeenCalled();
  });

  it('increments openPositions on "position-opened"', async () => {
    registry.get.mockResolvedValue({ metrics: { openPositions: 2 } });

    await collector.handleEvent({
      type: 'position-opened',
      agentId: 'agent-1',
      payload: {},
      timestamp: Date.now(),
    } as any);

    expect(registry.updateMetrics).toHaveBeenCalledWith('agent-1', { openPositions: 3 });
  });

  it('decrements openPositions on "position-closed" (min 0)', async () => {
    registry.get.mockResolvedValue({ metrics: { openPositions: 0 } });

    await collector.handleEvent({
      type: 'position-closed',
      agentId: 'agent-1',
      payload: {},
      timestamp: Date.now(),
    } as any);

    expect(registry.updateMetrics).toHaveBeenCalledWith('agent-1', { openPositions: 0 });
  });

  it('handles circuit-breaker-tripped without crashing', async () => {
    await expect(
      collector.handleEvent({
        type: 'circuit-breaker-tripped',
        agentId: 'agent-1',
        payload: {},
        timestamp: Date.now(),
      } as any)
    ).resolves.toBeUndefined();
  });

  it('handles command-ack', async () => {
    await expect(
      collector.handleEvent({
        type: 'command-ack',
        agentId: 'agent-1',
        payload: { commandId: 'cmd-1' },
        timestamp: Date.now(),
      } as any)
    ).resolves.toBeUndefined();
  });

  it('handles command-rejected', async () => {
    await expect(
      collector.handleEvent({
        type: 'command-rejected',
        agentId: 'agent-1',
        payload: { commandId: 'cmd-1', reason: 'invalid' },
        timestamp: Date.now(),
      } as any)
    ).resolves.toBeUndefined();
  });

  it('works without onEvent callback', async () => {
    const collectorNoCallback = new EventCollector(registry);
    await expect(
      collectorNoCallback.handleEvent({ type: 'started', agentId: 'agent-1', payload: {}, timestamp: Date.now() } as any)
    ).resolves.toBeUndefined();
    expect(registry.updateState).toHaveBeenCalledWith('agent-1', 'running');
  });
});
