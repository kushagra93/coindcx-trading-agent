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
} from 'lucide-react';
import { clearAuthToken } from '../api/client';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/positions', icon: TrendingUp, label: 'Positions' },
  { to: '/strategies', icon: Bot, label: 'Strategies' },
  { to: '/leaderboard', icon: Users, label: 'Leaderboard' },
  { to: '/wallet', icon: Wallet, label: 'Wallet' },
  { to: '/risk', icon: Shield, label: 'Risk' },
  { to: '/ai-chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/notifications', icon: Bell, label: 'Alerts' },
  { to: '/admin', icon: Settings2, label: 'Admin Panel' },
  { to: '/supervisor', icon: Eye, label: 'Supervisor' },
];

export function Layout() {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        background: '#111827',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px 0',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{
          padding: '0 20px 24px',
          borderBottom: '1px solid #1e293b',
          marginBottom: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Activity size={24} color="#3b82f6" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Trading Agent</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>by CoinDCX</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px' }}>
          {navItems.map(item => {
            const isActive = location.pathname === item.to ||
              (item.to !== '/' && location.pathname.startsWith(item.to));
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  color: isActive ? '#f1f5f9' : '#94a3b8',
                  background: isActive ? '#1e293b' : 'transparent',
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  marginBottom: 2,
                  transition: 'all 0.15s',
                }}
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid #1e293b' }}>
          <button
            onClick={() => { clearAuthToken(); window.location.href = '/login'; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              width: '100%',
              fontSize: 13,
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        marginLeft: 220,
        padding: '24px 32px',
        minHeight: '100vh',
      }}>
        <Outlet />
      </main>
    </div>
  );
}
