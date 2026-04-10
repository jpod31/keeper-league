import { useParams, Link } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Notification {
  id: number
  type: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string | null
}

interface NotifData {
  league: { id: number; name: string }
  notifs: Notification[]
}

function iconForType(type: string): string {
  switch (type) {
    case 'trade_received': return 'bi-arrow-left-right'
    case 'trade_accepted': return 'bi-check-circle'
    case 'trade_rejected': return 'bi-x-circle'
    case 'trade_vetoed': return 'bi-shield-exclamation'
    case 'player_delisted': return 'bi-person-dash'
    case 'message_received': return 'bi-chat-dots'
    default: return 'bi-bell'
  }
}

export function NotificationsPage() {
  const { leagueId } = useParams()
  const { data, loading, refetch } = useFetch<NotifData>(`/leagues/${leagueId}/notifications?format=json`)
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner text="Loading notifications..." />
  if (!data) return <p className="text-danger">Failed to load notifications</p>

  const { league, notifs } = data

  async function markAllRead() {
    setBusy(true)
    try {
      await fetch(`/leagues/${leagueId}/notifications/read-all`, { method: 'POST', credentials: 'include' })
      refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-8">
        <div className="page-header">
          <div className="page-breadcrumb">
            <Link to={`/leagues/${leagueId}`}>{league.name}</Link> / Notifications
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <h2>Notifications</h2>
            {notifs.length > 0 && (
              <button className="btn btn-sm btn-outline-secondary" onClick={markAllRead} disabled={busy}>
                <i className="bi bi-check-all me-1"></i>Mark all read
              </button>
            )}
          </div>
        </div>

        {notifs.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="bi bi-chat-dots" style={{ fontSize: '2.5rem', color: '#30363d' }}></i>
              <p className="text-secondary mt-2 mb-0">No notifications yet</p>
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            {notifs.map(n => (
              <a
                key={n.id}
                href={n.link || '#'}
                className="d-flex align-items-start gap-3 px-3 py-3"
                style={{
                  borderBottom: '1px solid #21262d',
                  textDecoration: 'none',
                  color: n.is_read ? '#8b949e' : '#c9d1d9',
                  background: n.is_read ? undefined : 'rgba(31,111,235,.05)',
                }}
              >
                <i className={`bi ${iconForType(n.type)}`}
                  style={{ fontSize: '1.1rem', color: '#58a6ff', marginTop: 2 }}></i>
                <div className="flex-grow-1">
                  <div style={{ fontSize: '.85rem', fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                  {n.body && (
                    <div style={{ fontSize: '.75rem', color: '#8b949e', marginTop: 2 }}>
                      {n.body.substring(0, 120)}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '.7rem', color: '#484f58', whiteSpace: 'nowrap' }}>
                  {n.created_at}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
