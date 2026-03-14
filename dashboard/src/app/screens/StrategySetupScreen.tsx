import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { SliderInput } from '../components/SliderInput';
import { MobileButton } from '../components/MobileButton';
import { mobile } from '../styles/mobile';

const templateInfo: Record<string, { name: string; desc: string; risk: string }> = {
  dca: { name: 'Buy the Dip (DCA)', desc: 'Dollar-cost average into positions during pullbacks', risk: 'Low' },
  momentum: { name: 'Ride the Trend', desc: 'Follow momentum with trailing stops for protection', risk: 'Medium' },
  grid: { name: 'Range Trader (Grid)', desc: 'Buy low, sell high within a price range automatically', risk: 'Medium' },
  'mean-reversion': { name: 'Mean Reversion', desc: 'Trade reversions to moving averages', risk: 'Medium' },
};

const tokens = ['SOL', 'ETH', 'BTC', 'ARB', 'MATIC', 'AVAX'];

export function StrategySetupScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const templateId = params.get('template') ?? 'dca';
  const info = templateInfo[templateId] ?? templateInfo.dca;

  const [budget, setBudget] = useState(1000);
  const [aggressiveness, setAggressiveness] = useState(50);
  const [selectedToken, setSelectedToken] = useState('SOL');
  const [activated, setActivated] = useState(false);

  const handleActivate = () => {
    setActivated(true);
    setTimeout(() => navigate('/app/strategies'), 1200);
  };

  return (
    <div style={{ padding: mobile.screenPadding }}>
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, marginBottom: 16, cursor: 'pointer', padding: 0 }}
      >
        <ArrowLeft size={18} /> Back
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{info.name}</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{info.desc}</div>
      <div style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
        background: info.risk === 'Low' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
        color: info.risk === 'Low' ? '#22c55e' : '#eab308',
        marginBottom: 24,
      }}>
        {info.risk} Risk
      </div>

      {/* Token selection */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>Token</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tokens.map(t => (
            <button key={t} onClick={() => setSelectedToken(t)} style={{
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: selectedToken === t ? '#3b82f6' : '#1e293b',
              color: selectedToken === t ? '#fff' : '#94a3b8',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44,
            }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <SliderInput
        label="Budget"
        value={budget}
        min={100}
        max={50000}
        step={100}
        formatValue={v => `$${v.toLocaleString()}`}
        onChange={setBudget}
      />

      <SliderInput
        label="Aggressiveness"
        value={aggressiveness}
        min={0}
        max={100}
        formatValue={v => v <= 33 ? 'Conservative' : v <= 66 ? 'Moderate' : 'Aggressive'}
        onChange={setAggressiveness}
      />

      {/* Sim returns */}
      <div style={{
        background: '#111827', borderRadius: 12, padding: 16, marginBottom: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Estimated 90-day return (backtested)</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>
          +{Math.round(12 + (aggressiveness / 100) * 20)}%
        </div>
        <div style={{ fontSize: 10, color: '#64748b' }}>Past performance does not guarantee future results</div>
      </div>

      <MobileButton onClick={handleActivate} disabled={activated}>
        {activated ? 'Activated!' : <><Zap size={18} /> Activate Strategy</>}
      </MobileButton>
    </div>
  );
}
