import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Trader {
  id: string;
  name: string;
  sharpe: number;
  pnl30d: number;
  copiers: number;
  chains: string[];
}

export function TraderCard({ trader }: { trader: Trader }) {
  const navigate = useNavigate();

  const gradients = ['#3b82f6', '#a855f7', '#22c55e', '#eab308', '#ef4444', '#ec4899'];
  const color = gradients[trader.name.length % gradients.length];

  return (
    <div
      onClick={() => navigate(`/app/copy/${trader.id}`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: '#111827',
        borderRadius: 14,
        cursor: 'pointer',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: `linear-gradient(135deg, ${color}, ${color}88)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 18, color: '#fff',
      }}>
        {trader.name[0]}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{trader.name}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
          {trader.chains.map(c => (
            <span key={c} style={{
              padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
              background: 'rgba(59,130,246,0.15)', color: '#3b82f6', textTransform: 'uppercase',
            }}>
              {c}
            </span>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#22c55e' }}>+{trader.pnl30d}%</div>
        <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
          <Users size={10} /> {trader.copiers}
        </div>
      </div>
    </div>
  );
}
