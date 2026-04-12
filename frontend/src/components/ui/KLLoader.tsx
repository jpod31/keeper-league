import { useState, useEffect } from 'react'

export function KLLoader({ fixed = true }: { fixed?: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Tiny delay so the browser paints the DOM first, then fade in
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const wrapperStyle: React.CSSProperties = fixed
    ? { opacity: visible ? 1 : 0, transition: 'opacity .15s ease' }
    : {
        position: 'relative', minHeight: '60vh', inset: 'auto',
        background: 'transparent',
        opacity: visible ? 1 : 0, transition: 'opacity .15s ease',
      }

  return (
    <div className="kl-loader" style={wrapperStyle}>
      <div className="kl-loader-inner">
        <div className="kl-loader-glow"></div>
        <img src="/static/icons/kl-logo.png" alt="Keeper League" className="kl-loader-logo" />
      </div>
    </div>
  )
}

export function KLLoaderInline() {
  return <KLLoader fixed={false} />
}
