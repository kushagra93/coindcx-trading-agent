import { useState } from 'react';
import { Shield, Wallet, Bell, Power } from 'lucide-react';
import { MobileCard } from '../components/MobileCard';
import { MobileButton } from '../components/MobileButton';
import { SliderInput } from '../components/SliderInput';
import { useApp } from '../context/AppContext';
import { mobile } from '../styles/mobile';

const wallets = [
  { chain: 'Solana', balance: '$4,200', address: '7xKQ...j4Pm' },
  { chain: 'Ethereum', balance: '$3,800', address: '0x1a2...9f3c' },
  { chain: 'Hyperliquid', balance: '$1,500', address: '0x8b7...2e1d' },
];

export function ProfileScreen() {
  const { agentStatus, toggleAgent } = useApp();
  const [risk, setRisk] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [dailyLimit, setDailyLimit] = useState(10);
  const [notifTrades, setNotifTrades] = useState(true);
  const [notifPnl, setNotifPnl] = useState(true);
  const [notifAlerts, setNotifAlerts] = useState(false);

  return (
    <div style={{ padding: mobile.screenPadding }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Profile</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Settings & wallet</div>

      {/* Risk Settings */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Shield size={16} color="#3b82f6" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Risk Settings</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['conservative', 'moderate', 'aggressive'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setRisk(lvl)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                background: risk === lvl ? '#3b82f6' : '#1e293b',
                color: risk === lvl ? '#fff' : '#94a3b8',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {lvl}
            </button>
          ))}
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

      {/* Wallets */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Wallet size={16} color="#22c55e" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Wallets</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {wallets.map(w => (
            <MobileCard key={w.chain}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{w.chain}</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{w.address}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{w.balance}</div>
              </div>
            </MobileCard>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Bell size={16} color="#eab308" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Notifications</span>
        </div>
        {[
          { label: 'Trade Executions', value: notifTrades, set: setNotifTrades },
          { label: 'Daily P&L Summary', value: notifPnl, set: setNotifPnl },
          { label: 'Risk Alerts', value: notifAlerts, set: setNotifAlerts },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #1e293b' }}>
            <span style={{ fontSize: 13 }}>{item.label}</span>
            <button
              onClick={() => item.set(!item.value)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: item.value ? '#3b82f6' : '#334155',
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 10, background: '#fff',
                position: 'absolute', top: 2,
                left: item.value ? 22 : 2,
                transition: 'left 0.2s',
              }} />
            </button>
          </div>
        ))}
      </div>

      {/* Stop Agent */}
      <MobileButton variant={agentStatus === 'running' ? 'danger' : 'primary'} onClick={toggleAgent}>
        <Power size={18} /> {agentStatus === 'running' ? 'Stop Agent' : 'Start Agent'}
      </MobileButton>
    </div>
  );
}
