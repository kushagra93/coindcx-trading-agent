import { useNavigate } from 'react-router-dom';
import { MobileCard } from './MobileCard';
import { tokens } from '../../styles/theme';
import type { TokenMetrics } from '../services/blockchain';

const gradeColors: Record<string, string> = {
  A: tokens.colors.positive,
  B: '#a3e635',
  C: tokens.colors.warning,
  D: '#f97316',
  F: tokens.colors.negative,
};

interface TokenCardProps {
  token: TokenMetrics;
  grade?: string;
}

export function TokenCard({ token, grade }: TokenCardProps) {
  const navigate = useNavigate();

  const formatCompact = (n: number) => {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const formatPrice = (p: number) => {
    if (p >= 100) return `$${p.toFixed(2)}`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    if (p >= 0.01) return `$${p.toFixed(4)}`;
    if (p >= 0.0001) return `$${p.toFixed(6)}`;
    return `$${p.toExponential(2)}`;
  };

  return (
    <MobileCard style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: tokens.radii.sm,
            background: tokens.colors.bgInput,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: tokens.colors.textSecondary,
          }}>
            {token.symbol.slice(0, 3)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: tokens.colors.text }}>{token.symbol}</span>
              {grade && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 4px',
                  borderRadius: 3,
                  background: `${gradeColors[grade] ?? tokens.colors.textMuted}18`,
                  color: gradeColors[grade] ?? tokens.colors.textMuted,
                }}>
                  {grade}
                </span>
              )}
              <span style={{
                fontSize: 9,
                padding: '1px 5px',
                borderRadius: 3,
                background: tokens.colors.bgInput,
                color: tokens.colors.textMuted,
              }}>
                {token.chain}
              </span>
            </div>
            <div style={{ fontSize: 10, color: tokens.colors.textMuted, marginTop: 1 }}>
              Vol {formatCompact(token.volume24h)} · MCap {formatCompact(token.marketCap)}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontWeight: 600,
            fontSize: 13,
            fontFamily: tokens.fonts.mono,
            color: tokens.colors.text,
          }}>
            {formatPrice(token.price)}
          </div>
          <div style={{
            fontSize: 10,
            fontFamily: tokens.fonts.mono,
            fontWeight: 600,
            color: token.priceChange24h >= 0 ? tokens.colors.positive : tokens.colors.negative,
          }}>
            {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {['Screen', 'Buy', 'Alert'].map(action => (
          <button
            key={action}
            onClick={() => navigate(`/app/agent`, { state: { command: `${action.toLowerCase()} ${token.symbol}` } })}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: tokens.radii.sm,
              border: `1px solid ${tokens.colors.border}`,
              background: tokens.colors.bgSurface,
              color: tokens.colors.textSecondary,
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              transition: `all ${tokens.transitions.fast}`,
            }}
          >
            {action}
          </button>
        ))}
      </div>
    </MobileCard>
  );
}
