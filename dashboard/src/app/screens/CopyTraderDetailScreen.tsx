import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Users, BarChart3 } from 'lucide-react';
import { SliderInput } from '../components/SliderInput';
import { MobileButton } from '../components/MobileButton';
import { MobileCard } from '../components/MobileCard';
import { mobile } from '../styles/mobile';

const traderData: Record<string, { name: string; chain: string; sharpe: number; pnl30d: number; copiers: number; winRate: number; avgTrade: string; totalTrades: number }> = {
  tr1: { name: 'CryptoWhale', chain: 'solana', sharpe: 2.4, pnl30d: 34.2, copiers: 1240, winRate: 68, avgTrade: '$2,400', totalTrades: 342 },
  tr2: { name: 'DeFiKing', chain: 'ethereum', sharpe: 1.9, pnl30d: 22.1, copiers: 890, winRate: 61, avgTrade: '$1,800', totalTrades: 256 },
  tr3: { name: 'AlphaHunter', chain: 'hyperliquid', sharpe: 3.1, pnl30d: 45.8, copiers: 2100, winRate: 72, avgTrade: '$5,200', totalTrades: 189 },
  tr4: { name: 'SolanaSniper', chain: 'solana', sharpe: 1.7, pnl30d: 18.5, copiers: 560, winRate: 58, avgTrade: '$900', totalTrades: 478 },
  tr5: { name: 'GridMaster', chain: 'ethereum', sharpe: 2.0, pnl30d: 28.3, copiers: 730, winRate: 65, avgTrade: '$1,500', totalTrades: 312 },
};

export function CopyTraderDetailScreen() {
  const navigate = useNavigate();
  const { traderId } = useParams();
  const trader = traderData[traderId ?? ''] ?? traderData.tr1;

  const [budget, setBudget] = useState(500);
  const [copying, setCopying] = useState(false);

  const handleCopy = () => {
    setCopying(true);
    setTimeout(() => navigate('/app/copy'), 1200);
  };

  return (
    <div style={{ padding: mobile.screenPadding }}>
      <button
        onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, marginBottom: 16, cursor: 'pointer', padding: 0 }}
      >
        <ArrowLeft size={18} /> Back
      </button>

      {/* Avatar + Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, #3b82f6, #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: '#fff',
        }}>
          {trader.name[0]}
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{trader.name}</div>
          <div style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>{trader.chain}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        {[
          { icon: <TrendingUp size={16} color="#22c55e" />, label: '30d P&L', value: `+${trader.pnl30d}%` },
          { icon: <BarChart3 size={16} color="#3b82f6" />, label: 'Sharpe', value: trader.sharpe.toFixed(1) },
          { icon: <Users size={16} color="#a855f7" />, label: 'Copiers', value: trader.copiers.toLocaleString() },
          { icon: null, label: 'Win Rate', value: `${trader.winRate}%` },
        ].map(stat => (
          <MobileCard key={stat.label} style={{ textAlign: 'center', padding: 12 }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {stat.icon} {stat.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{stat.value}</div>
          </MobileCard>
        ))}
      </div>

      {/* Performance chart placeholder */}
      <MobileCard style={{ marginBottom: 20, textAlign: 'center', padding: 20 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>30-Day Performance</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, height: 60 }}>
          {Array.from({ length: 30 }, (_, i) => {
            const h = 15 + Math.sin(i * 0.3) * 20 + Math.random() * 15;
            return <div key={i} style={{ width: 6, height: h, borderRadius: 2, background: h > 30 ? '#22c55e' : '#ef4444' }} />;
          })}
        </div>
      </MobileCard>

      {/* Trade info */}
      <MobileCard style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Trades', value: trader.totalTrades },
          { label: 'Avg Trade Size', value: trader.avgTrade },
        ].map(row => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </MobileCard>

      {/* Budget slider */}
      <SliderInput
        label="Copy Budget"
        value={budget}
        min={100}
        max={10000}
        step={100}
        formatValue={v => `$${v.toLocaleString()}`}
        onChange={setBudget}
      />

      <MobileButton onClick={handleCopy} disabled={copying}>
        {copying ? 'Copying Started!' : 'Start Copying'}
      </MobileButton>
    </div>
  );
}
