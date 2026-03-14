import { tokens } from '../../styles/theme';

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (v: number) => string;
  onChange: (v: number) => void;
}

export function SliderInput({ label, value, min, max, step = 1, formatValue, onChange }: SliderInputProps) {
  const display = formatValue ? formatValue(value) : String(value);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: tokens.colors.textSecondary }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: tokens.fonts.mono }}>{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: tokens.colors.accent }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tokens.colors.textMuted, marginTop: 4 }}>
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
}
