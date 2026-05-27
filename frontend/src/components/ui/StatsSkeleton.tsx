/**
 * StatsSkeleton — layout-aware placeholder for the stats page.
 *
 * Title + grid of 4 leader-table card placeholders (scoring,
 * consistency, ceiling, ironman). Reuses .kl-skel shimmer.
 */
export function StatsSkeleton() {
  return (
    <div className="ssksk">
      <div className="ssksk-header">
        <span className="kl-skel ssksk-title" />
      </div>
      <div className="ssksk-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="ssksk-card">
            <span className="kl-skel ssksk-cardhead" />
            {Array.from({ length: 6 }).map((_, j) => (
              <span key={j} className="kl-skel ssksk-row" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
