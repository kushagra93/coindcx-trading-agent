import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Users, DollarSign, Activity, Zap, AlertTriangle,
  Server, TrendingUp, Shield, Code2, RefreshCw,
} from 'lucide-react';
import { Card } from '../components/Card';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';

// Demo data — matches the admin API seedDemoAgents
const mockAgents = [
  { userId: 'usr_k8x92m', agentId: 'agt_001', status: 'running' as const, startedAt: '4h ago', strategy: 'Meme Sniper', chain: 'solana', tradesExecuted: 47, volumeUsd: 12840, pnlUsd: 892 },
  { userId: 'usr_p3n71q', agentId: 'agt_002', status: 'running' as const, startedAt: '12h ago', strategy: 'DCA Blue Chip', chain: 'ethereum', tradesExecuted: 8, volumeUsd: 45200, pnlUsd: 1230 },
  { userId: 'usr_j5w88r', agentId: 'agt_003', status: 'running' as const, startedAt: '2h ago', strategy: 'Perp Momentum', chain: 'hyperliquid', tradesExecuted: 23, volumeUsd: 68500, pnlUsd: -340 },
  { userId: 'usr_m2c44x', agentId: 'agt_004', status: 'running' as const, startedAt: '8h ago', strategy: 'Copy Trade', chain: 'base', tradesExecuted: 15, volumeUsd: 8920, pnlUsd: 445 },
  { userId: 'usr_t9v66p', agentId: 'agt_005', status: 'running' as const, startedAt: '1h ago', strategy: 'Perp Momentum', chain: 'hyperliquid', tradesExecuted: 6, volumeUsd: 22100, pnlUsd: 178 },
  { userId: 'usr_a7b33n', agentId: 'agt_006', status: 'stopped' as const, startedAt: '24h ago', strategy: 'Grid Trading', chain: 'arbitrum', tradesExecuted: 112, volumeUsd: 34600, pnlUsd: 1890 },
  { userId: 'usr_f1d22k', agentId: 'agt_007', status: 'running' as const, startedAt: '6h ago', strategy: 'Meme Sniper', chain: 'monad', tradesExecuted: 31, volumeUsd: 9450, pnlUsd: 2120 },
  { userId: 'usr_h8g55w', agentId: 'agt_008', status: 'error' as const, startedAt: '3h ago', strategy: 'DCA Blue Chip', chain: 'sui', tradesExecuted: 4, volumeUsd: 3200, pnlUsd: -45 },
];

// Volume by chain for bar chart
const volumeByChain = [
  { chain: 'Hyperliquid', volume: 90600, color: '#a855f7' },
  { chain: 'Ethereum', volume: 45200, color: '#3b82f6' },
  { chain: 'Arbitrum', volume: 34600, color: '#22d3ee' },
  { chain: 'Solana', volume: 12840, color: '#14b8a6' },
  { chain: 'Monad', volume: 9450, color: '#f97316' },
  { chain: 'Base', volume: 8920, color: '#6366f1' },
  { chain: 'Sui', volume: 3200, color: '#22c55e' },
];

// Fee breakdown for pie chart
const feeBreakdown = [
  { name: 'Platform Fees', value: 512.40, color: '#3b82f6' },
  { name: 'Builder Fees (HL)', value: 45.30, color: '#a855f7' },
  { name: 'Copy Trade Profit Share', value: 89.20, color: '#22c55e' },
];

// Builder fee trades
const builderTrades = [
  { tradeId: 'hl-1042', asset: 'TSLA-PERP', volume: 22100, feeBps: 5, feeUsd: 11.05, time: '1h ago' },
  { tradeId: 'hl-1038', asset: 'NVDA-PERP', volume: 18400, feeBps: 5, feeUsd: 9.20, time: '2h ago' },
  { tradeId: 'hl-1035', asset: 'TSLA-PERP', volume: 15200, feeBps: 5, feeUsd: 7.60, time: '3h ago' },
  { tradeId: 'hl-1029', asset: 'AAPL-PERP', volume: 12800, feeBps: 5, feeUsd: 6.40, time: '5h ago' },
  { tradeId: 'hl-1024', asset: 'AMZN-PERP', volume: 22000, feeBps: 5, feeUsd: 11.00, time: '8h ago' },
];

const statusColors: Record<string, string> = {
  running: '#22c55e',
  stopped: '#64748b',
  error: '#ef4444',
};

const statusBadgeColors: Record<string, 'green' | 'gray' | 'red'> = {
  running: 'green',
  stopped: 'gray',
  error: 'red',
};

