import { tokens } from '../../styles/theme';

interface Template {
  id: string;
  name: string;
  risk: 'low' | 'medium' | 'high';
  sim90d: string;
  icon: string;
}

export function StrategyTemplateCard({ template, onClick }: { template: Template; onClick: () => void }) {
  const riskColor = template.risk === 'low' ? tokens.colors.positive : template.risk === 'medium' ? tokens.colors.warning : tokens.colors.negative;

  return (
    <div
      onClick={onClick}
      style={{
        minWidth: 150,
        padding: 14,
        background: tokens.colors.bgSurface,
        borderRadius: tokens.radii.lg,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 8 }}>{template.icon}</div>
      <div style={{ fontWeight: 600, fontSize: 14, color: tokens.colors.text, marginBottom: 4 }}>{template.name}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: riskColor }} />
        <span style={{ fontSize: 11, color: tokens.colors.textMuted, textTransform: 'capitalize' }}>{template.risk} risk</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: tokens.colors.positive }}>{template.sim90d}</div>
      <div style={{ fontSize: 10, color: tokens.colors.textMuted }}>Sim. 90d</div>
    </div>
  );
}
