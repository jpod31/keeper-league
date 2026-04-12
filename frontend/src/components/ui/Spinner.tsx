/**
 * Lightweight inline loading indicator — a small centered spinner.
 * Shows immediately (no delay). Does NOT block the screen with a
 * full-screen overlay. The page layout stays visible behind it.
 */
export function Spinner({ text }: { text?: string } = {}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', gap: 12 }}>
      <div
        style={{
          width: 32, height: 32,
          border: '3px solid #21262d',
          borderTopColor: '#58a6ff',
          borderRadius: '50%',
          animation: 'spin .7s linear infinite',
        }}
      />
      {text && <p style={{ fontSize: '.82rem', color: '#6e7681', margin: 0 }}>{text}</p>}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
