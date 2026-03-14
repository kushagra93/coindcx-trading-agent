import type { ReactNode } from 'react';
import { tokens } from '../../styles/theme';

interface CarouselSlideProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function CarouselSlide({ icon, title, description }: CarouselSlideProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '20px 24px',
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: tokens.radii.xl,
        background: tokens.colors.accentSubtle,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: tokens.colors.textSecondary, lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}
