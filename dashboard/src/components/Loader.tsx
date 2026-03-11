export function Loader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      color: '#64748b',
      fontSize: 13,
      gap: 8,
    }}>
      <div style={{
        width: 16,
        height: 16,
        border: '2px solid #334155',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }} />
      {text}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
