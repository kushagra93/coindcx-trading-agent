import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MobileCard } from '../components/MobileCard';
import { mobile } from '../styles/mobile';
import { ChevronDown, ChevronUp, TrendingUp, Zap, Users, Copy, Search } from 'lucide-react';

type Section = 'leaderboard' | 'signals' | 'strategies' | 'tokens' | 'analyze';

const leaderboard = [
  { rank: 1, name: 'CryptoWhale', pnl: '+45.8%', sharpe: 3.1, copiers: 2100, chain: 'Solana' },
  { rank: 2, name: 'DeFiKing', pnl: '+34.2%', sharpe: 2.4, copiers: 1240, chain: 'Ethereum' },
  { rank: 3, name: 'BaseBuilder', pnl: '+31.5%', sharpe: 2.2, copiers: 980, chain: 'Base' },
  { rank: 4, name: 'AlphaHunter', pnl: '+28.3%', sharpe: 2.0, copiers: 730, chain: 'Hyperliquid' },
  { rank: 5, name: 'SolSniper', pnl: '+22.1%', sharpe: 1.9, copiers: 560, chain: 'Solana' },
];

const signals = [
  { token: 'FARTCOIN', chain: 'Solana', signal: 'Strong Buy', reason: 'Volume 10x + CT trending #1', strength: 96 },
  { token: 'POPCAT', chain: 'Solana', signal: 'Strong Buy', reason: 'Breaking ATH, whale accumulation', strength: 93 },
  { token: 'DEGEN', chain: 'Base', signal: 'Buy', reason: 'Base chain TVL rising + airdrop hype', strength: 82 },
  { token: 'TSLA-PERP', chain: 'Perps', signal: 'Buy', reason: 'Earnings beat + momentum', strength: 78 },
  { token: 'MYRO', chain: 'Solana', signal: 'Buy', reason: 'Low cap gem, RSI 28 oversold bounce', strength: 75 },
  { token: 'NVDA-PERP', chain: 'Perps', signal: 'Strong Buy', reason: 'AI sector rotation + breakout', strength: 88 },
  { token: 'BONK', chain: 'Solana', signal: 'Hold', reason: 'Consolidating after 18% pump', strength: 55 },
  { token: 'MOG', chain: 'Ethereum', signal: 'Buy', reason: 'ETH meme rotation starting', strength: 71 },
];

const strategies = [
  { id: 'meme-sniper', name: 'Meme Coin Sniper', desc: 'Auto-snipe trending low-cap memes on Solana/Base', active: true },
  { id: 'trailing-tpsl', name: 'Trailing TP/SL', desc: 'Auto take-profit & stop-loss that trail price', active: true },
  { id: 'conditional', name: 'Conditional Buy', desc: 'Buy when token trends, hits volume, or RSI level', active: true },
  { id: 'dca', name: 'DCA Bot', desc: 'Auto-buy on dips — memecoins, blue chips, or perps', active: true },
  { id: 'perps-momentum', name: 'Stock Perps Momentum', desc: 'Long/short US stock perps on earnings & momentum', active: true },
  { id: 'grid', name: 'Grid Trading', desc: 'Range-bound automated trades', active: false },
  { id: 'sniper', name: 'New Token Sniper', desc: 'Auto-buy new launches on Pump.fun & Aerodrome', active: false },
];

const trendingTokens = [
  { token: 'FARTCOIN', chain: 'Solana', price: '$0.0041', change: +142.5, vol: '$89M' },
  { token: 'POPCAT', chain: 'Solana', price: '$0.26', change: +67.3, vol: '$62M' },
  { token: 'MYRO', chain: 'Solana', price: '$0.017', change: +34.8, vol: '$12M' },
  { token: 'GIGA', chain: 'Solana', price: '$0.032', change: +28.9, vol: '$8.5M' },
  { token: 'DEGEN', chain: 'Base', price: '$0.004', change: +28.5, vol: '$24M' },
  { token: 'TOSHI', chain: 'Base', price: '$0.00015', change: +19.2, vol: '$6.8M' },
  { token: 'MOG', chain: 'Ethereum', price: '$0.0000008', change: +22.1, vol: '$18M' },
  { token: 'TSLA-PERP', chain: 'Perps', price: '$430.20', change: +3.8, vol: '$1.2B' },
  { token: 'NVDA-PERP', chain: 'Perps', price: '$140.10', change: +5.1, vol: '$890M' },
  { token: 'AAPL-PERP', chain: 'Perps', price: '$178.50', change: -1.2, vol: '$620M' },
];

