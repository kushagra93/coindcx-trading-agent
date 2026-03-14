import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Activity, Zap, BarChart3 } from 'lucide-react';
import { Card } from '../components/Card';
import { StatCard } from '../components/StatCard';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { tokens } from '../styles/theme';
import { useTradingData } from '../app/context/TradingDataContext';
import { screenToken } from '../app/services/blockchain';

// Mock chart data
const mockPnlData = Array.from({ length: 30 }, (_, i) => ({
  day: `Day ${i + 1}`,
  value: 10000 + Math.sin(i / 3) * 1500 + i * 120 + (Math.random() - 0.3) * 500,
}));

export function DashboardPage() {
  const navigate = useNavigate();
  const { portfolio, holdings, recentTrades, events, allTokens, signals } = useTradingData();
  const [agentRunning, setAgentRunning] = useState(true);

  const hotTokens = allTokens
    .filter(t => t.ctScore > 65 || t.priceChange24h > 15)
    .sort((a, b) => b.ctScore - a.ctScore)
    .slice(0, 6);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.colors.text }}>Dashboard</h1>
          <p style={{ color: tokens.colors.textMuted, fontSize: 13, marginTop: 4 }}>Trading portfolio overview</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge color={agentRunning ? 'gold' : 'gray'}>
            {agentRunning ? 'Agent Running' : 'Agent Stopped'}
          </Badge>
          <Button
            variant={agentRunning ? 'danger' : 'accent'}
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
          value={`$${portfolio.totalValue.toLocaleString()}`}
          icon={<DollarSign size={20} color={tokens.colors.accent} />}
        />
        <StatCard
          label="Today's P&L"
          value={`${portfolio.todayPnl >= 0 ? '+' : ''}$${Math.abs(portfolio.todayPnl).toLocaleString()}`}
          change={`${portfolio.todayPnlPct.toFixed(2)}%`}
          changePositive={portfolio.todayPnl >= 0}
          icon={portfolio.todayPnl >= 0 ? <TrendingUp size={20} color={tokens.colors.positive} /> : <TrendingDown size={20} color={tokens.colors.negative} />}
        />
        <StatCard
          label="Active Strategies"
          value={String(portfolio.activeStrategies)}
          icon={<BarChart3 size={20} color={tokens.colors.purple} />}
        />
        <StatCard
          label="Tokens Held"
          value={String(holdings.length)}
          icon={<Activity size={20} color={tokens.colors.positive} />}
        />
      </div>

      {/* 3-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '40% 35% 25%', gap: 16, marginBottom: 24 }}>
        {/* Portfolio Chart */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: tokens.colors.text }}>Portfolio Value (30d)</div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={mockPnlData}>
              <defs>
                <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tokens.colors.accent} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={tokens.colors.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: tokens.colors.textMuted }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: tokens.colors.textMuted, fontFamily: tokens.fonts.mono }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: tokens.colors.bgElevated, border: `1px solid ${tokens.colors.border}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: tokens.colors.textSecondary }}
                formatter={(v: number) => [`$${v.toFixed(0)}`, 'Value']}
              />
              <Area type="monotone" dataKey="value" stroke={tokens.colors.accent} fill="url(#pnlGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Agent Activity Feed */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: tokens.colors.text }}>Agent Activity</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentTrades.slice(0, 5).map(t => (
              <div key={t.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: tokens.colors.bg,
                borderRadius: tokens.radii.sm,
              }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: t.side === 'buy' ? tokens.colors.positive : tokens.colors.negative,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: tokens.colors.text }}>
                    {t.side === 'buy' ? 'Bought' : 'Sold'} {t.amount} {t.token}
                  </div>
                  <div style={{ fontSize: 10, color: tokens.colors.textMuted }}>{t.time}</div>
                </div>
                <div style={{ fontSize: 11, fontFamily: tokens.fonts.mono, color: tokens.colors.textSecondary }}>
                  {t.price}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Hot Tokens + Signals */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: tokens.colors.text }}>Hot Tokens</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {hotTokens.map(t => (
              <div key={t.symbol} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: tokens.colors.bg,
                borderRadius: tokens.radii.sm,
              }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.text }}>{t.symbol}</div>
                  <div style={{ fontSize: 9, color: tokens.colors.textMuted }}>{t.chain}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 600,
                    fontFamily: tokens.fonts.mono,
                    color: t.priceChange24h >= 0 ? tokens.colors.positive : tokens.colors.negative,
                  }}>
                    {t.priceChange24h >= 0 ? '+' : ''}{t.priceChange24h.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 9, color: tokens.colors.textMuted }}>CT {t.ctScore}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Trades */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: tokens.colors.text }}>Recent Trades</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.colors.border}` }}>
              {['Token', 'Side', 'Amount', 'Price', 'Time'].map(h => (
                <th key={h} style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: 11,
                  color: tokens.colors.textMuted,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentTrades.map(t => (
              <tr key={t.id} style={{ borderBottom: `1px solid ${tokens.colors.bg}` }}>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: tokens.colors.text }}>{t.token}</td>
                <td style={{ padding: '10px 12px' }}>
                  <Badge color={t.side === 'buy' ? 'green' : 'red'}>{t.side}</Badge>
                </td>
                <td style={{ padding: '10px 12px', fontFamily: tokens.fonts.mono, color: tokens.colors.text }}>{t.amount}</td>
                <td style={{ padding: '10px 12px', fontFamily: tokens.fonts.mono, color: tokens.colors.text }}>{t.price}</td>
                <td style={{ padding: '10px 12px', color: tokens.colors.textMuted }}>{t.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
