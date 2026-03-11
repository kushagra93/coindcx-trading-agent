import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Activity, Zap, BarChart3 } from 'lucide-react';
import { Card } from '../components/Card';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Loader } from '../components/Loader';
import { api } from '../api/client';
import { useApi } from '../hooks/useApi';

// Mock chart data for demo
const mockPnlData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  value: 10000 + Math.sin(i / 3) * 1500 + i * 120 + (Math.random() - 0.3) * 500,
}));

const mockPositions = [
  { id: '1', token: 'SOL', chain: 'solana', side: 'long', entryPrice: 142.5, currentPrice: 156.8, pnlPct: 10.04, sizeUsd: 2500 },
  { id: '2', token: 'ETH', chain: 'ethereum', side: 'long', entryPrice: 3200, currentPrice: 3450, pnlPct: 7.81, sizeUsd: 5000 },
  { id: '3', token: 'ARB', chain: 'arbitrum', side: 'short', entryPrice: 1.25, currentPrice: 1.18, pnlPct: 5.6, sizeUsd: 1200 },
  { id: '4', token: 'MATIC', chain: 'polygon', side: 'long', entryPrice: 0.85, currentPrice: 0.79, pnlPct: -7.06, sizeUsd: 800 },
];

const mockRecentTrades = [
  { id: 't1', token: 'SOL', side: 'buy', amount: '15.5', priceUsd: 142.5, time: '2 min ago', status: 'filled' },
  { id: 't2', token: 'ETH', side: 'buy', amount: '1.2', priceUsd: 3200, time: '15 min ago', status: 'filled' },
  { id: 't3', token: 'ARB', side: 'sell', amount: '800', priceUsd: 1.25, time: '1 hr ago', status: 'filled' },
  { id: 't4', token: 'MATIC', side: 'buy', amount: '1000', priceUsd: 0.85, time: '3 hr ago', status: 'filled' },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const [agentRunning, setAgentRunning] = useState(true);

  const totalBalance = mockPositions.reduce((s, p) => s + p.sizeUsd, 0);
  const totalPnl = mockPositions.reduce((s, p) => s + (p.sizeUsd * p.pnlPct / 100), 0);
  const totalPnlPct = (totalPnl / totalBalance) * 100;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Dashboard</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Overview of your trading portfolio</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge color={agentRunning ? 'green' : 'gray'}>
            {agentRunning ? 'Agent Running' : 'Agent Stopped'}
          </Badge>
          <Button
            variant={agentRunning ? 'danger' : 'primary'}
            size="sm"
            onClick={() => setAgentRunning(!agentRunning)}
          >
            <Zap size={14} />
            {agentRunning ? 'Stop Agent' : 'Start Agent'}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Total Balance"
          value={`$${totalBalance.toLocaleString()}`}
          icon={<DollarSign size={20} color="#3b82f6" />}
        />
        <StatCard
          label="Total P&L"
          value={`$${totalPnl.toFixed(2)}`}
          change={`${totalPnlPct.toFixed(2)}%`}
          changePositive={totalPnl > 0}
          icon={totalPnl > 0 ? <TrendingUp size={20} color="#22c55e" /> : <TrendingDown size={20} color="#ef4444" />}
        />
        <StatCard
          label="Active Positions"
          value={String(mockPositions.length)}
          icon={<BarChart3 size={20} color="#a855f7" />}
        />
        <StatCard
          label="Win Rate"
          value="72%"
          change="3 of last 5 profitable"
          changePositive
          icon={<Activity size={20} color="#22c55e" />}
        />
      </div>

      {/* Chart + Positions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* P&L Chart */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Portfolio Value (30d)</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={mockPnlData}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number) => [`$${v.toFixed(0)}`, 'Value']}
              />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="url(#pnlGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Open Positions */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Open Positions</div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/positions')}>View All</Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mockPositions.map(pos => (
              <div key={pos.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: '#0a0e17',
                borderRadius: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: '#1e293b', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, fontSize: 11, color: '#94a3b8',
                  }}>
                    {pos.token.slice(0, 3)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{pos.token}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {pos.chain} · {pos.side}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>${pos.sizeUsd.toLocaleString()}</div>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: pos.pnlPct >= 0 ? '#22c55e' : '#ef4444',
                  }}>
                    {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Recent Trades</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Token', 'Side', 'Amount', 'Price', 'Time', 'Status'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockRecentTrades.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.token}</td>
                <td style={{ padding: '10px 12px' }}>
                  <Badge color={t.side === 'buy' ? 'green' : 'red'}>{t.side}</Badge>
                </td>
                <td style={{ padding: '10px 12px' }}>{t.amount}</td>
                <td style={{ padding: '10px 12px' }}>${t.priceUsd.toLocaleString()}</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{t.time}</td>
                <td style={{ padding: '10px 12px' }}>
                  <Badge color="green">{t.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
