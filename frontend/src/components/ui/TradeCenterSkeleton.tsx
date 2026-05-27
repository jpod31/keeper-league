/**
 * TradeCenterSkeleton — layout-aware placeholder for the TradeCenter
 * page. Renders page header + tab bar + a few trade-card silhouettes.
 *
 * Reuses .kl-skel shimmer. Trade-card placeholder is roughly the
 * shape of a real card (two team blocks separated by an arrow).
 */
export function TradeCenterSkeleton() {
  return (
    <div className="tcsk">
      <div className="tcsk-header">
        <span className="kl-skel tcsk-title" />
        <span className="kl-skel tcsk-cta" />
      </div>
      <div className="tcsk-tabs">
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} className="kl-skel tcsk-tab" />
        ))}
      </div>
      <div className="tcsk-list">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="tcsk-card">
            <span className="kl-skel tcsk-side" />
            <span className="kl-skel tcsk-arrow" />
            <span className="kl-skel tcsk-side" />
          </div>
        ))}
      </div>
    </div>
  )
}
