/**
 * InboxSkeleton — placeholder for the DM inbox list. Header + 6
 * conversation-row silhouettes + a side card for "new message".
 *
 * Reuses .kl-skel shimmer.
 */
export function InboxSkeleton() {
  return (
    <div className="inbsk">
      <div className="inbsk-header">
        <span className="kl-skel inbsk-title" />
      </div>
      <div className="inbsk-cols">
        <div className="inbsk-list">
          <span className="kl-skel inbsk-listhead" />
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="kl-skel inbsk-row" />
          ))}
        </div>
        <div className="inbsk-side">
          <span className="kl-skel inbsk-sidehead" />
          <span className="kl-skel inbsk-input" />
          <span className="kl-skel inbsk-textarea" />
          <span className="kl-skel inbsk-btn" />
        </div>
      </div>
    </div>
  )
}
