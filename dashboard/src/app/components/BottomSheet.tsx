import { useRef, type ReactNode } from 'react';
import { tokens } from '../../styles/theme';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  height?: string;
  children: ReactNode;
}

export function BottomSheet({ isOpen, onClose, height = '92%', children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientY - startY.current;
    if (diff > 80) onClose();
  };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 300,
    }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
        }}
      />
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height,
          background: tokens.colors.bgSurface,
          borderRadius: `${tokens.radii.xl}px ${tokens.radii.xl}px 0 0`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '10px 0 6px',
          flexShrink: 0,
        }}>
          <div style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: tokens.colors.border,
          }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
