import type { CSSProperties, ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray';
  style?: CSSProperties;
}

const colorMap: Record<string, { bg: string; text: string }> = {
  green:  { bg: 'rgba(34, 197, 94, 0.15)',  text: '#22c55e' },
  red:    { bg: 'rgba(239, 68, 68, 0.15)',  text: '#ef4444' },
  yellow: { bg: 'rgba(234, 179, 8, 0.15)',  text: '#eab308' },
  blue:   { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  purple: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' },
  gray:   { bg: 'rgba(100, 116, 139, 0.15)', text: '#94a3b8' },
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
