import { useState, useRef, useEffect } from 'react';
import { Send, Shield, TrendingUp, Zap, Users, Search, ChevronDown, ChevronUp, Copy, ClipboardPaste } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MobileCard } from '../components/MobileCard';
import { ChatBubble } from '../components/ChatBubble';
import { TradeEventCard } from '../components/TradeEventCard';
import { mobile } from '../styles/mobile';
import { processMessage, type ChatMessage } from '../services/chatEngine';

// ─── Data ────────────────────────────────────────────────────────────

type Tab = 'portfolio' | 'signals' | 'chat';

const chains = ['All', 'Solana', 'Base', 'Ethereum', 'Perps'] as const;

const holdings = [
  { token: 'SOL', chain: 'Solana', balance: '24.5', usd: '$3,528', change: +5.2 },
  { token: 'FARTCOIN', chain: 'Solana', balance: '450K', usd: '$1,845', change: +142.5 },
  { token: 'POPCAT', chain: 'Solana', balance: '8,200', usd: '$2,132', change: +67.3 },
  { token: 'WIF', chain: 'Solana', balance: '1,200', usd: '$960', change: +8.7 },
  { token: 'BONK', chain: 'Solana', balance: '12.5M', usd: '$312', change: +18.4 },
  { token: 'MYRO', chain: 'Solana', balance: '25K', usd: '$425', change: +34.8 },
  { token: 'BRETT', chain: 'Base', balance: '5,000', usd: '$450', change: +12.3 },
  { token: 'DEGEN', chain: 'Base', balance: '180K', usd: '$720', change: +28.5 },
  { token: 'TOSHI', chain: 'Base', balance: '2.1M', usd: '$315', change: +19.2 },
  { token: 'AERO', chain: 'Base', balance: '850', usd: '$1,020', change: -3.1 },
  { token: 'ETH', chain: 'Ethereum', balance: '1.2', usd: '$3,840', change: +2.1 },
  { token: 'PEPE', chain: 'Ethereum', balance: '80B', usd: '$720', change: -1.5 },
  { token: 'MOG', chain: 'Ethereum', balance: '5.2B', usd: '$416', change: +22.1 },
  { token: 'TSLA-PERP', chain: 'Perps', balance: '0.5 contracts', usd: '$2,150', change: +3.8 },
  { token: 'NVDA-PERP', chain: 'Perps', balance: '1.2 contracts', usd: '$1,680', change: +5.1 },
  { token: 'AAPL-PERP', chain: 'Perps', balance: '2 contracts', usd: '$890', change: -1.2 },
];

