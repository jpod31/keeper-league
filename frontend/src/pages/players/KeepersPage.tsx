import { useParams } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface KeeperEntry {
  player_id: number
  player_name: string
  afl_team: string
  position: string
  age: number | null
  team_id: number
  team_name: string
  cost_label: string
  effective_round: number
  draft_score: number
  keeper_value: number
  recommendation: string
  trend_val: number
  trend_pct: number
  projected_score: number
  projected_kv: number
}

interface KeepersData {
  league: { id: number; name: string }
  total_rounds: number
  best_draft_score: number
  teams: { team_id: number; team_name: string; players: KeeperEntry[] }[]
  projected_rankings: KeeperEntry[]
}

const REC_COLOR: Record<string, string> = {
  KEEP: '#3fb950',
  TRADE: '#d29922',
  DROP: '#f85149',
}

export function KeepersPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<KeepersData>(`/leagues/${leagueId}/keepers?format=json`)
  const [activeTab, setActiveTab] = useState<'teams' | 'projected'>('teams')
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null)

  if (loading) return <Spinner text="Loading keeper values..." />
  if (!data) return <p className="text-danger">Failed to load keepers</p>

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-shield-check me-2" style={{ color: '#3fb950' }}></i>Keeper Values</h2>
        <div className="text-secondary" style={{ fontSize: '.85rem' }}>Draft cost vs. current/projected value</div>
      </div>

      <div className="btn-group mb-3">
        <button className={`btn btn-sm ${activeTab === 'teams' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setActiveTab('teams')}>By Team</button>
        <button className={`btn btn-sm ${activeTab === 'projected' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setActiveTab('projected')}>Projected Rankings</button>
      </div>

      {activeTab === 'teams' && (
        <div>
          {data.teams.map(t => (
            <div key={t.team_id} className="card mb-2">
              <div
                className="card-header d-flex justify-content-between align-items-center"
                style={{ cursor: 'pointer' }}
                onClick={() => setExpandedTeam(expandedTeam === t.team_id ? null : t.team_id)}
              >
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>
                  <i className={`bi bi-chevron-${expandedTeam === t.team_id ? 'down' : 'right'} me-2`}></i>
                  {t.team_name}
                </h5>
                <span className="text-secondary" style={{ fontSize: '.75rem' }}>{t.players.length} players</span>
              </div>
              {expandedTeam === t.team_id && (
                <div className="card-body p-0">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th>Cost</th>
                        <th className="text-end">Score</th>
                        <th className="text-end">KV</th>
                        <th className="text-end">Trend</th>
                        <th className="text-end">Proj KV</th>
                        <th>Rec</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.players.map(p => (
                        <tr key={p.player_id}>
                          <td>
                            <strong>{p.player_name}</strong>
                            <div className="text-secondary" style={{ fontSize: '.7rem' }}>{p.afl_team} · {p.position} · {p.age}</div>
                          </td>
                          <td className="text-secondary" style={{ fontSize: '.75rem' }}>{p.cost_label}</td>
                          <td className="text-end">{p.draft_score.toFixed(0)}</td>
                          <td className="text-end"><strong>{p.keeper_value.toFixed(2)}</strong></td>
                          <td className="text-end" style={{ color: p.trend_val >= 0 ? '#3fb950' : '#f85149', fontSize: '.75rem' }}>
                            {p.trend_val >= 0 ? '+' : ''}{p.trend_val.toFixed(1)}
                          </td>
                          <td className="text-end">{p.projected_kv.toFixed(2)}</td>
                          <td>
                            <span className="badge" style={{ background: REC_COLOR[p.recommendation] + '20', color: REC_COLOR[p.recommendation], fontSize: '.7rem' }}>
                              {p.recommendation}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'projected' && (
        <div className="card">
          <div className="card-header">
            <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Top 50 by Projected Keeper Value</h5>
          </div>
          <div className="card-body p-0">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Player</th>
                  <th>Team</th>
                  <th className="text-end">Current KV</th>
                  <th className="text-end">Projected KV</th>
                  <th>Rec</th>
                </tr>
              </thead>
              <tbody>
                {data.projected_rankings.map((p, i) => (
                  <tr key={`${p.player_id}-${p.team_id}`}>
                    <td>{i + 1}</td>
                    <td><strong>{p.player_name}</strong><div className="text-secondary" style={{ fontSize: '.7rem' }}>{p.afl_team} · {p.position}</div></td>
                    <td className="text-secondary" style={{ fontSize: '.75rem' }}>{p.team_name}</td>
                    <td className="text-end">{p.keeper_value.toFixed(2)}</td>
                    <td className="text-end"><strong>{p.projected_kv.toFixed(2)}</strong></td>
                    <td>
                      <span className="badge" style={{ background: REC_COLOR[p.recommendation] + '20', color: REC_COLOR[p.recommendation], fontSize: '.7rem' }}>
                        {p.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
