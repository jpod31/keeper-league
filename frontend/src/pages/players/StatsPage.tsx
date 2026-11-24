import { useParams } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { StatsSkeleton } from '../../components/ui/StatsSkeleton'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'
import { LeagueBreadcrumb } from '../../components/ui/LeagueBreadcrumb'

interface PlayerMetric {
  id: number
  name: string
  fantasy_team: string
  avg: number
  games: number
  std_dev: number
  ceiling: number
  floor: number
  best_round: number
  prev_avg: number | null
}

interface ImprovedMetric { name: string; prev_avg: number; curr_avg: number; improvement: number }

interface ByeImpactRow { round: number; players_out: number; estimated_loss: number }

interface TeamAnalysis {
  name: string
  round_scores: { round: number; score: number }[]
  position_breakdown: Record<string, number>
  bye_impact: ByeImpactRow[]
}

interface StatsData {
  league: { id: number; name: string }
  leaders: {
    scoring_avg: PlayerMetric[]
    consistency: PlayerMetric[]
    ceiling: PlayerMetric[]
    most_improved: ImprovedMetric[]
    ironman: PlayerMetric[]
  }
  teams: { id: number; name: string }[]
  team_analysis: Record<string, TeamAnalysis>
}

const STYLE = `
/* .stat-card on this page is used as a CARD WRAPPER around tables/charts,
   not as a label+value tile. Override the new global stat-card rules
   (text-align: center, padding, ::before stripe) to keep tables flush. */
.stat-card {
  background: rgba(19,19,22,.7);
  border: 1px solid rgba(220,218,231,.18);
  border-radius: 10px;
  text-align: initial;
  padding: 0;
  transform: none !important;
}
.stat-card::before { display: none !important; }
.stat-card:hover { transform: none; }
.stat-card .card-header { border-bottom: 1px solid rgba(220,218,231,.12); padding: 10px 14px; background: rgba(25,24,28,.55); }
.stat-card .card-header h6 { margin: 0; font-size: .85rem; font-weight: 700; color: #f5f5f7; display: flex; align-items: center; gap: 6px; }
.stat-table th { padding: 8px 10px; font-size: .8125rem; color: var(--kl-text-primary); font-weight: 800; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid rgba(220,218,231,.18); }
.stat-table td { padding: 7px 10px; font-size: .8125rem; vertical-align: middle; color: #ececf1; border-bottom: 1px solid rgba(220,218,231,.06); }
.stat-table tbody tr:hover { background: rgba(81,78,95,.05); }
.stat-rank { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; font-size:.8125rem; font-weight:800; font-variant-numeric:tabular-nums; font-feature-settings:"tnum" 1, "zero" 0; }
.rank-1 { background:rgba(194,147,47,.18); color:#f0d27a; border:1px solid rgba(194,147,47,.4); }
.rank-2 { background:rgba(210,209,217,.14); color:#dfdee4; border:1px solid rgba(210,209,217,.3); }
.rank-3 { background:rgba(184,127,61,.18); color:#d6a779; border:1px solid rgba(184,127,61,.36); }
.rank-other { background:rgba(220,218,231,.08); color:var(--kl-text-primary); }
.pos-bar-row { display:flex; align-items:center; gap:8px; padding:4px 0; font-size:.8125rem; }
.pos-bar-label { min-width:40px; color:var(--kl-text-primary); font-weight:600; }
.pos-bar-track { flex:1; height:18px; background:#0e0d0f; border-radius:3px; overflow:hidden; }
.pos-bar-fill { height:100%; border-radius:3px; transition:width .3s; }
.pos-bar-value { font-size:.8125rem; color:var(--kl-text-primary); font-weight:600; min-width:48px; text-align:right; }
.bye-impact-row { display:flex; align-items:center; gap:.5rem; padding:.4rem 0; border-bottom:1px solid #1e1d21; font-size:.8125rem; }
.bye-impact-row:last-child { border-bottom:none; }
.bye-round-badge { display:inline-flex; align-items:center; justify-content:center; min-width:28px; padding:2px 8px; border-radius:12px; font-size:.8125rem; font-weight:700; background:#1e1d21; color:var(--kl-text-primary); }
.trend-svg { width:100%; height:260px; }
.trend-svg .line { fill:none; stroke:#ececf6; stroke-width:2; }
.trend-svg .dot { fill:#ececf6; }
.trend-svg .axis { stroke:#2a292f; stroke-width:1; }
.trend-svg .tick-label { fill:#8a8895; font-size:.8125rem; font-family:system-ui; }
`

const POS_COLORS: Record<string, string> = {
  DEF: '#58a6ff', MID: '#bc8cff', FWD: '#f0883e', RUC: '#3fb950',
}

function rankClass(i: number) {
  return i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-other'
}

