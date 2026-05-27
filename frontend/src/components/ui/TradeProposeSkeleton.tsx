/**
 * TradeProposeSkeleton — placeholder for the trade builder.
 *
 * Three bands: header (recipient select + period toggle) + sticky
 * deal-poster (two team blocks separated by arrow) + roster columns
 * below (my players / their players). Reuses .kl-skel shimmer.
 */
export function TradeProposeSkeleton() {
  return (
    <div className="tpsk">
      <div className="tpsk-header">
        <span className="kl-skel tpsk-recipient" />
        <span className="kl-skel tpsk-period" />
      </div>
      <div className="tpsk-deal">
        <span className="kl-skel tpsk-side" />
        <span className="kl-skel tpsk-arrow" />
        <span className="kl-skel tpsk-side" />
      </div>
      <div className="tpsk-cols">
        {[0, 1].map(col => (
          <div key={col} className="tpsk-col">
            <span className="kl-skel tpsk-colhead" />
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="kl-skel tpsk-row" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
