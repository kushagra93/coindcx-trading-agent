import { useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { tokens } from '../../styles/theme';

const placeholders = [
  'trade any token at Hot Now, sell at 100%',
  'buy US stocks when RSI < 30, sell at 20%',
  'set alert when BTC drops 5%',
  'screen FARTCOIN',
  'long TSLA 3x on Hyperliquid',
  'DCA $50 into SOL weekly',
  'buy POPCAT $200',
];

interface CommandBarProps {
  onSend: (text: string) => void;
  suggestions?: string[];
  isProcessing?: boolean;
}

export function CommandBar({ onSend, isProcessing }: CommandBarProps) {
  const [input, setInput] = useState('');
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % placeholders.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    onSend(input.trim());
    setInput('');
  };

  const hasInput = input.trim().length > 0;

  return (
    <div style={{
      flexShrink: 0,
      background: tokens.colors.bg,
      borderTop: `1px solid ${tokens.colors.border}`,
    }}>
      {/* Command prompt */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 16px 12px',
        gap: 10,
      }}>
        {/* Prompt indicator */}
        <div style={{
          fontSize: 14, fontWeight: 700,
          color: isProcessing ? tokens.colors.textMuted : tokens.colors.accent,
          fontFamily: tokens.fonts.mono,
          flexShrink: 0,
          opacity: isProcessing ? 0.4 : 1,
        }}>
          {isProcessing ? '...' : '>'}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={placeholders[placeholderIdx]}
          disabled={isProcessing}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: tokens.colors.text,
            fontSize: 14,
            fontFamily: tokens.fonts.sans,
            outline: 'none',
            caretColor: tokens.colors.accent,
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!hasInput || isProcessing}
          style={{
            width: 32, height: 32,
            borderRadius: 8,
            border: 'none',
            background: hasInput ? tokens.colors.accent : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: hasInput ? 'pointer' : 'default',
            flexShrink: 0,
            opacity: hasInput ? 1 : 0,
            transition: `all ${tokens.transitions.fast}`,
          }}
        >
          <ArrowUp size={16} color="#0a0a0a" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
