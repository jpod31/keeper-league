/**
 * RowsSkeleton — generic "title + N rows" placeholder for simple
 * list / table pages. Reuses .kl-skel shimmer.
 *
 * Reach for this when a page is a single linear list and doesn't need
 * a bespoke skeleton layout. For richer shapes (2-col matchup, draft
 * room, etc.) keep building purpose-built skeletons.
 */

export interface RowsSkeletonProps {
  /** Number of placeholder rows. Default 8. */
  rows?: number
  /** Height per row in px. Default 44. */
  rowHeight?: number
  /** Show a title silhouette above the rows. Default true. */
  withTitle?: boolean
}

export function RowsSkeleton({ rows = 8, rowHeight = 44, withTitle = true }: RowsSkeletonProps) {
  return (
    <div className="rowsk">
      {withTitle && <span className="kl-skel rowsk-title" />}
      <div className="rowsk-list">
        {Array.from({ length: rows }).map((_, i) => (
          <span key={i} className="kl-skel rowsk-row" style={{ height: rowHeight }} />
        ))}
      </div>
    </div>
  )
}
