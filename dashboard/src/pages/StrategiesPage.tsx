import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Plus, Play, Pause, Trash2, Settings } from 'lucide-react';
import { tokens } from '../styles/theme';

interface Template {
  id: string;
  name: string;
  description: string;
  risk: 'low' | 'medium' | 'high';
  type: string;
  sim90d: string;
}

const templates: Template[] = [
  { id: 'dca', name: 'Buy the Dip (DCA)', description: 'Dollar-cost average into positions during pullbacks', risk: 'low', type: 'DEX Spot', sim90d: '+12%' },
  { id: 'momentum', name: 'Ride the Trend', description: 'Follow momentum with trailing stops for protection', risk: 'medium', type: 'DEX Spot', sim90d: '+28%' },
  { id: 'grid', name: 'Range Trader (Grid)', description: 'Buy low, sell high within a price range automatically', risk: 'medium', type: 'HL Perps', sim90d: '+18%' },
  { id: 'mean-reversion', name: 'Mean Reversion', description: 'Trade reversions to moving averages on overbought/oversold', risk: 'medium', type: 'DEX Spot', sim90d: '+15%' },
];

interface ActiveStrategy {
  id: string;
  template: string;
  token: string;
  chain: string;
  budget: number;
  status: 'running' | 'paused';
  pnl: number;
  trades: number;
}

const activeStrategies: ActiveStrategy[] = [
  { id: 's1', template: 'DCA', token: 'ETH', chain: 'ethereum', budget: 5000, status: 'running', pnl: 387.5, trades: 12 },
  { id: 's2', template: 'Momentum', token: 'SOL', chain: 'solana', budget: 2500, status: 'running', pnl: 251, trades: 8 },
  { id: 's3', template: 'Grid', token: 'BTC-PERP', chain: 'hyperliquid', budget: 3000, status: 'paused', pnl: -120, trades: 24 },
];

export function StrategiesPage() {
  const [showTemplates, setShowTemplates] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Strategies</h1>
          <p style={{ color: tokens.colors.textMuted, fontSize: 13, marginTop: 4 }}>Manage your auto-trading strategies</p>
        </div>
        <Button onClick={() => setShowTemplates(!showTemplates)}>
          <Plus size={16} /> New Strategy
        </Button>
      </div>

      {/* Strategy Templates */}
      {showTemplates && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Choose a Template</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {templates.map(t => (
              <Card key={t.id} hoverable onClick={() => setShowTemplates(false)} style={{ cursor: 'pointer' }}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: tokens.colors.textMuted, lineHeight: 1.4 }}>{t.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <Badge color={t.risk === 'low' ? 'green' : t.risk === 'medium' ? 'yellow' : 'red'}>
                    {t.risk} risk
                  </Badge>
                  <Badge color="blue">{t.type}</Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, color: tokens.colors.textMuted }}>Sim. 90d return</div>
                  <div style={{ fontWeight: 700, color: tokens.colors.positive, fontFamily: tokens.fonts.mono }}>{t.sim90d}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Strategies */}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Active Strategies ({activeStrategies.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeStrategies.map(s => (
          <Card key={s.id} hoverable>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: s.status === 'running' ? tokens.colors.positiveBg : tokens.colors.bgInput,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.status === 'running'
                    ? <Play size={20} color={tokens.colors.positive} />
                    : <Pause size={20} color={tokens.colors.textMuted} />
                  }
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{s.template}</span>
                    <Badge color={s.status === 'running' ? 'green' : 'yellow'}>{s.status}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 2 }}>
                    {s.token} on {s.chain} · {s.trades} trades executed
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: tokens.colors.textMuted }}>Budget</div>
                  <div style={{ fontWeight: 600, fontFamily: tokens.fonts.mono }}>${s.budget.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontSize: 11, color: tokens.colors.textMuted }}>P&L</div>
                  <div style={{
                    fontWeight: 700, fontFamily: tokens.fonts.mono,
                    color: s.pnl >= 0 ? tokens.colors.positive : tokens.colors.negative,
                  }}>
                    {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button variant="ghost" size="sm">
                    {s.status === 'running' ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                  <Button variant="ghost" size="sm"><Settings size={14} /></Button>
                  <Button variant="ghost" size="sm" style={{ color: tokens.colors.negative }}><Trash2 size={14} /></Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
