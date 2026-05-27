/**
 * DashboardSkeleton — layout-aware placeholder for the league
 * landing page. Renders the rough three-band shape: hero (round
 * + lockout strip), this-week matchup card, then a row of
 * summary tiles below.
 *
 * Reuses .kl-skel shimmer.
 */
export function DashboardSkeleton() {
  return (
    <div className="dbsk">
      <div className="dbsk-hero">
        <span className="kl-skel dbsk-round" />
        <span className="kl-skel dbsk-lockout" />
      </div>
      <div className="dbsk-matchup">
        <span className="kl-skel dbsk-side" />
        <span className="kl-skel dbsk-vs" />
        <span className="kl-skel dbsk-side" />
      </div>
      <div className="dbsk-tiles">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="kl-skel dbsk-tile" />
        ))}
      </div>
    </div>
  )
}
