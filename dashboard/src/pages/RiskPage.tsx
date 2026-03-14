import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Shield, AlertTriangle, Info } from 'lucide-react';
import { tokens } from '../styles/theme';

export function RiskPage() {
  const [riskLevel, setRiskLevel] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [dailyLossLimit, setDailyLossLimit] = useState(5000);
  const [maxPerTrade, setMaxPerTrade] = useState(10);
  const [saved, setSaved] = useState(false);

  const riskDescriptions = {
    conservative: 'Lower position sizes, tighter stops, low leverage. Best for capital preservation.',
    moderate: 'Balanced risk/reward. Standard position sizing with moderate stops.',
    aggressive: 'Larger positions, wider stops, higher potential returns with higher risk.',
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Risk Settings</h1>
      <p style={{ color: tokens.colors.textMuted, fontSize: 13, marginBottom: 24 }}>Control your risk exposure. These settings apply to all strategies.</p>

      {/* Risk Level */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Shield size={18} color={tokens.colors.accent} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Risk Level</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
          {(['conservative', 'moderate', 'aggressive'] as const).map(level => (
            <button
              key={level}
              onClick={() => setRiskLevel(level)}
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: riskLevel === level ? `2px solid ${tokens.colors.accent}` : `1px solid ${tokens.colors.border}`,
                background: riskLevel === level ? tokens.colors.accentSubtle : tokens.colors.bg,
                color: riskLevel === level ? tokens.colors.text : tokens.colors.textSecondary,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{
                fontWeight: 600, fontSize: 13, textTransform: 'capitalize',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: level === 'conservative' ? tokens.colors.positive : level === 'moderate' ? tokens.colors.warning : tokens.colors.negative,
                }} />
                {level}
              </div>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: tokens.colors.textMuted, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <Info size={14} style={{ marginTop: 1, flexShrink: 0 }} />
          {riskDescriptions[riskLevel]}
        </div>
      </Card>

      {/* Daily Loss Limit */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <AlertTriangle size={18} color={tokens.colors.warning} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Daily Loss Limit</div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>Stop trading if daily losses exceed:</span>
            <span style={{ fontWeight: 700, fontSize: 16, fontFamily: tokens.fonts.mono }}>${dailyLossLimit.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={100}
            max={50000}
            step={100}
            value={dailyLossLimit}
            onChange={e => setDailyLossLimit(Number(e.target.value))}
            style={{ width: '100%', accentColor: tokens.colors.accent }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tokens.colors.textMuted, marginTop: 4 }}>
            <span>$100</span>
            <span>$50,000</span>
          </div>
        </div>
      </Card>

      {/* Max Per Trade */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Shield size={18} color={tokens.colors.purple} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Max Per Trade</div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>Maximum portfolio % per single trade:</span>
            <span style={{ fontWeight: 700, fontSize: 16, fontFamily: tokens.fonts.mono }}>{maxPerTrade}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={25}
            step={1}
            value={maxPerTrade}
            onChange={e => setMaxPerTrade(Number(e.target.value))}
            style={{ width: '100%', accentColor: tokens.colors.purple }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: tokens.colors.textMuted, marginTop: 4 }}>
            <span>1%</span>
            <span>25%</span>
          </div>
        </div>
      </Card>

      {/* Circuit Breaker Status */}
      <Card style={{ marginBottom: 24, borderColor: tokens.colors.border }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Circuit Breaker</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>Status</div>
            <Badge color="green">Normal</Badge>
          </div>
          <div>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>Hourly Loss</div>
            <div style={{ fontWeight: 600, fontFamily: tokens.fonts.mono }}>$0.00 / $5,000</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>Auto-halt threshold</div>
            <div style={{ fontWeight: 600 }}>5% portfolio in 1 hour</div>
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} size="lg" style={{ width: '100%', justifyContent: 'center' }}>
        {saved ? 'Saved!' : 'Save Risk Settings'}
      </Button>
    </div>
  );
}
