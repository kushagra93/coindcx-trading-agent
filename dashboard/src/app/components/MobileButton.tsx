import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface MobileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
  children: ReactNode;
}

export function MobileButton({ variant = 'primary', fullWidth = true, children, style, ...props }: MobileButtonProps) {
  const bg = variant === 'primary' ? '#3b82f6'
    : variant === 'danger' ? '#ef4444'
    : variant === 'secondary' ? '#1e293b'
    : 'transparent';

  return (
    <button
      style={{
        width: fullWidth ? '100%' : undefined,
        padding: '14px 20px',
        borderRadius: 12,
        border: variant === 'ghost' ? '1px solid #334155' : 'none',
        background: bg,
        color: '#fff',
        fontSize: 15,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 48,
        opacity: props.disabled ? 0.5 : 1,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
