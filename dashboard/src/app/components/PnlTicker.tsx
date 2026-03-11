import { TrendingUp, TrendingDown } from 'lucide-react';

interface PnlTickerProps {
  pnl: number;
  pnlPct: number;
}

export function PnlTicker({ pnl, pnlPct }: PnlTickerProps) {
  const positive = pnl >= 0;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '8px 16px',
      background: positive ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
      borderRadius: 12,
    }}>
      {positive ? <TrendingUp size={16} color="#22c55e" /> : <TrendingDown size={16} color="#ef4444" />}
      <span style={{ fontSize: 14, fontWeight: 700, color: positive ? '#22c55e' : '#ef4444' }}>
        {positive ? '+' : ''}{pnlPct.toFixed(2)}%
      </span>
      <span style={{ fontSize: 13, color: '#94a3b8' }}>
        ({positive ? '+' : ''}${pnl.toFixed(2)} today)
      </span>
    </div>
  );
}