function TrendChart({ rounds }: { rounds: { round: number; score: number }[] }) {
  if (!rounds.length) return <div className="text-center text-secondary py-3" style={{ fontSize: '.8125rem' }}>No round data</div>
  const W = 600, H = 240, P = 32
  const xs = rounds.map(r => r.round)
  const ys = rounds.map(r => r.score)
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const yMin = Math.min(0, ...ys), yMax = Math.max(...ys)
  const xScale = (x: number) => P + ((x - xMin) / Math.max(1, xMax - xMin)) * (W - 2 * P)
  const yScale = (y: number) => H - P - ((y - yMin) / Math.max(1, yMax - yMin)) * (H - 2 * P)
  const path = rounds.map((r, i) => `${i === 0 ? 'M' : 'L'} ${xScale(r.round).toFixed(1)} ${yScale(r.score).toFixed(1)}`).join(' ')
  const yTicks = 5
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (yMax - yMin) * (i / yTicks))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" preserveAspectRatio="none">
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="axis" x1={P} y1={yScale(t)} x2={W - P} y2={yScale(t)} strokeDasharray="3 3" />
          <text className="tick-label" x={P - 6} y={yScale(t) + 3} textAnchor="end">{t.toFixed(0)}</text>
        </g>
      ))}
      {rounds.map((r, i) => (
        <text key={`xt-${i}`} className="tick-label" x={xScale(r.round)} y={H - P + 14} textAnchor="middle">R{r.round}</text>
      ))}
      <path className="line" d={path} />
      {rounds.map(r => <circle key={r.round} className="dot" cx={xScale(r.round)} cy={yScale(r.score)} r={3} />)}
    </svg>
  )
}

