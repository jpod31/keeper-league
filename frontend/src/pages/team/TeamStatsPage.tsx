import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Player {
  id: number
  name: string
  position: string
  afl_team: string
  age: number | null
  sc_avg: number
  career_games: number
  games_played: number
  draft_score: number | null
}

interface StatsData {
  league: { id: number; name: string }
  team: { id: number; name: string; logo_url: string | null }
  players: Player[]
  total_sc: number
  avg_age: number
  position_counts: Record<string, number>
}

function posCode(pos: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}

export function TeamStatsPage() {
  const { leagueId, teamId } = useParams()
  const { data, loading } = useFetch<StatsData>(`/leagues/${leagueId}/team/${teamId}/stats?format=json`)

  if (loading) return <Spinner text="Loading stats..." />
  if (!data) return <p className="text-danger">Failed to load team stats</p>

  const { league, team, players, total_sc, avg_age, position_counts } = data
  const avgSc = players.length > 0 ? (total_sc / players.length).toFixed(1) : '0'
  const top10 = [...players].sort((a, b) => (b.sc_avg || 0) - (a.sc_avg || 0)).slice(0, 10)
  const posEntries = Object.entries(position_counts).sort((a, b) => b[1] - a[1])

  return (
    <div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link>
          {' / '}<Link to={`/leagues/${leagueId}/team/${teamId}`}>{team.name}</Link>
          {' / '}Stats
        </div>
        <div className="d-flex justify-content-between align-items-start">
          <h2>{team.name} — Stats</h2>
          <div className="d-flex gap-2 d-none d-lg-flex">
            <Link to={`/leagues/${leagueId}/team/${teamId}`} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-people me-1"></i>Squad
            </Link>
            <Link to={`/leagues/${leagueId}/team/${teamId}/lineup/1`} className="btn btn-outline-primary btn-sm">
              <i className="bi bi-layout-text-window me-1"></i>Lineup
            </Link>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="stat-card">
            <div className="stat-value text-accent">{players.length}</div>
            <div className="stat-label">Squad Size</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#3fb950' }}>{total_sc}</div>
            <div className="stat-label">Total SC Value</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#d29922' }}>{avg_age}</div>
            <div className="stat-label">Avg Age</div>
          </div>
        </div>
        <div className="col-6 col-md-3">
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#bc8cff' }}>{avgSc}</div>
            <div className="stat-label">Avg SC / Player</div>
          </div>
        </div>
      </div>

      {/* Position breakdown + Top 10 */}
      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-diagram-3 me-2" style={{ color: '#8b949e' }}></i>Position Breakdown
              </h5>
            </div>
            <div className="card-body">
              {posEntries.map(([pos, count]) => {
                const pct = players.length > 0 ? Math.round((count / players.length) * 100) : 0
                return (
                  <div key={pos} className="d-flex align-items-center gap-3 mb-3">
                    <span className={`pos-badge pos-${pos}`} style={{ width: 45, textAlign: 'center' }}>{pos}</span>
                    <div className="flex-grow-1">
                      <div className="progress">
                        <div
                          className="progress-bar"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#238636,#1f6feb)' }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-secondary" style={{ fontSize: '.8rem', minWidth: 20 }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-star me-2" style={{ color: '#d29922' }}></i>Top 10 by SC Avg
              </h5>
            </div>
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Player</th>
                    <th>Pos</th>
                    <th className="text-end">SC Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {top10.map((p, i) => (
                    <tr key={p.id}>
                      <td style={{ color: '#484f58' }}>{i + 1}</td>
                      <td>
                        <a href={`/player/${encodeURIComponent(p.name)}`} className="text-decoration-none" style={{ color: '#c9d1d9' }}>
                          {p.name}
                        </a>
                      </td>
                      <td><span className={`pos-badge pos-${posCode(p.position)}`}>{p.position}</span></td>
                      <td className="text-end fw-bold">{p.sc_avg ? p.sc_avg.toFixed(1) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* All players table */}
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-list-ul me-2" style={{ color: '#8b949e' }}></i>All Players
          </h5>
        </div>
        <div className="card-body p-0">
          <table className="table table-hover table-sm mb-0">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th className="text-center">Age</th>
                <th>AFL Team</th>
                <th className="text-end">SC Avg</th>
                <th className="text-center">Games</th>
                <th className="text-end">Draft Score</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id}>
                  <td>
                    <a href={`/player/${encodeURIComponent(p.name)}`} className="text-decoration-none" style={{ color: '#c9d1d9' }}>
                      {p.name}
                    </a>
                  </td>
                  <td>
                    {(p.position || 'MID').split('/').map(pos => (
                      <span key={pos} className={`pos-badge pos-${pos}`}>{pos}</span>
                    ))}
                  </td>
                  <td className="text-center">{p.age || '-'}</td>
                  <td style={{ fontSize: '.8rem' }}>{p.afl_team}</td>
                  <td className="text-end">{p.sc_avg ? p.sc_avg.toFixed(1) : '-'}</td>
                  <td className="text-center">{p.career_games || '-'}</td>
                  <td className="text-end">{p.draft_score != null ? p.draft_score.toFixed(1) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
