import { PnlTicker } from '../components/PnlTicker';
import { TradeEventCard } from '../components/TradeEventCard';
import { mobile } from '../styles/mobile';

const trades = [
  { id: 't1', token: 'SOL', side: 'buy' as const, amount: '2.5', price: '142.50', time: '2m ago' },
  { id: 't2', token: 'ETH', side: 'buy' as const, amount: '0.45', price: '3,200', time: '15m ago' },
  { id: 't3', token: 'ARB', side: 'sell' as const, amount: '800', price: '1.25', time: '1h ago' },
  { id: 't4', token: 'SOL', side: 'buy' as const, amount: '5.0', price: '141.20', time: '3h ago' },
  { id: 't5', token: 'MATIC', side: 'sell' as const, amount: '1200', price: '0.92', time: '5h ago' },
  { id: 't6', token: 'BTC', side: 'buy' as const, amount: '0.02', price: '67,500', time: '8h ago' },
  { id: 't7', token: 'ETH', side: 'sell' as const, amount: '0.3', price: '3,180', time: '12h ago' },
  { id: 't8', token: 'AVAX', side: 'buy' as const, amount: '15', price: '38.40', time: '1d ago' },
];

export function ActivityScreen() {
  return (
    <div style={{ padding: mobile.screenPadding }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Activity</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Your agent's trade log</div>

      <PnlTicker value={652.30} label="Today's P&L" />

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trades.map(t => (
          <TradeEventCard key={t.id} trade={t} />
        ))}
      </div>
    </div>
  );
}
