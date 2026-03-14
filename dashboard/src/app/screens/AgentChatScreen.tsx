import { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTradingData } from '../context/TradingDataContext';
import { CommandBar } from '../components/CommandBar';
import { ChatBubble } from '../components/ChatBubble';
import { tokens } from '../../styles/theme';
import { mobile } from '../styles/mobile';
import { processMessage, type ChatMessage } from '../services/chatEngine';

const welcomeMsg: ChatMessage = {
  id: 'm0',
  role: 'assistant',
  text: `War Agent — ready.

Screens every token before trading. Auto-exits on every position.

--- Commands ---
"buy POPCAT $200" — buy with safety screening
"screen FARTCOIN" — full safety check
"long TSLA 3x" — leveraged perp
"set alert when BTC hits $100K" — price alert
"buy any token at Hot Now, sell at 100%" — automation rule
"trending" — see what's hot

Say "help" for all commands.`,
};

export function AgentChatScreen() {
  const navigate = useNavigate();
  const {
    addConditionalRule, addPriceAlert, addLimitOrder, addDcaPlan,
  } = useTradingData();

  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMsg]);
  const [isProcessing, setIsProcessing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);
    try {
      const reply = await processMessage(text);
      setMessages(prev => [...prev, reply]);

      if (reply.metadata?.createdAlert) {
        const a = reply.metadata.createdAlert;
        addPriceAlert({
          id: `alert-${Date.now()}`, token: a.token, targetPrice: a.price,
          direction: a.direction, status: 'active',
          description: `Alert when ${a.token} ${a.direction === 'above' ? '>' : '<'} $${a.price.toLocaleString()}`,
        });
      }
      if (reply.metadata?.createdRule) {
        const r = reply.metadata.createdRule;
        addConditionalRule({
          id: `rule-${Date.now()}`, condition: r.condition, action: r.action,
          status: 'active', description: `${r.condition} → ${r.action}`,
        });
      }
      if (reply.metadata?.createdLimit) {
        const l = reply.metadata.createdLimit;
        addLimitOrder({
          id: `limit-${Date.now()}`, token: l.token, triggerPrice: l.price,
          currentPrice: l.price * (l.side === 'buy' ? 1.1 : 0.9),
          side: l.side, amount: 100, status: 'active',
          description: `${l.side === 'buy' ? 'Buy' : 'Sell'} ${l.token} at $${l.price}`,
        });
      }
      if (reply.metadata?.createdDca) {
        const d = reply.metadata.createdDca;
        addDcaPlan({
          id: `dca-${Date.now()}`, token: d.token, amountPerBuy: d.amount,
          completedBuys: 0, totalBuys: 20, nextBuyTime: '1h', status: 'active',
          description: `DCA $${d.amount} into ${d.token} ${d.frequency}`,
        });
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: `e${Date.now()}`, role: 'assistant',
        text: `Error: ${e instanceof Error ? e.message : 'Unknown error'}. Try again.`,
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: tokens.colors.bg }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: `8px ${mobile.screenPadding}px`,
        borderBottom: `1px solid ${tokens.colors.border}`,
        flexShrink: 0,
      }}>
        <button
          onClick={() => navigate('/app/agent')}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'transparent', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} color={tokens.colors.textSecondary} />
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.text }}>Agent Chat</div>
          <div style={{ fontSize: 10, color: tokens.colors.textMuted }}>Natural language commands</div>
        </div>
      </div>

      {/* Chat */}
      <div style={{
        flex: 1, overflowY: 'auto', scrollbarWidth: 'none',
        padding: `0 ${mobile.screenPadding}px`,
      }}>
        {messages.map(m => (
          <ChatBubble key={m.id} role={m.role} text={m.text} onAction={send} />
        ))}
        {isProcessing && (
          <div style={{
            display: 'flex', gap: 10, padding: '10px 0',
            animation: 'fadeIn 0.15s ease',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: tokens.colors.bgSurface,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 4, height: 4, borderRadius: 2,
                background: tokens.colors.accent, animation: 'pulse 1s infinite',
              }} />
            </div>
            <div style={{
              fontSize: 12, color: tokens.colors.textMuted,
              fontFamily: tokens.fonts.mono, alignSelf: 'center',
            }}>
              scanning...
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* Command bar */}
      <CommandBar onSend={send} isProcessing={isProcessing} />
    </div>
  );
}
