import { useState } from 'react';
import { Bot, User } from 'lucide-react';
import { tokens } from '../../styles/theme';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  onAction?: (command: string) => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        marginLeft: 6, padding: '1px 6px', borderRadius: 4,
        border: `1px solid ${tokens.colors.border}`, background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
        color: copied ? tokens.colors.positive : tokens.colors.textMuted, fontSize: 9, fontWeight: 600,
        cursor: 'pointer', transition: `all ${tokens.transitions.fast}`, verticalAlign: 'middle',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function extractBuyOptions(text: string): { token: string; amounts: number[] } | null {
  const match = text.match(/Say "buy (\S+) \$(\d+)"\s*\/\s*"\$(\d+)"\s*\/\s*"\$(\d+)"/);
  if (match) return { token: match[1], amounts: [parseInt(match[2]), parseInt(match[3]), parseInt(match[4])] };
  return null;
}

function renderAgentText(text: string, onAction?: (command: string) => void) {
  const lines = text.split('\n');
  const buyOpts = extractBuyOptions(text);

  return lines.map((line, i) => {
    const key = i;
    // Section headers (--- Title ---)
    if (line.match(/^---\s.+\s---$/)) {
      return (
        <div key={key} style={{
          color: tokens.colors.accent, fontWeight: 600, fontSize: 10,
          marginTop: 10, marginBottom: 3, letterSpacing: '0.08em',
          textTransform: 'uppercase', fontFamily: tokens.fonts.mono,
        }}>
          {line.replace(/---/g, '').trim()}
        </div>
      );
    }
    // Top-level titles (all caps first line)
    if (i === 0 && line === line.toUpperCase() && line.length > 3) {
      return (
        <div key={key} style={{
          fontWeight: 700, fontSize: 13, color: tokens.colors.text,
          marginBottom: 4, fontFamily: tokens.fonts.mono, letterSpacing: '0.02em',
        }}>
          {line}
        </div>
      );
    }
    if (line.startsWith('Name: ')) {
      return <div key={key} style={{ fontSize: 11, color: tokens.colors.textSecondary, fontWeight: 500 }}>{line}</div>;
    }
    // Grades
    if (line.startsWith('Grade: A')) return <div key={key} style={{ color: tokens.colors.positive, fontWeight: 600, fontSize: 12, fontFamily: tokens.fonts.mono }}>{line}</div>;
    if (line.startsWith('Grade: B')) return <div key={key} style={{ color: '#a3e635', fontWeight: 600, fontSize: 12, fontFamily: tokens.fonts.mono }}>{line}</div>;
    if (line.startsWith('Grade: C') || line.startsWith('Grade: D')) return <div key={key} style={{ color: '#f97316', fontWeight: 600, fontSize: 12, fontFamily: tokens.fonts.mono }}>{line}</div>;
    if (line.startsWith('Grade: F')) return <div key={key} style={{ color: tokens.colors.negative, fontWeight: 600, fontSize: 12, fontFamily: tokens.fonts.mono }}>{line}</div>;
    // AI Confidence
    if (line.startsWith('AI Confidence:')) {
      const pct = parseInt(line.match(/(\d+)/)?.[1] ?? '0');
      return <div key={key} style={{ color: pct >= 70 ? tokens.colors.positive : pct >= 40 ? tokens.colors.warning : tokens.colors.negative, fontSize: 11, fontWeight: 600, fontFamily: tokens.fonts.mono }}>{line}</div>;
    }
    // Rug Probability
    if (line.startsWith('Rug Probability:')) {
      const pct = parseInt(line.match(/(\d+)/)?.[1] ?? '100');
      return <div key={key} style={{ color: pct <= 20 ? tokens.colors.positive : pct <= 50 ? tokens.colors.warning : tokens.colors.negative, fontSize: 11, fontWeight: 600, fontFamily: tokens.fonts.mono }}>{line}</div>;
    }
    // Contract address
    if (line.startsWith('Contract:')) {
      const evmFull = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
      const solFull = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0];
      const fullAddr = evmFull ?? solFull ?? line.replace('Contract:', '').trim();
      return (
        <div key={key} style={{ fontSize: 10, color: tokens.colors.textSecondary, fontFamily: tokens.fonts.mono, display: 'flex', alignItems: 'center' }}>
          {line}
          <CopyButton value={fullAddr} />
        </div>
      );
    }
    // Data sources
    if (line.startsWith('+ ') && line.includes(':')) return <div key={key} style={{ color: tokens.colors.positive, fontSize: 11, fontFamily: tokens.fonts.mono }}>{line}</div>;
    // P&L
    if (line.match(/P&L:.*\+/)) return <div key={key} style={{ color: tokens.colors.positive, fontSize: 12, fontFamily: tokens.fonts.mono }}>{line}</div>;
    if (line.match(/P&L:.*-/)) return <div key={key} style={{ color: tokens.colors.negative, fontSize: 12, fontFamily: tokens.fonts.mono }}>{line}</div>;
    // Warning/issue markers
    if (line.startsWith('X ')) return <div key={key} style={{ color: tokens.colors.negative, fontSize: 11 }}>{line}</div>;
    if (line.startsWith('* ')) return <div key={key} style={{ color: tokens.colors.warning, fontSize: 11 }}>{line}</div>;
    // Active exit
    if (line.includes('[ON]')) return <div key={key} style={{ color: tokens.colors.positive, fontSize: 11, fontFamily: tokens.fonts.mono }}>{line}</div>;
    if (line.includes('[OFF]')) return <div key={key} style={{ color: tokens.colors.textMuted, fontSize: 11, fontFamily: tokens.fonts.mono }}>{line}</div>;
    // Recommendations
    if (line.startsWith('BUY')) return <div key={key} style={{ color: tokens.colors.positive, fontWeight: 600, marginTop: 4, fontSize: 12 }}>{line}</div>;
    if (line.startsWith('AVOID') || line.startsWith('DO NOT') || line.startsWith('SKIP') || line.startsWith('BLOCKED')) {
      return <div key={key} style={{ color: tokens.colors.negative, fontWeight: 600, marginTop: 4, fontSize: 12 }}>{line}</div>;
    }
    if (line.startsWith('RISKY')) return <div key={key} style={{ color: '#f97316', fontWeight: 600, marginTop: 4, fontSize: 12 }}>{line}</div>;
    // Meme safety
    if (line.startsWith('MEME SAFETY') || line.startsWith('Ladder exit') || line.startsWith('Low-cap')) {
      return <div key={key} style={{ color: tokens.colors.warning, fontSize: 11, fontStyle: 'italic' }}>{line}</div>;
    }
    // Buy prompt — render as buttons
    if (line.startsWith('Say "buy') && buyOpts && onAction) {
      return (
        <div key={key} style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {buyOpts.amounts.map(amt => (
            <button
              key={amt}
              onClick={() => onAction(`buy ${buyOpts.token} $${amt}`)}
              style={{
                padding: '5px 14px', borderRadius: 6,
                border: `1px solid ${tokens.colors.positive}`,
                background: tokens.colors.positiveBg,
                color: tokens.colors.positive,
                fontSize: 11, fontWeight: 600, fontFamily: tokens.fonts.mono,
                cursor: 'pointer',
              }}
            >
              Buy ${amt}
            </button>
          ))}
        </div>
      );
    }
    // Force buy
    if (line.startsWith('Say "buy') && line.includes('force') && onAction) {
      const forceMatch = line.match(/Say "buy (\S+) force"/);
      if (forceMatch) {
        return (
          <div key={key} style={{ marginTop: 6 }}>
            <button
              onClick={() => onAction(`buy ${forceMatch[1]} $50 force`)}
              style={{
                padding: '4px 12px', borderRadius: 6,
                border: `1px solid ${tokens.colors.negative}`,
                background: tokens.colors.negativeBg,
                color: tokens.colors.negative,
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Force Buy $50 (Override)
            </button>
          </div>
        );
      }
    }
    if (line.trim() === '') return <div key={key} style={{ height: 6 }} />;
    // Default — metric lines get mono font
    if (line.match(/^(Price|Volume|Market Cap|Liquidity|Age|Holders|Size|Entry|Qty|Safety|Leverage|Funding|Token|Side|Buy on|Per buy|Max budget|Stop Loss|Take Profit|Trailing|Venue|MEV|Chain):/)) {
      return <div key={key} style={{ fontSize: 11, color: tokens.colors.textSecondary, fontFamily: tokens.fonts.mono }}>{line}</div>;
    }
    return <div key={key} style={{ fontSize: 12, color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{line}</div>;
  });
}

function isContractAddress(text: string): boolean {
  const trimmed = text.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
}

function formatTime(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export function ChatBubble({ role, text, onAction }: ChatBubbleProps) {
  const isUser = role === 'user';
  const isAddr = isUser && isContractAddress(text);

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      padding: '10px 0',
      animation: 'fadeIn 0.15s ease',
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 1,
        background: isUser ? tokens.colors.bgInput : tokens.colors.accentSubtle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isUser
          ? <User size={13} color={tokens.colors.textMuted} />
          : <Bot size={13} color={tokens.colors.accent} />
        }
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header: role + timestamp */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: isUser ? tokens.colors.textSecondary : tokens.colors.accent,
          }}>
            {isUser ? 'You' : 'Agent'}
          </span>
          <span style={{
            fontSize: 9, color: tokens.colors.textMuted, fontFamily: tokens.fonts.mono,
          }}>
            {formatTime()}
          </span>
        </div>

        {/* Message body */}
        {isUser ? (
          <div style={{
            fontSize: 13, color: tokens.colors.text, lineHeight: 1.5,
          }}>
            {isAddr ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontFamily: tokens.fonts.mono, fontSize: 11 }}>{text}</span>
                <CopyButton value={text.trim()} />
              </div>
            ) : text}
          </div>
        ) : (
          <div style={{
            background: tokens.colors.bgSurface,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: `2px ${tokens.radii.md}px ${tokens.radii.md}px ${tokens.radii.md}px`,
            padding: '10px 14px',
            lineHeight: 1.5,
          }}>
            {renderAgentText(text, onAction)}
          </div>
        )}
      </div>
    </div>
  );
}
