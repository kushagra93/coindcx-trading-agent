import { useLocation, useNavigate } from 'react-router-dom';
import { PieChart, Bot, TrendingUp, User } from 'lucide-react';
import { tokens } from '../../styles/theme';
import { mobile } from '../styles/mobile';

const tabs = [
  { key: 'portfolio', label: 'Portfolio', icon: PieChart, path: '/app/portfolio' },
  { key: 'agent', label: 'Agent', icon: Bot, path: '/app/agent', hero: true },
  { key: 'markets', label: 'Markets', icon: TrendingUp, path: '/app/markets' },
  { key: 'profile', label: 'Profile', icon: User, path: '/app/profile' },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: mobile.tabBarHeight + mobile.safeBottom,
      paddingBottom: mobile.safeBottom,
      background: tokens.colors.bgSurface,
      borderTop: `1px solid ${tokens.colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 100,
      backdropFilter: 'blur(12px)',
    }}>
      {tabs.map(tab => {
        const isActive = location.pathname.startsWith(tab.path);
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 0',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {tab.hero && isActive && (
                <div style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: tokens.radii.md,
                  background: tokens.colors.accentSubtle,
                  boxShadow: `0 0 16px ${tokens.colors.accentSubtle}`,
                }} />
              )}
              <Icon
                size={22}
                color={isActive ? tokens.colors.accent : tokens.colors.textMuted}
                style={{ position: 'relative', zIndex: 1 }}
              />
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? tokens.colors.accent : tokens.colors.textMuted,
              transition: `color ${tokens.transitions.fast}`,
            }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