export function AdminPage() {
  const [globalHalt, setGlobalHalt] = useState(false);

  const runningCount = mockAgents.filter(a => a.status === 'running').length;
  const totalVolume = mockAgents.reduce((s, a) => s + a.volumeUsd, 0);
  const totalTrades = mockAgents.reduce((s, a) => s + a.tradesExecuted, 0);
  const totalPnl = mockAgents.reduce((s, a) => s + a.pnlUsd, 0);
  const totalFees = feeBreakdown.reduce((s, f) => s + f.value, 0);
  const builderFeeTotal = builderTrades.reduce((s, t) => s + t.feeUsd, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Admin Control Panel</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>CoinDCX Trading Agent — Operations Dashboard</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge color={globalHalt ? 'red' : 'green'}>
            {globalHalt ? 'GLOBAL HALT' : 'System Operational'}
          </Badge>
          <Button
            variant={globalHalt ? 'primary' : 'danger'}
            size="sm"
            onClick={() => setGlobalHalt(!globalHalt)}
          >
            <Shield size={14} />
            {globalHalt ? 'Resume All' : 'Emergency Halt'}
          </Button>
        </div>
      </div>

      {/* Top Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Agents Running"
          value={String(runningCount)}
          change={`${mockAgents.length} total`}
          changePositive
          icon={<Server size={20} color="#3b82f6" />}
        />
        <StatCard
          label="Total Volume"
          value={`$${(totalVolume / 1000).toFixed(1)}K`}
          change={`${totalTrades} trades`}
          changePositive
          icon={<Activity size={20} color="#a855f7" />}
        />
        <StatCard
          label="Total P&L"
          value={`$${totalPnl.toLocaleString()}`}
          change={`${((totalPnl / totalVolume) * 100).toFixed(2)}%`}
          changePositive={totalPnl > 0}
          icon={<TrendingUp size={20} color={totalPnl > 0 ? '#22c55e' : '#ef4444'} />}
        />
        <StatCard
          label="Platform Fees"
          value={`$${totalFees.toFixed(2)}`}
          icon={<DollarSign size={20} color="#22c55e" />}
        />
        <StatCard
          label="Builder Code Fees"
          value={`$${builderFeeTotal.toFixed(2)}`}
          change="Hyperliquid rebates"
          changePositive
          icon={<Code2 size={20} color="#f97316" />}
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Volume by Chain */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Volume by Chain</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={volumeByChain}>
              <XAxis dataKey="chain" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, 'Volume']}
              />
              <Bar dataKey="volume" radius={[6, 6, 0, 0]}>
                {volumeByChain.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Fee Breakdown Pie */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Fee Breakdown</div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={feeBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                stroke="none"
              >
                {feeBreakdown.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => [`$${v.toFixed(2)}`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {feeBreakdown.map(f => (
              <div key={f.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.color }} />
                  <span style={{ color: '#94a3b8' }}>{f.name}</span>
                </div>
                <span style={{ fontWeight: 600 }}>${f.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Hyperliquid Builders Code Section */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code2 size={18} color="#a855f7" />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Hyperliquid Builders Code</div>
            <Badge color="purple">Active</Badge>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#94a3b8' }}>
            <span>Code: <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>0xCoinDCXAgent</strong></span>
            <span>Fee: <strong style={{ color: '#e2e8f0' }}>5 bps</strong></span>
            <span>Network: <strong style={{ color: '#f97316' }}>Mainnet</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ background: '#0a0e17', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Total Builder Volume</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>${(90500).toLocaleString()}</div>
          </div>
          <div style={{ background: '#0a0e17', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Builder Rebates Earned</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>${builderFeeTotal.toFixed(2)}</div>
          </div>
          <div style={{ background: '#0a0e17', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Perp Trades via Builder</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{builderTrades.length}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Trade ID', 'Asset', 'Volume', 'Fee Rate', 'Fee Earned', 'Time'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {builderTrades.map(t => (
              <tr key={t.tradeId} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{t.tradeId}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.asset}</td>
                <td style={{ padding: '10px 12px' }}>${t.volume.toLocaleString()}</td>
                <td style={{ padding: '10px 12px' }}>{t.feeBps} bps</td>
                <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 600 }}>${t.feeUsd.toFixed(2)}</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{t.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Active Agents Table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={18} color="#3b82f6" />
            <div style={{ fontSize: 14, fontWeight: 600 }}>Active Agents ({mockAgents.length})</div>
          </div>
          <Button variant="ghost" size="sm">
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Status', 'Agent ID', 'User', 'Strategy', 'Chain', 'Trades', 'Volume', 'P&L', 'Uptime'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockAgents.map(agent => (
              <tr key={agent.agentId} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: statusColors[agent.status],
                      boxShadow: agent.status === 'running' ? `0 0 6px ${statusColors[agent.status]}` : 'none',
                    }} />
                    <Badge color={statusBadgeColors[agent.status]}>
                      {agent.status}
                    </Badge>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{agent.agentId}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>{agent.userId}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{agent.strategy}</td>
                <td style={{ padding: '10px 12px' }}>
                  <Badge color="blue">{agent.chain}</Badge>
                </td>
                <td style={{ padding: '10px 12px' }}>{agent.tradesExecuted}</td>
                <td style={{ padding: '10px 12px' }}>${agent.volumeUsd.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: agent.pnlUsd >= 0 ? '#22c55e' : '#ef4444' }}>
                  {agent.pnlUsd >= 0 ? '+' : ''}${agent.pnlUsd.toLocaleString()}
                </td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{agent.startedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
