/**
 * SquadSkeleton — layout-aware loading placeholder for SquadPage.
 *
 * Replaces the generic centred Spinner so the page outlines itself
 * while data loads. Sets expectations about what's coming
 * (hero, tab bar, field area) instead of showing a blank loading
 * state.
 *
 * Reuses the existing .kl-skel shimmer rule from style.css.
 */
export function SquadSkeleton() {
  return (
    <div className="sqsk">
      <div className="sqsk-hero">
        <span className="kl-skel sqsk-logo" />
        <span className="kl-skel sqsk-title" />
      </div>
      <div className="sqsk-tabs">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="kl-skel sqsk-tab" />
        ))}
      </div>
      <div className="sqsk-strip kl-skel" />
      <div className="sqsk-field">
        <div className="sqsk-zone">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="kl-skel sqsk-card" />
          ))}
        </div>
        <div className="sqsk-zone">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="kl-skel sqsk-card" />
          ))}
        </div>
        <div className="sqsk-zone">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="kl-skel sqsk-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
