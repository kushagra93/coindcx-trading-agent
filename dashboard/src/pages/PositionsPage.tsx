import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { TrendingUp, TrendingDown, X } from 'lucide-react';

const mockPositions = [
  { id: '1', token: 'SOL', chain: 'solana', side: 'long', entryPrice: 142.5, currentPrice: 156.8, pnlPct: 10.04, pnlUsd: 251, sizeUsd: 2500, qty: '17.54', strategy: 'Momentum', openedAt: '2 days ago' },
  { id: '2', token: 'ETH', chain: 'ethereum', side: 'long', entryPrice: 3200, currentPrice: 3450, pnlPct: 7.81, pnlUsd: 390.5, sizeUsd: 5000, qty: '1.5625', strategy: 'DCA', openedAt: '5 days ago' },
  { id: '3', token: 'ARB', chain: 'arbitrum', side: 'short', entryPrice: 1.25, currentPrice: 1.18, pnlPct: 5.6, pnlUsd: 67.2, sizeUsd: 1200, qty: '960', strategy: 'Copy Trade', openedAt: '1 day ago' },
  { id: '4', token: 'MATIC', chain: 'polygon', side: 'long', entryPrice: 0.85, currentPrice: 0.79, pnlPct: -7.06, pnlUsd: -56.48, sizeUsd: 800, qty: '941.18', strategy: 'Grid', openedAt: '3 days ago' },
  { id: '5', token: 'BTC-PERP', chain: 'hyperliquid', side: 'long', entryPrice: 67200, currentPrice: 68950, pnlPct: 2.6, pnlUsd: 175, sizeUsd: 3000, qty: '0.0446', strategy: 'Momentum', openedAt: '12 hrs ago' },
];

const mockClosedPositions = [
  { id: 'c1', token: 'AVAX', chain: 'ethereum', side: 'long', entryPrice: 35.2, closePrice: 38.1, pnlPct: 8.24, pnlUsd: 82.4, sizeUsd: 1000, closedAt: '1 day ago' },
  { id: 'c2', token: 'DOGE', chain: 'solana', side: 'long', entryPrice: 0.12, closePrice: 0.108, pnlPct: -10, pnlUsd: -60, sizeUsd: 600, closedAt: '2 days ago' },
];

export function PositionsPage() {
  const [tab, setTab] = useState<'open' | 'closed'>('open');

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Positions</h1>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>Track your open and closed positions</p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#111827', borderRadius: 8, padding: 4, width: 'fit-content' }}>
        {(['open', 'closed'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: 'none',
              background: tab === t ? '#1e293b' : 'transparent',
              color: tab === t ? '#f1f5f9' : '#64748b',
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              textTransform: 'capitalize',
            }}
          >
            {t} ({t === 'open' ? mockPositions.length : mockClosedPositions.length})
          </button>
        ))}
      </div>

      {tab === 'open' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mockPositions.map(pos => (
            <Card key={pos.id} hoverable>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    background: '#1e293b', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, fontSize: 13,
                  }}>
                    {pos.token.slice(0, 3)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{pos.token}</span>
                      <Badge color={pos.side === 'long' ? 'green' : 'red'}>{pos.side}</Badge>
                      <Badge color="blue">{pos.chain}</Badge>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Strategy: {pos.strategy} · Opened {pos.openedAt} · Qty: {pos.qty}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Entry / Current</div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>
                      ${pos.entryPrice.toLocaleString()} / ${pos.currentPrice.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Size</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>${pos.sizeUsd.toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 80 }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>P&L</div>
                    <div style={{
                      fontSize: 15, fontWeight: 700,
                      color: pos.pnlPct >= 0 ? '#22c55e' : '#ef4444',
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                    }}>
                      {pos.pnlPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 12, color: pos.pnlUsd >= 0 ? '#22c55e' : '#ef4444' }}>
                      {pos.pnlUsd >= 0 ? '+' : ''}${pos.pnlUsd.toFixed(2)}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <X size={14} /> Close
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Token', 'Side', 'Entry', 'Close', 'Size', 'P&L', 'Closed'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: '#64748b', fontWeight: 500, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockClosedPositions.map(pos => (
                <tr key={pos.id} style={{ borderBottom: '1px solid #0f172a' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{pos.token}</td>
                  <td style={{ padding: '10px 12px' }}><Badge color={pos.side === 'long' ? 'green' : 'red'}>{pos.side}</Badge></td>
                  <td style={{ padding: '10px 12px' }}>${pos.entryPrice}</td>
                  <td style={{ padding: '10px 12px' }}>${pos.closePrice}</td>
                  <td style={{ padding: '10px 12px' }}>${pos.sizeUsd}</td>
                  <td style={{ padding: '10px 12px', color: pos.pnlPct >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}% (${pos.pnlUsd.toFixed(2)})
                  </td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{pos.closedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
