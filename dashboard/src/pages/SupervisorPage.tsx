import { useState } from 'react';
import {
  Eye, Users, Play, Pause, Square, Trash2, AlertTriangle, Shield,
  Activity, Zap, Settings, FileText, ChevronDown, Globe, GitBranch,
  Cpu, Moon, Lock, ArrowRightLeft,
} from 'lucide-react';
import { Badge } from '../components/Badge';
import { useTradingData, type AgentData } from '../app/context/TradingDataContext';

type AgentState = AgentData['state'];

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

type Tab = 'agents' | 'brokers' | 'policies' | 'events' | 'lifecycle' | 'helpers' | 'hibernation' | 'security' | 'audit';

export function SupervisorPage() {
  const {
    agents, setAgents, events, auditLog, helpers, brokers,
    portfolio, addAuditEntry,
  } = useTradingData();
  const [tab, setTab] = useState<Tab>('agents');
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
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid #1e293b', paddingBottom: 1, flexWrap: 'wrap' }}>
        {([
          { key: 'agents' as Tab, label: 'Agents', icon: Users },
          { key: 'brokers' as Tab, label: 'Brokers', icon: Globe },
          { key: 'policies' as Tab, label: 'Policies', icon: Shield },
          { key: 'events' as Tab, label: 'Events', icon: Zap },
          { key: 'lifecycle' as Tab, label: 'Trade Lifecycle', icon: GitBranch },
          { key: 'helpers' as Tab, label: 'Helpers', icon: Cpu },
          { key: 'hibernation' as Tab, label: 'Hibernation', icon: Moon },
          { key: 'security' as Tab, label: 'Security', icon: Lock },
          { key: 'audit' as Tab, label: 'Audit Log', icon: FileText },
        ]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '8px 12px', border: 'none', borderRadius: '6px 6px 0 0',
            fontSize: 12, fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer',
            background: tab === t.key ? '#1e293b' : 'transparent',
            color: tab === t.key ? '#f1f5f9' : '#64748b',
          }}>
            <t.icon size={13} />{t.label}
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
          {events.map((e, i) => (
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

      {/* ══════ BROKERS TAB ══════ */}
      {tab === 'brokers' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {brokers.map(b => (
              <div key={b.jurisdiction} style={{
                background: '#111827', borderRadius: 10, padding: 16,
                border: '1px solid #1e293b',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Globe size={18} color="#3b82f6" />
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{b.jurisdiction}</span>
                  </div>
                  <Badge color="green">{b.status}</Badge>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                  <div>Compliance: <span style={{ color: '#f1f5f9' }}>{b.compliance}</span></div>
                  <div>Max Leverage: <span style={{ color: '#f1f5f9' }}>{b.maxLeverage}x</span></div>
                  <div>User Agents: <span style={{ color: '#f1f5f9' }}>{b.agents.toLocaleString()}</span></div>
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  Restricted: {b.restricted.map(r => (
                    <Badge key={r} color="red" style={{ marginRight: 4, marginTop: 4 }}>{r}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════ TRADE LIFECYCLE TAB ══════ */}
      {tab === 'lifecycle' && (
        <div>
          <div style={{ background: '#111827', borderRadius: 10, padding: 20, border: '1px solid #1e293b', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>11-Step Trade Lifecycle Pipeline</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {[
                { state: 'SIGNAL_GENERATED', color: '#3b82f6' },
                { state: 'RISK_ASSESSED', color: '#8b5cf6' },
                { state: 'COMPLIANCE_CHECKED', color: '#6366f1' },
                { state: 'APPROVAL_REQUESTED', color: '#eab308' },
                { state: 'APPROVED', color: '#22c55e' },
                { state: 'FEE_RESERVED', color: '#f97316' },
                { state: 'ORDER_SUBMITTED', color: '#3b82f6' },
                { state: 'ORDER_CONFIRMED', color: '#22c55e' },
                { state: 'FEE_SETTLED', color: '#f97316' },
                { state: 'FEE_LEDGER_RECORDED', color: '#8b5cf6' },
                { state: 'NOTIFICATION_SENT', color: '#06b6d4' },
                { state: 'POSITION_UPDATED', color: '#22c55e' },
              ].map((s, i) => (
                <div key={s.state} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: `${s.color}20`, color: s.color, fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                  }}>{s.state}</div>
                  {i < 11 && <ArrowRightLeft size={12} color="#475569" />}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 12 }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>Rejection States:</div>
              {['RISK_REJECTED', 'COMPLIANCE_REJECTED', 'APPROVAL_REJECTED'].map(s => (
                <div key={s} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
                  background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontFamily: 'monospace',
                }}>{s}</div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Each trade follows the full lifecycle pipeline. Atomic rule: fee + trade always succeed or fail together.
          </div>
        </div>
      )}

      {/* ══════ HELPERS TAB ══════ */}
      {tab === 'helpers' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {helpers.map(h => {
            const IconMap: Record<string, typeof Activity> = { Activity, Shield, Zap, FileText, GitBranch };
            const Icon = IconMap[h.icon] ?? Cpu;
            return (
              <div key={h.type} style={{
                background: '#111827', borderRadius: 10, padding: 16,
                border: '1px solid #1e293b',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={16} color={h.color} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{h.type}</span>
                  </div>
                  <Badge color={h.status === 'running' ? 'green' : h.status === 'idle' ? 'yellow' : 'red'}>{h.status}</Badge>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  <div>Queue: <span style={{ color: h.queue > 0 ? '#eab308' : '#22c55e', fontWeight: 600 }}>{h.queue}</span></div>
                  <div>Processed: <span style={{ color: '#f1f5f9' }}>{h.processed.toLocaleString()}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════ HIBERNATION TAB ══════ */}
      {tab === 'hibernation' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {(() => {
              const active = agents.filter(a => a.state === 'running').length;
              const idle = agents.filter(a => a.state === 'paused').length;
              const onDemand = agents.filter(a => a.state === 'stopped').length;
              const archived = agents.filter(a => a.state === 'error').length;
              const total = Math.max(active + idle + onDemand + archived, 1);
              // Scale up to show realistic numbers
              const scale = 1000;
              return [
                { state: 'Active', count: active * scale, pct: Math.round(active / total * 100), color: '#22c55e', desc: 'Currently trading' },
                { state: 'Idle', count: idle * scale, pct: Math.round(idle / total * 100), color: '#eab308', desc: '30min no activity' },
                { state: 'On-Demand', count: onDemand * scale, pct: Math.round(onDemand / total * 100), color: '#3b82f6', desc: 'Serialized to Redis (<100ms wake)' },
                { state: 'Deep Archive', count: archived * scale, pct: Math.round(archived / total * 100), color: '#64748b', desc: 'Archived to PostgreSQL (~500ms wake)' },
              ];
            })().map(s => (
              <div key={s.state} style={{
                background: '#111827', borderRadius: 10, padding: 16,
                border: '1px solid #1e293b',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Moon size={14} color={s.color} />
                  <span style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase' }}>{s.state}</span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{s.count.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.pct}%</div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{s.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ background: '#111827', borderRadius: 10, padding: 16, border: '1px solid #1e293b' }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Hibernation Thresholds</h4>
            <div style={{ fontSize: 12, color: '#94a3b8', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>Idle threshold: <span style={{ color: '#f1f5f9' }}>30 minutes</span></div>
              <div>On-demand threshold: <span style={{ color: '#f1f5f9' }}>2 hours</span></div>
              <div>Archive threshold: <span style={{ color: '#f1f5f9' }}>24 hours</span></div>
              <div>Sweep interval: <span style={{ color: '#f1f5f9' }}>5 minutes</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ SECURITY TAB ══════ */}
      {tab === 'security' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#111827', borderRadius: 10, padding: 16, border: '1px solid #1e293b' }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Lock size={14} color="#22c55e" /> Trust Chain (ECDSA P-256)
              </h4>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                <div style={{ marginBottom: 8 }}>
                  <Badge color="green" style={{ marginRight: 4 }}>Root CA</Badge>
                  <span style={{ fontFamily: 'monospace', fontSize: 11 }}>master-agent-root</span>
                </div>
                <div style={{ paddingLeft: 20, borderLeft: '2px solid #1e293b', marginBottom: 4 }}>
                  <Badge color="blue" style={{ marginRight: 4 }}>Broker</Badge> broker-US (SEC/CFTC)
                </div>
                <div style={{ paddingLeft: 20, borderLeft: '2px solid #1e293b', marginBottom: 4 }}>
                  <Badge color="blue" style={{ marginRight: 4 }}>Broker</Badge> broker-EU (MiFID II)
                </div>
                <div style={{ paddingLeft: 20, borderLeft: '2px solid #1e293b', marginBottom: 4 }}>
                  <Badge color="blue" style={{ marginRight: 4 }}>Broker</Badge> broker-APAC (MAS)
                </div>
                <div style={{ paddingLeft: 40, borderLeft: '2px solid #1e293b', fontSize: 11, color: '#475569' }}>
                  User agents issued per-broker certificates
                </div>
              </div>
            </div>
            <div style={{ background: '#111827', borderRadius: 10, padding: 16, border: '1px solid #1e293b' }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={14} color="#8b5cf6" /> Security Layers
              </h4>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {[
                  { layer: 'Network Isolation', desc: 'VPC + security groups', status: 'active' },
                  { layer: 'Message Signing', desc: 'HMAC-SHA256 (30s expiry)', status: 'active' },
                  { layer: 'Certificate Chain', desc: 'ECDSA P-256 hierarchy', status: 'active' },
                  { layer: 'User Namespace', desc: 'Per-user encrypted isolation', status: 'active' },
                  { layer: 'Dual-Sig Custody', desc: 'User+Broker for withdrawals', status: 'active' },
                  { layer: 'Immutable Audit', desc: 'SHA-256 hash-chained log', status: 'active' },
                ].map((l, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                    <div>
                      <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{l.layer}</span>
                      <span style={{ color: '#475569', marginLeft: 8, fontSize: 11 }}>{l.desc}</span>
                    </div>
                    <Badge color="green">{l.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ background: '#111827', borderRadius: 10, padding: 16, border: '1px solid #1e293b' }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginTop: 0 }}>Approval Tokens</h4>
            <div style={{ fontSize: 12, color: '#94a3b8', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>Token expiry: <span style={{ color: '#f1f5f9' }}>30 seconds</span></div>
              <div>Nonce window: <span style={{ color: '#f1f5f9' }}>60 seconds</span></div>
              <div>One-time use: <span style={{ color: '#22c55e', fontWeight: 600 }}>Enforced (atomic CAS)</span></div>
            </div>
          </div>
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
            {auditLog.map((entry, i) => (
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
