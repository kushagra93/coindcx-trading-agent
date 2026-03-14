import { tokens } from '../../styles/theme';
import type { PortfolioSummary } from '../context/TradingDataContext';

interface PortfolioHeaderProps {
  portfolio: PortfolioSummary;
}

export function PortfolioHeader({ portfolio }: PortfolioHeaderProps) {
  const positive = portfolio.todayPnl >= 0;

  return (
    <div style={{ padding: '4px 0 12px' }}>
      <div style={{
        fontSize: 34,
        fontWeight: 700,
        fontFamily: tokens.fonts.mono,
        color: tokens.colors.text,
        letterSpacing: '-0.02em',
      }}>
        ${portfolio.totalValue.toLocaleString()}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <span style={{
          fontSize: 14,
          fontWeight: 600,
          fontFamily: tokens.fonts.mono,
          color: positive ? tokens.colors.positive : tokens.colors.negative,
        }}>
          {positive ? '+' : ''}${Math.abs(portfolio.todayPnl).toLocaleString()} ({portfolio.todayPnlPct > 0 ? '+' : ''}{portfolio.todayPnlPct}%)
        </span>
        <span style={{ fontSize: 11, color: tokens.colors.textMuted }}>
          today
        </span>
      </div>
    </div>
  );
}
