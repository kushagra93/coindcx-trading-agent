import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Trophy, Users, TrendingUp, Shield, Copy } from 'lucide-react';
import { tokens } from '../styles/theme';

const mockTraders = [
  { id: 'l1', name: 'CryptoWhale_42', pnl30d: 32.5, pnl90d: 87.2, winRate: 78, maxDrawdown: -8.2, copiers: 1243, aum: 2450000, sharpe: 2.8, chains: ['solana', 'ethereum'] },
  { id: 'l2', name: 'SolanaAlpha', pnl30d: 28.1, pnl90d: 64.5, winRate: 71, maxDrawdown: -12.4, copiers: 876, aum: 1800000, sharpe: 2.3, chains: ['solana'] },
  { id: 'l3', name: 'DeFiSage', pnl30d: 18.7, pnl90d: 45.3, winRate: 65, maxDrawdown: -15.1, copiers: 654, aum: 950000, sharpe: 1.9, chains: ['ethereum', 'arbitrum'] },
  { id: 'l4', name: 'PerpKing', pnl30d: 45.2, pnl90d: 92.1, winRate: 62, maxDrawdown: -22.3, copiers: 432, aum: 680000, sharpe: 1.7, chains: ['hyperliquid'] },
  { id: 'l5', name: 'GridMaster', pnl30d: 12.3, pnl90d: 38.7, winRate: 82, maxDrawdown: -5.8, copiers: 321, aum: 520000, sharpe: 2.1, chains: ['ethereum', 'polygon'] },
  { id: 'l6', name: 'MomentumX', pnl30d: 22.8, pnl90d: 55.4, winRate: 68, maxDrawdown: -18.5, copiers: 289, aum: 410000, sharpe: 1.5, chains: ['solana', 'ethereum'] },
];

export function LeaderboardPage() {
  const [selectedTrader, setSelectedTrader] = useState<typeof mockTraders[0] | null>(null);
  const [copyBudget, setCopyBudget] = useState('1000');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Leaderboard</h1>
          <p style={{ color: tokens.colors.textMuted, fontSize: 13, marginTop: 4 }}>
            Copy top traders with one click. Ranked by Sharpe ratio.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedTrader ? '1fr 360px' : '1fr', gap: 16 }}>
        {/* Leaderboard Table */}
        <Card style={{ padding: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${tokens.colors.border}` }}>
                {['#', 'Trader', 'Sharpe', '30d P&L', '90d P&L', 'Win Rate', 'Max DD', 'Copiers', 'AUM', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, color: tokens.colors.textMuted, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockTraders.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedTrader(t)}
                  style={{
                    borderBottom: `1px solid ${tokens.colors.bg}`,
                    cursor: 'pointer',
                    background: selectedTrader?.id === t.id ? tokens.colors.bgInput : undefined,
                  }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    {i < 3 ? (
                      <Trophy size={16} color={i === 0 ? tokens.colors.warning : i === 1 ? tokens.colors.textSecondary : '#cd7f32'} />
                    ) : (
                      <span style={{ color: tokens.colors.textMuted }}>{i + 1}</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: tokens.colors.textMuted, display: 'flex', gap: 4, marginTop: 2 }}>
                      {t.chains.map(c => <Badge key={c} color="blue">{c}</Badge>)}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: tokens.colors.purple, fontFamily: tokens.fonts.mono }}>{t.sharpe.toFixed(1)}</td>
                  <td style={{ padding: '12px 16px', color: tokens.colors.positive, fontWeight: 600, fontFamily: tokens.fonts.mono }}>+{t.pnl30d}%</td>
                  <td style={{ padding: '12px 16px', color: tokens.colors.positive, fontWeight: 600, fontFamily: tokens.fonts.mono }}>+{t.pnl90d}%</td>
                  <td style={{ padding: '12px 16px', fontFamily: tokens.fonts.mono }}>{t.winRate}%</td>
                  <td style={{ padding: '12px 16px', color: tokens.colors.negative, fontFamily: tokens.fonts.mono }}>{t.maxDrawdown}%</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} color={tokens.colors.textMuted} /> {t.copiers.toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: tokens.colors.textMuted, fontFamily: tokens.fonts.mono }}>${(t.aum / 1000000).toFixed(1)}M</td>
                  <td style={{ padding: '12px 16px' }}>
                    <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedTrader(t); }}>
                      <Copy size={12} /> Copy
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Copy Panel */}
        {selectedTrader && (
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedTrader.name}</div>
                <div style={{ fontSize: 12, color: tokens.colors.textMuted, marginTop: 2 }}>Sharpe: {selectedTrader.sharpe.toFixed(1)}</div>
              </div>
              <button
                onClick={() => setSelectedTrader(null)}
                style={{ background: 'none', border: 'none', color: tokens.colors.textMuted, padding: 4 }}
              >
                x
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: '30d P&L', value: `+${selectedTrader.pnl30d}%`, color: tokens.colors.positive },
                { label: '90d P&L', value: `+${selectedTrader.pnl90d}%`, color: tokens.colors.positive },
                { label: 'Win Rate', value: `${selectedTrader.winRate}%`, color: tokens.colors.text },
                { label: 'Max DD', value: `${selectedTrader.maxDrawdown}%`, color: tokens.colors.negative },
              ].map(s => (
                <div key={s.label} style={{ background: tokens.colors.bg, borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 11, color: tokens.colors.textMuted }}>{s.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: tokens.fonts.mono }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Copy Form */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: tokens.colors.textSecondary, display: 'block', marginBottom: 6 }}>
                Budget (USD)
              </label>
              <input
                type="number"
                value={copyBudget}
                onChange={e => setCopyBudget(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: `1px solid ${tokens.colors.border}`,
                  background: tokens.colors.bgInput,
                  color: tokens.colors.text,
                  fontSize: 14,
                  fontFamily: tokens.fonts.mono,
                }}
              />
            </div>

            <div style={{ fontSize: 11, color: tokens.colors.textMuted, marginBottom: 16 }}>
              Fee: 10% profit share (no per-trade fee). Auto-stops if trader's 30d return drops below -15%.
            </div>

            <Button style={{ width: '100%', justifyContent: 'center' }}>
              <Copy size={14} /> Start Copying
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
