import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Pick {
  pick_number: number
  draft_round: number
  team_name: string
  player_name: string | null
  position: string | null
  afl_team: string | null
  draft_score: number | null
  expected_value: number | null
  value_diff: number | null
  is_pass: boolean
  is_auto_pick: boolean
}

interface Grade {
  team_id: number
  team_name: string
  grade: string
  grade_color: string
  total_value: number
  expected_value: number
  ratio: number
  picks_count: number
  best_pick: { player_name: string; value_diff: number } | null
  worst_pick: { player_name: string; value_diff: number } | null
}

interface RecapData {
  league: { id: number; name: string; season_year: number }
  session: { id: number; status: string; draft_round_type: string; completed_at: string | null }
  picks: Pick[]
  grades: Grade[]
}

export function DraftRecapPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<RecapData>(`/leagues/${leagueId}/draft/recap?format=json`)

  if (loading) return <Spinner text="Loading draft recap..." />
  if (!data) return <p className="text-danger">Failed to load draft recap</p>

  const { picks, grades } = data

  // Group picks by round for display
  const rounds: Record<number, Pick[]> = {}
  picks.forEach(p => {
    if (!rounds[p.draft_round]) rounds[p.draft_round] = []
    rounds[p.draft_round].push(p)
  })

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-list-check me-2" style={{ color: '#58a6ff' }}></i>Draft Recap</h2>
        <div className="text-secondary" style={{ fontSize: '.85rem' }}>
          {data.league.season_year} {data.session.draft_round_type} draft
          {data.session.completed_at && ` · ${new Date(data.session.completed_at).toLocaleDateString()}`}
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-trophy me-2" style={{ color: '#d29922' }}></i>Draft Grades
          </h5>
        </div>
        <div className="card-body p-0">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Team</th>
                <th style={{ width: 70 }}>Grade</th>
                <th className="text-end">Actual</th>
                <th className="text-end">Expected</th>
                <th className="text-end">Ratio</th>
                <th>Best Pick</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g, i) => (
                <tr key={g.team_id}>
                  <td>{i + 1}</td>
                  <td><strong>{g.team_name}</strong></td>
                  <td>
                    <span
                      className="badge"
                      style={{
                        background: g.grade_color + '20',
                        color: g.grade_color,
                        fontSize: '.85rem',
                        minWidth: 32,
                      }}
                    >
                      {g.grade}
                    </span>
                  </td>
                  <td className="text-end">{g.total_value.toFixed(0)}</td>
                  <td className="text-end text-secondary">{g.expected_value.toFixed(0)}</td>
                  <td className="text-end" style={{ color: g.ratio >= 1 ? '#3fb950' : '#f85149' }}>
                    {(g.ratio * 100).toFixed(0)}%
                  </td>
                  <td className="text-secondary" style={{ fontSize: '.75rem' }}>
                    {g.best_pick ? `${g.best_pick.player_name} (+${g.best_pick.value_diff.toFixed(0)})` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-clock-history me-2"></i>Pick History
          </h5>
        </div>
        <div className="card-body p-0">
          {Object.entries(rounds).map(([roundNum, picks]) => (
            <div key={roundNum}>
              <div
                style={{
                  padding: '.5rem 1rem',
                  background: '#0d1117',
                  borderBottom: '1px solid var(--kl-border)',
                  fontSize: '.75rem',
                  fontWeight: 700,
                  color: 'var(--kl-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '.5px',
                }}
              >
                Round {roundNum}
              </div>
              <table className="table table-sm mb-0">
                <tbody>
                  {picks.map(p => (
                    <tr key={p.pick_number}>
                      <td style={{ width: 40, color: '#484f58' }}>{p.pick_number}</td>
                      <td style={{ width: 140 }}>{p.team_name}</td>
                      <td>
                        {p.is_pass ? (
                          <span className="text-secondary">— Pass —</span>
                        ) : (
                          <>
                            <strong>{p.player_name}</strong>
                            <span className="text-secondary ms-2" style={{ fontSize: '.75rem' }}>
                              {p.position} · {p.afl_team}
                            </span>
                            {p.is_auto_pick && (
                              <span className="badge ms-2" style={{ background: '#21262d', color: '#8b949e', fontSize: '.6rem' }}>auto</span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="text-end" style={{ width: 80 }}>
                        {p.draft_score != null && (
                          <span style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>
                            {p.draft_score.toFixed(0)}
                          </span>
                        )}
                      </td>
                      <td className="text-end" style={{ width: 70 }}>
                        {p.value_diff != null && (
                          <span style={{
                            fontSize: '.7rem',
                            fontFamily: 'monospace',
                            color: p.value_diff >= 0 ? '#3fb950' : '#f85149',
                          }}>
                            {p.value_diff >= 0 ? '+' : ''}{p.value_diff.toFixed(0)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center mt-3">
        <Link to={`/leagues/${leagueId}/draft/setup`} className="text-secondary" style={{ fontSize: '.8rem' }}>
          <i className="bi bi-arrow-left me-1"></i>Back to draft setup
        </Link>
      </div>
    </div>
  )
}
