import { Zap, RefreshCw, Target, Bell, Users } from 'lucide-react';
import { tokens } from '../../styles/theme';

export type AutomationType = 'conditional_rule' | 'dca_plan' | 'limit_order' | 'price_alert' | 'copy_trade';

export interface AutomationData {
  id: string;
  type: AutomationType;
  description: string;
  status: 'active' | 'triggered' | 'completed' | 'paused';
  condition?: string;
  action?: string;
  completedBuys?: number;
  totalBuys?: number;
  nextBuyTime?: string;
  token?: string;
  triggerPrice?: number;
  currentPrice?: number;
  traderName?: string;
}

const typeConfig: Record<AutomationType, { icon: typeof Zap; label: string }> = {
  conditional_rule: { icon: Zap, label: 'Rule' },
  dca_plan: { icon: RefreshCw, label: 'DCA' },
  limit_order: { icon: Target, label: 'Limit' },
  price_alert: { icon: Bell, label: 'Alert' },
  copy_trade: { icon: Users, label: 'Copy' },
};

interface AutomationCardProps {
  data: AutomationData;
  onToggle?: (id: string) => void;
  compact?: boolean;
}

export function AutomationCard({ data, compact }: AutomationCardProps) {
  const config = typeConfig[data.type];
  const Icon = config.icon;
  const isActive = data.status === 'active';

  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 0',
      }}>
        <Icon size={12} color={tokens.colors.textSecondary} />
        <span style={{
          fontSize: 11, color: tokens.colors.textSecondary,
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {data.description}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 500,
          color: isActive ? tokens.colors.textSecondary : tokens.colors.textMuted,
        }}>
          {isActive ? 'on' : data.status}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: tokens.radii.sm,
      background: tokens.colors.bgSurface,
      border: `1px solid ${tokens.colors.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <Icon size={14} color={tokens.colors.textSecondary} style={{ marginTop: 2, flexShrink: 0 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Type + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{
              fontSize: 9, fontWeight: 600, color: tokens.colors.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {config.label}
            </span>
            <span style={{
              width: 4, height: 4, borderRadius: 2,
              background: isActive ? tokens.colors.positive : tokens.colors.textMuted,
            }} />
          </div>

          <div style={{ fontSize: 12, fontWeight: 500, color: tokens.colors.text, lineHeight: 1.4 }}>
            {data.description}
          </div>

          {/* Conditional rule — simple text, no chips */}
          {data.type === 'conditional_rule' && data.condition && data.action && (
            <div style={{ fontSize: 10, color: tokens.colors.textMuted, marginTop: 4, fontFamily: tokens.fonts.mono }}>
              if {data.condition.toLowerCase()} → {data.action.toLowerCase()}
            </div>
          )}

          {/* DCA progress */}
          {data.type === 'dca_plan' && data.totalBuys != null && data.completedBuys != null && (
            <div style={{ marginTop: 5 }}>
              <div style={{
                height: 2, borderRadius: 1, background: tokens.colors.bgInput,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 1,
                  background: tokens.colors.textSecondary,
                  width: `${(data.completedBuys / data.totalBuys) * 100}%`,
                }} />
              </div>
              <div style={{
                fontSize: 9, color: tokens.colors.textMuted, marginTop: 3,
                fontFamily: tokens.fonts.mono,
              }}>
                {data.completedBuys}/{data.totalBuys}{data.nextBuyTime ? ` · next ${data.nextBuyTime}` : ''}
              </div>
            </div>
          )}

          {/* Limit order */}
          {data.type === 'limit_order' && data.triggerPrice != null && data.currentPrice != null && (
            <div style={{ fontSize: 10, color: tokens.colors.textMuted, marginTop: 4, fontFamily: tokens.fonts.mono }}>
              target ${data.triggerPrice} · now ${data.currentPrice} ({((data.triggerPrice - data.currentPrice) / data.currentPrice * 100).toFixed(1)}%)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
