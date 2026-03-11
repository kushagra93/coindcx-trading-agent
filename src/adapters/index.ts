import { config } from '../core/config.js';
import type { HostAppAdapter } from './host-app-adapter.js';
import { CoinDCXAdapter } from './coindcx-adapter.js';
import { GenericAdapter } from './generic-adapter.js';

const adapters: Record<string, () => HostAppAdapter> = {
  coindcx: () => new CoinDCXAdapter(),
  generic: () => new GenericAdapter(),
};

let instance: HostAppAdapter | null = null;

export function getAdapter(): HostAppAdapter {
  if (!instance) {
    const factory = adapters[config.hostApp.adapter];
    if (!factory) {
      throw new Error(`Unknown host app adapter: ${config.hostApp.adapter}. Available: ${Object.keys(adapters).join(', ')}`);
    }
    instance = factory();
  }
  return instance;
}

export type { HostAppAdapter } from './host-app-adapter.js';
