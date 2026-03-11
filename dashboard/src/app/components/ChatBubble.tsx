interface ChatBubbleProps {
  role: 'user' | 'assistant';
  text: string;
}

/** Color-code structured agent responses */
function renderAgentText(text: string) {
  const lines = text.split('\n');
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
    // Contract address
    if (line.startsWith('Contract:')) return <div key={key} style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{line}</div>;
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
    // Empty lines
    if (line.trim() === '') return <div key={key} style={{ height: 4 }} />;
    // Default
    return <div key={key}>{line}</div>;
  });
}

export function ChatBubble({ role, text }: ChatBubbleProps) {
  const isUser = role === 'user';
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
        {isUser ? text : renderAgentText(text)}
      </div>
    </div>
  );
}
