/**
 * Big inline loader with the pulsing KL logo and ambient green/blue
 * glow blobs. Use on pages that have a noticeable fetch time so the
 * screen isn't blank during load. For fast pages, prefer the no-op
 * <Spinner /> or no loader at all.
 */
export function PageLoader({ text }: { text?: string } = {}) {
  return (
    <div
      style={{
        position: 'relative',
        minHeight: 'min(60vh, 520px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '70%',
          height: '70%',
          borderRadius: '50%',
          filter: 'blur(80px)',
          background: 'rgba(63,185,80,.28)',
          animation: 'klGlowGreen 3s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-10%',
          width: '70%',
          height: '70%',
          borderRadius: '50%',
          filter: 'blur(80px)',
          background: 'rgba(31,111,235,.28)',
          animation: 'klGlowBlue 3s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <img
          src="/static/icons/kl-logo.png"
          alt=""
          style={{
            width: 'min(40vw, 180px)',
            height: 'min(40vw, 180px)',
            animation: 'klPulse 2.4s ease-in-out infinite',
          }}
        />
        {text && (
          <p style={{ fontSize: '.8rem', color: '#8b949e', margin: 0, fontWeight: 500 }}>{text}</p>
        )}
      </div>

      <style>{`
        @keyframes klPulse { 0%,100% { transform:scale(1); opacity:.88; } 50% { transform:scale(1.03); opacity:1; } }
        @keyframes klGlowGreen { 0%,100% { transform:scale(.85); opacity:.5; } 50% { transform:scale(1.15); opacity:.9; } }
        @keyframes klGlowBlue { 0%,100% { transform:scale(1.15); opacity:.9; } 50% { transform:scale(.85); opacity:.5; } }
      `}</style>
    </div>
  )
}
