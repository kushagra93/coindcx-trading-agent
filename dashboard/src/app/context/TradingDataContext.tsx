/**
 * Shared Trading Data Provider — single source of truth for all screens.
 *
 * Derives holdings, signals, agents, portfolio summary, and events
 * from TOKEN_DB / PERP_DB in blockchain.ts. Both the user-facing
 * MainScreen and the admin SupervisorPage consume this context so
 * data is always in sync.
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
  TOKEN_DB, PERP_DB, CHAIN_CONFIG,
  type TokenMetrics, type Chain,
} from '../services/blockchain';

// ─── Types ────────────────────────────────────────────────────

export interface Holding {
  token: string;
  chain: string;
  balance: string;
  usd: string;
  usdRaw: number;
  change: number;
  price: number;
}

export interface PerpHolding {
  token: string;
  side: 'Long' | 'Short';
  leverage: string;
  size: string;
  sizeRaw: number;
  entry: string;
  pnl: string;
  pnlRaw: number;
  pnlPct: number;
}

export interface Signal {
  token: string;
  chain: string;
  signal: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell';
  reason: string;
  strength: number;
}

export interface TradeEvent {
  id: string;
  token: string;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  time: string;
  timestamp: number;
}

export interface AgentData {
  agentId: string;
  userId: string;
  state: 'running' | 'paused' | 'stopped' | 'error' | 'creating';
  strategy: string;
  chain: string;
  riskLevel: string;
  tradesExecuted: number;
  volumeUsd: number;
  pnlUsd: number;
  openPositions: number;
  lastHeartbeat: number;
  createdAt: number;
}

export interface EventEntry {
  type: string;
  agentId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface AuditEntry {
  actor: string;
  action: string;
  resource: string;
  timestamp: number;
  success: boolean;
}

export interface LeaderEntry {
  rank: number;
  name: string;
  pnl: string;
  sharpe: number;
  copiers: number;
  chain: string;
}

export interface StrategyEntry {
  id: string;
  name: string;
  desc: string;
  active: boolean;
}

// ─── Automation Types ──────────────────────────────────────────

export interface ConditionalRule {
  id: string;
  condition: string;
  action: string;
  status: 'active' | 'triggered' | 'paused';
  description: string;
}

export interface DcaPlan {
  id: string;
  token: string;
  amountPerBuy: number;
  completedBuys: number;
  totalBuys: number;
  nextBuyTime: string;
  status: 'active' | 'completed' | 'paused';
  description: string;
}

export interface LimitOrder {
  id: string;
  token: string;
  triggerPrice: number;
  currentPrice: number;
  side: 'buy' | 'sell';
  amount: number;
  status: 'active' | 'triggered' | 'paused';
  description: string;
}

export interface PriceAlert {
  id: string;
  token: string;
  targetPrice: number;
  direction: 'above' | 'below';
  status: 'active' | 'triggered' | 'paused';
  description: string;
}

export interface CopyTrade {
  id: string;
  traderName: string;
  allocation: number;
  status: 'active' | 'paused';
  description: string;
}

export interface PortfolioSummary {
  totalValue: number;
  todayPnl: number;
  todayPnlPct: number;
  activeStrategies: number;
  perpTotalSize: number;
  perpTotalPnl: number;
}

export interface HelperStatus {
  type: string;
  status: 'running' | 'idle' | 'error';
  queue: number;
  processed: number;
  icon: string;
  color: string;
}

export interface BrokerData {
  jurisdiction: string;
  status: string;
  agents: number;
  compliance: string;
  restricted: string[];
  maxLeverage: number;
}

export interface TradingDataState {
  // Derived from TOKEN_DB
  holdings: Holding[];
  perpHoldings: PerpHolding[];
  signals: Signal[];
  recentTrades: TradeEvent[];
  portfolio: PortfolioSummary;

  // Supervisor data (derived from TOKEN_DB tokens as agents)
  agents: AgentData[];
  events: EventEntry[];
  auditLog: AuditEntry[];
  helpers: HelperStatus[];
  brokers: BrokerData[];
  leaderboard: LeaderEntry[];
  strategies: StrategyEntry[];

  // Automations
  conditionalRules: ConditionalRule[];
  dcaPlans: DcaPlan[];
  limitOrders: LimitOrder[];
  priceAlerts: PriceAlert[];
  copyTrades: CopyTrade[];

  // Actions
  setAgents: React.Dispatch<React.SetStateAction<AgentData[]>>;
  addTradeEvent: (event: TradeEvent) => void;
  addAuditEntry: (entry: AuditEntry) => void;
  addConditionalRule: (rule: ConditionalRule) => void;
  addPriceAlert: (alert: PriceAlert) => void;
  addLimitOrder: (order: LimitOrder) => void;
  addDcaPlan: (plan: DcaPlan) => void;

  // Chains list derived from data
  chains: string[];
  allTokens: TokenMetrics[];
}

const TradingDataContext = createContext<TradingDataState | null>(null);

// ─── Data Generation from TOKEN_DB ───────────────────────────

function generateHoldings(): Holding[] {
  // Which tokens the user "holds" — select a representative set from TOKEN_DB
  const heldSymbols = [
    'SOL', 'FARTCOIN', 'POPCAT', 'WIF', 'BONK', 'MYRO',
    'BRETT', 'DEGEN', 'TOSHI', 'AERO',
    'ETH', 'PEPE', 'MOG',
    'ARB', 'GMX', 'PENDLE',
    'POL', 'AAVE',
    'BNB', 'CAKE',
    'OP',
    'AVAX',
    'MON', 'KURU', 'MOYAKI',
    'SUI', 'CETUS', 'NAVX',
    'APT', 'THALA',
    'MEGA', 'GTE', 'CRAB',
  ];

  // Simulate different balances based on token price tier
  const balanceForPrice = (price: number): { balance: string; qty: number } => {
    if (price > 100) return { balance: (200 + Math.random() * 50).toFixed(1), qty: 200 + Math.random() * 50 };
    if (price > 10) return { balance: (50 + Math.random() * 200).toFixed(0), qty: 50 + Math.random() * 200 };
    if (price > 1) return { balance: (500 + Math.random() * 2000).toFixed(0), qty: 500 + Math.random() * 2000 };
    if (price > 0.01) return { balance: `${(5 + Math.random() * 20).toFixed(0)}K`, qty: (5 + Math.random() * 20) * 1000 };
    if (price > 0.0001) return { balance: `${(100 + Math.random() * 500).toFixed(0)}K`, qty: (100 + Math.random() * 500) * 1000 };
    if (price > 0.000001) return { balance: `${(5 + Math.random() * 80).toFixed(1)}M`, qty: (5 + Math.random() * 80) * 1_000_000 };
    return { balance: `${(1 + Math.random() * 10).toFixed(1)}B`, qty: (1 + Math.random() * 10) * 1_000_000_000 };
  };

  return heldSymbols
    .filter(s => TOKEN_DB[s])
    .map(symbol => {
      const t = TOKEN_DB[symbol];
      const chainName = CHAIN_CONFIG[t.chain]?.name ?? t.chain;
      const { balance, qty } = balanceForPrice(t.price);
      const usdVal = qty * t.price;
      return {
        token: t.symbol,
        chain: chainName,
        balance,
        usd: `$${usdVal >= 1000 ? (usdVal / 1000).toFixed(1) + 'K' : usdVal.toFixed(0)}`,
        usdRaw: usdVal,
        change: t.priceChange24h,
        price: t.price,
      };
    });
}

function generatePerpHoldings(): PerpHolding[] {
  const perpSymbols = Object.keys(PERP_DB);
  const sides: Array<'Long' | 'Short'> = ['Long', 'Short'];
  const leverages = ['2x', '3x'];

  return perpSymbols.map((sym, i) => {
    const t = PERP_DB[sym];
    const side = i === 2 ? 'Short' : 'Long'; // AAPL is short
    const leverage = i === 0 ? '3x' : '2x';
    const size = 800 + Math.random() * 1500;
    const pnlPct = t.priceChange24h * (side === 'Short' ? -1 : 1) * parseFloat(leverage);
    const pnlUsd = size * (pnlPct / 100);

    return {
      token: t.symbol,
      side,
      leverage,
      size: `$${size.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`,
      sizeRaw: size,
      entry: `$${t.price.toFixed(2)}`,
      pnl: `${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(0)}`,
      pnlRaw: pnlUsd,
      pnlPct: parseFloat(pnlPct.toFixed(1)),
    };
  });
}

function generateSignals(): Signal[] {
  return Object.values(TOKEN_DB)
    .filter(t => t.priceChange24h > 5 || t.ctScore > 75 || t.volume24h > 10_000_000)
    .map(t => {
      const strength = Math.round(
        t.ctScore * 0.4 +
        Math.min(t.priceChange24h, 50) * 0.8 +
        (t.volume24h > 100_000_000 ? 15 : t.volume24h > 10_000_000 ? 8 : 0) +
        (t.rugScore > 90 ? 10 : 0)
      );
      const clampedStrength = Math.min(99, Math.max(30, strength));
      const signal: Signal['signal'] =
        clampedStrength >= 90 ? 'Strong Buy' :
          clampedStrength >= 70 ? 'Buy' :
            clampedStrength >= 50 ? 'Hold' : 'Sell';
      const chainName = CHAIN_CONFIG[t.chain]?.name ?? t.chain;

      // Generate contextual reason from token data
      const reasons: string[] = [];
      if (t.priceChange24h > 50) reasons.push(`${t.priceChange24h.toFixed(0)}% surge`);
      else if (t.priceChange24h > 20) reasons.push(`+${t.priceChange24h.toFixed(0)}% momentum`);
      if (t.ctScore > 85) reasons.push('CT trending');
      if (t.volume24h > 100_000_000) reasons.push('high volume');
      else if (t.volume24h > 10_000_000) reasons.push('volume surge');
      if (t.rugScore > 90) reasons.push('strong fundamentals');
      if (t.holders > 100000) reasons.push('large community');
      if (t.marketCap < 50_000_000 && t.priceChange24h > 20) reasons.push('low cap gem');

      return {
        token: t.symbol,
        chain: chainName,
        signal,
        reason: reasons.slice(0, 3).join(' + ') || `${t.priceChange24h > 0 ? 'Bullish' : 'Bearish'} on ${chainName}`,
        strength: clampedStrength,
      };
    })
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 22); // top signals
}

function generateRecentTrades(): TradeEvent[] {
  const tokens = ['FARTCOIN', 'POPCAT', 'TSLA-PERP', 'DEGEN', 'BONK', 'MON', 'MEGA', 'ARB'];
  const now = Date.now();

  return tokens.slice(0, 6).map((sym, i) => {
    const t = TOKEN_DB[sym] ?? PERP_DB[sym.replace('-PERP', '')];
    const elapsed = [30, 120, 300, 720, 1080, 1800][i];
    const timeLabel =
      elapsed < 60 ? `${elapsed}s ago` :
        elapsed < 3600 ? `${Math.floor(elapsed / 60)}m ago` :
          `${Math.floor(elapsed / 3600)}h ago`;

    return {
      id: `t${i + 1}`,
      token: sym,
      side: 'buy' as const,
      amount: t ? (t.price < 0.01 ? '150K' : t.price < 1 ? '2,000' : '10') : '100',
      price: t ? `$${t.price}` : '$0',
      time: timeLabel,
      timestamp: now - elapsed * 1000,
    };
  });
}

function generateAgents(): AgentData[] {
  // Generate agents from a subset of tokens — each "agent" trades a token on its chain
  const strategyNames = ['Meme Sniper', 'DCA Blue Chip', 'Perp Momentum', 'Copy Trade', 'Grid Trading', 'Mean Reversion'];
  const riskLevels = ['aggressive', 'conservative', 'moderate'];
  const states: AgentData['state'][] = ['running', 'running', 'running', 'running', 'running', 'paused', 'running', 'running', 'error', 'stopped', 'running', 'paused'];

  const selectedTokens = [
    TOKEN_DB.FARTCOIN, TOKEN_DB.ETH, PERP_DB.TSLA, TOKEN_DB.BRETT,
    TOKEN_DB.ARB, TOKEN_DB.MON, TOKEN_DB.SUI, TOKEN_DB.MEGA,
    TOKEN_DB.POPCAT, TOKEN_DB.POL, TOKEN_DB.CRAB, TOKEN_DB.AVAX,
  ].filter(Boolean);

  return selectedTokens.map((t, i) => {
    const chain = t.chain === 'perps' ? 'hyperliquid' : t.chain;
    const isMeme = t.marketCap < 100_000_000;
    const strategy = isMeme ? strategyNames[0] :
      t.chain === 'perps' ? strategyNames[2] :
        t.marketCap > 1_000_000_000 ? strategyNames[1] :
          strategyNames[i % strategyNames.length];
    const risk = isMeme ? 'aggressive' :
      t.marketCap > 5_000_000_000 ? 'conservative' : 'moderate';

    return {
      agentId: `agt_${t.symbol.toLowerCase().slice(0, 4)}_${(i + 1).toString().padStart(2, '0')}`,
      userId: `usr_${Math.random().toString(36).slice(2, 8)}`,
      state: states[i % states.length],
      strategy,
      chain,
      riskLevel: risk,
      tradesExecuted: Math.round(20 + Math.random() * 300),
      volumeUsd: Math.round(t.volume24h * 0.0001 + Math.random() * 50_000),
      pnlUsd: Math.round((Math.random() - 0.3) * 8000),
      openPositions: states[i % states.length] === 'running' ? Math.round(1 + Math.random() * 6) : 0,
      lastHeartbeat: states[i % states.length] === 'running'
        ? Date.now() - Math.round(Math.random() * 5000)
        : Date.now() - Math.round(Math.random() * 3600_000),
      createdAt: Date.now() - Math.round(Math.random() * 30 * 86400_000),
    };
  });
}

function generateEvents(agents: AgentData[]): EventEntry[] {
  const runningAgents = agents.filter(a => a.state === 'running');
  const events: EventEntry[] = [];
  const tokens = Object.keys(TOKEN_DB);
  const now = Date.now();

  runningAgents.slice(0, 5).forEach((a, i) => {
    const tkn = tokens[Math.floor(Math.random() * tokens.length)];
    events.push({
      type: 'trade-executed',
      agentId: a.agentId,
      timestamp: now - (i + 1) * 15_000,
      payload: { token: tkn, side: 'buy', volumeUsd: Math.round(200 + Math.random() * 2000) },
    });
  });

  if (agents.some(a => a.state === 'error')) {
    events.push({
      type: 'circuit-breaker-tripped',
      agentId: agents.find(a => a.state === 'error')!.agentId,
      timestamp: now - 120_000,
      payload: {},
    });
  }

  agents.filter(a => a.state === 'paused').forEach((a, i) => {
    events.push({
      type: 'command-ack',
      agentId: a.agentId,
      timestamp: now - 180_000 - i * 60_000,
      payload: { commandId: 'cmd_pause' },
    });
  });

  return events.sort((a, b) => b.timestamp - a.timestamp);
}

function generateAuditLog(agents: AgentData[]): AuditEntry[] {
  const pausedAgent = agents.find(a => a.state === 'paused');
  const stoppedAgent = agents.find(a => a.state === 'stopped');
  const now = Date.now();
  return [
    { actor: 'admin_kush', action: 'pause-agent', resource: pausedAgent?.agentId ?? 'agt_unknown', timestamp: now - 180_000, success: true },
    { actor: 'admin_kush', action: 'create-agent', resource: agents[agents.length - 1]?.agentId ?? 'agt_new', timestamp: now - 360_000, success: true },
    { actor: 'admin_ops1', action: 'override-risk', resource: agents[2]?.agentId ?? 'agt_risk', timestamp: now - 600_000, success: true },
    { actor: 'supervisor', action: 'dead-agent-detected', resource: agents.find(a => a.state === 'error')?.agentId ?? 'agt_dead', timestamp: now - 900_000, success: true },
    { actor: 'admin_kush', action: 'update-policies', resource: 'global-policies', timestamp: now - 1800_000, success: true },
    { actor: 'admin_kush', action: 'emergency-halt-all', resource: 'all-agents', timestamp: now - 86400_000, success: true },
  ];
}

function generateLeaderboard(): LeaderEntry[] {
  // Derive from top-performing tokens
  const topTokens = Object.values(TOKEN_DB)
    .filter(t => t.marketCap > 100_000_000)
    .sort((a, b) => b.priceChange24h - a.priceChange24h)
    .slice(0, 3);

  const names = ['CryptoWhale', 'DeFiKing', 'BaseBuilder'];

  return topTokens.map((t, i) => ({
    rank: i + 1,
    name: names[i],
    pnl: `+${(t.priceChange24h * 1.5).toFixed(1)}%`,
    sharpe: parseFloat((3.5 - i * 0.5).toFixed(1)),
    copiers: Math.round(2500 - i * 500 + Math.random() * 200),
    chain: CHAIN_CONFIG[t.chain]?.name ?? t.chain,
  }));
}

function generateHelpers(agents: AgentData[]): HelperStatus[] {
  const total = agents.length;
  return [
    { type: 'Market Data', status: 'running', queue: 0, processed: total * 1200, icon: 'Activity', color: '#22c55e' },
    { type: 'Risk Analyzer', status: 'running', queue: Math.round(Math.random() * 5), processed: total * 700, icon: 'Shield', color: '#8b5cf6' },
    { type: 'Strategy Executor', status: 'running', queue: Math.round(Math.random() * 3), processed: total * 400, icon: 'Zap', color: '#3b82f6' },
    { type: 'Chat/NLP', status: 'running', queue: 0, processed: total * 150, icon: 'FileText', color: '#06b6d4' },
    { type: 'Backtesting', status: 'idle' as const, queue: 0, processed: Math.round(total * 28), icon: 'GitBranch', color: '#eab308' },
    { type: 'Notification', status: 'running', queue: Math.round(Math.random() * 4), processed: total * 500, icon: 'Activity', color: '#f97316' },
  ];
}

function generateBrokers(agents: AgentData[]): BrokerData[] {
  // Count agents by chain category for each jurisdiction
  const usChains = new Set(['ethereum', 'arbitrum', 'polygon', 'optimism', 'hyperliquid']);
  const euChains = new Set(['ethereum', 'base', 'polygon', 'avalanche']);
  const apacChains = new Set(['solana', 'sui', 'aptos', 'monad', 'megaeth', 'bsc']);

  return [
    {
      jurisdiction: 'US',
      status: 'active',
      agents: agents.filter(a => usChains.has(a.chain)).length * 350,
      compliance: 'SEC/CFTC',
      restricted: ['Securities tokens', 'Unlicensed derivatives'],
      maxLeverage: 5,
    },
    {
      jurisdiction: 'EU',
      status: 'active',
      agents: agents.filter(a => euChains.has(a.chain)).length * 320,
      compliance: 'MiFID II/ESMA',
      restricted: ['Binary options', 'High-risk CFDs'],
      maxLeverage: 2,
    },
    {
      jurisdiction: 'APAC',
      status: 'active',
      agents: agents.filter(a => apacChains.has(a.chain)).length * 425,
      compliance: 'MAS/FSA',
      restricted: ['Privacy coins', 'Unlicensed stablecoins'],
      maxLeverage: 10,
    },
  ];
}

// ─── Automation Data Generators ────────────────────────────────

function generateConditionalRules(): ConditionalRule[] {
  return [
    { id: 'rule-1', condition: 'FARTCOIN hits Hot Now', action: 'Buy $5', status: 'active', description: 'Buy FARTCOIN when trending' },
    { id: 'rule-2', condition: 'BTC RSI < 30', action: 'Buy $50 BTC', status: 'active', description: 'Buy BTC on oversold RSI' },
    { id: 'rule-3', condition: 'SOL drops 10%', action: 'Buy $25 SOL', status: 'paused', description: 'Dip buy SOL on correction' },
  ];
}

function generateDcaPlans(): DcaPlan[] {
  return [
    { id: 'dca-1', token: 'ETH', amountPerBuy: 50, completedBuys: 7, totalBuys: 20, nextBuyTime: '2h 15m', status: 'active', description: 'DCA $50 into ETH weekly' },
    { id: 'dca-2', token: 'SOL', amountPerBuy: 25, completedBuys: 12, totalBuys: 12, nextBuyTime: '-', status: 'completed', description: 'DCA $25 into SOL (completed)' },
  ];
}

function generateLimitOrders(): LimitOrder[] {
  return [
    { id: 'limit-1', token: 'POPCAT', triggerPrice: 0.65, currentPrice: 0.72, side: 'buy', amount: 100, status: 'active', description: 'Buy POPCAT at $0.65' },
    { id: 'limit-2', token: 'ARB', triggerPrice: 1.50, currentPrice: 1.28, side: 'sell', amount: 500, status: 'active', description: 'Sell ARB at $1.50' },
  ];
}

function generatePriceAlerts(): PriceAlert[] {
  return [
    { id: 'alert-1', token: 'BTC', targetPrice: 100000, direction: 'above', status: 'active', description: 'Alert when BTC > $100K' },
    { id: 'alert-2', token: 'ETH', targetPrice: 2800, direction: 'below', status: 'active', description: 'Alert when ETH < $2,800' },
  ];
}

function generateCopyTrades(): CopyTrade[] {
  return [
    { id: 'copy-1', traderName: 'MemeKing', allocation: 500, status: 'active', description: 'Copying MemeKing ($500 allocated)' },
  ];
}

// ─── Provider ─────────────────────────────────────────────────

export function TradingDataProvider({ children }: { children: ReactNode }) {
  // Initialize all data from TOKEN_DB
  const [holdings] = useState(generateHoldings);
  const [perpHoldings] = useState(generatePerpHoldings);
  const [signals] = useState(generateSignals);
  const [recentTrades, setRecentTrades] = useState(generateRecentTrades);
  const [agents, setAgents] = useState(generateAgents);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>(() => []);
  const [leaderboard] = useState(generateLeaderboard);

  // Automations
  const [conditionalRules, setConditionalRules] = useState(generateConditionalRules);
  const [dcaPlans, setDcaPlans] = useState(generateDcaPlans);
  const [limitOrders, setLimitOrders] = useState(generateLimitOrders);
  const [priceAlerts, setPriceAlerts] = useState(generatePriceAlerts);
  const [copyTrades] = useState(generateCopyTrades);

  // Derived data — recompute when agents change
  const events = useMemo(() => generateEvents(agents), [agents]);
  const helpers = useMemo(() => generateHelpers(agents), [agents]);
  const brokers = useMemo(() => generateBrokers(agents), [agents]);

  // Initialize audit log from agents (once)
  useEffect(() => {
    setAuditLog(generateAuditLog(agents));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const strategies: StrategyEntry[] = useMemo(() => [
    { id: 'meme-sniper', name: 'Meme Sniper', desc: 'Auto-snipe trending low-cap memes', active: agents.some(a => a.strategy === 'Meme Sniper' && a.state === 'running') },
    { id: 'trailing-tpsl', name: 'Trailing TP/SL', desc: 'Trail price for auto exits', active: true },
    { id: 'perps-momentum', name: 'Perps Momentum', desc: 'Long/short US stocks on momentum', active: agents.some(a => a.strategy === 'Perp Momentum' && a.state === 'running') },
    { id: 'dca', name: 'DCA Bot', desc: 'Auto-buy dips on any chain', active: agents.some(a => a.strategy === 'DCA Blue Chip' && a.state === 'running') },
    { id: 'grid', name: 'Grid Trading', desc: 'Buy/sell in price ranges', active: agents.some(a => a.strategy === 'Grid Trading' && a.state === 'running') },
    { id: 'copy', name: 'Copy Trade', desc: 'Mirror top trader moves', active: agents.some(a => a.strategy === 'Copy Trade' && a.state === 'running') },
  ], [agents]);

  // Portfolio summary computed from holdings
  const portfolio: PortfolioSummary = useMemo(() => {
    const total = holdings.reduce((s, h) => s + h.usdRaw, 0) +
      perpHoldings.reduce((s, p) => s + p.sizeRaw, 0);
    const pnl = holdings.reduce((s, h) => s + h.usdRaw * (h.change / (100 + h.change)), 0) +
      perpHoldings.reduce((s, p) => s + p.pnlRaw, 0);
    return {
      totalValue: Math.round(total),
      todayPnl: Math.round(pnl),
      todayPnlPct: parseFloat((pnl / (total - pnl) * 100).toFixed(2)),
      activeStrategies: strategies.filter(s => s.active).length,
      perpTotalSize: perpHoldings.reduce((s, p) => s + p.sizeRaw, 0),
      perpTotalPnl: perpHoldings.reduce((s, p) => s + p.pnlRaw, 0),
    };
  }, [holdings, perpHoldings, strategies]);

  // Unique chains from holdings
  const chains = useMemo(() =>
    [...new Set(holdings.map(h => h.chain))].sort(),
    [holdings]
  );

  const allTokens = useMemo(() => [
    ...Object.values(TOKEN_DB),
    ...Object.values(PERP_DB),
  ], []);

  const addTradeEvent = useCallback((event: TradeEvent) => {
    setRecentTrades(prev => [event, ...prev].slice(0, 10));
  }, []);

  const addAuditEntry = useCallback((entry: AuditEntry) => {
    setAuditLog(prev => [entry, ...prev].slice(0, 20));
  }, []);

  const addConditionalRule = useCallback((rule: ConditionalRule) => {
    setConditionalRules(prev => [rule, ...prev]);
  }, []);

  const addPriceAlert = useCallback((alert: PriceAlert) => {
    setPriceAlerts(prev => [alert, ...prev]);
  }, []);

  const addLimitOrder = useCallback((order: LimitOrder) => {
    setLimitOrders(prev => [order, ...prev]);
  }, []);

  const addDcaPlan = useCallback((plan: DcaPlan) => {
    setDcaPlans(prev => [plan, ...prev]);
  }, []);

  const value: TradingDataState = useMemo(() => ({
    holdings,
    perpHoldings,
    signals,
    recentTrades,
    portfolio,
    agents,
    events,
    auditLog,
    helpers,
    brokers,
    leaderboard,
    strategies,
    conditionalRules,
    dcaPlans,
    limitOrders,
    priceAlerts,
    copyTrades,
    setAgents,
    addTradeEvent,
    addAuditEntry,
    addConditionalRule,
    addPriceAlert,
    addLimitOrder,
    addDcaPlan,
    chains,
    allTokens,
  }), [holdings, perpHoldings, signals, recentTrades, portfolio, agents, events, auditLog, helpers, brokers, leaderboard, strategies, conditionalRules, dcaPlans, limitOrders, priceAlerts, copyTrades, addTradeEvent, addAuditEntry, addConditionalRule, addPriceAlert, addLimitOrder, addDcaPlan, chains, allTokens]);

  return (
    <TradingDataContext.Provider value={value}>
      {children}
    </TradingDataContext.Provider>
  );
}

export function useTradingData(): TradingDataState {
  const ctx = useContext(TradingDataContext);
  if (!ctx) throw new Error('useTradingData must be inside TradingDataProvider');
  return ctx;
}
