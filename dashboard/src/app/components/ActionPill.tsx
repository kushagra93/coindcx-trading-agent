import type { ReactNode } from 'react';

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
        borderRadius: 20,
        border: '1px solid #1e293b',
        background: '#111827',
        color: '#f1f5f9',
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
