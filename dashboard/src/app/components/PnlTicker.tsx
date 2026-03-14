import { TrendingUp, TrendingDown } from 'lucide-react';
import { tokens } from '../../styles/theme';

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
      background: positive ? tokens.colors.positiveBg : tokens.colors.negativeBg,
      borderRadius: tokens.radii.md,
    }}>
      {positive ? <TrendingUp size={16} color={tokens.colors.positive} /> : <TrendingDown size={16} color={tokens.colors.negative} />}
      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: tokens.fonts.mono, color: positive ? tokens.colors.positive : tokens.colors.negative }}>
        {positive ? '+' : ''}{pnlPct.toFixed(2)}%
      </span>
      <span style={{ fontSize: 13, fontFamily: tokens.fonts.mono, color: tokens.colors.textSecondary }}>
        ({positive ? '+' : ''}${pnl.toFixed(2)} today)
      </span>
    </div>
  );
}
