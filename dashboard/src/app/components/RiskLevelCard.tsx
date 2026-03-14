import { Shield, Scale, Flame } from 'lucide-react';
import { tokens } from '../../styles/theme';

const configs = {
  conservative: { icon: Shield, color: tokens.colors.positive, desc: 'Steady growth, lower risk' },
  moderate: { icon: Scale, color: tokens.colors.warning, desc: 'Balanced risk and reward' },
  aggressive: { icon: Flame, color: tokens.colors.negative, desc: 'Higher returns, higher risk' },
};

interface RiskLevelCardProps {
  level: 'conservative' | 'moderate' | 'aggressive';
  selected: boolean;
  onSelect: () => void;
}

export function RiskLevelCard({ level, selected, onSelect }: RiskLevelCardProps) {
  const cfg = configs[level];
  const Icon = cfg.icon;

  return (
    <button
      onClick={onSelect}
      style={{
        flex: 1,
        padding: 14,
        borderRadius: tokens.radii.lg,
        border: selected ? `2px solid ${tokens.colors.accent}` : `1px solid ${tokens.colors.border}`,
        background: selected ? tokens.colors.accentSubtle : tokens.colors.bgSurface,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        textAlign: 'center',
        minHeight: 44,
      }}
    >
      <Icon size={22} color={cfg.color} />
      <div style={{ fontWeight: 600, fontSize: 12, color: tokens.colors.text, textTransform: 'capitalize' }}>
        {level}
      </div>
      <div style={{ fontSize: 10, color: tokens.colors.textMuted, lineHeight: 1.3 }}>{cfg.desc}</div>
    </button>
  );
}
