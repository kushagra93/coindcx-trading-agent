import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  hoverable?: boolean;
}

export function Card({ children, style, onClick, hoverable }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#111827',
        border: '1px solid #1e293b',
        borderRadius: 12,
        padding: 20,
        cursor: onClick ? 'pointer' : undefined,
        transition: hoverable ? 'border-color 0.15s, background 0.15s' : undefined,
        ...style,
      }}
      onMouseEnter={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#334155';
        (e.currentTarget as HTMLDivElement).style.background = '#1a2332';
      } : undefined}
      onMouseLeave={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#1e293b';
        (e.currentTarget as HTMLDivElement).style.background = '#111827';
      } : undefined}
    >
      {children}
    </div>
  );
}
