import type { ReactNode } from 'react';
import { mobile, colors } from '../styles/mobile';

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
      background: '#060910',
      padding: 24,
    }}>
      <div style={{
        width: mobile.width,
        height: mobile.height,
        borderRadius: 40,
        border: '3px solid #222',
        background: colors.bg,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 150,
          height: 30,
          background: '#000',
          borderRadius: '0 0 18px 18px',
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
