/**
 * Full-screen Keeper League loading animation — matches templates/base.html.
 * Uses the existing .kl-loader CSS in static/style.css so visuals stay in sync
 * with the Jinja side.
 */
export function KLLoader({ fixed = true }: { fixed?: boolean }) {
  const wrapperStyle: React.CSSProperties = fixed
    ? {}
    : { position: 'relative', minHeight: '60vh', inset: 'auto', background: 'transparent' }

  return (
    <div className="kl-loader" style={wrapperStyle}>
      <div className="kl-loader-inner">
        <div className="kl-loader-glow"></div>
        <img src="/static/icons/kl-logo.png" alt="Keeper League" className="kl-loader-logo" />
      </div>
    </div>
  )
}

/** In-page version used inside routes/suspense boundaries. */
export function KLLoaderInline() {
  return <KLLoader fixed={false} />
}
