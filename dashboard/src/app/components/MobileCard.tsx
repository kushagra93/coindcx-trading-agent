import type { CSSProperties, ReactNode } from 'react';
import { tokens } from '../../styles/theme';

type Variant = 'default' | 'elevated' | 'ghost' | 'glow';

interface MobileCardProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  variant?: Variant;
}

const variantStyles: Record<Variant, CSSProperties> = {
  default: {
    background: tokens.colors.bgSurface,
    border: 'none',
  },
  elevated: {
    background: tokens.colors.bgElevated,
    boxShadow: tokens.shadows.elevated,
  },
  ghost: {
    background: 'transparent',
    border: `1px solid ${tokens.colors.border}`,
  },
  glow: {
    background: tokens.colors.bgSurface,
    border: `1px solid ${tokens.colors.border}`,
  },
};

export function MobileCard({ children, style, onClick, variant = 'default' }: MobileCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        borderRadius: tokens.radii.lg,
        padding: tokens.spacing.lg,
        cursor: onClick ? 'pointer' : undefined,
        transition: `all ${tokens.transitions.fast}`,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
