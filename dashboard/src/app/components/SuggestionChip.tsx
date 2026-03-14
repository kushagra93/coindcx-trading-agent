import { Sparkles } from 'lucide-react';
import { tokens } from '../../styles/theme';

export function SuggestionChip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 12px',
        borderRadius: tokens.radii.sm,
        border: `1px solid ${tokens.colors.border}`,
        background: tokens.colors.bg,
        color: tokens.colors.textSecondary,
        fontSize: 12,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
      }}
    >
      <Sparkles size={11} color={tokens.colors.accent} />
      {text}
    </button>
  );
}
