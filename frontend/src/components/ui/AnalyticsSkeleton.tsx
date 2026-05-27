/**
 * AnalyticsSkeleton — layout-aware placeholder for the heavy
 * analytics page. Renders hero stat tiles + a big chart placeholder
 * + two columns of section cards.
 *
 * Optional rebuild banner preserves the original Spinner's context
 * message ("Rebuilding analytics — this may take 20-30s on first
 * load") for the slow cold-cache path.
 */

export interface AnalyticsSkeletonProps {
  rebuilding?: boolean
}

export function AnalyticsSkeleton({ rebuilding = false }: AnalyticsSkeletonProps) {
  return (
    <div className="ansk">
      {rebuilding && (
        <div className="ansk-rebuild" role="status">
          <i className="bi bi-arrow-repeat" aria-hidden></i>
          Rebuilding analytics — this may take 20-30s on first load.
        </div>
      )}
      <div className="ansk-tiles">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="kl-skel ansk-tile" />
        ))}
      </div>
      <div className="ansk-chart kl-skel" />
      <div className="ansk-cols">
        {[0, 1].map(col => (
          <div key={col} className="ansk-col">
            <span className="kl-skel ansk-cardhead" />
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="kl-skel ansk-row" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
