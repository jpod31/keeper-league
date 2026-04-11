import { useParams, Link } from 'react-router'
import { useState, useMemo } from 'react'
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
  recommendation: 'KEEP' | 'TRADE' | 'DROP'
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

const POSITIONS = ['FWD', 'DEF', 'RUC', 'MID'] as const

// Pixel-for-pixel port of templates/leagues/keepers.html styles
const KEEPER_CSS = `
.keeper-table th { padding: .5rem .6rem; font-size: .7rem; border-bottom: 2px solid #30363d; position: relative; color: #8b949e; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; background: #161b22; }
.keeper-table td { padding: .45rem .6rem; vertical-align: middle; font-size: .8rem; }
.keeper-table tbody tr { transition: background .1s; }
.keeper-table tbody tr:hover { background: rgba(88,166,255,.04) !important; }
.kp-rec-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: .65rem; font-weight: 700; letter-spacing: .3px; white-space: nowrap; text-transform: uppercase; }
.kp-rec-keep { background: rgba(63,185,80,.15); color: #56d364; }
.kp-rec-trade { background: rgba(210,153,34,.15); color: #e3b341; }
.kp-rec-drop { background: rgba(248,81,73,.15); color: #f85149; }
.kp-cost-badge { display: inline-block; padding: 2px 7px; border-radius: 8px; font-size: .7rem; font-weight: 600; letter-spacing: .3px; background: rgba(88,166,255,.1); color: #79c0ff; }
.kp-cost-trade { background: rgba(210,153,34,.12); color: #e3b341; }
.kp-cost-supp { background: rgba(188,140,255,.12); color: #d2a8ff; }
.kp-cost-undrafted { background: rgba(139,148,158,.1); color: #8b949e; }
.kp-kv-bar-wrap { width: 60px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.06); overflow: hidden; display: inline-block; vertical-align: middle; margin-left: 6px; }
.kp-kv-bar { height: 100%; border-radius: 3px; transition: width .3s; }
.kp-kv-val { font-weight: 700; font-size: .82rem; }
.kp-kv-great { color: #56d364; }
.kp-kv-good { color: #79c0ff; }
.kp-kv-fair { color: #e3b341; }
.kp-kv-poor { color: #f85149; }
.kp-team-section { margin-bottom: 1.5rem; border: 1px solid #21262d; border-radius: 10px; overflow: hidden; background: #0d1117; }
.kp-team-header { display: flex; align-items: center; justify-content: space-between; padding: .6rem .8rem; background: #161b22; border-bottom: 1px solid #30363d; gap: .5rem; flex-wrap: wrap; }
.kp-team-header h3 { font-size: .9rem; font-weight: 700; color: #e6edf3; margin: 0; }
.kp-team-stat { font-size: .72rem; color: #8b949e; display: flex; gap: .8rem; flex-wrap: wrap; }
.kp-team-stat strong { color: #c9d1d9; }
.kp-projected-rank { color: #484f58; font-size: .7rem; font-weight: 700; }
.kp-section-title { font-size: 1rem; font-weight: 700; color: #e6edf3; margin: 1.5rem 0 .75rem; display: flex; align-items: center; gap: .5rem; }
.kp-section-title i { color: #58a6ff; }
.kp-trend-up { display: inline-flex; align-items: center; gap: 2px; padding: 1px 6px; border-radius: 10px; font-size: .7rem; font-weight: 600; background: rgba(63,185,80,.1); color: #56d364; }
.kp-trend-down { display: inline-flex; align-items: center; gap: 2px; padding: 1px 6px; border-radius: 10px; font-size: .7rem; font-weight: 600; background: rgba(248,81,73,.1); color: #f85149; }
.kp-trend-flat { color: #484f58; font-size: .7rem; }
.kp-pos-pill { display: inline-block; padding: 2px 5px; font-size: .65rem; font-weight: 600; border-radius: 4px; margin-right: 2px; }
.kp-pos-def { background: #1a3f66; color: #79c0ff; }
.kp-pos-mid { background: #351d4a; color: #d2a8ff; }
.kp-pos-fwd { background: #46290a; color: #ffb471; }
.kp-pos-ruc { background: #1d3d2e; color: #7ee787; }
.kp-filter-bar { display: flex; gap: .5rem; flex-wrap: wrap; align-items: center; }
.kp-filter-bar .form-select-sm { background: #0d1117; border-color: #30363d; font-size: .78rem; }
`

function kvColor(kv: number): { cls: string; bar: string } {
  if (kv > 1.5) return { cls: 'kp-kv-great', bar: '#56d364' }
  if (kv > 1.2) return { cls: 'kp-kv-good', bar: '#58a6ff' }
  if (kv >= 0.8) return { cls: 'kp-kv-fair', bar: '#e3b341' }
  return { cls: 'kp-kv-poor', bar: '#f85149' }
}

