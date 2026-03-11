import { useRef, type ReactNode } from 'react';
import { colors } from '../styles/mobile';

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
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
        }}
      />
      {/* Sheet */}
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
          background: colors.bgCard,
          borderRadius: '20px 20px 0 0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.25s ease-out',
        }}
      >
        {/* Drag handle */}
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
            background: '#334155',
          }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  );
}
