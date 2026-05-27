/**
 * FixtureSkeleton — layout-aware loading placeholder for FixturePage.
 *
 * Round picker tabs + a stack of matchup-row placeholders. Reuses
 * the existing .kl-skel shimmer rule.
 */
export function FixtureSkeleton() {
  return (
    <div className="fxsk">
      <div className="fxsk-header">
        <span className="kl-skel fxsk-title" />
      </div>
      <div className="fxsk-rounds">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="kl-skel fxsk-round" />
        ))}
      </div>
      <div className="fxsk-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="fxsk-row">
            <span className="kl-skel fxsk-side" />
            <span className="kl-skel fxsk-score" />
            <span className="kl-skel fxsk-side" />
          </div>
        ))}
      </div>
    </div>
  )
}
