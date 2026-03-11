export function StepIndicator({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '12px 0' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? 20 : 6,
            height: 6,
            borderRadius: 3,
            background: i === current ? '#3b82f6' : '#334155',
            transition: 'all 0.2s',
          }}
        />
      ))}
    </div>
  );
}
