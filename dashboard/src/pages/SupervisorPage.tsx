import { useState } from 'react';
import {
  Eye, Users, Play, Pause, Square, Trash2, AlertTriangle, Shield,
  Activity, Zap, Settings, FileText, ChevronDown,
} from 'lucide-react';
import { Badge } from '../components/Badge';

// ─── Demo Data ────────────────────────────────────────────────

type AgentState = 'running' | 'paused' | 'stopped' | 'error' | 'creating';

interface DemoAgent {
  agentId: string;
  userId: string;
  state: AgentState;
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

const demoAgents: DemoAgent[] = [
  { agentId: 'agt_a1b2c3d4', userId: 'usr_k8x92m', state: 'running', strategy: 'Meme Sniper', chain: 'solana', riskLevel: 'aggressive', tradesExecuted: 142, volumeUsd: 48_200, pnlUsd: 3_892, openPositions: 4, lastHeartbeat: Date.now() - 2_000, createdAt: Date.now() - 86400_000 * 3 },
  { agentId: 'agt_e5f6g7h8', userId: 'usr_p3n71q', state: 'running', strategy: 'DCA Blue Chip', chain: 'ethereum', riskLevel: 'conservative', tradesExecuted: 24, volumeUsd: 125_000, pnlUsd: 4_230, openPositions: 8, lastHeartbeat: Date.now() - 3_000, createdAt: Date.now() - 86400_000 * 14 },
  { agentId: 'agt_i9j0k1l2', userId: 'usr_j5w88r', state: 'running', strategy: 'Perp Momentum', chain: 'hyperliquid', riskLevel: 'moderate', tradesExecuted: 89, volumeUsd: 234_500, pnlUsd: -1_340, openPositions: 3, lastHeartbeat: Date.now() - 1_500, createdAt: Date.now() - 86400_000 * 7 },
  { agentId: 'agt_m3n4o5p6', userId: 'usr_m2c44x', state: 'paused', strategy: 'Copy Trade', chain: 'base', riskLevel: 'moderate', tradesExecuted: 67, volumeUsd: 32_900, pnlUsd: 1_445, openPositions: 2, lastHeartbeat: Date.now() - 45_000, createdAt: Date.now() - 86400_000 * 10 },
  { agentId: 'agt_q7r8s9t0', userId: 'usr_t9v66p', state: 'running', strategy: 'Grid Trading', chain: 'arbitrum', riskLevel: 'moderate', tradesExecuted: 312, volumeUsd: 89_600, pnlUsd: 5_890, openPositions: 6, lastHeartbeat: Date.now() - 4_000, createdAt: Date.now() - 86400_000 * 21 },
  { agentId: 'agt_u1v2w3x4', userId: 'usr_a7b33n', state: 'running', strategy: 'Meme Sniper', chain: 'monad', riskLevel: 'aggressive', tradesExecuted: 78, volumeUsd: 22_100, pnlUsd: 6_120, openPositions: 5, lastHeartbeat: Date.now() - 2_500, createdAt: Date.now() - 86400_000 * 5 },
  { agentId: 'agt_y5z6a7b8', userId: 'usr_f1d22k', state: 'error', strategy: 'DCA Blue Chip', chain: 'sui', riskLevel: 'conservative', tradesExecuted: 12, volumeUsd: 8_200, pnlUsd: -245, openPositions: 0, lastHeartbeat: Date.now() - 120_000, createdAt: Date.now() - 86400_000 * 2 },
  { agentId: 'agt_c9d0e1f2', userId: 'usr_h8g55w', state: 'stopped', strategy: 'Perp Momentum', chain: 'hyperliquid', riskLevel: 'aggressive', tradesExecuted: 56, volumeUsd: 67_800, pnlUsd: 2_100, openPositions: 0, lastHeartbeat: Date.now() - 3600_000, createdAt: Date.now() - 86400_000 * 30 },
  { agentId: 'agt_g3h4i5j6', userId: 'usr_r4p21b', state: 'running', strategy: 'Copy Trade', chain: 'base', riskLevel: 'moderate', tradesExecuted: 45, volumeUsd: 18_400, pnlUsd: 920, openPositions: 3, lastHeartbeat: Date.now() - 5_000, createdAt: Date.now() - 86400_000 * 8 },
  { agentId: 'agt_k7l8m9n0', userId: 'usr_x5y33z', state: 'running', strategy: 'Grid Trading', chain: 'polygon', riskLevel: 'moderate', tradesExecuted: 198, volumeUsd: 54_300, pnlUsd: 3_450, openPositions: 4, lastHeartbeat: Date.now() - 3_500, createdAt: Date.now() - 86400_000 * 12 },
  { agentId: 'agt_o1p2q3r4', userId: 'usr_w8t11g', state: 'paused', strategy: 'Meme Sniper', chain: 'megaeth', riskLevel: 'aggressive', tradesExecuted: 34, volumeUsd: 12_600, pnlUsd: 4_780, openPositions: 2, lastHeartbeat: Date.now() - 50_000, createdAt: Date.now() - 86400_000 },
  { agentId: 'agt_s5t6u7v8', userId: 'usr_q2m77k', state: 'running', strategy: 'DCA Blue Chip', chain: 'avalanche', riskLevel: 'conservative', tradesExecuted: 15, volumeUsd: 42_000, pnlUsd: 1_120, openPositions: 5, lastHeartbeat: Date.now() - 2_000, createdAt: Date.now() - 86400_000 * 6 },
];

const demoEvents = [
  { type: 'trade-executed', agentId: 'agt_a1b2c3d4', timestamp: Date.now() - 5_000, payload: { token: 'FARTCOIN', side: 'buy', volumeUsd: 420 } },
  { type: 'started', agentId: 'agt_s5t6u7v8', timestamp: Date.now() - 12_000, payload: {} },
  { type: 'position-opened', agentId: 'agt_i9j0k1l2', timestamp: Date.now() - 30_000, payload: { token: 'TSLA-PERP', amountUsd: 2500 } },
  { type: 'circuit-breaker-tripped', agentId: 'agt_y5z6a7b8', timestamp: Date.now() - 120_000, payload: {} },
  { type: 'command-ack', agentId: 'agt_m3n4o5p6', timestamp: Date.now() - 180_000, payload: { commandId: 'cmd_pause' } },
  { type: 'trade-executed', agentId: 'agt_q7r8s9t0', timestamp: Date.now() - 240_000, payload: { token: 'ARB', side: 'buy', volumeUsd: 1200 } },
  { type: 'position-closed', agentId: 'agt_u1v2w3x4', timestamp: Date.now() - 300_000, payload: { token: 'MON', pnlUsd: 340 } },
  { type: 'error', agentId: 'agt_y5z6a7b8', timestamp: Date.now() - 360_000, payload: { message: 'RPC timeout on Sui' } },
  { type: 'trade-executed', agentId: 'agt_k7l8m9n0', timestamp: Date.now() - 420_000, payload: { token: 'POL', side: 'sell', volumeUsd: 800 } },
  { type: 'resumed', agentId: 'agt_g3h4i5j6', timestamp: Date.now() - 500_000, payload: {} },
];

const demoAuditLog = [
  { actor: 'admin_kush', action: 'pause-agent', resource: 'agt_m3n4o5p6', timestamp: Date.now() - 180_000, success: true },
  { actor: 'admin_kush', action: 'create-agent', resource: 'agt_s5t6u7v8', timestamp: Date.now() - 360_000, success: true },
  { actor: 'admin_ops1', action: 'override-risk', resource: 'agt_i9j0k1l2', timestamp: Date.now() - 600_000, success: true },
  { actor: 'supervisor', action: 'dead-agent-detected', resource: 'agt_y5z6a7b8', timestamp: Date.now() - 900_000, success: true },
  { actor: 'admin_kush', action: 'update-policies', resource: 'global-policies', timestamp: Date.now() - 1800_000, success: true },
  { actor: 'admin_kush', action: 'emergency-halt-all', resource: 'all-agents', timestamp: Date.now() - 86400_000, success: true },
];

// ─── Helpers ─────────────────────────────────────────────────

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`;
const ago = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const stateColor: Record<AgentState, 'green' | 'yellow' | 'gray' | 'red' | 'blue'> = {
  running: 'green', paused: 'yellow', stopped: 'gray', error: 'red', creating: 'blue',
};

// ─── Component ───────────────────────────────────────────────

type Tab = 'agents' | 'policies' | 'events' | 'audit';

export function SupervisorPage() {
  const [tab, setTab] = useState<Tab>('agents');
  const [agents, setAgents] = useState(demoAgents);
  const [globalHalt, setGlobalHalt] = useState(false);
  const [filterState, setFilterState] = useState<string>('all');
  const [filterChain, setFilterChain] = useState<string>('all');
  const [haltConfirm, setHaltConfirm] = useState(false);

  // Policies state
  const [policies, setPolicies] = useState({
    maxAgentsPerUser: 5, maxTotalAgents: 10_000,
    globalMaxPositionSizePct: 25, globalMaxDailyLossUsd: 10_000, globalMaxLeverage: 10,
    maintenanceMode: false,
  });

  // Stats
  const running = agents.filter(a => a.state === 'running').length;
  const paused = agents.filter(a => a.state === 'paused').length;
  const errors = agents.filter(a => a.state === 'error').length;
  const totalVolume = agents.reduce((s, a) => s + a.volumeUsd, 0);
  const totalPnl = agents.reduce((s, a) => s + a.pnlUsd, 0);

  // Filter agents
  const filtered = agents.filter(a => {
    if (filterState !== 'all' && a.state !== filterState) return false;
    if (filterChain !== 'all' && a.chain !== filterChain) return false;
    return true;
  });

  const toggleAgentState = (id: string, action: 'start' | 'pause' | 'stop') => {
    setAgents(prev => prev.map(a => {
      if (a.agentId !== id) return a;
      if (action === 'start') return { ...a, state: 'running' as AgentState, lastHeartbeat: Date.now() };
      if (action === 'pause') return { ...a, state: 'paused' as AgentState };
      if (action === 'stop') return { ...a, state: 'stopped' as AgentState, openPositions: 0 };
      return a;
    }));
  };

  const handleEmergencyHalt = () => {
    setGlobalHalt(true);
    setAgents(prev => prev.map(a => ({
      ...a, state: 'stopped' as AgentState, openPositions: 0,
    })));
    setHaltConfirm(false);
  };

  const handleResumeAll = () => {
    setGlobalHalt(false);
    setAgents(prev => prev.map(a => ({
      ...a, state: 'running' as AgentState, lastHeartbeat: Date.now(),
    })));
  };

  const statCards = [
    { label: 'Total Agents', value: agents.length, icon: Users, color: '#3b82f6' },
    { label: 'Running', value: running, icon: Activity, color: '#22c55e' },
    { label: 'Paused', value: paused, icon: Pause, color: '#eab308' },
    { label: 'Errors', value: errors, icon: AlertTriangle, color: '#ef4444' },
    { label: 'Total Volume', value: fmt(totalVolume), icon: Zap, color: '#8b5cf6' },
    { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}${fmt(totalPnl)}`, icon: Activity, color: totalPnl >= 0 ? '#22c55e' : '#ef4444' },
  ];

  const chains = [...new Set(agents.map(a => a.chain))];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Eye size={24} color="#3b82f6" />
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Supervisor Control Panel</h1>
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>CoinDCX Master Agent — Full control over all user agents</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Badge color={globalHalt ? 'red' : 'green'}>
            {globalHalt ? 'HALTED' : 'System OK'}
          </Badge>
          {globalHalt ? (
            <button onClick={handleResumeAll} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
              background: '#22c55e', color: '#fff', cursor: 'pointer',
            }}>Resume All</button>
          ) : (
            <button onClick={() => setHaltConfirm(true)} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
              background: '#ef4444', color: '#fff', cursor: 'pointer',
            }}>
              <AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
              Emergency Halt
            </button>
          )}
        </div>
      </div>

      {/* Emergency Halt Confirmation */}
      {haltConfirm && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, color: '#ef4444', fontSize: 14 }}>Confirm Emergency Halt</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              This will immediately stop ALL {running + paused} active agents and close all positions.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setHaltConfirm(false)} style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #334155', background: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleEmergencyHalt} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>HALT ALL AGENTS</button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.label} style={{
            background: '#111827', borderRadius: 10, padding: '14px 16px',
            border: '1px solid #1e293b',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <s.icon size={14} color={s.color} />
              <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: typeof s.value === 'string' && s.value.startsWith('+') ? '#22c55e' : typeof s.value === 'string' && s.value.startsWith('-') ? '#ef4444' : '#f1f5f9' }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #1e293b', paddingBottom: 1 }}>
        {([
          { key: 'agents' as Tab, label: 'Agents', icon: Users },
          { key: 'policies' as Tab, label: 'Policies', icon: Shield },
          { key: 'events' as Tab, label: 'Events', icon: Zap },
          { key: 'audit' as Tab, label: 'Audit Log', icon: FileText },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', border: 'none', borderRadius: '6px 6px 0 0',
            fontSize: 13, fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer',
            background: tab === t.key ? '#1e293b' : 'transparent',
            color: tab === t.key ? '#f1f5f9' : '#64748b',
          }}>
            <t.icon size={14} />{t.label}
          </button>
        ))}
      </div>

      {/* ══════ AGENTS TAB ══════ */}
      {tab === 'agents' && (
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select value={filterState} onChange={e => setFilterState(e.target.value)} style={{
              padding: '6px 10px', borderRadius: 6, border: '1px solid #334155',
              background: '#0f172a', color: '#94a3b8', fontSize: 12,
            }}>
              <option value="all">All States</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="stopped">Stopped</option>
              <option value="error">Error</option>
            </select>
            <select value={filterChain} onChange={e => setFilterChain(e.target.value)} style={{
              padding: '6px 10px', borderRadius: 6, border: '1px solid #334155',
              background: '#0f172a', color: '#94a3b8', fontSize: 12,
            }}>
              <option value="all">All Chains</option>
              {chains.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>
              {filtered.length} agent{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Agent Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Status', 'Agent ID', 'User', 'Strategy', 'Chain', 'Risk', 'Trades', 'Volume', 'P&L', 'Positions', 'Heartbeat', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '8px 10px', textAlign: 'left', fontSize: 10,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: '#64748b', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.agentId} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '10px' }}>
                    <Badge color={stateColor[a.state]}>{a.state}</Badge>
                  </td>
                  <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: 11 }}>{a.agentId}</td>
                  <td style={{ padding: '10px', color: '#94a3b8' }}>{a.userId}</td>
                  <td style={{ padding: '10px', fontWeight: 600 }}>{a.strategy}</td>
                  <td style={{ padding: '10px' }}>
                    <Badge color="blue">{a.chain}</Badge>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <Badge color={a.riskLevel === 'aggressive' ? 'red' : a.riskLevel === 'conservative' ? 'green' : 'yellow'}>
                      {a.riskLevel}
                    </Badge>
                  </td>
                  <td style={{ padding: '10px' }}>{a.tradesExecuted}</td>
                  <td style={{ padding: '10px' }}>{fmt(a.volumeUsd)}</td>
                  <td style={{
                    padding: '10px', fontWeight: 600,
                    color: a.pnlUsd >= 0 ? '#22c55e' : '#ef4444',
                  }}>
                    {a.pnlUsd >= 0 ? '+' : ''}{fmt(a.pnlUsd)}
                  </td>
                  <td style={{ padding: '10px' }}>{a.openPositions}</td>
                  <td style={{ padding: '10px', color: '#64748b' }}>
                    {a.state === 'running' ? ago(a.lastHeartbeat) : '—'}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(a.state === 'stopped' || a.state === 'paused' || a.state === 'error') && (
                        <button onClick={() => toggleAgentState(a.agentId, 'start')} title="Start" style={actionBtnStyle('#22c55e')}>
                          <Play size={11} />
                        </button>
                      )}
                      {a.state === 'running' && (
                        <button onClick={() => toggleAgentState(a.agentId, 'pause')} title="Pause" style={actionBtnStyle('#eab308')}>
                          <Pause size={11} />
                        </button>
                      )}
                      {(a.state === 'running' || a.state === 'paused') && (
                        <button onClick={() => toggleAgentState(a.agentId, 'stop')} title="Stop" style={actionBtnStyle('#64748b')}>
                          <Square size={11} />
                        </button>
                      )}
                      <button title="Force Close" style={actionBtnStyle('#ef4444')}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ══════ POLICIES TAB ══════ */}
      {tab === 'policies' && (
        <div style={{ maxWidth: 700 }}>
          <div style={{ background: '#111827', borderRadius: 10, padding: 20, border: '1px solid #1e293b' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>Global Policy Configuration</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { label: 'Max Agents per User', key: 'maxAgentsPerUser', min: 1, max: 100 },
                { label: 'Max Total Agents', key: 'maxTotalAgents', min: 1, max: 100000 },
                { label: 'Max Position Size %', key: 'globalMaxPositionSizePct', min: 1, max: 50 },
                { label: 'Max Daily Loss (USD)', key: 'globalMaxDailyLossUsd', min: 100, max: 1000000 },
                { label: 'Max Leverage', key: 'globalMaxLeverage', min: 1, max: 100 },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input
                    type="number"
                    value={(policies as any)[f.key]}
                    onChange={e => setPolicies(prev => ({ ...prev, [f.key]: parseInt(e.target.value) || 0 }))}
                    min={f.min}
                    max={f.max}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 6,
                      border: '1px solid #334155', background: '#0f172a',
                      color: '#f1f5f9', fontSize: 13,
                    }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>Maintenance Mode</label>
                <button onClick={() => setPolicies(prev => ({ ...prev, maintenanceMode: !prev.maintenanceMode }))} style={{
                  width: '100%', padding: '8px 10px', borderRadius: 6,
                  border: '1px solid #334155', cursor: 'pointer',
                  background: policies.maintenanceMode ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                  color: policies.maintenanceMode ? '#ef4444' : '#22c55e',
                  fontSize: 13, fontWeight: 600,
                }}>
                  {policies.maintenanceMode ? 'ON — Blocking new agents' : 'OFF — Accepting new agents'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Allowed Chains</h4>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['solana', 'ethereum', 'base', 'arbitrum', 'polygon', 'hyperliquid', 'monad', 'sui', 'aptos', 'megaeth', 'avalanche'].map(c => (
                  <Badge key={c} color="blue" style={{ cursor: 'pointer', opacity: 0.9 }}>{c}</Badge>
                ))}
              </div>
            </div>

            <button style={{
              marginTop: 20, padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Save Policies
            </button>
          </div>
        </div>
      )}

      {/* ══════ EVENTS TAB ══════ */}
      {tab === 'events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {demoEvents.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
              background: '#111827', borderRadius: 8, border: '1px solid #1e293b',
            }}>
              <Badge color={
                e.type === 'error' || e.type === 'circuit-breaker-tripped' ? 'red' :
                e.type.includes('trade') || e.type === 'position-opened' ? 'green' :
                e.type === 'started' || e.type === 'resumed' ? 'blue' :
                'gray'
              }>{e.type}</Badge>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{e.agentId}</span>
              <span style={{ fontSize: 12, color: '#64748b', flex: 1 }}>
                {e.payload && Object.keys(e.payload).length > 0 ? JSON.stringify(e.payload) : ''}
              </span>
              <span style={{ fontSize: 11, color: '#475569', whiteSpace: 'nowrap' }}>{ago(e.timestamp)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ══════ AUDIT TAB ══════ */}
      {tab === 'audit' && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Time', 'Actor', 'Action', 'Resource', 'Status'].map(h => (
                <th key={h} style={{
                  padding: '8px 10px', textAlign: 'left', fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  color: '#64748b', fontWeight: 600,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demoAuditLog.map((entry, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '10px', color: '#64748b' }}>{ago(entry.timestamp)}</td>
                <td style={{ padding: '10px', fontWeight: 600 }}>{entry.actor}</td>
                <td style={{ padding: '10px' }}>
                  <Badge color={
                    entry.action.includes('halt') ? 'red' :
                    entry.action.includes('create') || entry.action.includes('resume') ? 'green' :
                    entry.action.includes('override') || entry.action.includes('pause') ? 'yellow' :
                    'blue'
                  }>{entry.action}</Badge>
                </td>
                <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: 11, color: '#94a3b8' }}>{entry.resource}</td>
                <td style={{ padding: '10px' }}>
                  <Badge color={entry.success ? 'green' : 'red'}>{entry.success ? 'OK' : 'FAIL'}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const actionBtnStyle = (color: string): React.CSSProperties => ({
  width: 26, height: 26, borderRadius: 6, border: 'none',
  background: `${color}20`, color,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0,
});