function SectionToggle({ label, icon, open, onToggle }: { label: string; icon: React.ReactNode; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
      padding: '12px 0', background: 'none', border: 'none', borderBottom: '1px solid #1e293b',
      color: '#fff', cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
      </div>
      {open ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
    </button>
  );
}

export function ExploreScreen() {
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState<Set<Section>>(new Set(['signals']));

  const toggle = (s: Section) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  };

  return (
    <div style={{ padding: mobile.screenPadding }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Explore</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Signals, strategies & top traders</div>

      {/* Signals */}
      <SectionToggle label="Signals" icon={<Zap size={16} color="#eab308" />} open={openSections.has('signals')} onToggle={() => toggle('signals')} />
      {openSections.has('signals') && (
        <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {signals.map(s => (
            <MobileCard key={s.token} style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{s.token}</span>
                    <span style={{ fontSize: 10, color: '#64748b', background: '#1e293b', padding: '1px 6px', borderRadius: 4 }}>{s.chain}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.reason}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: s.strength >= 70 ? '#22c55e' : s.strength >= 50 ? '#eab308' : '#ef4444',
                  }}>{s.signal}</div>
                  <div style={{
                    width: 40, height: 4, borderRadius: 2, background: '#1e293b', marginTop: 4, marginLeft: 'auto',
                  }}>
                    <div style={{
                      width: `${s.strength}%`, height: '100%', borderRadius: 2,
                      background: s.strength >= 70 ? '#22c55e' : s.strength >= 50 ? '#eab308' : '#ef4444',
                    }} />
                  </div>
                </div>
              </div>
            </MobileCard>
          ))}
        </div>
      )}

      {/* Trending Tokens */}
      <SectionToggle label="Trending Tokens" icon={<TrendingUp size={16} color="#22c55e" />} open={openSections.has('tokens')} onToggle={() => toggle('tokens')} />
      {openSections.has('tokens') && (
        <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {trendingTokens.map(t => (
            <MobileCard key={t.token} style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, background: '#1e293b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: '#94a3b8',
                  }}>{t.token.slice(0, 3)}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.token}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{t.chain} · Vol {t.vol}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t.price}</div>
                  <div style={{ fontSize: 10, color: t.change >= 0 ? '#22c55e' : '#ef4444' }}>
                    {t.change >= 0 ? '+' : ''}{t.change}%
                  </div>
                </div>
              </div>
            </MobileCard>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      <SectionToggle label="Leaderboard" icon={<Users size={16} color="#a855f7" />} open={openSections.has('leaderboard')} onToggle={() => toggle('leaderboard')} />
      {openSections.has('leaderboard') && (
        <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {leaderboard.map(t => (
            <MobileCard key={t.rank} style={{ padding: '10px 14px', cursor: 'pointer' }} onClick={() => navigate(`/app/explore/trader/${t.name.toLowerCase()}`)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: t.rank <= 3 ? 'rgba(234,179,8,0.15)' : '#1e293b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    color: t.rank <= 3 ? '#eab308' : '#64748b',
                  }}>{t.rank}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{t.chain} · {t.copiers} copiers</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#22c55e' }}>{t.pnl}</div>
                  <div style={{ fontSize: 10, color: '#64748b' }}>Sharpe {t.sharpe}</div>
                </div>
              </div>
            </MobileCard>
          ))}
        </div>
      )}

      {/* Token Analysis */}
      <SectionToggle label="Token Analysis" icon={<Search size={16} color="#06b6d4" />} open={openSections.has('analyze')} onToggle={() => toggle('analyze')} />
      {openSections.has('analyze') && (
        <div style={{ padding: '12px 0' }}>
          <div style={{
            display: 'flex', gap: 8, marginBottom: 12,
          }}>
            <input
              placeholder="Search any token (SOL, BONK, PEPE...)"
              style={{
                flex: 1, background: '#1e293b', border: 'none', borderRadius: 10,
                padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none',
              }}
            />
            <button onClick={() => navigate('/app/chat')} style={{
              padding: '0 14px', borderRadius: 10, border: 'none',
              background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Analyze</button>
          </div>
          {/* Quick analysis cards */}
          {[
            { token: 'FARTCOIN', chain: 'Solana', rsi: 22, macd: 'Oversold bounce', support: '$0.0028', resistance: '$0.0065', sentiment: 'Very Bullish', score: 94 },
            { token: 'POPCAT', chain: 'Solana', rsi: 68, macd: 'Bullish', support: '$0.18', resistance: '$0.35', sentiment: 'Bullish', score: 85 },
            { token: 'TSLA-PERP', chain: 'Perps', rsi: 62, macd: 'Bullish', support: '$400', resistance: '$460', sentiment: 'Bullish', score: 78 },
            { token: 'DEGEN', chain: 'Base', rsi: 35, macd: 'Turning Bullish', support: '$0.003', resistance: '$0.006', sentiment: 'Bullish', score: 76 },
          ].map(a => (
            <MobileCard key={a.token} style={{ padding: '10px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{a.token}</span>
                  <span style={{ fontSize: 10, color: '#64748b', background: '#1e293b', padding: '1px 6px', borderRadius: 4 }}>{a.chain}</span>
                </div>
                <div style={{
                  padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  background: a.score >= 70 ? 'rgba(34,197,94,0.15)' : a.score >= 50 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                  color: a.score >= 70 ? '#22c55e' : a.score >= 50 ? '#eab308' : '#ef4444',
                }}>{a.score}/100</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                <div style={{ color: '#64748b' }}>RSI: <span style={{ color: a.rsi < 30 ? '#22c55e' : a.rsi > 70 ? '#ef4444' : '#94a3b8' }}>{a.rsi}</span></div>
                <div style={{ color: '#64748b' }}>MACD: <span style={{ color: '#94a3b8' }}>{a.macd}</span></div>
                <div style={{ color: '#64748b' }}>Support: <span style={{ color: '#94a3b8' }}>{a.support}</span></div>
                <div style={{ color: '#64748b' }}>Resistance: <span style={{ color: '#94a3b8' }}>{a.resistance}</span></div>
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Sentiment: <span style={{
                color: a.sentiment.includes('Bullish') ? '#22c55e' : a.sentiment.includes('Bearish') ? '#ef4444' : '#eab308',
                fontWeight: 600,
              }}>{a.sentiment}</span></div>
            </MobileCard>
          ))}
        </div>
      )}

      {/* Strategies */}
      <SectionToggle label="My Strategies" icon={<Copy size={16} color="#3b82f6" />} open={openSections.has('strategies')} onToggle={() => toggle('strategies')} />
      {openSections.has('strategies') && (
        <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {strategies.map(s => (
            <MobileCard key={s.id} style={{ padding: '10px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.desc}</div>
                </div>
                <div style={{
                  padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  background: s.active ? 'rgba(34,197,94,0.15)' : '#1e293b',
                  color: s.active ? '#22c55e' : '#64748b',
                }}>{s.active ? 'Active' : 'Off'}</div>
              </div>
            </MobileCard>
          ))}
          <button onClick={() => navigate('/app/chat')} style={{
            width: '100%', padding: 12, borderRadius: 12, border: '1px dashed #334155',
            background: 'none', color: '#3b82f6', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', textAlign: 'center',
          }}>
            + Create strategy via Chat
          </button>
        </div>
      )}
    </div>
  );
}
