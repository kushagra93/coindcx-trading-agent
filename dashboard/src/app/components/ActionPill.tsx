import type { ReactNode } from 'react';
import { tokens } from '../../styles/theme';

interface ActionPillProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

export function ActionPill({ icon, label, onClick }: ActionPillProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 16px',
        borderRadius: tokens.radii.xl,
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.colors.bgSurface,
        color: tokens.colors.text,
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        minHeight: 44,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
