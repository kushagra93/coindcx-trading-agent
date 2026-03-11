import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Clock, Shield, Users, Zap } from 'lucide-react';
import { StepIndicator } from '../components/StepIndicator';
import { CarouselSlide } from '../components/CarouselSlide';
import { RiskLevelCard } from '../components/RiskLevelCard';
import { MobileButton } from '../components/MobileButton';
import { MobileCard } from '../components/MobileCard';
import { useApp } from '../context/AppContext';
import { mobile } from '../styles/mobile';

const slides = [
  { icon: <Bot size={36} color="#3b82f6" />, title: 'Meet Your AI Agent', description: 'An intelligent trading agent that executes strategies on your behalf across Solana, Ethereum, and Hyperliquid.' },
  { icon: <Clock size={36} color="#3b82f6" />, title: 'Trades 24/7', description: 'Never miss an opportunity. Your agent monitors markets and executes trades around the clock.' },
  { icon: <Shield size={36} color="#3b82f6" />, title: 'You Stay in Control', description: 'Set risk limits, pause anytime, and track every trade with full transparency.' },
];

const chains = ['solana', 'ethereum', 'polygon', 'arbitrum'];
const presets = [100, 500, 1000, 5000];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const { setOnboarded } = useApp();
  const [step, setStep] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [selectedChain, setSelectedChain] = useState('solana');
  const [depositAmount, setDepositAmount] = useState(1000);
  const [path, setPath] = useState<'copy' | 'auto' | null>(null);
  const [risk, setRisk] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');

  const next = () => setStep(s => s + 1);
  const activate = () => {
    setOnboarded(true);
    navigate('/app/home');
  };

  return (
    <div style={{ padding: mobile.screenPadding, paddingTop: mobile.safeTop + 16, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <StepIndicator total={5} current={step} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Step 0: Welcome */}
        {step === 0 && (
          <div>
            <CarouselSlide {...slides[slideIdx]} />
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16, marginBottom: 24 }}>
              {slides.map((_, i) => (
                <button key={i} onClick={() => setSlideIdx(i)} style={{
                  width: i === slideIdx ? 20 : 6, height: 6, borderRadius: 3,
                  background: i === slideIdx ? '#3b82f6' : '#334155',
                  border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                }} />
              ))}
            </div>
            <MobileButton onClick={next}>Get Started</MobileButton>
          </div>
        )}

        {/* Step 1: Deposit */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>Deposit Funds</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center' }}>Choose a chain and amount to get started</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {chains.map(c => (
                <button key={c} onClick={() => setSelectedChain(c)} style={{
                  padding: '8px 14px', borderRadius: 10, border: 'none', fontSize: 12, fontWeight: 500,
                  background: selectedChain === c ? '#3b82f6' : '#1e293b',
                  color: selectedChain === c ? '#fff' : '#94a3b8',
                  cursor: 'pointer', textTransform: 'capitalize',
                }}>
                  {c}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {presets.map(p => (
                <button key={p} onClick={() => setDepositAmount(p)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                  background: depositAmount === p ? '#3b82f6' : '#1e293b',
                  color: depositAmount === p ? '#fff' : '#94a3b8',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  ${p}
                </button>
              ))}
            </div>

            <MobileCard style={{ marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Deposit address ({selectedChain})</div>
              <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8', wordBreak: 'break-all' }}>
                7xKQ...j4Pm
              </div>
            </MobileCard>

            <MobileButton onClick={next}>I've Deposited ${depositAmount}</MobileButton>
          </div>
        )}

        {/* Step 2: Choose path */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>How do you want to trade?</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center' }}>You can always change this later</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <MobileCard
                onClick={() => { setPath('copy'); next(); }}
                style={{ border: path === 'copy' ? '2px solid #a855f7' : '1px solid #1e293b', cursor: 'pointer', textAlign: 'center' }}
              >
                <Users size={28} color="#a855f7" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Copy a Top Trader</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Mirror trades from proven performers. Hands-off.</div>
              </MobileCard>

              <MobileCard
                onClick={() => { setPath('auto'); next(); }}
                style={{ border: path === 'auto' ? '2px solid #3b82f6' : '1px solid #1e293b', cursor: 'pointer', textAlign: 'center' }}
              >
                <Bot size={28} color="#3b82f6" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Auto-Trade Templates</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>DCA, Momentum, Grid — pick a strategy and customize.</div>
              </MobileCard>
            </div>
          </div>
        )}

        {/* Step 3: Risk */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>Set Your Risk Level</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center' }}>Controls position sizes and stop losses</div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {(['conservative', 'moderate', 'aggressive'] as const).map(lvl => (
                <RiskLevelCard key={lvl} level={lvl} selected={risk === lvl} onSelect={() => setRisk(lvl)} />
              ))}
            </div>

            <MobileButton onClick={next}>Continue</MobileButton>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>Ready to Launch</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20, textAlign: 'center' }}>Review your setup</div>

            <MobileCard style={{ marginBottom: 16 }}>
              {[
                { label: 'Deposit', value: `$${depositAmount} on ${selectedChain}` },
                { label: 'Strategy', value: path === 'copy' ? 'Copy Trading' : 'Auto-Trade' },
                { label: 'Risk', value: risk },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>{row.value}</span>
                </div>
              ))}
            </MobileCard>

            <MobileButton onClick={activate}>
              <Zap size={18} /> Activate Agent
            </MobileButton>
          </div>
        )}
      </div>
    </div>
  );
}
