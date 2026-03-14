import { useNavigate } from 'react-router-dom';
import { tokens } from '../../styles/theme';

interface TradeEvent {
  id: string;
  token: string;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  time: string;
}

export function TradeEventCard({ trade }: { trade: TradeEvent }) {
  const navigate = useNavigate();
  const isBuy = trade.side === 'buy';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      background: tokens.colors.bgSurface,
      borderRadius: tokens.radii.md,
      borderLeft: `3px solid ${isBuy ? tokens.colors.positive : tokens.colors.negative}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: tokens.radii.sm,
        background: isBuy ? tokens.colors.positiveBg : tokens.colors.negativeBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 11, color: isBuy ? tokens.colors.positive : tokens.colors.negative,
      }}>
        {trade.token.slice(0, 3)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text }}>
          {isBuy ? 'Bought' : 'Sold'} {trade.amount} {trade.token}
        </div>
        <div style={{ fontSize: 11, color: tokens.colors.textMuted }}>
          ${trade.price} · {trade.time}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/app/activity/${trade.id}`); }}
        style={{
          padding: '4px 10px',
          borderRadius: tokens.radii.sm,
          border: `1px solid ${tokens.colors.border}`,
          background: 'transparent',
          color: tokens.colors.textSecondary,
          fontSize: 11,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Why?
      </button>
    </div>
  );
}
