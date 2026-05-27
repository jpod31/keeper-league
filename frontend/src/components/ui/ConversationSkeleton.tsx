/**
 * ConversationSkeleton — chat-shaped placeholder. Header silhouette
 * + an alternating-sides message stack + input-bar silhouette.
 *
 * Reuses .kl-skel shimmer.
 */
export function ConversationSkeleton() {
  return (
    <div className="cvsk">
      <div className="cvsk-header">
        <span className="kl-skel cvsk-back" />
        <span className="kl-skel cvsk-title" />
      </div>
      <div className="cvsk-stack">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className={`kl-skel cvsk-bubble cvsk-bubble-${i % 2 === 0 ? 'in' : 'out'}`}
            style={{ width: `${50 + ((i * 37) % 40)}%` }}
          />
        ))}
      </div>
      <div className="cvsk-input kl-skel" />
    </div>
  )
}