function costClass(label: string): string {
  if (label.includes('Supp')) return 'kp-cost-badge kp-cost-supp'
  if (label === 'Trade') return 'kp-cost-badge kp-cost-trade'
  if (label === 'Undrafted') return 'kp-cost-badge kp-cost-undrafted'
  return 'kp-cost-badge'
}

function recBadge(rec: string) {
  const cls = rec === 'KEEP' ? 'kp-rec-keep' : rec === 'TRADE' ? 'kp-rec-trade' : 'kp-rec-drop'
  const label = rec === 'KEEP' ? 'Keep' : rec === 'TRADE' ? 'Trade' : 'Drop'
  return <span className={`kp-rec-badge ${cls}`}>{label}</span>
}

function posBadges(position: string) {
  const parts = (position || 'MID').split('/')
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'nowrap' }}>
      {POSITIONS.filter(p => parts.includes(p)).map(p => (
        <span key={p} className={`kp-pos-pill kp-pos-${p.toLowerCase()}`}>{p}</span>
      ))}
    </div>
  )
}

function trendPill(trend: number) {
  if (trend > 5) {
    return <span className="kp-trend-up"><i className="bi bi-caret-up-fill"></i>+{Math.round(trend)}</span>
  }
  if (trend < -5) {
    return <span className="kp-trend-down"><i className="bi bi-caret-down-fill"></i>{Math.round(trend)}</span>
  }
  if (trend !== 0) {
    return <span className="kp-trend-flat">{trend > 0 ? '+' : ''}{Math.round(trend)}</span>
  }
  return <span style={{ color: '#484f58' }}>—</span>
}

function KeeperValueCell({ kv }: { kv: number }) {
  const { cls, bar } = kvColor(kv)
  const width = Math.min((kv / 2.5) * 100, 100)
  return (
    <>
      <span className={`kp-kv-val ${cls}`}>{kv.toFixed(2)}x</span>
      <div className="kp-kv-bar-wrap">
        <div className="kp-kv-bar" style={{ width: `${width}%`, background: bar }}></div>
      </div>
    </>
  )
}

