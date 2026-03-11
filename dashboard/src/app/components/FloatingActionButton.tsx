import { MessageSquare } from 'lucide-react';

export function FloatingActionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 52,
        height: 52,
        borderRadius: 16,
        background: '#3b82f6',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
        cursor: 'pointer',
      }}
    >
      <MessageSquare size={22} color="#fff" />
    </button>
  );
}
