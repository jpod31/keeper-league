/**
 * Inline loading indicator — small pulsing KL logo.
 * Renders immediately, doesn't block the screen.
 */
export function Spinner({ text }: { text?: string } = {}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 10 }}>
      <img
        src="/static/icons/kl-logo.png"
        alt=""
        style={{
          width: 64, height: 64,
          animation: 'klPulse 1.8s ease-in-out infinite',
          opacity: 0.7,
        }}
      />
      {text && <p style={{ fontSize: '.78rem', color: '#484f58', margin: 0 }}>{text}</p>}
      <style>{`@keyframes klPulse { 0%,100% { transform:scale(1); opacity:.5; } 50% { transform:scale(1.06); opacity:.85; } }`}</style>
    </div>
  )
}
