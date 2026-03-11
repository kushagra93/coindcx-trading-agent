import { Zap, Pause } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function StatusHero() {
  const { agentStatus, toggleAgent, portfolio } = useApp();
  const running = agentStatus === 'running';

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(59,130,246,0) 60%)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: running ? '#22c55e' : '#64748b',
          boxShadow: running ? '0 0 8px #22c55e' : 'none',
          animation: running ? 'pulse 2s infinite' : 'none',
        }} />
        <span style={{ fontSize: 14, color: '#94a3b8' }}>
          {running ? 'Your AI Agent is Running' : 'Agent Paused'}
        </span>
        <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
      </div>

      {/* Portfolio stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Balance</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>${portfolio.totalValue.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Today</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: portfolio.todayPnl >= 0 ? '#22c55e' : '#ef4444' }}>
            {portfolio.todayPnl >= 0 ? '+' : ''}${portfolio.todayPnl.toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bots</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{portfolio.activeStrategies}</div>
        </div>
      </div>

      <button
        onClick={toggleAgent}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: 12,
          border: 'none',
          background: running ? 'rgba(239,68,68,0.15)' : '#3b82f6',
          color: running ? '#ef4444' : '#fff',
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
