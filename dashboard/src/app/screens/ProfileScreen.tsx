import { useState } from 'react';
import { Shield, Wallet, Bell, Power, User } from 'lucide-react';
import { MobileCard } from '../components/MobileCard';
import { MobileButton } from '../components/MobileButton';
import { SliderInput } from '../components/SliderInput';
import { useApp } from '../context/AppContext';
import { useTradingData } from '../context/TradingDataContext';
import { tokens } from '../../styles/theme';
import { mobile } from '../styles/mobile';

const wallets = [
  { chain: 'Solana', balance: '$4,200', address: '7xKQ...j4Pm' },
  { chain: 'Ethereum', balance: '$3,800', address: '0x1a2...9f3c' },
  { chain: 'Hyperliquid', balance: '$1,500', address: '0x8b7...2e1d' },
];

export function ProfileScreen() {
  const { agentStatus, toggleAgent } = useApp();
  const { strategies } = useTradingData();
  const [risk, setRisk] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [dailyLimit, setDailyLimit] = useState(10);
  const [notifTrades, setNotifTrades] = useState(true);
  const [notifPnl, setNotifPnl] = useState(true);
  const [notifAlerts, setNotifAlerts] = useState(false);

  const riskConfigs = {
    conservative: { color: tokens.colors.positive, desc: 'Steady growth, lower risk' },
    moderate: { color: tokens.colors.warning, desc: 'Balanced risk and reward' },
    aggressive: { color: tokens.colors.negative, desc: 'Higher returns, higher risk' },
  };

  return (
    <div style={{ overflow: 'auto', height: '100%', scrollbarWidth: 'none' }}>
      <div style={{ padding: `0 ${mobile.screenPadding}px`, paddingBottom: 24 }}>
        {/* User identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0 20px' }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: tokens.radii.lg,
            background: tokens.colors.accentSubtle,
            border: `2px solid ${tokens.colors.accent}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <User size={22} color={tokens.colors.accent} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: tokens.colors.text }}>Trader</div>
            <div style={{ fontSize: 12, color: tokens.colors.textMuted }}>
              Agent {agentStatus === 'running' ? 'Active' : 'Inactive'}
            </div>
          </div>
        </div>

        {/* Risk Settings */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Shield size={16} color={tokens.colors.accent} />
            <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.text }}>Risk Level</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {(['conservative', 'moderate', 'aggressive'] as const).map(lvl => {
              const cfg = riskConfigs[lvl];
              const selected = risk === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => setRisk(lvl)}
                  style={{
                    flex: 1,
                    padding: '12px 4px',
                    borderRadius: tokens.radii.md,
                    border: selected ? `2px solid ${tokens.colors.accent}` : `1px solid ${tokens.colors.border}`,
                    background: selected ? tokens.colors.accentSubtle : tokens.colors.bgSurface,
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 12, color: selected ? tokens.colors.accent : tokens.colors.text, textTransform: 'capitalize', marginBottom: 2 }}>
                    {lvl}
                  </div>
                  <div style={{ fontSize: 9, color: tokens.colors.textMuted }}>{cfg.desc}</div>
                </button>
              );
            })}
          </div>
          <SliderInput
            label="Daily Loss Limit"
            value={dailyLimit}
            min={1}
            max={25}
            formatValue={v => `${v}%`}
            onChange={setDailyLimit}
          />
        </div>

        {/* Active Strategies */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.text, marginBottom: 12 }}>Active Strategies</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {strategies.map(s => (
              <MobileCard key={s.id} style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: tokens.colors.text }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: tokens.colors.textMuted, marginTop: 1 }}>{s.desc}</div>
                  </div>
                  <div style={{
                    padding: '2px 8px',
                    borderRadius: tokens.radii.sm,
                    fontSize: 10,
                    fontWeight: 600,
                    background: s.active ? tokens.colors.positiveBg : tokens.colors.bgInput,
                    color: s.active ? tokens.colors.positive : tokens.colors.textMuted,
                  }}>
                    {s.active ? 'Active' : 'Off'}
                  </div>
                </div>
              </MobileCard>
            ))}
          </div>
        </div>

        {/* Wallets */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Wallet size={16} color={tokens.colors.positive} />
            <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.text }}>Wallets</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {wallets.map(w => (
              <MobileCard key={w.chain} style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: tokens.colors.text }}>{w.chain}</div>
                    <div style={{ fontSize: 11, color: tokens.colors.textMuted, fontFamily: tokens.fonts.mono }}>{w.address}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, fontFamily: tokens.fonts.mono, color: tokens.colors.text }}>{w.balance}</div>
                </div>
              </MobileCard>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Bell size={16} color={tokens.colors.warning} />
            <span style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.text }}>Notifications</span>
          </div>
          {[
            { label: 'Trade Executions', value: notifTrades, set: setNotifTrades },
            { label: 'Daily P&L Summary', value: notifPnl, set: setNotifPnl },
            { label: 'Risk Alerts', value: notifAlerts, set: setNotifAlerts },
          ].map(item => (
            <div key={item.label} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: `1px solid ${tokens.colors.border}`,
            }}>
              <span style={{ fontSize: 13, color: tokens.colors.text }}>{item.label}</span>
              <button
                onClick={() => item.set(!item.value)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  border: 'none',
                  cursor: 'pointer',
                  background: item.value ? tokens.colors.accent : tokens.colors.bgInput,
                  position: 'relative',
                  transition: `background ${tokens.transitions.normal}`,
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  background: '#fff',
                  position: 'absolute',
                  top: 2,
                  left: item.value ? 22 : 2,
                  transition: `left ${tokens.transitions.normal}`,
                }} />
              </button>
            </div>
          ))}
        </div>

        {/* Agent button */}
        <MobileButton variant={agentStatus === 'running' ? 'danger' : 'primary'} onClick={toggleAgent}>
          <Power size={18} /> {agentStatus === 'running' ? 'Stop Agent' : 'Start Agent'}
        </MobileButton>
      </div>
    </div>
  );
}
