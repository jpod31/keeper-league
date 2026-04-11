import { useParams } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Leader {
  player_id: number
  player_name: string
  afl_team: string
  position: string
  team_name: string | null
  value: number
  games: number | null
}

interface StatsData {
  league: { id: number; name: string }
  leaders: Record<string, Leader[]>
  teams: { id: number; name: string }[]
  team_analysis: Record<string, {
    name: string
    round_scores: { round: number; score: number }[]
    position_breakdown: Record<string, number>
    bye_impact: { round: number; players_out: number; estimated_loss: number }[]
  }>
  all_players: { id: number; name: string; position: string; afl_team: string; sc_avg: number }[]
}

export function StatsPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<StatsData>(`/leagues/${leagueId}/stats?format=json`)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  if (loading) return <Spinner text="Loading advanced stats..." />
  if (!data) return <p className="text-danger">Failed to load stats</p>

  const leaderCategories = Object.keys(data.leaders)

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-graph-up me-2" style={{ color: '#58a6ff' }}></i>Advanced Stats</h2>
      </div>

      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>League Leaders</h5>
            </div>
            <div className="card-body" style={{ maxHeight: 700, overflowY: 'auto' }}>
              {leaderCategories.length === 0 && (
                <div className="text-center py-3 text-secondary">No leader data available.</div>
              )}
              {leaderCategories.map(cat => (
                <div key={cat} className="mb-3">
                  <h6 className="text-uppercase text-secondary fw-bold" style={{ fontSize: '.7rem', letterSpacing: '.5px' }}>{cat.replace(/_/g, ' ')}</h6>
                  <table className="table table-sm mb-0">
                    <tbody>
                      {data.leaders[cat]?.slice(0, 10).map((l, i) => (
                        <tr key={`${cat}-${l.player_id}`}>
                          <td style={{ width: 24, color: '#484f58' }}>{i + 1}</td>
                          <td>
                            <strong>{l.player_name}</strong>
                            <span className="text-secondary ms-2" style={{ fontSize: '.7rem' }}>{l.afl_team} · {l.position}</span>
                          </td>
                          <td className="text-end"><strong>{l.value?.toFixed?.(1) ?? l.value}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-lg-5">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Team Analysis</h5>
            </div>
            <div className="card-body">
              <select className="form-select form-select-sm mb-3" value={selectedTeamId ?? ''} onChange={e => setSelectedTeamId(e.target.value || null)}>
                <option value="">Select a team...</option>
                {data.teams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
              </select>
              {selectedTeamId && data.team_analysis[selectedTeamId] && (() => {
                const ta = data.team_analysis[selectedTeamId]
                return (
                  <div>
                    <div className="mb-3">
                      <h6 className="text-uppercase text-secondary fw-bold" style={{ fontSize: '.7rem' }}>Position Breakdown</h6>
                      {Object.entries(ta.position_breakdown).map(([pos, pts]) => (
                        <div key={pos} className="d-flex justify-content-between py-1">
                          <span><span className={`pos-badge pos-${pos}`}>{pos}</span></span>
                          <strong>{typeof pts === 'number' ? pts.toFixed(0) : pts}</strong>
                        </div>
                      ))}
                    </div>
                    {ta.bye_impact.length > 0 && (
                      <div className="mb-3">
                        <h6 className="text-uppercase text-secondary fw-bold" style={{ fontSize: '.7rem' }}>Bye Impact</h6>
                        <table className="table table-sm mb-0">
                          <thead><tr><th>Round</th><th className="text-end">Out</th><th className="text-end">Loss</th></tr></thead>
                          <tbody>
                            {ta.bye_impact.map(b => (
                              <tr key={b.round}>
                                <td>R{b.round}</td>
                                <td className="text-end">{b.players_out}</td>
                                <td className="text-end">{b.estimated_loss.toFixed(0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
