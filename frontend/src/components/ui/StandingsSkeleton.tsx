/**
 * StandingsSkeleton — layout-aware placeholder for the StandingsPage.
 *
 * Page title + ten ladder rows (most leagues are 8-12 teams).
 * Reuses .kl-skel shimmer.
 */
export function StandingsSkeleton() {
  return (
    <div className="stsk">
      <div className="stsk-header">
        <span className="kl-skel stsk-title" />
        <span className="kl-skel stsk-meta" />
      </div>
      <div className="stsk-list">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="stsk-row">
            <span className="kl-skel stsk-rank" />
            <span className="kl-skel stsk-name" />
            <span className="kl-skel stsk-cell" />
            <span className="kl-skel stsk-cell" />
            <span className="kl-skel stsk-cell" />
          </div>
        ))}
      </div>
    </div>
  )
}
