import { Sparkles } from 'lucide-react';

export function SuggestionChip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        borderRadius: 10,
        border: '1px solid #334155',
        background: '#0a0e17',
        color: '#94a3b8',
        fontSize: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
      }}
    >
      <Sparkles size={11} color="#a855f7" />
      {text}
    </button>
  );
}
