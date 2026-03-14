import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { tokens } from '../../styles/theme';

interface MobileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
  children: ReactNode;
}

export function MobileButton({ variant = 'primary', fullWidth = true, children, style, ...props }: MobileButtonProps) {
  const bg = variant === 'primary' ? tokens.colors.accent
    : variant === 'danger' ? tokens.colors.negative
    : variant === 'secondary' ? tokens.colors.bgInput
    : 'transparent';

  const color = variant === 'primary' ? '#0a0a0a'
    : variant === 'danger' ? '#fff'
    : tokens.colors.text;

  return (
    <button
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '14px 20px',
        borderRadius: tokens.radii.md,
        border: variant === 'ghost' ? `1px solid ${tokens.colors.border}` : 'none',
        background: bg,
        color,
        fontSize: 15,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 48,
        opacity: props.disabled ? 0.5 : 1,
        transition: `all ${tokens.transitions.fast}`,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
