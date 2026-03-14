import { tokens } from '../../styles/theme';
import type { TradeEvent, EventEntry } from '../context/TradingDataContext';

interface ActivityItem {
  id: string;
  type: 'trade' | 'alert' | 'rule' | 'system';
  description: string;
  token?: string;
  amount?: string;
  timestamp: number;
}

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const dotColors: Record<string, string> = {
  trade: tokens.colors.positive,
  alert: tokens.colors.warning,
  rule: tokens.colors.accent,
  system: tokens.colors.info,
};

function mergeAndSort(trades: TradeEvent[], events: EventEntry[]): ActivityItem[] {
  const items: ActivityItem[] = [];

  trades.forEach(t => {
    items.push({
      id: t.id,
      type: 'trade',
      description: `${t.side === 'buy' ? 'Bought' : 'Sold'} ${t.amount} ${t.token}`,
      token: t.token,
      amount: t.price,
      timestamp: t.timestamp,
    });
  });

  events.forEach((e, i) => {
    const type = e.type.includes('trade') ? 'trade' as const
      : e.type.includes('circuit') ? 'alert' as const
      : e.type.includes('command') ? 'rule' as const
      : 'system' as const;
    items.push({
      id: `ev-${i}`,
      type,
      description: e.type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      token: (e.payload.token as string) || undefined,
      amount: e.payload.volumeUsd ? `$${e.payload.volumeUsd}` : undefined,
      timestamp: e.timestamp,
    });
  });

  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
}

interface ActivityFeedProps {
  trades: TradeEvent[];
  events: EventEntry[];
  maxItems?: number;
}

export function ActivityFeed({ trades, events, maxItems = 10 }: ActivityFeedProps) {
  const items = mergeAndSort(trades, events).slice(0, maxItems);

  if (items.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: tokens.colors.textMuted, fontSize: 12 }}>
        No recent activity
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '8px 0',
            borderBottom: i < items.length - 1 ? `1px solid ${tokens.colors.border}` : 'none',
          }}
        >
          {/* Timeline dot + line */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: dotColors[item.type],
              flexShrink: 0,
            }} />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 12, color: tokens.colors.text, fontWeight: 500 }}>
                {item.description}
              </span>
              <span style={{
                fontSize: 10,
                color: tokens.colors.textMuted,
                fontFamily: tokens.fonts.mono,
                flexShrink: 0,
              }}>
                {formatRelativeTime(item.timestamp)}
              </span>
            </div>
            {(item.token || item.amount) && (
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {item.token && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: tokens.colors.accent,
                    background: tokens.colors.accentSubtle,
                    padding: '1px 5px',
                    borderRadius: 4,
                  }}>
                    {item.token}
                  </span>
                )}
                {item.amount && (
                  <span style={{ fontSize: 10, color: tokens.colors.textSecondary, fontFamily: tokens.fonts.mono }}>
                    {item.amount}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
