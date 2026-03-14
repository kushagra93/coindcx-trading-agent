import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Brain, BarChart3, ShieldCheck, CheckCircle } from 'lucide-react';
import { MobileCard } from '../components/MobileCard';
import { mobile } from '../styles/mobile';

const tradeDetails: Record<string, { token: string; side: string; amount: string; price: string; strategy: string; signal: string; riskCheck: string; outcome: string }> = {
  t1: { token: 'SOL', side: 'Buy', amount: '2.5', price: '$142.50', strategy: 'DCA — Dollar-cost averaging triggered on 3% pullback from local high.', signal: 'RSI dropped below 35, MACD crossed bearish-to-bullish. Volume spike confirmed buyer interest.', riskCheck: 'Position size: 3.7% of portfolio (within 5% limit). Stop loss set at $135.20 (-5.1%).', outcome: 'Entry filled at $142.50. Trailing stop active.' },
  t2: { token: 'ETH', side: 'Buy', amount: '0.45', price: '$3,200', strategy: 'Momentum — Trend-following entry on breakout above resistance.', signal: '4h candle closed above $3,180 resistance with above-average volume. EMA 20 > EMA 50.', riskCheck: 'Position size: 4.5% of portfolio. Daily loss limit: 2.1% used of 10% max.', outcome: 'Entry at $3,200. Target: $3,450. Stop: $3,100.' },
  t3: { token: 'ARB', side: 'Sell', amount: '800', price: '$1.25', strategy: 'Mean Reversion — Price extended 2.5 std above 20-day mean.', signal: 'Bollinger Band upper touch. RSI 78 (overbought). Funding rate elevated.', riskCheck: 'Profit lock: +$180 realized. Remaining exposure reduced to 1.2% of portfolio.', outcome: 'Sold at $1.25. Profit: +$180.' },
};

export function TradeExplanationScreen() {
  const navigate = useNavigate();
  const { tradeId } = useParams();
  const trade = tradeDetails[tradeId ?? ''] ?? tradeDetails.t1;

  const sections = [
    { icon: <Brain size={18} color="#3b82f6" />, title: 'Strategy', text: trade.strategy },
    { icon: <BarChart3 size={18} color="#eab308" />, title: 'Signal', text: trade.signal },
    { icon: <ShieldCheck size={18} color="#22c55e" />, title: 'Risk Check', text: trade.riskCheck },
    { icon: <CheckCircle size={18} color="#a855f7" />, title: 'Outcome', text: trade.outcome },
  ];

  return (
    <div style={{ padding: mobile.screenPadding }}>
      <button
        onClick={() => navigate(-1)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, marginBottom: 16, cursor: 'pointer', padding: 0 }}
      >
        <ArrowLeft size={18} /> Back
      </button>

      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Why This Trade?</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
        {trade.side} {trade.amount} {trade.token} @ {trade.price}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sections.map(s => (
          <MobileCard key={s.title}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {s.icon}
              <span style={{ fontWeight: 700, fontSize: 14 }}>{s.title}</span>
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{s.text}</div>
          </MobileCard>
        ))}
      </div>
    </div>
  );
}
