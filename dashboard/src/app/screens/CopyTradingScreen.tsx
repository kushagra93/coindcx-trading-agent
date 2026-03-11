import { useState } from 'react';
import { TraderCard } from '../components/TraderCard';
import { mobile } from '../styles/mobile';

const traders = [
  { id: 'tr1', name: 'CryptoWhale', chain: 'solana', sharpe: 2.4, pnl30d: 34.2, copiers: 1240 },
  { id: 'tr2', name: 'DeFiKing', chain: 'ethereum', sharpe: 1.9, pnl30d: 22.1, copiers: 890 },
  { id: 'tr3', name: 'AlphaHunter', chain: 'hyperliquid', sharpe: 3.1, pnl30d: 45.8, copiers: 2100 },
  { id: 'tr4', name: 'SolanaSniper', chain: 'solana', sharpe: 1.7, pnl30d: 18.5, copiers: 560 },
  { id: 'tr5', name: 'GridMaster', chain: 'ethereum', sharpe: 2.0, pnl30d: 28.3, copiers: 730 },
];

type SortKey = 'sharpe' | 'pnl30d' | 'copiers';

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'sharpe', label: 'Sharpe' },
  { key: 'pnl30d', label: '30d P&L' },
  { key: 'copiers', label: 'Copiers' },
];

export function CopyTradingScreen() {
  const [sortBy, setSortBy] = useState<SortKey>('sharpe');

  const sorted = [...traders].sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <div style={{ padding: mobile.screenPadding }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Copy Trading</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Follow top performers</div>

      {/* Sort pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {sortOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none',
              background: sortBy === opt.key ? '#3b82f6' : '#1e293b',
              color: sortBy === opt.key ? '#fff' : '#94a3b8',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Trader list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(t => (
          <TraderCard key={t.id} trader={t} />
        ))}
      </div>
    </div>
  );
}
