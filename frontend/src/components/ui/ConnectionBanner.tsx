import type { ConnectionState } from '../../hooks/useSocket'

export function ConnectionBanner({ state }: { state: ConnectionState }) {
  if (state === 'connected') return null
  const isReconnecting = state === 'connecting' || state === 'disconnected'
  const isError = state === 'error'
  const label = isError ? 'Connection lost — retrying…' : 'Reconnecting…'
  const color = isError ? '#f85149' : '#d29922'

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '6px 12px',
      background: 'rgba(248, 81, 73, .08)',
      borderBottom: `1px solid ${color}`,
      color,
      fontSize: '.75rem',
      fontWeight: 600,
    }}>
      {isReconnecting && (
        <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12, borderWidth: 2 }} />
      )}
      <span>{label}</span>
    </div>
  )
}
