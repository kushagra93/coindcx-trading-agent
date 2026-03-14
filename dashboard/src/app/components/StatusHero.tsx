import { Zap, Pause } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTradingData } from '../context/TradingDataContext';
import { tokens } from '../../styles/theme';

export function StatusHero() {
  const { agentStatus, toggleAgent } = useApp();
  const { portfolio } = useTradingData();
  const running = agentStatus === 'running';

  return (
    <div style={{
      background: `linear-gradient(135deg, rgba(212,168,83,0.12) 0%, rgba(212,168,83,0) 60%)`,
      borderRadius: tokens.radii.lg,
      padding: 20,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: running ? tokens.colors.accent : tokens.colors.textMuted,
          boxShadow: running ? `0 0 8px ${tokens.colors.accent}` : 'none',
          animation: running ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{ fontSize: 14, color: tokens.colors.textSecondary }}>
          {running ? 'Your AI Agent is Running' : 'Agent Paused'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: tokens.colors.text }}>${portfolio.totalValue.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: portfolio.todayPnl >= 0 ? tokens.colors.positive : tokens.colors.negative }}>
            {portfolio.todayPnl >= 0 ? '+' : ''}${portfolio.todayPnl.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bots</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: tokens.colors.text }}>{portfolio.activeStrategies}</div>
        </div>
      </div>

      <button
        onClick={toggleAgent}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: tokens.radii.md,
          border: 'none',
          background: running ? tokens.colors.negativeBg : tokens.colors.accent,
          color: running ? tokens.colors.negative : '#0a0a0a',
          fontSize: 14,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
      >
        {running ? <><Pause size={16} /> Stop Agent</> : <><Zap size={16} /> Start Agent</>}
      </button>
    </div>
  );
}