export function KeepersPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<KeepersData>(`/leagues/${leagueId}/keepers?format=json`)
  const [teamFilter, setTeamFilter] = useState('')
  const [recFilter, setRecFilter] = useState('')

  const filteredTeams = useMemo(() => {
    if (!data) return []
    return data.teams
      .filter(t => !teamFilter || String(t.team_id) === teamFilter)
      .map(t => ({
        ...t,
        players: t.players.filter(p => !recFilter || p.recommendation === recFilter),
      }))
      .filter(t => t.players.length > 0)
  }, [data, teamFilter, recFilter])

  if (loading) return <Spinner />
  if (!data) return <p className="text-danger">Failed to load keepers</p>

  return (
    <div>
      <style>{KEEPER_CSS}</style>

      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{data.league.name}</Link> / Players / Keepers
        </div>
        <div className="d-flex justify-content-between align-items-end flex-wrap gap-2">
          <div>
            <h2 className="mb-0">Keeper Values</h2>
            <span style={{ fontSize: '.78rem', color: '#8b949e' }}>
              Draft cost vs current value for every rostered player
            </span>
          </div>
          <div className="kp-filter-bar">
            <select
              className="form-select form-select-sm"
              value={teamFilter}
              onChange={e => setTeamFilter(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="">All Teams</option>
              {data.teams.map(t => (
                <option key={t.team_id} value={String(t.team_id)}>{t.team_name}</option>
              ))}
            </select>
            <select
              className="form-select form-select-sm"
              value={recFilter}
              onChange={e => setRecFilter(e.target.value)}
              style={{ width: 'auto' }}
            >
              <option value="">All Rec.</option>
              <option value="KEEP">Keep</option>
              <option value="TRADE">Trade</option>
              <option value="DROP">Drop</option>
            </select>
          </div>
        </div>
      </div>

      {/* Per-team sections */}
      {filteredTeams.map(td => {
        const keeps = td.players.filter(p => p.recommendation === 'KEEP').length
        const trades = td.players.filter(p => p.recommendation === 'TRADE').length
        const drops = td.players.filter(p => p.recommendation === 'DROP').length
        const avgKv = td.players.reduce((s, p) => s + p.keeper_value, 0) / Math.max(td.players.length, 1)
        return (
          <div key={td.team_id} className="kp-team-section">
            <div className="kp-team-header">
              <h3><i className="bi bi-people-fill me-2" style={{ color: '#58a6ff' }}></i>{td.team_name}</h3>
              <div className="kp-team-stat">
                <span><strong>{td.players.length}</strong> players</span>
                <span style={{ color: '#56d364' }}><strong>{keeps}</strong> keep</span>
                <span style={{ color: '#e3b341' }}><strong>{trades}</strong> trade</span>
                <span style={{ color: '#f85149' }}><strong>{drops}</strong> drop</span>
                <span>Avg KV: <strong>{avgKv.toFixed(2)}</strong></span>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-sm mb-0 keeper-table">
                <thead>
                  <tr>
                    <th style={{ width: 35 }}>#</th>
                    <th>Player</th>
                    <th style={{ width: 90 }}>Pos</th>
                    <th className="text-center" style={{ width: 55 }}>AFL</th>
                    <th className="text-center" style={{ width: 80 }}>Cost</th>
                    <th className="text-end" style={{ width: 75 }}>Score</th>
                    <th className="text-center" style={{ width: 80 }}>Trend</th>
                    <th className="text-end" style={{ width: 140 }}>Keeper Value</th>
                    <th className="text-center" style={{ width: 70 }}>Rec.</th>
                    <th className="text-end" style={{ width: 95 }}>Proj. Next Yr</th>
                  </tr>
                </thead>
                <tbody>
                  {td.players.map((p, i) => (
                    <tr key={p.player_id}>
                      <td className="kp-projected-rank">{i + 1}</td>
                      <td style={{ color: '#e6edf3', fontWeight: 600 }}>{p.player_name}</td>
                      <td>{posBadges(p.position)}</td>
                      <td className="text-center" style={{ color: '#8b949e', fontSize: '.75rem' }}>{p.afl_team || '—'}</td>
                      <td className="text-center"><span className={costClass(p.cost_label)}>{p.cost_label}</span></td>
                      <td className="text-end">
                        {p.draft_score ? (
                          <span style={{ color: '#58a6ff', fontWeight: 700 }}>{p.draft_score.toFixed(0)}</span>
                        ) : (
                          <span style={{ color: '#484f58' }}>—</span>
                        )}
                      </td>
                      <td className="text-center">{trendPill(p.trend_val)}</td>
                      <td className="text-end"><KeeperValueCell kv={p.keeper_value} /></td>
                      <td className="text-center">{recBadge(p.recommendation)}</td>
                      <td className="text-end">
                        {p.projected_score ? (
                          <span style={{ color: '#c9d1d9', fontWeight: 600, fontSize: '.8rem' }}>
                            {p.projected_score.toFixed(0)}
                          </span>
                        ) : (
                          <span style={{ color: '#484f58' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Projected rankings */}
      <div className="kp-section-title">
        <i className="bi bi-trophy"></i> Projected Keeper Rankings — Next Season
      </div>
      <div className="card">
        <div className="card-body p-0" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <table className="table table-sm mb-0 keeper-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ width: 35 }}>#</th>
                <th>Player</th>
                <th style={{ width: 90 }}>Pos</th>
                <th className="text-center" style={{ width: 45 }}>Age</th>
                <th style={{ width: 140 }}>Team</th>
                <th className="text-center" style={{ width: 80 }}>Cost</th>
                <th className="text-end" style={{ width: 85 }}>Current</th>
                <th className="text-end" style={{ width: 85 }}>Proj.</th>
                <th className="text-end" style={{ width: 140 }}>Proj. KV</th>
                <th className="text-center" style={{ width: 70 }}>Rec.</th>
              </tr>
            </thead>
            <tbody>
              {data.projected_rankings.map((p, i) => (
                <tr key={`${p.player_id}-${p.team_id}`}>
                  <td className="kp-projected-rank">{i + 1}</td>
                  <td style={{ color: '#e6edf3', fontWeight: 600 }}>{p.player_name}</td>
                  <td>{posBadges(p.position)}</td>
                  <td className="text-center" style={{ color: '#8b949e', fontSize: '.75rem' }}>{p.age ?? '—'}</td>
                  <td style={{ color: '#8b949e', fontSize: '.75rem' }}>{p.team_name}</td>
                  <td className="text-center"><span className={costClass(p.cost_label)}>{p.cost_label}</span></td>
                  <td className="text-end">
                    {p.draft_score ? p.draft_score.toFixed(0) : <span style={{ color: '#484f58' }}>—</span>}
                  </td>
                  <td className="text-end">
                    <span style={{ color: '#c9d1d9', fontWeight: 600 }}>{p.projected_score.toFixed(0)}</span>
                  </td>
                  <td className="text-end"><KeeperValueCell kv={p.projected_kv} /></td>
                  <td className="text-center">{recBadge(p.recommendation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
