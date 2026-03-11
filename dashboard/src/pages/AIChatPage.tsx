import { useState, useRef, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Send, Bot, User, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const suggestions = [
  'I want to invest 10,000 rupees/month into top 5 coins',
  'Create a momentum strategy for SOL with tight stops',
  'Set up DCA for ETH buying $500 every dip of 5%+',
  'What are the best performing tokens this week?',
];

export function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I\'m your AI trading assistant. I can help you build trading strategies, analyze markets, and manage your portfolio. Try describing what you want in plain language.',
      timestamp: new Date(),
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

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateMockResponse(text),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, reply]);
      setLoading(false);
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>AI Strategy Builder</h1>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>Describe your trading goals in plain language</p>
      </div>

      {/* Chat Messages */}
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
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                background: msg.role === 'assistant' ? 'rgba(59, 130, 246, 0.15)' : '#1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {msg.role === 'assistant' ? <Bot size={16} color="#3b82f6" /> : <User size={16} color="#94a3b8" />}
              </div>
              <div style={{
                maxWidth: '75%',
                padding: '10px 14px',
                borderRadius: 12,
                background: msg.role === 'user' ? '#3b82f6' : '#1e293b',
                color: '#f1f5f9',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(59, 130, 246, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={16} color="#3b82f6" />
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 12, background: '#1e293b', color: '#64748b', fontSize: 13 }}>
                Thinking...
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
                  borderRadius: 8,
                  border: '1px solid #334155',
                  background: '#0a0e17',
                  color: '#94a3b8',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Sparkles size={12} color="#a855f7" />
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
            placeholder="Describe your trading strategy..."
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid #334155',
              background: '#0a0e17',
              color: '#f1f5f9',
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
  );
}

function generateMockResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('dca') || lower.includes('dollar cost') || lower.includes('invest') || lower.includes('monthly')) {
    return `Great choice! I've analyzed your request and recommend a DCA strategy:

Strategy: Buy the Dip (DCA)
Tokens: ETH, SOL, BTC, MATIC, ARB
Chain: Multi-chain (Ethereum + Solana)
Frequency: Weekly buys on 5%+ dips
Risk Level: Conservative

Estimated 90-day return based on backtesting: +12-18%

Would you like me to set this up? I'll configure the strategy with appropriate position sizing based on your risk settings.`;
  }

  if (lower.includes('momentum') || lower.includes('trend')) {
    return `I'll set up a momentum strategy for you:

Strategy: Ride the Trend (Momentum)
Token: SOL
Chain: Solana (via Jupiter)
Entry: Buy when RSI crosses above 50 with increasing volume
Exit: Trailing stop at 8%
Risk: Medium

This strategy performed +28% in backtesting over 90 days. Shall I activate it?`;
  }

  if (lower.includes('grid') || lower.includes('range')) {
    return `Here's a grid trading strategy:

Strategy: Range Trader (Grid)
Price Range: Auto-detected based on 30-day range
Grid Levels: 10
Order Size: Equal distribution of budget
Chain: Hyperliquid (perps)

Grid trading works best in sideways markets. I'll auto-pause if the price breaks out of range. Ready to start?`;
  }

  return `I understand you're interested in: "${input}"

Let me analyze the current market conditions and suggest the best approach. Based on recent data:

1. Market regime: Moderate volatility (good for trend-following)
2. Top performers this week: SOL (+12%), ETH (+5%), ARB (+8%)
3. Recommended approach: A diversified strategy combining DCA + Momentum

Would you like me to create a specific strategy based on this analysis? You can also tell me your risk tolerance and budget.`;
}
