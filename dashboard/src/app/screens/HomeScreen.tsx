import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { MobileCard } from '../components/MobileCard';
import { TradeEventCard } from '../components/TradeEventCard';
import { mobile } from '../styles/mobile';

const chains = ['All', 'Solana', 'Base', 'Ethereum', 'Perps'] as const;

const holdings = [
  { token: 'SOL', chain: 'Solana', balance: '24.5', usd: '$3,528', change: +5.2 },
  { token: 'FARTCOIN', chain: 'Solana', balance: '450K', usd: '$1,845', change: +142.5 },
  { token: 'POPCAT', chain: 'Solana', balance: '8,200', usd: '$2,132', change: +67.3 },
  { token: 'WIF', chain: 'Solana', balance: '1,200', usd: '$960', change: +8.7 },
  { token: 'BONK', chain: 'Solana', balance: '12.5M', usd: '$312', change: +18.4 },
  { token: 'MYRO', chain: 'Solana', balance: '25K', usd: '$425', change: +34.8 },
  { token: 'BRETT', chain: 'Base', balance: '5,000', usd: '$450', change: +12.3 },
  { token: 'DEGEN', chain: 'Base', balance: '180K', usd: '$720', change: +28.5 },
  { token: 'TOSHI', chain: 'Base', balance: '2.1M', usd: '$315', change: +19.2 },
  { token: 'AERO', chain: 'Base', balance: '850', usd: '$1,020', change: -3.1 },
  { token: 'ETH', chain: 'Ethereum', balance: '1.2', usd: '$3,840', change: +2.1 },
  { token: 'PEPE', chain: 'Ethereum', balance: '80B', usd: '$720', change: -1.5 },
  { token: 'MOG', chain: 'Ethereum', balance: '5.2B', usd: '$416', change: +22.1 },
  { token: 'TSLA-PERP', chain: 'Perps', balance: '0.5 contracts', usd: '$2,150', change: +3.8 },
  { token: 'NVDA-PERP', chain: 'Perps', balance: '1.2 contracts', usd: '$1,680', change: +5.1 },
  { token: 'AAPL-PERP', chain: 'Perps', balance: '2 contracts', usd: '$890', change: -1.2 },
];

const recentTrades = [
  { id: 't1', token: 'FARTCOIN', side: 'buy' as const, amount: '150K', price: '$0.0041', time: '30s ago' },
  { id: 't2', token: 'POPCAT', side: 'buy' as const, amount: '2,000', price: '$0.26', time: '2m ago' },
  { id: 't3', token: 'TSLA-PERP', side: 'buy' as const, amount: '0.5', price: '$430.20', time: '5m ago' },
  { id: 't4', token: 'DEGEN', side: 'buy' as const, amount: '50K', price: '$0.004', time: '12m ago' },
  { id: 't5', token: 'BONK', side: 'buy' as const, amount: '2.5M', price: '$0.000025', time: '18m ago' },
  { id: 't6', token: 'NVDA-PERP', side: 'buy' as const, amount: '0.3', price: '$140.10', time: '25m ago' },
  { id: 't7', token: 'MYRO', side: 'buy' as const, amount: '10K', price: '$0.017', time: '45m ago' },
  { id: 't8', token: 'MOG', side: 'sell' as const, amount: '1B', price: '$0.0000008', time: '1h ago' },
];

export function HomeScreen() {
  const navigate = useNavigate();
  const { agentStatus, portfolio, toggleAgent } = useApp();
  const [chainFilter, setChainFilter] = useState<typeof chains[number]>('All');

  const filtered = chainFilter === 'All' ? holdings : holdings.filter(h => h.chain === chainFilter);

  return (
    <div style={{ padding: mobile.screenPadding }}>
      {/* Agent Status Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: 4,
            background: agentStatus === 'running' ? '#22c55e' : '#ef4444',
            boxShadow: agentStatus === 'running' ? '0 0 8px #22c55e' : 'none',
          }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Agent {agentStatus === 'running' ? 'Running' : 'Stopped'}
          </span>
        </div>
        <button onClick={toggleAgent} style={{
          padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600,
          background: agentStatus === 'running' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          color: agentStatus === 'running' ? '#ef4444' : '#22c55e',
          cursor: 'pointer',
        }}>
          {agentStatus === 'running' ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Portfolio Summary */}
      <MobileCard style={{ marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Total Balance</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>
          ${portfolio.totalValue.toLocaleString()}
        </div>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: portfolio.todayPnl >= 0 ? '#22c55e' : '#ef4444',
        }}>
          {portfolio.todayPnl >= 0 ? '+' : ''}${portfolio.todayPnl.toFixed(0)} today
        </span>
      </MobileCard>

      {/* Chain Filter Pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {chains.map(c => (
          <button key={c} onClick={() => setChainFilter(c)} style={{
            padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 500,
            background: chainFilter === c ? '#3b82f6' : '#1e293b',
            color: chainFilter === c ? '#fff' : '#94a3b8',
            cursor: 'pointer',
          }}>
            {c}
          </button>
        ))}
      </div>

      {/* Holdings */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Holdings</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(h => (
            <MobileCard key={h.token} style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: '#1e293b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#94a3b8',
                  }}>{h.token.slice(0, 3)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{h.token}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{h.chain} · {h.balance}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{h.usd}</div>
                  <div style={{ fontSize: 10, color: h.change >= 0 ? '#22c55e' : '#ef4444' }}>
                    {h.change >= 0 ? '+' : ''}{h.change}%
                  </div>
                </div>
              </div>
            </MobileCard>
          ))}
        </div>
      </div>

      {/* Recent Trades */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Recent Trades</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recentTrades.map(t => (
            <TradeEventCard key={t.id} trade={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
