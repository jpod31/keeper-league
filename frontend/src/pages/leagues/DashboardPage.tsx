import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useLeague } from '../../contexts/LeagueContext'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface DashboardData {
  standings: { team_id: number; name: string; wins: number; losses: number; draws: number; points: number; pct: number; for: number }[]
  current_round: number
  recent_results: { fixture_id: number; home: string; away: string; home_score: number; away_score: number }[]
  user_team_summary: { name: string; record: string; rank: number } | null
}

export function DashboardPage() {
  const { league } = useLeague()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!league) return
    api<DashboardData>(`/api/leagues/${league.id}/dashboard`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [league?.id])

  if (loading || !league) return <Spinner text="Loading..." />
  if (!data) return <p className="text-danger">Failed to load dashboard</p>

  const lid = league.id
  const t = league.user_team

  return (
    <div>
      {/* Page header - matches dashboard.html */}
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h4 className="fw-bold mb-1" style={{ color: 'var(--kl-text-heading)' }}>{league.name}</h4>
          <div className="d-flex align-items-center gap-2">
            <span className={`status-pill status-${league.season_phase}`} style={{ fontSize: '.68rem' }}>
              {league.season_phase}
            </span>
            <span style={{ fontSize: '.78rem', color: 'var(--kl-text-secondary)' }}>{league.season_year} Season</span>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Teams card */}
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span className="fw-bold" style={{ color: 'var(--kl-text-heading)' }}>Teams</span>
              <span style={{ fontSize: '.75rem', color: 'var(--kl-text-secondary)' }}>{league.teams.length} teams</span>
            </div>
            <div className="card-body p-0">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>Team</th>
                    <th>Owner</th>
                    <th className="text-end">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {data.standings.map((s, i) => {
                    const isUser = t?.id === s.team_id
                    return (
                      <tr key={s.team_id}>
                        <td style={{ color: 'var(--kl-text-faint)' }}>{i + 1}</td>
                        <td>
                          <Link to={`/leagues/${lid}/team/${s.team_id}`} className="text-decoration-none fw-bold" style={{ color: 'var(--kl-text-heading)' }}>
                            {s.name}
                          </Link>
                          {isUser && <span className="badge ms-2" style={{ background: 'var(--kl-accent-blue)', fontSize: '.6rem' }}>You</span>}
                        </td>
                        <td style={{ color: 'var(--kl-text-secondary)' }}>
                          {league.teams.find(tm => tm.id === s.team_id)?.owner || ''}
                        </td>
                        <td className="text-end">
                          <span style={{ color: 'var(--kl-text-heading)', fontWeight: 600 }}>{s.wins}-{s.losses}</span>
                          {s.draws > 0 && <span style={{ color: 'var(--kl-text-secondary)' }}>-{s.draws}</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent results */}
          {data.recent_results.length > 0 && (
            <div className="card mt-3">
              <div className="card-header d-flex align-items-center gap-2">
                <i className="bi bi-trophy" style={{ color: '#3fb950' }}></i>
                <span className="fw-bold" style={{ fontSize: '.85rem' }}>Round {data.current_round} Results</span>
              </div>
              <div className="card-body p-0">
                {data.recent_results.map(r => (
                  <Link key={r.fixture_id} to={`/leagues/${lid}/matchup/${r.fixture_id}`}
                    className="d-flex align-items-center justify-content-between px-3 py-2 text-decoration-none"
                    style={{ borderBottom: '1px solid #21262d' }}>
                    <span style={{ fontSize: '.85rem', fontWeight: 500, color: r.home_score > r.away_score ? '#e6edf3' : '#8b949e', flex: 1 }}>{r.home}</span>
                    <div className="d-flex align-items-center gap-2 mx-3">
                      <span className="fw-bold" style={{ color: r.home_score > r.away_score ? '#3fb950' : '#8b949e' }}>{r.home_score}</span>
                      <span style={{ color: '#484f58', fontSize: '.75rem' }}>-</span>
                      <span className="fw-bold" style={{ color: r.away_score > r.home_score ? '#3fb950' : '#8b949e' }}>{r.away_score}</span>
                    </div>
                    <span style={{ fontSize: '.85rem', fontWeight: 500, color: r.away_score > r.home_score ? '#e6edf3' : '#8b949e', flex: 1, textAlign: 'right' }}>{r.away}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="col-lg-4">
          {/* Invite */}
          {league.invite_code && (
            <div className="card mb-3">
              <div className="card-header d-flex align-items-center gap-2">
                <i className="bi bi-link-45deg" style={{ color: '#d29922' }}></i>
                <span className="fw-bold" style={{ fontSize: '.85rem' }}>Invite Link</span>
              </div>
              <div className="card-body">
                <div className="input-group input-group-sm">
                  <input className="form-control" readOnly value={`keeperlg.com/invite/${league.invite_code}`}
                    style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)', fontSize: '.78rem' }} />
                  <button className="btn btn-outline-secondary" onClick={() => navigator.clipboard.writeText(`https://keeperlg.com/invite/${league.invite_code}`)}>
                    <i className="bi bi-clipboard"></i>
                  </button>
                </div>
                <div className="mt-2">
                  <span className="badge" style={{ background: 'var(--kl-bg-elevated)', color: 'var(--kl-text-secondary)', fontSize: '.7rem' }}>
                    Code: {league.invite_code}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* League details */}
          <div className="card">
            <div className="card-header">
              <span className="fw-bold" style={{ fontSize: '.85rem' }}>League Details</span>
            </div>
            <div className="card-body">
              <div className="info-row">
                <span className="info-label">Teams</span>
                <span className="info-value">{league.teams.length}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Season</span>
                <span className="info-value">{league.season_year}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Status</span>
                <span className="info-value text-capitalize">{league.season_phase}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
