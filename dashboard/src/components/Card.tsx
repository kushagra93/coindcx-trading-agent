import type { CSSProperties, ReactNode } from 'react';
import { tokens } from '../styles/theme';

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
        background: tokens.colors.bgSurface,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: tokens.radii.md,
        padding: 20,
        cursor: onClick ? 'pointer' : undefined,
        transition: hoverable ? `border-color ${tokens.transitions.fast}, background ${tokens.transitions.fast}` : undefined,
        ...style,
      }}
      onMouseEnter={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = tokens.colors.borderActive;
        (e.currentTarget as HTMLDivElement).style.background = tokens.colors.bgElevated;
      } : undefined}
      onMouseLeave={hoverable ? (e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = tokens.colors.border;
        (e.currentTarget as HTMLDivElement).style.background = tokens.colors.bgSurface;
      } : undefined}
    >
      {children}
    </div>
  );
}
