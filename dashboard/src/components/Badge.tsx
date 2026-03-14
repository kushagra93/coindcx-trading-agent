import type { CSSProperties, ReactNode } from 'react';
import { tokens } from '../styles/theme';

interface BadgeProps {
  children: ReactNode;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray' | 'gold';
  style?: CSSProperties;
}

const colorMap: Record<string, { bg: string; text: string }> = {
  green:  { bg: tokens.colors.positiveBg,  text: tokens.colors.positive },
  red:    { bg: tokens.colors.negativeBg,  text: tokens.colors.negative },
  yellow: { bg: 'rgba(251, 191, 36, 0.12)',  text: tokens.colors.warning },
  blue:   { bg: 'rgba(96, 165, 250, 0.12)', text: tokens.colors.info },
  purple: { bg: 'rgba(167, 139, 250, 0.12)', text: tokens.colors.purple },
  gray:   { bg: 'rgba(90, 89, 87, 0.15)', text: tokens.colors.textSecondary },
  gold:   { bg: tokens.colors.accentSubtle, text: tokens.colors.accent },
};

export function Badge({ children, color = 'gray', style }: BadgeProps) {
  const c = colorMap[color];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      background: c.bg,
      color: c.text,
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
      ...style,
    }}>
      {children}
    </span>
  );
}
