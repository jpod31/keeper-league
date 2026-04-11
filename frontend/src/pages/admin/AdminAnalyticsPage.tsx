import { Link } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface AnalyticsData {
  summary: {
    total_views: number
    unique_users: number
    avg_daily: number
    change_pct: number
    prev_views: number
  }
  daily_views: { labels: string[]; data: number[] }
  daily_users: { labels: string[]; data: number[] }
  heatmap: number[][]
  users: {
    id: number
    name: string
    views: number
    active_days: number
    avg_per_day: number
    last_seen: string
    sparkline: number[]
  }[]
  features: [string, number][]
  device: { mobile: number; desktop: number }
  top_pages: { path: string; views: number }[]
}

export function AdminAnalyticsPage() {
  const [days, setDays] = useState(30)
  const { data, loading } = useFetch<AnalyticsData>(`/admin/analytics/api?days=${days}`)

  if (loading) return <Spinner text="Loading analytics..." />
  if (!data) return <p className="text-danger">Failed to load analytics</p>

  const maxDaily = Math.max(...data.daily_views.data, 1)
  const mobilePct = data.device.mobile + data.device.desktop > 0
    ? (data.device.mobile / (data.device.mobile + data.device.desktop)) * 100
    : 0

  return (
    <div className="container py-4">
      <div className="page-header">
        <h2><i className="bi bi-graph-up me-2"></i>Analytics</h2>
        <div className="d-flex gap-2 align-items-center">
          <select className="form-select form-select-sm" style={{ width: 120 }} value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
          <Link to="/admin" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left me-1"></i>Back
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <div className="text-secondary" style={{ fontSize: '.7rem' }}>TOTAL VIEWS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.summary.total_views.toLocaleString()}</div>
              <div style={{ fontSize: '.75rem', color: data.summary.change_pct >= 0 ? '#3fb950' : '#f85149' }}>
                {data.summary.change_pct >= 0 ? '▲' : '▼'} {Math.abs(data.summary.change_pct)}% vs prior
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <div className="text-secondary" style={{ fontSize: '.7rem' }}>UNIQUE USERS</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.summary.unique_users}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <div className="text-secondary" style={{ fontSize: '.7rem' }}>AVG DAILY</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.summary.avg_daily}</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card">
            <div className="card-body">
              <div className="text-secondary" style={{ fontSize: '.7rem' }}>MOBILE</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{mobilePct.toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card mb-3">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Daily Views</h5></div>
            <div className="card-body">
              <div className="d-flex align-items-end gap-1" style={{ height: 120 }}>
                {data.daily_views.data.map((v, i) => (
                  <div
                    key={i}
                    title={`${data.daily_views.labels[i]}: ${v}`}
                    style={{
                      flex: 1,
                      height: `${(v / maxDaily) * 100}%`,
                      background: '#58a6ff',
                      minHeight: 2,
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Top Users</h5></div>
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <thead><tr><th>User</th><th className="text-end">Views</th><th className="text-end">Days</th><th className="text-end">Avg/Day</th><th>Last Seen</th></tr></thead>
                <tbody>
                  {data.users.slice(0, 20).map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.name}</strong></td>
                      <td className="text-end">{u.views}</td>
                      <td className="text-end">{u.active_days}</td>
                      <td className="text-end">{u.avg_per_day}</td>
                      <td className="text-secondary" style={{ fontSize: '.7rem' }}>{u.last_seen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card mb-3">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Feature Breakdown</h5></div>
            <div className="card-body">
              {data.features.map(([feat, count]) => {
                const max = data.features[0]?.[1] || 1
                return (
                  <div key={feat} className="mb-2">
                    <div className="d-flex justify-content-between" style={{ fontSize: '.75rem' }}>
                      <span>{feat}</span>
                      <strong>{count}</strong>
                    </div>
                    <div style={{ height: 4, background: '#21262d', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: '#58a6ff' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Top Pages</h5></div>
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <tbody>
                  {data.top_pages.slice(0, 10).map((p, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: '.7rem' }}>{p.path}</td>
                      <td className="text-end"><strong>{p.views}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
