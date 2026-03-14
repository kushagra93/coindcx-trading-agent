import { tokens } from '../../styles/theme';
import type { TokenMetrics } from '../services/blockchain';

const gradeColors: Record<string, string> = {
  A: tokens.colors.positive,
  B: '#a3e635',
  C: tokens.colors.warning,
  D: '#f97316',
  F: tokens.colors.negative,
};

function getGrade(t: TokenMetrics): string {
  if (t.rugScore >= 85 && t.lpLocked) return 'A';
  if (t.rugScore >= 70) return 'B';
  if (t.rugScore >= 50) return 'C';
  if (t.rugScore >= 30) return 'D';
  return 'F';
}

interface HotNowCarouselProps {
  tokens: TokenMetrics[];
}

export function HotNowCarousel({ tokens: hotTokens }: HotNowCarouselProps) {
  if (hotTokens.length === 0) return null;

  const formatPrice = (p: number) => {
    if (p >= 1) return `$${p.toFixed(2)}`;
    if (p >= 0.01) return `$${p.toFixed(4)}`;
    return `$${p.toFixed(6)}`;
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        paddingBottom: 8,
      }}>
        {hotTokens.slice(0, 8).map(t => {
          const grade = getGrade(t);
          return (
            <div
              key={t.symbol}
              style={{
                minWidth: 140,
                padding: 14,
                borderRadius: tokens.radii.lg,
                background: `linear-gradient(135deg, ${tokens.colors.bgSurface} 0%, ${tokens.colors.bgElevated} 100%)`,
                border: `1px solid ${tokens.colors.border}`,
                scrollSnapAlign: 'start',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: tokens.colors.text }}>{t.symbol}</span>
                <span style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 4px',
                  borderRadius: 3,
                  background: `${gradeColors[grade]}18`,
                  color: gradeColors[grade],
                }}>
                  {grade}
                </span>
              </div>
              <div style={{
                fontSize: 15,
                fontWeight: 600,
                fontFamily: tokens.fonts.mono,
                color: tokens.colors.text,
                marginBottom: 4,
              }}>
                {formatPrice(t.price)}
              </div>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: tokens.fonts.mono,
                color: t.priceChange24h >= 0 ? tokens.colors.positive : tokens.colors.negative,
              }}>
                {t.priceChange24h >= 0 ? '+' : ''}{t.priceChange24h.toFixed(1)}%
              </div>
              <div style={{ fontSize: 9, color: tokens.colors.textMuted, marginTop: 4 }}>
                {t.chain}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
