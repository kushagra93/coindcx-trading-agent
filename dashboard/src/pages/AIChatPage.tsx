import { useState, useRef, useEffect } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Send, Bot, User, Sparkles, Zap, RefreshCw, Target, Bell } from 'lucide-react';
import { tokens } from '../styles/theme';
import { processMessage, type ChatMessage } from '../app/services/chatEngine';
import { useTradingData } from '../app/context/TradingDataContext';

const suggestions = [
  'Screen FARTCOIN for safety',
  'Buy $200 of POPCAT',
  'Set alert when BTC hits $100K',
  'Long TSLA 3x on Hyperliquid',
  'Show my active automations',
  'What\'s trending right now?',
];

export function AIChatPage() {
  const { portfolio, conditionalRules, dcaPlans, limitOrders, priceAlerts } = useTradingData();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `AGENT COMMAND CENTER

I can execute trades, set rules, alerts, and manage your strategies.
Type naturally — "buy $50 of FARTCOIN" or "set alert when ETH drops 10%".

Say "help" for all commands.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const reply = await processMessage(text);
      setMessages(prev => [...prev, reply]);
    } catch {
      setMessages(prev => [...prev, {
        id: `e${Date.now()}`,
        role: 'assistant',
        text: 'Error processing command. Try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const activeCount = conditionalRules.filter(r => r.status === 'active').length
    + dcaPlans.filter(d => d.status === 'active').length
    + limitOrders.filter(l => l.status === 'active').length
    + priceAlerts.filter(a => a.status === 'active').length;

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 104px)' }}>
      {/* Left: Command Input + Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: tokens.colors.text }}>Agent Command Center</h1>
          <p style={{ color: tokens.colors.textMuted, fontSize: 13, marginTop: 4 }}>Natural language trading commands</p>
        </div>

        <Card style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', padding: 16 }}>
          <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                gap: 12,
                marginBottom: 16,
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: tokens.radii.sm, flexShrink: 0,
                  background: msg.role === 'assistant' ? tokens.colors.accentSubtle : tokens.colors.bgInput,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'assistant' ? <Bot size={16} color={tokens.colors.accent} /> : <User size={16} color={tokens.colors.textSecondary} />}
                </div>
                <div style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: tokens.radii.md,
                  background: msg.role === 'user' ? tokens.colors.accent : tokens.colors.bgElevated,
                  color: msg.role === 'user' ? '#0a0a0a' : tokens.colors.text,
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: tokens.radii.sm,
                  background: tokens.colors.accentSubtle,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={16} color={tokens.colors.accent} />
                </div>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: tokens.radii.md,
                  background: tokens.colors.bgElevated,
                  color: tokens.colors.textMuted,
                  fontSize: 13,
                }}>
                  Scanning on-chain data...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: tokens.radii.sm,
                    border: `1px solid ${tokens.colors.border}`,
                    background: tokens.colors.bg,
                    color: tokens.colors.textSecondary,
                    fontSize: 12,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Sparkles size={12} color={tokens.colors.accent} />
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
              placeholder="Type a command..."
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: tokens.radii.sm,
                border: `1px solid ${tokens.colors.border}`,
                background: tokens.colors.bg,
                color: tokens.colors.text,
                fontSize: 13,
                outline: 'none',
              }}
            />
            <Button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}>
              <Send size={16} />
            </Button>
          </div>
        </Card>
      </div>

      {/* Right: Active Automations + Stats */}
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Quick Stats */}
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: tokens.colors.text }}>Quick Stats</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: tokens.colors.textSecondary }}>Portfolio</span>
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: tokens.fonts.mono, color: tokens.colors.text }}>
                ${portfolio.totalValue.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: tokens.colors.textSecondary }}>Today's P&L</span>
              <span style={{
                fontSize: 13,
                fontWeight: 600,
                fontFamily: tokens.fonts.mono,
                color: portfolio.todayPnl >= 0 ? tokens.colors.positive : tokens.colors.negative,
              }}>
                {portfolio.todayPnl >= 0 ? '+' : ''}${Math.abs(portfolio.todayPnl).toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: tokens.colors.textSecondary }}>Active Automations</span>
              <span style={{ fontSize: 13, fontWeight: 600, fontFamily: tokens.fonts.mono, color: tokens.colors.accent }}>
                {activeCount}
              </span>
            </div>
          </div>
        </Card>

        {/* Active Automations */}
        <Card style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: tokens.colors.text }}>Active Automations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {conditionalRules.filter(r => r.status === 'active').map(r => (
              <div key={r.id} style={{ padding: '8px 10px', background: tokens.colors.bg, borderRadius: tokens.radii.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Zap size={12} color={tokens.colors.accent} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: tokens.colors.accent }}>RULE</span>
                </div>
                <div style={{ fontSize: 12, color: tokens.colors.text }}>{r.description}</div>
              </div>
            ))}
            {dcaPlans.filter(d => d.status === 'active').map(d => (
              <div key={d.id} style={{ padding: '8px 10px', background: tokens.colors.bg, borderRadius: tokens.radii.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <RefreshCw size={12} color={tokens.colors.info} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: tokens.colors.info }}>DCA</span>
                </div>
                <div style={{ fontSize: 12, color: tokens.colors.text }}>{d.description}</div>
                <div style={{ fontSize: 10, color: tokens.colors.textMuted, marginTop: 2 }}>
                  {d.completedBuys}/{d.totalBuys} buys · Next: {d.nextBuyTime}
                </div>
              </div>
            ))}
            {limitOrders.filter(l => l.status === 'active').map(l => (
              <div key={l.id} style={{ padding: '8px 10px', background: tokens.colors.bg, borderRadius: tokens.radii.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Target size={12} color={tokens.colors.warning} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: tokens.colors.warning }}>LIMIT</span>
                </div>
                <div style={{ fontSize: 12, color: tokens.colors.text }}>{l.description}</div>
              </div>
            ))}
            {priceAlerts.filter(a => a.status === 'active').map(a => (
              <div key={a.id} style={{ padding: '8px 10px', background: tokens.colors.bg, borderRadius: tokens.radii.sm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Bell size={12} color={tokens.colors.purple} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: tokens.colors.purple }}>ALERT</span>
                </div>
                <div style={{ fontSize: 12, color: tokens.colors.text }}>{a.description}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
