/**
 * Big inline loader with the pulsing KL logo and an ambient halo that
 * fades naturally via radial gradients — no rectangular clipping box.
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
      }}
    >
      {/* Radial halo — green and blue, centered on the logo, fades to nothing */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 640,
          height: 640,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle at 35% 40%, rgba(63,185,80,.35), rgba(63,185,80,0) 55%), radial-gradient(circle at 65% 60%, rgba(31,111,235,.35), rgba(31,111,235,0) 55%)',
          filter: 'blur(40px)',
          animation: 'klHalo 3s ease-in-out infinite',
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
        @keyframes klHalo {
          0%,100% { transform: translate(-50%, -50%) scale(.95); opacity:.6; }
          50%     { transform: translate(-50%, -50%) scale(1.08); opacity:1; }
        }
      `}</style>
    </div>
  )
}
