import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const variantStyles: Record<string, CSSProperties> = {
  primary: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: '#1e293b',
    color: '#f1f5f9',
    border: '1px solid #334155',
  },
  danger: {
    background: '#ef4444',
    color: '#fff',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #1e293b',
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
        borderRadius: 8,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        transition: 'opacity 0.15s',
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
