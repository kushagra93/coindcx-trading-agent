import { Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../../styles/theme';

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

  const gradients = [tokens.colors.accent, tokens.colors.purple, tokens.colors.positive, tokens.colors.warning, tokens.colors.negative, '#ec4899'];
  const color = gradients[trader.name.length % gradients.length];

  return (
    <div
      onClick={() => navigate(`/app/copy/${trader.id}`)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: tokens.colors.bgSurface,
        borderRadius: tokens.radii.lg,
        cursor: 'pointer',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: tokens.radii.lg,
        background: `linear-gradient(135deg, ${color}, ${color}88)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 18, color: '#fff',
      }}>
        {trader.name[0]}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: tokens.colors.text }}>{trader.name}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
          {trader.chains.map(c => (
            <span key={c} style={{
              padding: '1px 6px', borderRadius: 4, fontSize: 9, fontWeight: 600,
              background: tokens.colors.accentSubtle, color: tokens.colors.accent, textTransform: 'uppercase',
            }}>
              {c}
            </span>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: tokens.colors.positive }}>+{trader.pnl30d}%</div>
        <div style={{ fontSize: 10, color: tokens.colors.textMuted, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end' }}>
          <Users size={10} /> {trader.copiers}
        </div>
      </div>
    </div>
  );
}
