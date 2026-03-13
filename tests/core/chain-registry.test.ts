import { describe, it, expect } from 'vitest';
import {
  CHAIN_REGISTRY,
  ALL_CHAIN_IDS,
  EVM_CHAINS,
  VALID_CHAINS,
  EVM_CHAIN_IDS,
  CHAIN_ID_TO_NAME,
  DEXSCREENER_TO_CHAIN,
  NATIVE_TOKEN_SYMBOLS,
  getChainConfig,
  getChainRpcUrl,
  getEvmChainId,
  isNativeToken,
} from '../../src/core/chain-registry.js';

describe('chain-registry', () => {
  describe('CHAIN_REGISTRY', () => {
    it('has solana entry', () => {
      const sol = CHAIN_REGISTRY.solana;
      expect(sol.id).toBe('solana');
      expect(sol.family).toBe('solana');
      expect(sol.nativeToken).toBe('SOL');
    });

    it('has ethereum entry with chain ID', () => {
      const eth = CHAIN_REGISTRY.ethereum;
      expect(eth.id).toBe('ethereum');
      expect(eth.family).toBe('evm');
      expect(eth.chainId).toBe(1);
      expect(eth.nativeToken).toBe('ETH');
    });

    it('has hyperliquid entry', () => {
      const hl = CHAIN_REGISTRY.hyperliquid;
      expect(hl.id).toBe('hyperliquid');
      expect(hl.family).toBe('hyperliquid');
    });

    it('all entries have required fields', () => {
      for (const [id, cfg] of Object.entries(CHAIN_REGISTRY)) {
        expect(cfg.id).toBe(id);
        expect(cfg.name).toBeTruthy();
        expect(cfg.family).toBeTruthy();
        expect(cfg.nativeToken).toBeTruthy();
        expect(cfg.defaultRpcUrl).toBeTruthy();
        expect(cfg.dexScreenerId).toBeTruthy();
        expect(cfg.defaultDexVenue).toBeTruthy();
        expect(cfg.gasConfig).toBeDefined();
      }
    });
  });

  describe('derived constants', () => {
    it('ALL_CHAIN_IDS contains all registry keys', () => {
      expect(ALL_CHAIN_IDS).toEqual(Object.keys(CHAIN_REGISTRY));
      expect(ALL_CHAIN_IDS).toContain('solana');
      expect(ALL_CHAIN_IDS).toContain('ethereum');
      expect(ALL_CHAIN_IDS).toContain('polygon');
    });

    it('EVM_CHAINS only contains EVM chains', () => {
      for (const id of EVM_CHAINS) {
        expect(CHAIN_REGISTRY[id].family).toBe('evm');
      }
      expect(EVM_CHAINS).not.toContain('solana');
      expect(EVM_CHAINS).not.toContain('hyperliquid');
    });

    it('VALID_CHAINS is a Set of all chain IDs', () => {
      expect(VALID_CHAINS.has('solana')).toBe(true);
      expect(VALID_CHAINS.has('ethereum')).toBe(true);
      expect(VALID_CHAINS.has('nonexistent')).toBe(false);
    });

    it('EVM_CHAIN_IDS maps chain name to numeric ID', () => {
      expect(EVM_CHAIN_IDS.ethereum).toBe(1);
      expect(EVM_CHAIN_IDS.polygon).toBe(137);
      expect(EVM_CHAIN_IDS.base).toBe(8453);
    });

    it('CHAIN_ID_TO_NAME reverse-maps numeric ID to name', () => {
      expect(CHAIN_ID_TO_NAME[1]).toBe('ethereum');
      expect(CHAIN_ID_TO_NAME[137]).toBe('polygon');
    });

    it('DEXSCREENER_TO_CHAIN maps dexscreener slugs', () => {
      expect(DEXSCREENER_TO_CHAIN.solana).toBe('solana');
      expect(DEXSCREENER_TO_CHAIN.ethereum).toBe('ethereum');
    });

    it('NATIVE_TOKEN_SYMBOLS contains expected symbols', () => {
      expect(NATIVE_TOKEN_SYMBOLS.has('SOL')).toBe(true);
      expect(NATIVE_TOKEN_SYMBOLS.has('ETH')).toBe(true);
      expect(NATIVE_TOKEN_SYMBOLS.has('MATIC')).toBe(true);
    });
  });

  describe('getChainConfig', () => {
    it('returns config for known chain', () => {
      const cfg = getChainConfig('solana');
      expect(cfg.id).toBe('solana');
    });

    it('throws for unknown chain', () => {
      expect(() => getChainConfig('fakenetwork')).toThrow('Unknown chain');
    });
  });

  describe('getChainRpcUrl', () => {
    it('returns default RPC for chain', () => {
      const url = getChainRpcUrl('solana');
      expect(url).toBe('https://api.mainnet-beta.solana.com');
    });

    it('returns env override if set', () => {
      process.env.CHAIN_RPC_POLYGON = 'https://custom-polygon.example.com';
      const url = getChainRpcUrl('polygon');
      expect(url).toBe('https://custom-polygon.example.com');
      delete process.env.CHAIN_RPC_POLYGON;
    });
  });

  describe('getEvmChainId', () => {
    it('returns numeric chain ID for EVM chain', () => {
      expect(getEvmChainId('ethereum')).toBe(1);
      expect(getEvmChainId('polygon')).toBe(137);
    });

    it('throws for non-EVM chain', () => {
      expect(() => getEvmChainId('solana')).toThrow('not an EVM chain');
    });
  });

  describe('isNativeToken', () => {
    it('returns true for matching native token', () => {
      expect(isNativeToken('solana', 'SOL')).toBe(true);
      expect(isNativeToken('ethereum', 'ETH')).toBe(true);
    });

    it('returns true for "native" keyword', () => {
      expect(isNativeToken('solana', 'native')).toBe(true);
    });

    it('returns false for non-native token', () => {
      expect(isNativeToken('ethereum', 'USDC')).toBe(false);
    });

    it('returns false for unknown chain', () => {
      expect(isNativeToken('fakenet', 'ETH')).toBe(false);
    });
  });
});
