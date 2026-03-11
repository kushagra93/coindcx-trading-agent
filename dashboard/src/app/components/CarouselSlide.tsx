import type { ReactNode } from 'react';

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
        width: 80, height: 80, borderRadius: 24,
        background: 'rgba(59,130,246,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}
