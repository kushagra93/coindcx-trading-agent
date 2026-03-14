import { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Bot,
  Shield,
  Wallet,
  Bell,
  MessageSquare,
  LogOut,
  Activity,
  Settings2,
  Eye,
  ChevronDown,
} from 'lucide-react';
import { clearAuthToken } from '../api/client';
import { tokens } from '../styles/theme';

const primaryNav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/positions', icon: TrendingUp, label: 'Positions' },
  { to: '/ai-chat', icon: MessageSquare, label: 'Agent' },
  { to: '/leaderboard', icon: Users, label: 'Leaderboard' },
];

const moreNav = [
  { to: '/strategies', icon: Bot, label: 'Strategies' },
  { to: '/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/risk', icon: Shield, label: 'Risk' },
  { to: '/notifications', icon: Bell, label: 'Alerts' },
  { to: '/admin', icon: Settings2, label: 'Admin' },
  { to: '/supervisor', icon: Eye, label: 'Supervisor' },
];

export function Layout() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (to: string) =>
    location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Horizontal Header */}
      <header style={{
        height: 56,
        background: tokens.colors.bgSurface,
        borderBottom: `1px solid ${tokens.colors.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
      }}>
        {/* Left: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32 }}>
          <Activity size={22} color={tokens.colors.accent} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: tokens.colors.text }}>Trading Agent</div>
            <div style={{ fontSize: 9, color: tokens.colors.textMuted, marginTop: -2 }}>by CoinDCX</div>
          </div>
        </div>

        {/* Center: Nav links */}
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {primaryNav.map(item => {
            const active = isActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: tokens.radii.sm,
                  color: active ? tokens.colors.text : tokens.colors.textSecondary,
                  background: active ? tokens.colors.bgElevated : 'transparent',
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  transition: `all ${tokens.transitions.fast}`,
                  position: 'relative',
                }}
              >
                <item.icon size={16} />
                {item.label}
                {active && (
                  <div style={{
                    position: 'absolute',
                    bottom: -1,
                    left: 14,
                    right: 14,
                    height: 2,
                    background: tokens.colors.accent,
                    borderRadius: 1,
                  }} />
                )}
              </NavLink>
            );
          })}

          {/* More dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '8px 14px',
                borderRadius: tokens.radii.sm,
                background: moreOpen ? tokens.colors.bgElevated : 'transparent',
                border: 'none',
                color: tokens.colors.textSecondary,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              More <ChevronDown size={14} />
            </button>
            {moreOpen && (
              <>
                <div
                  onClick={() => setMoreOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: tokens.colors.bgElevated,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: tokens.radii.md,
                  padding: 4,
                  minWidth: 180,
                  zIndex: 100,
                  boxShadow: tokens.shadows.elevated,
                }}>
                  {moreNav.map(item => {
                    const active = isActive(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMoreOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 12px',
                          borderRadius: tokens.radii.sm,
                          color: active ? tokens.colors.text : tokens.colors.textSecondary,
                          background: active ? tokens.colors.bgInput : 'transparent',
                          textDecoration: 'none',
                          fontSize: 13,
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        <item.icon size={15} />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </nav>

        {/* Right: Agent status + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: tokens.colors.positive,
              boxShadow: `0 0 8px ${tokens.colors.positive}`,
            }} />
            <span style={{ fontSize: 11, color: tokens.colors.textSecondary }}>Agent Running</span>
          </div>
          <button
            onClick={() => { clearAuthToken(); window.location.href = '/login'; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: tokens.radii.sm,
              background: 'transparent',
              border: `1px solid ${tokens.colors.border}`,
              color: tokens.colors.textSecondary,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{
        flex: 1,
        marginTop: 56,
        padding: '24px 32px',
        minHeight: 'calc(100vh - 56px)',
      }}>
        <Outlet />
      </main>
    </div>
  );
}
