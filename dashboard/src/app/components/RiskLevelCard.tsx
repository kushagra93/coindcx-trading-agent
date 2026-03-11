import { Shield, Scale, Flame } from 'lucide-react';

const configs = {
  conservative: { icon: Shield, color: '#22c55e', desc: 'Steady growth, lower risk' },
  moderate: { icon: Scale, color: '#eab308', desc: 'Balanced risk and reward' },
  aggressive: { icon: Flame, color: '#ef4444', desc: 'Higher returns, higher risk' },
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
        borderRadius: 14,
        border: selected ? `2px solid ${cfg.color}` : '1px solid #1e293b',
        background: selected ? `${cfg.color}10` : '#111827',
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
      <div style={{ fontWeight: 600, fontSize: 12, color: '#f1f5f9', textTransform: 'capitalize' }}>
        {level}
      </div>
      <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.3 }}>{cfg.desc}</div>
    </button>
  );
}