export function StatsPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<StatsData>(`/leagues/${leagueId}/stats?format=json`)
  const [tab, setTab] = useState<'leaders' | 'team'>('leaders')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')

  if (loading) return <StatsSkeleton />
  if (!data) return <p className="text-danger">Failed to load stats</p>

  const leaders = data.leaders
  const selectedTeam = selectedTeamId ? data.team_analysis[selectedTeamId] : null

  // Position breakdown colors
  const posTotal = selectedTeam ? Object.values(selectedTeam.position_breakdown).reduce((a, b) => a + b, 0) : 0

  return (
    <div>
      <style>{STYLE}</style>
      <div className="d-none d-lg-block"><PlayersSubnav active="stats" leagueId={leagueId!} /></div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <LeagueBreadcrumb leagueId={leagueId!} fallbackName={data.league.name} /> / Players / Stats
        </div>
        <div className="d-flex justify-content-between align-items-end flex-wrap gap-2">
          <div>
            <h2 className="mb-0">Advanced stats</h2>
            <span style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)' }}>Season Analytics</span>
          </div>
        </div>
      </div>

      <div className="league-subnav" style={{ marginBottom: '1rem' }}>
        <a href="#leaders" className={`league-subtab${tab === 'leaders' ? ' active' : ''}`} onClick={e => { e.preventDefault(); setTab('leaders') }}>
          <i className="bi bi-award"></i>Leaders
        </a>
        <a href="#team" className={`league-subtab${tab === 'team' ? ' active' : ''}`} onClick={e => { e.preventDefault(); setTab('team') }}>
          <i className="bi bi-bar-chart"></i>Team
        </a>
      </div>

      {tab === 'leaders' && (
        <div className="row g-3">
          <div className="col-lg-6">
            <div className="stat-card">
              <div className="card-header"><h6><i className="bi bi-trophy-fill" style={{ color: '#e3b341' }}></i>Top Scorers (Avg)</h6></div>
              <table className="table table-sm mb-0 stat-table">
                <thead><tr><th style={{ width: 32 }}>#</th><th>Player</th><th>Team</th><th className="text-end">Avg</th><th className="text-end">GP</th></tr></thead>
                <tbody>
                  {leaders.scoring_avg.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className={`stat-rank ${rankClass(i)}`}>{i + 1}</span></td>
                      <td><strong>{p.name}</strong></td>
                      <td style={{ color: 'var(--kl-text-primary)' }}>{p.fantasy_team || '-'}</td>
                      <td className="text-end"><strong style={{ color: '#ececf6' }}>{p.avg.toFixed(1)}</strong></td>
                      <td className="text-end" style={{ color: 'var(--kl-text-primary)' }}>{p.games}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="stat-card">
              <div className="card-header"><h6><i className="bi bi-bullseye" style={{ color: '#3fb950' }}></i>Most Consistent (Lowest Std Dev)</h6></div>
              <table className="table table-sm mb-0 stat-table">
                <thead><tr><th style={{ width: 32 }}>#</th><th>Player</th><th className="text-end">Avg</th><th className="text-end">Std Dev</th></tr></thead>
                <tbody>
                  {leaders.consistency.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className={`stat-rank ${rankClass(i)}`}>{i + 1}</span></td>
                      <td><strong>{p.name}</strong></td>
                      <td className="text-end" style={{ color: 'var(--kl-text-primary)' }}>{p.avg.toFixed(1)}</td>
                      <td className="text-end"><strong style={{ color: '#3fb950' }}>{p.std_dev.toFixed(1)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="stat-card">
              <div className="card-header"><h6><i className="bi bi-lightning-fill" style={{ color: '#d29922' }}></i>Highest Ceiling (Best Single Round)</h6></div>
              <table className="table table-sm mb-0 stat-table">
                <thead><tr><th style={{ width: 32 }}>#</th><th>Player</th><th className="text-end">Best</th><th className="text-end">Avg</th><th className="text-end">Rd</th></tr></thead>
                <tbody>
                  {leaders.ceiling.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className={`stat-rank ${rankClass(i)}`}>{i + 1}</span></td>
                      <td><strong>{p.name}</strong></td>
                      <td className="text-end"><strong style={{ color: '#d29922' }}>{p.ceiling}</strong></td>
                      <td className="text-end" style={{ color: 'var(--kl-text-primary)' }}>{p.avg.toFixed(1)}</td>
                      <td className="text-end" style={{ color: 'var(--kl-text-primary)' }}>{p.best_round}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="stat-card">
              <div className="card-header"><h6><i className="bi bi-graph-up-arrow" style={{ color: '#e4e3ed' }}></i>Most Improved (Avg Increase)</h6></div>
              <table className="table table-sm mb-0 stat-table">
                <thead><tr><th style={{ width: 32 }}>#</th><th>Player</th><th className="text-end">Prev</th><th className="text-end">Now</th><th className="text-end">Diff</th></tr></thead>
                <tbody>
                  {leaders.most_improved.map((p, i) => (
                    <tr key={`${p.name}-${i}`}>
                      <td><span className={`stat-rank ${rankClass(i)}`}>{i + 1}</span></td>
                      <td><strong>{p.name}</strong></td>
                      <td className="text-end" style={{ color: 'var(--kl-text-primary)' }}>{p.prev_avg.toFixed(1)}</td>
                      <td className="text-end" style={{ color: 'var(--kl-text-primary)' }}>{p.curr_avg.toFixed(1)}</td>
                      <td className="text-end"><strong style={{ color: '#e4e3ed' }}>+{p.improvement.toFixed(1)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col-lg-6">
            <div className="stat-card">
              <div className="card-header"><h6><i className="bi bi-heart-pulse-fill" style={{ color: '#f85149' }}></i>Ironman (Most Games)</h6></div>
              <table className="table table-sm mb-0 stat-table">
                <thead><tr><th style={{ width: 32 }}>#</th><th>Player</th><th className="text-end">Games</th><th className="text-end">Avg</th></tr></thead>
                <tbody>
                  {leaders.ironman.map((p, i) => (
                    <tr key={p.id}>
                      <td><span className={`stat-rank ${rankClass(i)}`}>{i + 1}</span></td>
                      <td><strong>{p.name}</strong></td>
                      <td className="text-end"><strong style={{ color: '#f85149' }}>{p.games}</strong></td>
                      <td className="text-end" style={{ color: 'var(--kl-text-primary)' }}>{p.avg.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'team' && (
        <div className="row g-3">
          <div className="col-12">
            <select className="form-select form-select-sm" value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} style={{ maxWidth: 280, background: '#0e0d0f', borderColor: '#2a292f', fontSize: '.82rem' }}>
              <option value="">Select a team...</option>
              {data.teams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
            </select>
          </div>

          {selectedTeam && (
            <>
              <div className="col-lg-8">
                <div className="stat-card">
                  <div className="card-header"><h6>{selectedTeam.name}, Scoring Trend</h6></div>
                  <div className="card-body">
                    <TrendChart rounds={selectedTeam.round_scores} />
                  </div>
                </div>
              </div>

              <div className="col-lg-4">
                <div className="stat-card">
                  <div className="card-header"><h6>Position Group Contribution</h6></div>
                  <div className="card-body p-3">
                    {Object.entries(selectedTeam.position_breakdown).map(([pos, pts]) => {
                      const pct = posTotal > 0 ? (pts / posTotal) * 100 : 0
                      return (
                        <div key={pos} className="pos-bar-row">
                          <span className="pos-bar-label" style={{ color: POS_COLORS[pos] || '#ececf1' }}>{pos}</span>
                          <div className="pos-bar-track">
                            <div className="pos-bar-fill" style={{ width: `${pct}%`, background: POS_COLORS[pos] || '#ececf1' }}></div>
                          </div>
                          <span className="pos-bar-value">{pts.toFixed(0)} ({pct.toFixed(0)}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {selectedTeam.bye_impact.length > 0 && (
                  <div className="stat-card mt-3">
                    <div className="card-header"><h6><i className="bi bi-calendar-x" style={{ color: '#d29922' }}></i>Bye Round Impact</h6></div>
                    <div className="card-body p-3">
                      {selectedTeam.bye_impact.map(b => (
                        <div key={b.round} className="bye-impact-row">
                          <span className="bye-round-badge">R{b.round}</span>
                          <span style={{ color: 'var(--kl-text-primary)' }}>{b.players_out} out</span>
                          <span className="ms-auto" style={{ color: '#f85149', fontWeight: 600 }}>-{b.estimated_loss.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
