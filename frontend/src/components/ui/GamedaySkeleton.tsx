/**
 * GamedaySkeleton — layout-aware loading placeholder for GamedayPage.
 *
 * Renders the rough shape of a matchup view: hero with two team
 * blocks + score, then two columns of player rows.
 *
 * Reuses .kl-skel shimmer + the .sqsk-* tokens from style.css where
 * possible to avoid CSS duplication.
 */
export function GamedaySkeleton() {
  return (
    <div className="gdsk">
      <div className="gdsk-hero">
        <div className="gdsk-side">
          <span className="kl-skel gdsk-logo" />
          <span className="kl-skel gdsk-name" />
        </div>
        <span className="kl-skel gdsk-score" />
        <div className="gdsk-side gdsk-side-r">
          <span className="kl-skel gdsk-name" />
          <span className="kl-skel gdsk-logo" />
        </div>
      </div>
      <div className="gdsk-cols">
        {[0, 1].map(col => (
          <div key={col} className="gdsk-col">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="kl-skel gdsk-row" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
