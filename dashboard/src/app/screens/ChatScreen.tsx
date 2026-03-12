import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Shield } from 'lucide-react';
import { ChatBubble } from '../components/ChatBubble';
import { mobile } from '../styles/mobile';
import { processMessage, type ChatMessage } from '../services/chatEngine';

const quickActions = [
  'Screen FARTCOIN',
  'Buy POPCAT $200',
  'Snipe low-cap memes',
  'Long TSLA 3x',
  'Analyze MYRO',
  'Positions',
  'Trending',
  'Show P&L',
];

const welcome: ChatMessage = {
  id: 'm0',
  role: 'assistant',
  text: `TRADING AGENT v2 (War Agent Core)

I screen tokens using on-chain data before trading:
- Age, Volume, Liquidity, Holder distribution
- RugCheck score, LP lock status
- CT trending score

Exit strategies auto-applied:
- Memes: Micro SL + Ladder 2.5x + Trailing
- Blue chips: SL -5% + TP +20% + Trail
- Perps: SL -8% + TP +15% + Trail

Chains: Solana | Base | Ethereum | Perps

Say "screen [token]" to check safety first, or "buy [token] $amount" to trade.`,
};

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([welcome]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const reply = await processMessage(text);
      setMessages(prev => [...prev, reply]);
    } catch (e) {
      setMessages(prev => [...prev, {
        id: `e${Date.now()}`,
        role: 'assistant',
        text: `Error fetching live data: ${e instanceof Error ? e.message : 'Unknown error'}. Try again.`,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const showChips = messages.length <= 1;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: `0 ${mobile.screenPadding}px`,
    }}>
      {/* Header */}
      <div style={{ padding: '12px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={18} color="#3b82f6" />
          <span style={{ fontSize: 17, fontWeight: 700 }}>Agent Chat</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.6 }}>
          <Shield size={12} color="#22c55e" />
          <span style={{ fontSize: 10, color: '#22c55e' }}>War Agent</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
        {messages.map(m => (
          <ChatBubble key={m.id} role={m.role} text={m.text} />
        ))}
        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 16, borderBottomLeftRadius: 4,
              background: '#1e293b', color: '#64748b', fontSize: 13,
            }}>
              Scanning on-chain data...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick action chips */}
      {showChips && (
        <div style={{
          display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 0',
        }}>
          {quickActions.map(q => (
            <button key={q} onClick={() => send(q)} style={{
              padding: '6px 12px', borderRadius: 16, border: '1px solid #334155',
              background: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        display: 'flex', gap: 8, padding: `8px 0 ${mobile.safeBottom > 0 ? 0 : 8}px`,
        borderTop: '1px solid #1e293b',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          placeholder="screen MYRO, buy FARTCOIN $200, long TSLA 3x..."
          style={{
            flex: 1, background: '#1e293b', border: 'none', borderRadius: 12,
            padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none',
          }}
        />
        <button onClick={() => send(input)} style={{
          width: 44, height: 44, borderRadius: 12, border: 'none',
          background: '#3b82f6', display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
        }}>
          <Send size={18} color="#fff" />
        </button>
      </div>
    </div>
  );
}
