import { useNavigate } from 'react-router-dom';

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
      background: '#111827',
      borderRadius: 12,
      borderLeft: `3px solid ${isBuy ? '#22c55e' : '#ef4444'}`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: isBuy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 11, color: isBuy ? '#22c55e' : '#ef4444',
      }}>
        {trade.token.slice(0, 3)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>
          {isBuy ? 'Bought' : 'Sold'} {trade.amount} {trade.token}
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          ${trade.price} · {trade.time}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); navigate(`/app/activity/${trade.id}`); }}
        style={{
          padding: '4px 10px',
          borderRadius: 8,
          border: '1px solid #334155',
          background: 'transparent',
          color: '#94a3b8',
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
