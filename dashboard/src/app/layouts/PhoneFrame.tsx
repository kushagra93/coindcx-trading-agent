import type { ReactNode } from 'react';
import { mobile } from '../styles/mobile';
import { tokens } from '../../styles/theme';

export function PhoneFrame({ children }: { children: ReactNode }) {
  // On narrow viewports or WebView, render full-bleed
  const isNarrow = typeof window !== 'undefined' && window.innerWidth <= 430;
  if (isNarrow) return <>{children}</>;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#050507',
      padding: 24,
    }}>
      <div style={{
        width: mobile.width,
        height: mobile.height,
        borderRadius: 40,
        border: `2px solid ${tokens.colors.border}`,
        background: tokens.colors.bg,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Minimal status bar / Dynamic Island */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 28,
          background: '#000',
          borderRadius: 14,
          zIndex: 200,
        }} />
        {/* Screen content */}
        <div style={{
          width: '100%',
          height: '100%',
          overflow: 'auto',
          position: 'relative',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
