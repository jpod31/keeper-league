import { Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Activity {
  user: string
  path: string
  method: string
  status: number
  time: string | null
}

interface AdminData {
  total_users: number
  total_leagues: number
  total_teams: number
  views_today: number
  activity: Activity[]
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div className="col-md-3">
      <div className="card">
        <div className="card-body">
          <div className="d-flex align-items-center gap-3">
            <div
              style={{
                width: 48, height: 48, borderRadius: 12,
                background: color + '20', color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              <i className={`bi ${icon}`}></i>
            </div>
            <div>
              <div className="text-secondary" style={{ fontSize: '.7rem', textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

async function syncPositions() {
  if (!confirm('Sync player positions from Footywire?')) return
  const fd = new FormData()
  await fetch('/admin/sync-positions', { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' })
  alert('Sync requested. Reload to see results.')
}

async function syncInjuries() {
  if (!confirm('Sync injuries from AFL?')) return
  const fd = new FormData()
  await fetch('/admin/sync-injuries', { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' })
  alert('Sync requested. Reload to see results.')
}

export function AdminDashboardPage() {
  const { data, loading } = useFetch<AdminData>('/admin/?format=json')

  if (loading) return <Spinner text="Loading admin dashboard..." />
  if (!data) return <p className="text-danger">Failed to load admin dashboard</p>

  return (
    <div className="container py-4">
      <div className="page-header">
        <h2><i className="bi bi-bar-chart-line me-2" style={{ color: '#d29922' }}></i>Admin Dashboard</h2>
        <div className="d-flex gap-2">
          <Link to="/admin/users" className="btn btn-sm btn-outline-secondary">Users</Link>
          <Link to="/admin/leagues" className="btn btn-sm btn-outline-secondary">Leagues</Link>
          <Link to="/admin/analytics" className="btn btn-sm btn-outline-secondary">Analytics</Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <Stat label="Users" value={data.total_users} icon="bi-people" color="#58a6ff" />
        <Stat label="Leagues" value={data.total_leagues} icon="bi-trophy" color="#d29922" />
        <Stat label="Teams" value={data.total_teams} icon="bi-shield" color="#3fb950" />
        <Stat label="Views Today" value={data.views_today} icon="bi-eye" color="#bc8cff" />
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Recent Activity</h5>
            </div>
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <thead>
                  <tr><th>User</th><th>Path</th><th>Method</th><th className="text-end">Status</th><th>Time</th></tr>
                </thead>
                <tbody>
                  {data.activity.map((a, i) => (
                    <tr key={i}>
                      <td>{a.user}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '.7rem' }}>{a.path}</td>
                      <td><span className="badge bg-secondary">{a.method}</span></td>
                      <td className="text-end">
                        <span className="badge" style={{ background: a.status < 400 ? 'rgba(63,185,80,.15)' : 'rgba(248,81,73,.15)', color: a.status < 400 ? '#3fb950' : '#f85149' }}>
                          {a.status}
                        </span>
                      </td>
                      <td className="text-secondary" style={{ fontSize: '.7rem' }}>
                        {a.time ? new Date(a.time).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Sync Actions</h5></div>
            <div className="card-body">
              <button className="btn btn-outline-primary w-100 mb-2" onClick={syncPositions}>
                <i className="bi bi-arrow-clockwise me-1"></i>Sync Positions
              </button>
              <button className="btn btn-outline-primary w-100" onClick={syncInjuries}>
                <i className="bi bi-bandaid me-1"></i>Sync Injuries
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
