import { MessageSquare } from 'lucide-react';
import { tokens } from '../../styles/theme';

export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 52,
        height: 52,
        borderRadius: tokens.radii.lg,
        background: tokens.colors.accent,
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(212,168,83,0.4)',
        cursor: 'pointer',
      }}
    >
      <MessageSquare size={22} color="#0a0a0a" />
    </button>
  );
}
