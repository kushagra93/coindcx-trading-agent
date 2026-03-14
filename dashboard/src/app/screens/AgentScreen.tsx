import { useNavigate } from 'react-router-dom';
import { MessageSquare, Zap, TrendingUp, Search, Bell, RefreshCw, Target, BarChart3, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTradingData } from '../context/TradingDataContext';
import { AutomationCard, type AutomationData } from '../components/AutomationCard';
import { ActivityFeed } from '../components/ActivityFeed';
import { tokens } from '../../styles/theme';
import { mobile } from '../styles/mobile';

const prompts: { icon: typeof Zap; label: string; desc: string; command: string }[] = [
  { icon: TrendingUp, label: 'Hot Now → 100%', desc: 'Buy any trending token and auto-sell at 2x', command: 'Buy any token listed at Hot Now and sell at 100%' },
  { icon: BarChart3, label: 'RSI < 30 → Buy', desc: 'Buy US stocks on oversold RSI, sell at 20%', command: 'Buy any US stock when RSI is less than 30 and sell at 20%' },
  { icon: Search, label: 'Screen Token', desc: 'Run a full safety check on any token', command: 'Screen FARTCOIN' },
  { icon: Bell, label: 'Price Alert', desc: 'Get notified at a specific price', command: 'Set alert when BTC hits $100K' },
  { icon: Zap, label: 'Perp Trade', desc: 'Leveraged long/short on Hyperliquid', command: 'Long TSLA 3x' },
  { icon: RefreshCw, label: 'Start DCA', desc: 'Auto-buy on a schedule', command: 'DCA $50 into SOL weekly' },
];

export function AgentScreen() {
  const navigate = useNavigate();
  const { agentStatus, toggleAgent } = useApp();
  const {
    portfolio, recentTrades, events,
    conditionalRules, dcaPlans, limitOrders, priceAlerts, copyTrades,
  } = useTradingData();

  const allAutomations: AutomationData[] = [
    ...conditionalRules.map(r => ({
      id: r.id, type: 'conditional_rule' as const, description: r.description,
      status: r.status as AutomationData['status'], condition: r.condition, action: r.action,
    })),
    ...dcaPlans.map(d => ({
      id: d.id, type: 'dca_plan' as const, description: d.description,
      status: d.status as AutomationData['status'],
      completedBuys: d.completedBuys, totalBuys: d.totalBuys, nextBuyTime: d.nextBuyTime,
    })),
    ...limitOrders.map(l => ({
      id: l.id, type: 'limit_order' as const, description: l.description,
      status: l.status as AutomationData['status'],
      token: l.token, triggerPrice: l.triggerPrice, currentPrice: l.currentPrice,
    })),
    ...priceAlerts.map(a => ({
      id: a.id, type: 'price_alert' as const, description: a.description,
      status: a.status as AutomationData['status'],
    })),
    ...copyTrades.map(c => ({
      id: c.id, type: 'copy_trade' as const, description: c.description,
      status: c.status as AutomationData['status'], traderName: c.traderName,
    })),
  ];
  const activeAutomations = allAutomations.filter(a => a.status === 'active');

  const openChat = (command?: string) => {
    navigate('/app/agent/chat', command ? { state: { command } } : undefined);
  };

  return (
    <div style={{ overflow: 'auto', height: '100%', scrollbarWidth: 'none' }}>
      <div style={{ padding: `0 ${mobile.screenPadding}px`, paddingBottom: 24 }}>

        {/* ── Status + P&L Hero ── */}
        <div style={{ padding: '12px 0 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 16,
          }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: tokens.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Agent Status
            </div>
            <button onClick={toggleAgent} style={{
              padding: '5px 14px', borderRadius: 6,
              border: `1px solid ${tokens.colors.border}`,
              background: 'transparent',
              fontSize: 11, fontWeight: 600,
              color: agentStatus === 'running' ? tokens.colors.positive : tokens.colors.textSecondary,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: 3,
                background: agentStatus === 'running' ? tokens.colors.positive : tokens.colors.textMuted,
              }} />
              {agentStatus === 'running' ? 'Running' : 'Start'}
            </button>
          </div>

          {/* P&L numbers */}
          <div style={{ display: 'flex', gap: 24 }}>
            <div>
              <div style={{ fontSize: 10, color: tokens.colors.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Portfolio
              </div>
              <div style={{
                fontSize: 28, fontWeight: 700, fontFamily: tokens.fonts.mono,
                color: tokens.colors.text, letterSpacing: '-0.02em',
              }}>
                ${portfolio.totalValue.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: tokens.colors.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Today
              </div>
              <div style={{
                fontSize: 28, fontWeight: 700, fontFamily: tokens.fonts.mono,
                color: portfolio.todayPnl >= 0 ? tokens.colors.positive : tokens.colors.negative,
                letterSpacing: '-0.02em',
              }}>
                {portfolio.todayPnl >= 0 ? '+' : ''}{portfolio.todayPnlPct}%
              </div>
            </div>
          </div>
        </div>

        {/* ── Chat CTA ── */}
        <button
          onClick={() => openChat()}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', marginBottom: 20,
            borderRadius: tokens.radii.md,
            border: `1px solid ${tokens.colors.accent}30`,
            background: tokens.colors.accentSubtle,
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <MessageSquare size={20} color={tokens.colors.accent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: tokens.colors.text }}>Chat with Agent</div>
            <div style={{ fontSize: 11, color: tokens.colors.textSecondary, marginTop: 1 }}>
              Trade, screen, set alerts — in plain English
            </div>
          </div>
          <div style={{ fontSize: 18, color: tokens.colors.accent }}>→</div>
        </button>

        {/* ── Prompt Cards ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: tokens.colors.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
          }}>
            Quick Actions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {prompts.map((p, i) => {
              const Icon = p.icon;
              return (
                <button
                  key={i}
                  onClick={() => openChat(p.command)}
                  style={{
                    padding: '14px 12px', textAlign: 'left',
                    borderRadius: tokens.radii.md,
                    border: `1px solid ${tokens.colors.border}`,
                    background: tokens.colors.bgSurface,
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={16} color={tokens.colors.accent} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: tokens.colors.text, marginBottom: 2 }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 10, color: tokens.colors.textMuted, lineHeight: 1.4 }}>
                    {p.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Active Automations ── */}
        {activeAutomations.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: tokens.colors.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
            }}>
              Active Rules ({activeAutomations.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeAutomations.map(a => (
                <AutomationCard key={a.id} data={a} />
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Activity ── */}
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: tokens.colors.textMuted,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
          }}>
            Recent Activity
          </div>
          <ActivityFeed trades={recentTrades} events={events} maxItems={6} />
        </div>
      </div>
    </div>
  );
}
