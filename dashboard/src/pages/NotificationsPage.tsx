import { useState } from 'react';
import { Card } from '../components/Card';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Bell, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Settings } from 'lucide-react';

const mockNotifications = [
  { id: 'n1', type: 'trade', title: 'Trade Executed: Buy SOL', description: 'Bought 15.5 SOL at $142.50 via Jupiter', time: '2 min ago', read: false },
  { id: 'n2', type: 'trade', title: 'Trade Executed: Buy ETH', description: 'Bought 1.2 ETH at $3,200 via 1inch Fusion', time: '15 min ago', read: false },
  { id: 'n3', type: 'pnl', title: 'Daily P&L Update', description: 'Your portfolio is up +3.2% ($285.50) today', time: '1 hr ago', read: true },
  { id: 'n4', type: 'alert', title: 'Copy Trade Alert', description: 'CryptoWhale_42 opened a new SOL position. Mirrored automatically.', time: '2 hrs ago', read: true },
  { id: 'n5', type: 'warning', title: 'Strategy Paused', description: 'Grid strategy on MATIC paused due to price breakout above range', time: '3 hrs ago', read: true },
  { id: 'n6', type: 'trade', title: 'Trade Executed: Sell ARB', description: 'Sold 800 ARB at $1.25 via 1inch Fusion (trailing stop hit)', time: '5 hrs ago', read: true },
  { id: 'n7', type: 'pnl', title: 'Position Milestone', description: 'Your ETH position is up +10% since entry. Consider taking profits.', time: '1 day ago', read: true },
];

const iconMap: Record<string, { icon: typeof TrendingUp; color: string }> = {
  trade: { icon: TrendingUp, color: '#3b82f6' },
  pnl: { icon: CheckCircle, color: '#22c55e' },
  alert: { icon: Bell, color: '#a855f7' },
  warning: { icon: AlertTriangle, color: '#eab308' },
};

export function NotificationsPage() {
  const [showSettings, setShowSettings] = useState(false);
  const [threshold, setThreshold] = useState(100);
  const [pnlAlerts, setPnlAlerts] = useState(true);

  const unreadCount = mockNotifications.filter(n => !n.read).length;

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Notifications</h1>
          <p style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <Button variant="ghost" onClick={() => setShowSettings(!showSettings)}>
          <Settings size={14} /> Settings
        </Button>
      </div>

      {/* Settings */}
      {showSettings && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Notification Settings</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13 }}>Trade threshold</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Notify for trades above this amount</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13 }}>${threshold}</span>
                <input
                  type="range" min={0} max={5000} step={50} value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  style={{ width: 120, accentColor: '#3b82f6' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13 }}>P&L Alerts</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Daily summary and milestone notifications</div>
              </div>
              <button
                onClick={() => setPnlAlerts(!pnlAlerts)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none',
                  background: pnlAlerts ? '#3b82f6' : '#334155',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: pnlAlerts ? 23 : 3, transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {mockNotifications.map(n => {
          const { icon: Icon, color } = iconMap[n.type] ?? iconMap.alert;
          return (
            <Card key={n.id} hoverable style={{
              padding: '14px 16px',
              borderLeft: n.read ? undefined : `3px solid ${color}`,
            }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: `${color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} color={color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: n.read ? 400 : 600, fontSize: 13 }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{n.time}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{n.description}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
