/**
 * DraftSkeleton — layout-aware loading placeholder for DraftRoomPage.
 *
 * Renders the room's three-band shape: pick clock header (timer +
 * "on the clock" banner), then a two-column main area (available
 * players on the left, draft board on the right), then a row of
 * recent-pick chips.
 *
 * Reuses .kl-skel shimmer from style.css.
 */
export function DraftSkeleton() {
  return (
    <div className="drsk">
      <div className="drsk-clock">
        <span className="kl-skel drsk-timer" />
        <span className="kl-skel drsk-onclock" />
      </div>
      <div className="drsk-cols">
        <div className="drsk-col drsk-col-list">
          <span className="kl-skel drsk-filter" />
          {Array.from({ length: 14 }).map((_, i) => (
            <span key={i} className="kl-skel drsk-row" />
          ))}
        </div>
        <div className="drsk-col drsk-col-board">
          <span className="kl-skel drsk-board-head" />
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="kl-skel drsk-board-row" />
          ))}
        </div>
      </div>
      <div className="drsk-history">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="kl-skel drsk-pick" />
        ))}
      </div>
    </div>
  )
}
