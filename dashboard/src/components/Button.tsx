import type { CSSProperties, ButtonHTMLAttributes, ReactNode } from 'react';
import { tokens } from '../styles/theme';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variantStyles: Record<string, CSSProperties> = {
  primary: {
    background: tokens.colors.accent,
    color: '#0a0a0a',
    border: 'none',
  },
  accent: {
    background: tokens.colors.accent,
    color: '#0a0a0a',
    border: 'none',
  },
  secondary: {
    background: tokens.colors.bgInput,
    color: tokens.colors.text,
    border: `1px solid ${tokens.colors.border}`,
  },
  danger: {
    background: tokens.colors.negative,
    color: '#fff',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: tokens.colors.textSecondary,
    border: `1px solid ${tokens.colors.border}`,
  },
};

const sizeStyles: Record<string, CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 12 },
  md: { padding: '8px 16px', fontSize: 13 },
  lg: { padding: '12px 24px', fontSize: 14 },
};

export function Button({ variant = 'primary', size = 'md', children, style, ...props }: ButtonProps) {
  return (
    <button
      style={{
        borderRadius: tokens.radii.sm,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: `opacity ${tokens.transitions.fast}`,
        opacity: props.disabled ? 0.5 : 1,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
