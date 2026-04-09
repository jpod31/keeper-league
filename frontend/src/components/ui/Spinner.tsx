export function Spinner({ text }: { text?: string }) {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center gap-3" style={{ minHeight: '60vh' }}>
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      {text && <p style={{ fontSize: '.85rem', color: 'var(--kl-text-muted)' }}>{text}</p>}
    </div>
  )
}
