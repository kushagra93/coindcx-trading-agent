import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { ChatBubble } from '../components/ChatBubble';
import { SuggestionChip } from '../components/SuggestionChip';
import { mobile } from '../styles/mobile';

const suggestions = [
  'How is my portfolio doing?',
  'What trades did you make today?',
  'Should I increase my budget?',
  'Explain my risk level',
];

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const initialMessages: Message[] = [
  { id: 'm0', role: 'assistant', text: "Hi! I'm your trading assistant. Ask me anything about your portfolio or strategies." },
];

export function AIChatSheet({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: `u${Date.now()}`, role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      const reply: Message = {
        id: `a${Date.now()}`,
        role: 'assistant',
        text: getReply(text),
      };
      setMessages(prev => [...prev, reply]);
    }, 800);
  };

  return (
    <div style={{
      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 100,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f172a', borderRadius: '20px 20px 0 0',
          height: '75%', display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#334155' }} />
        </div>

        <div style={{ padding: '0 16px 8px', fontSize: 16, fontWeight: 700 }}>AI Assistant</div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map(m => (
            <ChatBubble key={m.id} role={m.role} text={m.text} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {suggestions.map(s => (
              <SuggestionChip key={s} label={s} onClick={() => send(s)} />
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{
          display: 'flex', gap: 8, padding: `8px 16px ${mobile.safeBottom + 8}px`,
          borderTop: '1px solid #1e293b',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="Ask your agent..."
            style={{
              flex: 1, background: '#1e293b', border: 'none', borderRadius: 12,
              padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none',
            }}
          />
          <button
            onClick={() => send(input)}
            style={{
              width: 44, height: 44, borderRadius: 12, border: 'none',
              background: '#3b82f6', display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <Send size={18} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

function getReply(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('portfolio')) return 'Your portfolio is up +6.8% this week. Total balance: $9,500 across 3 active strategies.';
  if (lower.includes('trade')) return 'Today I executed 4 trades: 2 buys (SOL, ETH) and 2 sells (ARB, MATIC). Net P&L: +$127.';
  if (lower.includes('budget')) return 'Based on your risk profile, I\'d suggest keeping your current allocation. Your Sharpe ratio is healthy at 1.8.';
  if (lower.includes('risk')) return 'You\'re set to Moderate risk. This means max 5% per trade, 10% daily loss limit, and trailing stops at 3%.';
  return 'I can help with portfolio questions, trade explanations, strategy advice, and risk management. What would you like to know?';
}
