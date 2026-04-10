import { useParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Entry {
  id: number
  type: string
  title: string
  body: string | null
  link: string | null
  created_at: string | null
}

interface ActivityData {
  league: { id: number; name: string }
  entries: Entry[]
}

const TYPE_ICONS: Record<string, string> = {
  trade_received: 'bi-arrow-left-right',
  trade_accepted: 'bi-check-circle',
  trade_rejected: 'bi-x-circle',
  trade_vetoed: 'bi-shield-exclamation',
  player_delisted: 'bi-person-dash',
  message_received: 'bi-chat-dots',
  list_change: 'bi-clock-history',
}

const TYPE_COLORS: Record<string, string> = {
  trade_received: 'var(--kl-accent-yellow)',
  trade_accepted: 'var(--kl-accent-green)',
  trade_rejected: 'var(--kl-accent-red)',
  trade_vetoed: 'var(--kl-text-secondary)',
  player_delisted: 'var(--kl-accent-red)',
  message_received: 'var(--kl-accent-blue)',
  list_change: 'var(--kl-accent-blue)',
}

export function ActivityFeedPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<ActivityData>(`/leagues/${leagueId}/activity?format=json`)

  if (loading) return <Spinner text="Loading activity..." />
  if (!data) return <p className="text-danger">Failed to load activity feed</p>

  const { entries } = data

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center justify-content-between">
          <h2>
            <i className="bi bi-activity me-2" style={{ color: 'var(--kl-accent-green)' }}></i>
            Activity Feed
          </h2>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          {entries.length > 0 ? (
            entries.map(entry => (
              <a
                key={entry.id}
                href={entry.link || '#'}
                className="d-flex align-items-start gap-3 px-3 py-3 text-decoration-none"
                style={{ borderBottom: '1px solid var(--kl-border)', color: 'var(--kl-text-primary)', transition: 'background .15s' }}
              >
                <div
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--kl-bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <i
                    className={`bi ${TYPE_ICONS[entry.type] || 'bi-bell'}`}
                    style={{ color: TYPE_COLORS[entry.type] || 'var(--kl-text-secondary)', fontSize: '.9rem' }}
                  ></i>
                </div>
                <div className="flex-grow-1">
                  <div style={{ fontSize: '.85rem', fontWeight: 500 }}>{entry.title}</div>
                  {entry.body && (
                    <div style={{ fontSize: '.75rem', color: 'var(--kl-text-secondary)', marginTop: 2 }}>
                      {entry.body.substring(0, 120)}
                    </div>
                  )}
                  <div style={{ fontSize: '.65rem', color: 'var(--kl-text-muted)', marginTop: 3 }}>
                    {entry.created_at}
                  </div>
                </div>
              </a>
            ))
          ) : (
            <div className="empty-state">
              <div className="empty-icon"><i className="bi bi-activity" style={{ fontSize: '1.5rem' }}></i></div>
              <h4>No activity yet</h4>
              <p>League activity (trades, SSP signings, delists) will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