const recentTrades = [
  { id: 't1', token: 'FARTCOIN', side: 'buy' as const, amount: '150K', price: '$0.0041', time: '30s ago' },
  { id: 't2', token: 'POPCAT', side: 'buy' as const, amount: '2,000', price: '$0.26', time: '2m ago' },
  { id: 't3', token: 'TSLA-PERP', side: 'buy' as const, amount: '0.5', price: '$430.20', time: '5m ago' },
  { id: 't4', token: 'DEGEN', side: 'buy' as const, amount: '50K', price: '$0.004', time: '12m ago' },
  { id: 't5', token: 'BONK', side: 'buy' as const, amount: '2.5M', price: '$0.000025', time: '18m ago' },
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

const leaderboard = [
  { rank: 1, name: 'CryptoWhale', pnl: '+45.8%', sharpe: 3.1, copiers: 2100, chain: 'Solana' },
  { rank: 2, name: 'DeFiKing', pnl: '+34.2%', sharpe: 2.4, copiers: 1240, chain: 'Ethereum' },
  { rank: 3, name: 'BaseBuilder', pnl: '+31.5%', sharpe: 2.2, copiers: 980, chain: 'Base' },
];

const strategies = [
  { id: 'meme-sniper', name: 'Meme Sniper', desc: 'Auto-snipe trending low-cap memes', active: true },
  { id: 'trailing-tpsl', name: 'Trailing TP/SL', desc: 'Trail price for auto exits', active: true },
  { id: 'perps-momentum', name: 'Perps Momentum', desc: 'Long/short US stocks on momentum', active: true },
  { id: 'dca', name: 'DCA Bot', desc: 'Auto-buy dips on any chain', active: true },
];

const quickActions = [
  'Screen FARTCOIN',
  'Buy POPCAT $200',
  'Snipe low-cap memes',
  'Long TSLA 3x',
  'Analyze MYRO',
  'Trending',
  'Show P&L',
];

const welcomeMsg: ChatMessage = {
  id: 'm0',
  role: 'assistant',
  text: `TRADING AGENT v2 (War Agent Core)

Screens tokens on-chain before trading:
Age, Volume, Liquidity, RugCheck, LP lock, Holders

Exit strategies auto-applied:
- Memes: Micro SL + Ladder 2.5x + Trailing
- Blue chips: SL -5% + TP +20% + Trail
- Perps: SL -8% + TP +15% + Trail

Say "screen [token]" or "buy [token] $amount"`,
};

// ─── Component ───────────────────────────────────────────────────────

export function MainScreen() {
  const { agentStatus, portfolio, toggleAgent } = useApp();
  const [tab, setTab] = useState<Tab>('portfolio');
  const [chainFilter, setChainFilter] = useState<typeof chains[number]>('All');

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMsg]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      const reply = processMessage(text);
      setMessages(prev => [...prev, reply]);
      setIsTyping(false);
    }, 400 + Math.random() * 400);
  };

  // Signals state
  const [signalSection, setSignalSection] = useState<'signals' | 'leaderboard' | 'strategies'>('signals');

  const filtered = chainFilter === 'All' ? holdings : holdings.filter(h => h.chain === chainFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Fixed Header ── */}
      <div style={{ padding: `0 ${mobile.screenPadding}px`, flexShrink: 0 }}>
        {/* Agent status + Portfolio */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0 6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              background: agentStatus === 'running' ? '#22c55e' : '#ef4444',
              boxShadow: agentStatus === 'running' ? '0 0 8px #22c55e' : 'none',
            }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {agentStatus === 'running' ? 'Agent Running' : 'Agent Stopped'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.5 }}>
              <Shield size={11} color="#22c55e" />
              <span style={{ fontSize: 9, color: '#22c55e' }}>War Agent</span>
            </div>
            <button onClick={toggleAgent} style={{
              padding: '4px 12px', borderRadius: 16, border: 'none', fontSize: 11, fontWeight: 600,
              background: agentStatus === 'running' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
              color: agentStatus === 'running' ? '#ef4444' : '#22c55e',
              cursor: 'pointer',
            }}>
              {agentStatus === 'running' ? 'Stop' : 'Start'}
            </button>
          </div>
        </div>

        {/* Portfolio summary — always visible */}
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 10, padding: '2px 0 10px',
        }}>
          <span style={{ fontSize: 26, fontWeight: 700 }}>
            ${portfolio.totalValue.toLocaleString()}
          </span>
          <span style={{
            fontSize: 13, fontWeight: 600,
            color: portfolio.todayPnl >= 0 ? '#22c55e' : '#ef4444',
          }}>
            {portfolio.todayPnl >= 0 ? '+' : ''}${portfolio.todayPnl.toFixed(0)} today
          </span>
        </div>

        {/* ── Segmented Toggle ── */}
        <div style={{
          display: 'flex', background: '#0f172a', borderRadius: 10, padding: 3,
          marginBottom: 10,
        }}>
          {([
            { key: 'portfolio' as Tab, label: 'Portfolio' },
            { key: 'signals' as Tab, label: 'Signals' },
            { key: 'chat' as Tab, label: 'Chat' },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: tab === t.key ? '#1e293b' : 'transparent',
              color: tab === t.key ? '#fff' : '#64748b',
              transition: 'all 0.15s ease',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content Area ── */}
      <div style={{
        flex: 1, overflow: tab === 'chat' ? 'hidden' : 'auto',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ══════ PORTFOLIO TAB ══════ */}
        {tab === 'portfolio' && (
          <div style={{ padding: `0 ${mobile.screenPadding}px`, paddingBottom: 16 }}>
            {/* Chain pills */}
            <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
              {chains.map(c => (
                <button key={c} onClick={() => setChainFilter(c)} style={{
                  padding: '4px 10px', borderRadius: 16, border: 'none', fontSize: 11, fontWeight: 500,
                  background: chainFilter === c ? '#3b82f6' : '#1e293b',
                  color: chainFilter === c ? '#fff' : '#94a3b8',
                  cursor: 'pointer',
                }}>
                  {c}
                </button>
              ))}
            </div>

            {/* Holdings */}
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Holdings</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map(h => (
                <MobileCard key={h.token} style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, background: '#1e293b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: '#94a3b8',
                      }}>{h.token.slice(0, 3)}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{h.token}</div>
                        <div style={{ fontSize: 9, color: '#64748b' }}>{h.chain} · {h.balance}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{h.usd}</div>
                      <div style={{ fontSize: 9, color: h.change >= 0 ? '#22c55e' : '#ef4444' }}>
                        {h.change >= 0 ? '+' : ''}{h.change}%
                      </div>
                    </div>
                  </div>
                </MobileCard>
              ))}
            </div>

            {/* Recent Trades */}
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 }}>Recent Trades</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentTrades.map(t => (
                <TradeEventCard key={t.id} trade={t} />
              ))}
            </div>
          </div>
        )}

        {/* ══════ SIGNALS TAB ══════ */}
        {tab === 'signals' && (
          <div style={{ padding: `0 ${mobile.screenPadding}px`, paddingBottom: 16 }}>
            {/* Sub-toggle for signals */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {([
                { key: 'signals' as const, label: 'Signals', icon: <Zap size={12} /> },
                { key: 'leaderboard' as const, label: 'Traders', icon: <Users size={12} /> },
                { key: 'strategies' as const, label: 'Strategies', icon: <Copy size={12} /> },
              ]).map(s => (
                <button key={s.key} onClick={() => setSignalSection(s.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 10px', borderRadius: 16, border: 'none', fontSize: 11, fontWeight: 500,
                  background: signalSection === s.key ? '#3b82f6' : '#1e293b',
                  color: signalSection === s.key ? '#fff' : '#94a3b8',
                  cursor: 'pointer',
                }}>
                  {s.icon}{s.label}
                </button>
              ))}
            </div>

            {signalSection === 'signals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {signals.map(s => (
                  <MobileCard key={s.token} style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{s.token}</span>
                          <span style={{ fontSize: 9, color: '#64748b', background: '#1e293b', padding: '1px 5px', borderRadius: 4 }}>{s.chain}</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{s.reason}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: 11, fontWeight: 700,
                          color: s.strength >= 70 ? '#22c55e' : s.strength >= 50 ? '#eab308' : '#ef4444',
                        }}>{s.signal}</div>
                        <div style={{
                          width: 36, height: 3, borderRadius: 2, background: '#1e293b', marginTop: 3, marginLeft: 'auto',
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

            {signalSection === 'leaderboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {leaderboard.map(t => (
                  <MobileCard key={t.rank} style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: 6,
                          background: t.rank <= 3 ? 'rgba(234,179,8,0.15)' : '#1e293b',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700,
                          color: t.rank <= 3 ? '#eab308' : '#64748b',
                        }}>{t.rank}</span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{t.name}</div>
                          <div style={{ fontSize: 9, color: '#64748b' }}>{t.chain} · {t.copiers} copiers</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#22c55e' }}>{t.pnl}</div>
                        <div style={{ fontSize: 9, color: '#64748b' }}>Sharpe {t.sharpe}</div>
                      </div>
                    </div>
                  </MobileCard>
                ))}
              </div>
            )}

            {signalSection === 'strategies' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {strategies.map(s => (
                  <MobileCard key={s.id} style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{s.name}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{s.desc}</div>
                      </div>
                      <div style={{
                        padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                        background: s.active ? 'rgba(34,197,94,0.15)' : '#1e293b',
                        color: s.active ? '#22c55e' : '#64748b',
                      }}>{s.active ? 'Active' : 'Off'}</div>
                    </div>
                  </MobileCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════ CHAT TAB ══════ */}
        {tab === 'chat' && (
          <div style={{
            display: 'flex', flexDirection: 'column', flex: 1,
            padding: `0 ${mobile.screenPadding}px`, overflow: 'hidden',
          }}>
            {/* Messages */}
            <div ref={chatScrollRef} style={{
              flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
              paddingBottom: 6,
            }}>
              {messages.map(m => (
                <ChatBubble key={m.id} role={m.role} text={m.text} onAction={send} />
              ))}
              {isTyping && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                  <div style={{
                    padding: '8px 12px', borderRadius: 14, borderBottomLeftRadius: 4,
                    background: '#1e293b', color: '#64748b', fontSize: 12,
                  }}>
                    Scanning on-chain data...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick chips — only on first message */}
            {messages.length <= 1 && (
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '6px 0' }}>
                {quickActions.map(q => (
                  <button key={q} onClick={() => send(q)} style={{
                    padding: '5px 10px', borderRadius: 14, border: '1px solid #334155',
                    background: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Address detected badge */}
            {input.trim() && (/^0x[a-fA-F0-9]{40}$/.test(input.trim()) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input.trim())) && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', fontSize: 10, fontWeight: 600,
                color: '#3b82f6', background: 'rgba(59,130,246,0.1)',
                borderRadius: 6, marginBottom: 2, width: 'fit-content',
              }}>
                <Search size={10} />
                Contract address detected — will auto-screen
              </div>
            )}

            {/* Input */}
            <div style={{
              display: 'flex', gap: 6, padding: '6px 0 4px',
              borderTop: '1px solid #1e293b', flexShrink: 0,
            }}>
              {/* Paste from clipboard */}
              <button onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  if (text) { setInput(text.trim()); }
                } catch { /* clipboard permission denied */ }
              }} style={{
                width: 40, height: 40, borderRadius: 10, border: '1px solid #334155',
                background: 'none', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              }}>
                <ClipboardPaste size={15} color="#64748b" />
              </button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send(input)}
                placeholder="Paste address or type command..."
                style={{
                  flex: 1, background: '#1e293b', border: 'none', borderRadius: 10,
                  padding: '9px 12px', color: '#fff', fontSize: 13, outline: 'none',
                }}
              />
              <button onClick={() => send(input)} style={{
                width: 40, height: 40, borderRadius: 10, border: 'none',
                background: '#3b82f6', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
              }}>
                <Send size={16} color="#fff" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
