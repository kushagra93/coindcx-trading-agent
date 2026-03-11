import type { CSSProperties, ReactNode } from 'react';

interface MobileCardProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}

export function MobileCard({ children, style, onClick }: MobileCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#111827',
        borderRadius: 16,
        padding: 16,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
