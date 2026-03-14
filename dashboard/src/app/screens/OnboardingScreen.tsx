import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Shield, Zap, Users, Wallet } from 'lucide-react';
import { StepIndicator } from '../components/StepIndicator';
import { MobileButton } from '../components/MobileButton';
import { MobileCard } from '../components/MobileCard';
import { useApp } from '../context/AppContext';
import { tokens } from '../../styles/theme';
import { mobile } from '../styles/mobile';

const chains = ['solana', 'ethereum', 'polygon', 'arbitrum'];
const presets = [100, 500, 1000, 5000];

export function OnboardingScreen() {
  const navigate = useNavigate();
  const { setOnboarded } = useApp();
  const [step, setStep] = useState(0);
  const [risk, setRisk] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [selectedChain, setSelectedChain] = useState('solana');
  const [depositAmount, setDepositAmount] = useState(1000);
  const [path, setPath] = useState<'copy' | 'auto' | null>(null);

  const next = () => setStep(s => s + 1);
  const activate = () => {
    setOnboarded(true);
    navigate('/app/agent');
  };

  const riskConfigs = {
    conservative: { icon: Shield, color: tokens.colors.positive, desc: 'Steady growth, lower risk' },
    moderate: { icon: Zap, color: tokens.colors.warning, desc: 'Balanced risk & reward' },
    aggressive: { icon: Zap, color: tokens.colors.negative, desc: 'Higher returns, higher risk' },
  };

  return (
    <div style={{
      padding: mobile.screenPadding,
      paddingTop: mobile.safeTop + 16,
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: tokens.colors.bg,
    }}>
      <StepIndicator total={3} current={step} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {/* Step 0: Welcome + Risk Level */}
        {step === 0 && (
          <div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: 28,
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background: tokens.colors.accentSubtle,
                border: `2px solid ${tokens.colors.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Bot size={32} color={tokens.colors.accent} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: tokens.colors.text, marginBottom: 6, textAlign: 'center' }}>
                CoinDCX Trading Agent
              </div>
              <div style={{ fontSize: 13, color: tokens.colors.textSecondary, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
                An AI agent that screens tokens, manages risk, and trades 24/7 across 28 blockchains.
              </div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.text, marginBottom: 12, textAlign: 'center' }}>
              Choose your risk level
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
              {(['conservative', 'moderate', 'aggressive'] as const).map(lvl => {
                const cfg = riskConfigs[lvl];
                const selected = risk === lvl;
                return (
                  <button
                    key={lvl}
                    onClick={() => setRisk(lvl)}
                    style={{
                      flex: 1,
                      padding: 14,
                      borderRadius: tokens.radii.md,
                      border: selected ? `2px solid ${tokens.colors.accent}` : `1px solid ${tokens.colors.border}`,
                      background: selected ? tokens.colors.accentSubtle : tokens.colors.bgSurface,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 12, color: selected ? tokens.colors.accent : tokens.colors.text, textTransform: 'capitalize', marginBottom: 4 }}>
                      {lvl}
                    </div>
                    <div style={{ fontSize: 10, color: tokens.colors.textMuted, lineHeight: 1.3 }}>{cfg.desc}</div>
                  </button>
                );
              })}
            </div>

            <MobileButton onClick={next}>Continue</MobileButton>
          </div>
        )}

        {/* Step 1: Fund Your Agent */}
        {step === 1 && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
              <Wallet size={28} color={tokens.colors.accent} style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 20, fontWeight: 700, color: tokens.colors.text, marginBottom: 6, textAlign: 'center' }}>
                Fund Your Agent
              </div>
              <div style={{ fontSize: 13, color: tokens.colors.textSecondary, textAlign: 'center' }}>
                Choose a chain and amount to get started
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {chains.map(c => (
                <button key={c} onClick={() => setSelectedChain(c)} style={{
                  padding: '8px 14px',
                  borderRadius: tokens.radii.sm,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 500,
                  background: selectedChain === c ? tokens.colors.accent : tokens.colors.bgSurface,
                  color: selectedChain === c ? '#0a0a0a' : tokens.colors.textSecondary,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}>
                  {c}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {presets.map(p => (
                <button key={p} onClick={() => setDepositAmount(p)} style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: tokens.radii.sm,
                  border: 'none',
                  background: depositAmount === p ? tokens.colors.accent : tokens.colors.bgSurface,
                  color: depositAmount === p ? '#0a0a0a' : tokens.colors.textSecondary,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  ${p}
                </button>
              ))}
            </div>

            <MobileCard style={{ marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: tokens.colors.textMuted, marginBottom: 4 }}>
                Deposit address ({selectedChain})
              </div>
              <div style={{ fontSize: 12, fontFamily: tokens.fonts.mono, color: tokens.colors.textSecondary, wordBreak: 'break-all' }}>
                7xKQ...j4Pm
              </div>
            </MobileCard>

            <MobileButton onClick={next}>I've Deposited ${depositAmount}</MobileButton>
          </div>
        )}

        {/* Step 2: Choose Strategy + Activate */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: tokens.colors.text, marginBottom: 6, textAlign: 'center' }}>
              Choose Your Strategy
            </div>
            <div style={{ fontSize: 13, color: tokens.colors.textSecondary, marginBottom: 20, textAlign: 'center' }}>
              You can always change this later
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <MobileCard
                onClick={() => setPath('copy')}
                variant={path === 'copy' ? 'glow' : 'default'}
                style={{ cursor: 'pointer', textAlign: 'center', border: path === 'copy' ? `1px solid ${tokens.colors.accent}` : `1px solid ${tokens.colors.border}` }}
              >
                <Users size={24} color={tokens.colors.purple} style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: tokens.colors.text, marginBottom: 4 }}>Copy a Top Trader</div>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>Mirror trades from proven performers.</div>
              </MobileCard>

              <MobileCard
                onClick={() => setPath('auto')}
                variant={path === 'auto' ? 'glow' : 'default'}
                style={{ cursor: 'pointer', textAlign: 'center', border: path === 'auto' ? `1px solid ${tokens.colors.accent}` : `1px solid ${tokens.colors.border}` }}
              >
                <Bot size={24} color={tokens.colors.accent} style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, fontSize: 15, color: tokens.colors.text, marginBottom: 4 }}>Auto-Trade Templates</div>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>DCA, Momentum, Grid — pick and customize.</div>
              </MobileCard>
            </div>

            {/* Summary */}
            <MobileCard style={{ marginBottom: 20 }}>
              {[
                { label: 'Deposit', value: `$${depositAmount} on ${selectedChain}` },
                { label: 'Strategy', value: path === 'copy' ? 'Copy Trading' : path === 'auto' ? 'Auto-Trade' : 'Not selected' },
                { label: 'Risk', value: risk },
              ].map(row => (
                <div key={row.label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: `1px solid ${tokens.colors.border}`,
                }}>
                  <span style={{ fontSize: 12, color: tokens.colors.textMuted }}>{row.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: tokens.colors.text, textTransform: 'capitalize' }}>{row.value}</span>
                </div>
              ))}
            </MobileCard>

            <MobileButton onClick={activate} disabled={!path}>
              <Zap size={18} /> Activate Agent
            </MobileButton>
          </div>
        )}
      </div>
    </div>
  );
}
