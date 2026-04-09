import { useParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { post } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'

interface Notification {
  id: number
  type: string
  title: string
  body: string
  read: boolean
  created: string
  link: string | null
}

export function NotificationsPage() {
  const { leagueId } = useParams()
  const { data, loading, refetch } = useFetch<Notification[]>(`/api/leagues/${leagueId}/notifications`)
  const { toast } = useToast()

  const markAllRead = async () => {
    await post(`/api/leagues/${leagueId}/notifications/read-all`)
    toast('All marked as read', 'success')
    refetch()
  }

  if (loading) return <Spinner />
  if (!data) return <p className="text-danger">Failed to load</p>

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0" style={{ color: 'var(--kl-text-heading)' }}>Notifications</h4>
        {data.some(n => !n.read) && (
          <button className="btn btn-outline-secondary btn-sm" onClick={markAllRead}>
            <i className="bi bi-check-all me-1"></i>Mark all read
          </button>
        )}
      </div>

      {data.length === 0 ? (
        <div className="empty-state" style={{ padding: '4rem 2rem' }}>
          <div className="empty-icon" style={{ width: 64, height: 64 }}>
            <i className="bi bi-bell" style={{ fontSize: '1.5rem' }}></i>
          </div>
          <h4>No notifications</h4>
          <p>You're all caught up.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            {data.map(n => (
              <div key={n.id}
                className={`d-flex align-items-start gap-3 px-3 py-2${!n.read ? ' notif-unread' : ''}`}
                style={{ borderBottom: '1px solid var(--kl-border)', background: !n.read ? 'rgba(31,111,235,.06)' : undefined }}>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--kl-accent-blue)', marginTop: 6, flexShrink: 0 }}></span>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '.82rem', fontWeight: 500, color: 'var(--kl-text-heading)' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: '.75rem', color: 'var(--kl-text-secondary)', marginTop: 1 }}>{n.body}</div>}
                  <div style={{ fontSize: '.65rem', color: 'var(--kl-text-faint)', marginTop: 2 }}>{n.created}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
