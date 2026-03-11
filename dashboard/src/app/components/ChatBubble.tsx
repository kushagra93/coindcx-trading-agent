import { useState } from 'react';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  text: string;
  onAction?: (command: string) => void;
}

/** Inline copy button for contract addresses */
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
        border: '1px solid #334155', background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
        color: copied ? '#22c55e' : '#64748b', fontSize: 9, fontWeight: 600,
        cursor: 'pointer', transition: 'all 0.15s', verticalAlign: 'middle',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/** Extract buy options from screening text like: Say "buy TOKEN $50" / "$200" / "$500" */
function extractBuyOptions(text: string): { token: string; amounts: number[] } | null {
  // Match: Say "buy TOKEN $50" / "$200" / "$500"
  const match = text.match(/Say "buy (\S+) \$(\d+)"\s*\/\s*"\$(\d+)"\s*\/\s*"\$(\d+)"/);
  if (match) return { token: match[1], amounts: [parseInt(match[2]), parseInt(match[3]), parseInt(match[4])] };
  return null;
}

/** Color-code structured agent responses */
function renderAgentText(text: string, onAction?: (command: string) => void) {
  const lines = text.split('\n');
  const buyOpts = extractBuyOptions(text);

  return lines.map((line, i) => {
    const key = i;
    // Section headers (--- Title ---)
    if (line.match(/^---\s.+\s---$/)) {
      return (
        <div key={key} style={{ color: '#3b82f6', fontWeight: 600, fontSize: 11, marginTop: 8, marginBottom: 2, letterSpacing: 0.5 }}>
          {line.replace(/---/g, '').trim()}
        </div>
      );
    }
    // Top-level titles (all caps first line)
    if (i === 0 && line === line.toUpperCase() && line.length > 3) {
      return <div key={key} style={{ fontWeight: 700, fontSize: 14, color: '#f8fafc', marginBottom: 2 }}>{line}</div>;
    }
    // Token name line
    if (line.startsWith('Name: ')) {
      return <div key={key} style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{line}</div>;
    }
    // Status badges: Grade, BUY, BLOCKED, SOLD
    if (line.startsWith('Grade: A')) return <div key={key} style={{ color: '#22c55e', fontWeight: 600 }}>{line}</div>;
    if (line.startsWith('Grade: B')) return <div key={key} style={{ color: '#eab308', fontWeight: 600 }}>{line}</div>;
    if (line.startsWith('Grade: C') || line.startsWith('Grade: D')) return <div key={key} style={{ color: '#f97316', fontWeight: 600 }}>{line}</div>;
    if (line.startsWith('Grade: F')) return <div key={key} style={{ color: '#ef4444', fontWeight: 600 }}>{line}</div>;
    // AI Confidence line
    if (line.startsWith('AI Confidence:')) {
      const pct = parseInt(line.match(/(\d+)/)?.[1] ?? '0');
      return <div key={key} style={{ color: pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444', fontSize: 12, fontWeight: 600 }}>{line}</div>;
    }
    // Rug Probability line
    if (line.startsWith('Rug Probability:')) {
      const pct = parseInt(line.match(/(\d+)/)?.[1] ?? '100');
      return <div key={key} style={{ color: pct <= 20 ? '#22c55e' : pct <= 50 ? '#eab308' : '#ef4444', fontSize: 12, fontWeight: 600 }}>{line}</div>;
    }
    // Contract address — with copy button
    if (line.startsWith('Contract:')) {
      const addr = line.replace('Contract:', '').trim();
      // Find full address from the original text (the short version is displayed but we want full for copy)
      const evmFull = text.match(/0x[a-fA-F0-9]{40}/)?.[0];
      const solFull = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/)?.[0];
      const fullAddr = evmFull ?? solFull ?? addr;
      return (
        <div key={key} style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', display: 'flex', alignItems: 'center' }}>
          {line}
          <CopyButton value={fullAddr} />
        </div>
      );
    }
    // Data source lines with + (safe), * (warn), X (danger) prefixes
    if (line.startsWith('+ ') && line.includes(':')) return <div key={key} style={{ color: '#22c55e', fontSize: 11 }}>{line}</div>;
    // Positive P&L
    if (line.match(/P&L:.*\+/)) return <div key={key} style={{ color: '#22c55e' }}>{line}</div>;
    if (line.match(/P&L:.*-/)) return <div key={key} style={{ color: '#ef4444' }}>{line}</div>;
    // Warning/issue markers
    if (line.startsWith('X ')) return <div key={key} style={{ color: '#ef4444', fontSize: 12 }}>{line}</div>;
    if (line.startsWith('* ')) return <div key={key} style={{ color: '#eab308', fontSize: 12 }}>{line}</div>;
    // Active exit [ON]/[OFF]
    if (line.includes('[ON]')) return <div key={key} style={{ color: '#22c55e', fontSize: 12 }}>{line}</div>;
    if (line.includes('[OFF]')) return <div key={key} style={{ color: '#64748b', fontSize: 12 }}>{line}</div>;
    // Recommendation lines
    if (line.startsWith('BUY')) return <div key={key} style={{ color: '#22c55e', fontWeight: 600, marginTop: 4 }}>{line}</div>;
    if (line.startsWith('AVOID') || line.startsWith('DO NOT') || line.startsWith('SKIP') || line.startsWith('BLOCKED')) {
      return <div key={key} style={{ color: '#ef4444', fontWeight: 600, marginTop: 4 }}>{line}</div>;
    }
    if (line.startsWith('RISKY')) return <div key={key} style={{ color: '#f97316', fontWeight: 600, marginTop: 4 }}>{line}</div>;
    // Meme safety callouts
    if (line.startsWith('MEME SAFETY') || line.startsWith('Ladder exit') || line.startsWith('Low-cap')) {
      return <div key={key} style={{ color: '#eab308', fontSize: 12, fontStyle: 'italic' }}>{line}</div>;
    }
    // Buy prompt line — render as buttons
    if (line.startsWith('Say "buy') && buyOpts && onAction) {
      return (
        <div key={key} style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {buyOpts.amounts.map(amt => (
            <button
              key={amt}
              onClick={() => onAction(`buy ${buyOpts.token} $${amt}`)}
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                border: 'none',
                background: '#22c55e',
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseOver={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseOut={e => (e.currentTarget.style.opacity = '1')}
            >
              Buy ${amt}
            </button>
          ))}
        </div>
      );
    }
    // "buy force" override prompt — render as button
    if (line.startsWith('Say "buy') && line.includes('force') && onAction) {
      const forceMatch = line.match(/Say "buy (\S+) force"/);
      if (forceMatch) {
        return (
          <div key={key} style={{ marginTop: 6 }}>
            <button
              onClick={() => onAction(`buy ${forceMatch[1]} $50 force`)}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: '1px solid #ef4444',
                background: 'rgba(239,68,68,0.1)',
                color: '#ef4444',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Force Buy $50 (Override)
            </button>
          </div>
        );
      }
    }
    // Empty lines
    if (line.trim() === '') return <div key={key} style={{ height: 4 }} />;
    // Default
    return <div key={key}>{line}</div>;
  });
}

/** Check if text looks like a contract address */
function isContractAddress(text: string): boolean {
  const trimmed = text.trim();
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
}

export function ChatBubble({ role, text, onAction }: ChatBubbleProps) {
  const isUser = role === 'user';
  const isAddr = isUser && isContractAddress(text);
  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 10,
    }}>
      <div style={{
        maxWidth: isUser ? '80%' : '92%',
        padding: '10px 14px',
        borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        background: isUser ? '#3b82f6' : '#1e293b',
        color: '#f1f5f9',
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {isUser ? (
          isAddr ? (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{text}</span>
              <CopyButton value={text.trim()} />
            </div>
          ) : text
        ) : renderAgentText(text, onAction)}
      </div>
    </div>
  );
}
