import { useNavigate } from 'react-router-dom';
import { Play, Pause } from 'lucide-react';
import { StrategyTemplateCard } from '../components/StrategyTemplateCard';
import { MobileCard } from '../components/MobileCard';
import { mobile } from '../styles/mobile';

const templates = [
  { id: 'dca', name: 'DCA', risk: 'low' as const, sim90d: '+12%', icon: '📈' },
  { id: 'momentum', name: 'Momentum', risk: 'medium' as const, sim90d: '+28%', icon: '🚀' },
  { id: 'grid', name: 'Grid', risk: 'medium' as const, sim90d: '+18%', icon: '📊' },
  { id: 'mean-reversion', name: 'Reversal', risk: 'medium' as const, sim90d: '+15%', icon: '🔄' },
];

const activeStrategies = [
  { id: 's1', name: 'DCA', token: 'ETH', chain: 'ethereum', status: 'running' as const, pnl: 387.5, trades: 12 },
  { id: 's2', name: 'Momentum', token: 'SOL', chain: 'solana', status: 'running' as const, pnl: 251, trades: 8 },
  { id: 's3', name: 'Grid', token: 'BTC-PERP', chain: 'hyperliquid', status: 'paused' as const, pnl: -120, trades: 24 },
];

export function StrategyListScreen() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: mobile.screenPadding }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Strategies</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Your bots and templates</div>

      {/* Templates */}
      <div style={{ marginBottom: mobile.sectionGap }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Templates</div>
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {templates.map(t => (
            <StrategyTemplateCard key={t.id} template={t} onClick={() => navigate(`/app/strategies/new?template=${t.id}`)} />
          ))}
        </div>
      </div>

      {/* Active */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Active ({activeStrategies.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {activeStrategies.map(s => (
            <MobileCard key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: s.status === 'running' ? 'rgba(34,197,94,0.1)' : '#1e293b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {s.status === 'running' ? <Play size={16} color="#22c55e" /> : <Pause size={16} color="#64748b" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{s.token} · {s.chain} · {s.trades} trades</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: s.pnl >= 0 ? '#22c55e' : '#ef4444' }}>
                    {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(0)}
                  </div>
                  <div style={{
                    fontSize: 10, padding: '2px 6px', borderRadius: 4,
                    background: s.status === 'running' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                    color: s.status === 'running' ? '#22c55e' : '#eab308',
                    fontWeight: 600, display: 'inline-block',
                  }}>
                    {s.status}
                  </div>
                </div>
              </div>
            </MobileCard>
          ))}
        </div>
      </div>
    </div>
  );
}
