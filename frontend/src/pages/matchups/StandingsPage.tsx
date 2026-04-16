import { useParams, Link } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'

interface Team { id: number; name: string; logo_url?: string | null }

interface Standing {
  team_id: number
  team: Team | null
  wins: number
  losses: number
  draws: number
  ladder_points: number
  points_for: number
  points_against: number
  percentage: number
}

interface Ranking {
  rank: number
  movement: number
  team_id: number
  team: Team | null
  score: number
  afl_round: number
}

interface RankingDetail {
  headline: string
  avg_score: number
  league_avg: number
  pct_above: number
  best_round: number
  worst_round: number
  record: string
  form_wins: number
  form_losses: number
  form_total: number
}

interface ScoringContext {
  type: string
  label: string
  is_uf: boolean
  is_custom: boolean
  is_hybrid: boolean
  has_custom_rules: boolean
  score_label: string
  for_label: string
  against_label: string
  pct_label: string
}

interface StandingsData {
  standings: Standing[]
  finals_teams: number
  scoring: ScoringContext
  rankings: Ranking[]
  ranking_details: Record<string, RankingDetail>
  team_form: Record<string, string[]>
  user_team_id: number | null
}

// CSS from templates/matchups/standings.html <style> block. Mobile + global shared
// classes (`ldr-mob-*`, `ldr-hide-mobile`) live in static/style.css and are inherited.
const LDR_CSS = `
.ldr-wrap { background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow:hidden; }
.ldr-table { width:100%; border-collapse:collapse; }
.ldr-table th { font-size:.65rem; font-weight:600; color:#484f58; text-transform:uppercase; letter-spacing:.5px; padding:10px 12px; border-bottom:1px solid #21262d; white-space:nowrap; }
.ldr-table td { font-size:.8rem; padding:10px 12px; border-bottom:1px solid #161b22; color:#8b949e; font-variant-numeric:tabular-nums; }
.ldr-table tbody tr { transition:background .1s; }
.ldr-table tbody tr:hover { background:rgba(22,27,34,.5); }
.ldr-table tbody tr:last-child td { border-bottom:none; }
.ldr-finals-line td { border-bottom:2px solid rgba(63,185,80,.5) !important; }
.ldr-pos { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; font-size:.7rem; font-weight:700; }
.ldr-pos-finals { background:rgba(46,160,67,.08); color:#2ea043; }
.ldr-pos-out { color:#484f58; }
.ldr-pos-1 { background:rgba(255,215,0,.15); color:#FFD700; text-shadow:0 0 6px rgba(255,215,0,.4); }
.ldr-pos-2 { background:rgba(192,192,192,.1); color:#C0C0C0; }
.ldr-pos-3 { background:rgba(205,127,50,.1); color:#CD7F32; }
.ldr-name { color:#e6edf3; font-weight:600; text-decoration:none; transition:color .1s; }
.ldr-name:hover { color:#58a6ff; }
.ldr-pts { color:#58a6ff; font-weight:700; }
.ldr-pct { font-weight:500; }
.ldr-footer { padding:8px 16px; font-size:.68rem; color:#30363d; border-top:1px solid #161b22; display:flex; justify-content:space-between; align-items:center; }
.ldr-toggle { display:inline-flex; border:1px solid #30363d; border-radius:6px; overflow:hidden; margin-bottom:16px; }
.ldr-toggle-btn { padding:6px 16px; font-size:.78rem; font-weight:600; cursor:pointer; background:transparent; color:#8b949e; border:none; transition:all .15s; }
.ldr-toggle-btn.active { background:rgba(88,166,255,.12); color:#58a6ff; }
.ldr-toggle-btn:hover:not(.active) { color:#c9d1d9; }
.pr-row { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid #161b22; transition:background .1s; }
.pr-row:hover { background:rgba(22,27,34,.5); }
.pr-row:last-child { border-bottom:none; }
.pr-rank-num { font-size:1.1rem; font-weight:800; min-width:28px; text-align:center; }
.pr-rank-1 { color:#FFD700; }
.pr-rank-2 { color:#C0C0C0; }
.pr-rank-3 { color:#CD7F32; }
.pr-rank-other { color:#484f58; }
.pr-move { font-size:.72rem; font-weight:700; min-width:32px; text-align:center; }
.pr-move-up { color:#3fb950; }
.pr-move-down { color:#f85149; }
.pr-move-same { color:#30363d; }
.pr-info { flex:1; min-width:0; }
.pr-team { color:#e6edf3; font-weight:600; font-size:.88rem; display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.pr-headline { font-size:.6rem; font-weight:700; letter-spacing:.3px; padding:1px 6px; border-radius:3px; text-transform:uppercase; }
.pr-hl-onfire, .pr-hl-dominant { background:rgba(63,185,80,.15); color:#3fb950; }
.pr-hl-surging, .pr-hl-strong { background:rgba(88,166,255,.12); color:#58a6ff; }
.pr-hl-steady { background:rgba(139,148,158,.1); color:#8b949e; }
.pr-hl-underperforming, .pr-hl-struggling { background:rgba(248,81,73,.1); color:#f85149; }
.pr-hl-sliding, .pr-hl-infreefall { background:rgba(248,81,73,.15); color:#f85149; }
.pr-detail-row { display:flex; align-items:center; gap:6px; margin-top:2px; font-size:.7rem; color:#8b949e; }
.pr-detail-item b { color:#c9d1d9; }
.pr-detail-sep { width:1px; height:10px; background:#30363d; }
.pr-detail-pos { color:#3fb950; }
.pr-detail-neg { color:#f85149; }
.pr-right { display:flex; align-items:center; gap:12px; }
.pr-score-badge { color:#58a6ff; font-weight:700; font-size:.85rem; }
.pr-form-dots { display:flex; gap:2px; }
.pr-dot { width:16px; height:16px; border-radius:3px; font-size:.55rem; font-weight:800; display:flex; align-items:center; justify-content:center; }
.pr-dot-W { background:rgba(63,185,80,.15); color:#3fb950; }
.pr-dot-L { background:rgba(248,81,73,.12); color:#f85149; }
.pr-dot-D { background:rgba(210,153,34,.12); color:#d29922; }
`

function posClass(pos: number, inFinals: boolean): string {
  if (pos === 1) return ' ldr-pos-1'
  if (pos === 2) return ' ldr-pos-2'
  if (pos === 3) return ' ldr-pos-3'
  if (inFinals) return ' ldr-pos-finals'
  return ' ldr-pos-out'
}

function scoringTagType(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('supercoach')) return 'sc'
  if (l.includes('fantasy')) return 'af'
  if (l.includes('ultimate')) return 'uf'
  if (l.includes('hybrid')) return 'hybrid'
  return 'custom'
}

// Mirrors Jinja's `pr-hl-{{ headline|lower|replace(' ','') }}` suffix
function headlineSlug(h: string): string {
  return (h || 'Steady').toLowerCase().replace(/\s+/g, '')
}

export function StandingsPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<StandingsData>(`/leagues/${leagueId}/standings?format=json`)
  const [view, setView] = useState<'ladder' | 'rankings'>('ladder')

  if (loading) return <Spinner text="Loading standings..." />
  if (!data) return <p className="text-danger">Failed to load standings</p>

  const { standings, finals_teams, scoring, rankings, ranking_details, team_form, user_team_id } = data
  const hasRankings = rankings && rankings.length > 0
  const scType = scoringTagType(scoring.label)

  return (
    <div>
      <style>{LDR_CSS}</style>
      <div className="d-none d-lg-block"><LeagueSubnav active="ladder" leagueId={leagueId!} /></div>

      {/* Competition toggle: Main vs 7s */}
      <div className="comp-toggle">
        <span className="comp-toggle-btn" style={{ borderColor: 'rgba(88,166,255,.3)', color: '#58a6ff', background: 'rgba(88,166,255,.08)', borderRadius: '8px 0 0 8px' }}>Main</span>
        <Link to={`/leagues/${leagueId}/reserve7s/standings`} className="comp-toggle-btn text-decoration-none" style={{ borderColor: '#30363d', color: '#8b949e', borderRadius: '0 8px 8px 0', borderLeft: 0 }}>7s</Link>
      </div>

      {hasRankings && (
        <div className="ldr-toggle">
          <button className={`ldr-toggle-btn${view === 'ladder' ? ' active' : ''}`} onClick={() => setView('ladder')}>Ladder</button>
          <button className={`ldr-toggle-btn${view === 'rankings' ? ' active' : ''}`} onClick={() => setView('rankings')}>Power Rankings</button>
        </div>
      )}

      {/* ═══ LADDER VIEW ═══ */}
      {view === 'ladder' && (
        <div>
          {standings.length > 0 ? (
            <>
              {/* Mobile cards */}
              <div className="d-lg-none ldr-cards-mobile">
                {standings.map((s, i) => {
                  const pos = i + 1
                  const inFinals = finals_teams > 0 && pos <= finals_teams
                  const isFinalsLine = inFinals && pos === finals_teams
                  const isMine = user_team_id != null && s.team_id === user_team_id
                  return (
                    <div key={s.team_id}
                      className={`ldr-mob-card${isMine ? ' ldr-mob-mine' : ''}${inFinals ? ' ldr-mob-finals' : ''}`}
                      style={isFinalsLine ? { borderBottom: '2px solid rgba(63,185,80,.5)' } : undefined}>
                      <span className={`ldr-mob-rank${posClass(pos, inFinals)}`}>{pos}</span>
                      <Link to={`/leagues/${leagueId}/team/${s.team_id}`} className="ldr-mob-name">
                        {s.team?.name}
                      </Link>
                      <span className="ldr-mob-record">
                        {s.wins}-{s.losses}{s.draws > 0 ? `-${s.draws}` : ''}
                      </span>
                      <span className="ldr-mob-pts">
                        {s.ladder_points}
                        <span style={{ fontSize: '.65rem', fontWeight: 500, color: '#8b949e' }}> pts</span>
                      </span>
                    </div>
                  )
                })}
                {finals_teams > 0 && (
                  <div style={{ fontSize: '.65rem', color: '#484f58', padding: '8px 12px', textAlign: 'center', background: 'rgba(63,185,80,.03)' }}>
                    <i className="bi bi-trophy-fill" style={{ color: '#2ea043', marginRight: 4 }}></i>
                    Top {finals_teams} qualify for finals
                  </div>
                )}
              </div>

              {/* Desktop table */}
              <div className="d-none d-lg-block ldr-wrap" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="ldr-table" style={{ minWidth: 580 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40, textAlign: 'center' }}>#</th>
                      <th>Team</th>
                      <th style={{ textAlign: 'center' }}>P</th>
                      <th style={{ textAlign: 'center' }}>W</th>
                      <th style={{ textAlign: 'center' }}>L</th>
                      <th className="ldr-hide-mobile" style={{ textAlign: 'center' }}>D</th>
                      <th style={{ textAlign: 'center' }}>Pts</th>
                      <th className="ldr-hide-mobile" style={{ textAlign: 'right' }}>{scoring.for_label}</th>
                      <th className="ldr-hide-mobile" style={{ textAlign: 'right' }}>{scoring.against_label}</th>
                      <th className="ldr-hide-mobile" style={{ textAlign: 'right' }}>{scoring.pct_label}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => {
                      const pos = i + 1
                      const inFinals = finals_teams > 0 && pos <= finals_teams
                      const rowCls = inFinals && pos === finals_teams ? 'ldr-finals-line' : undefined
                      return (
                        <tr key={s.team_id}
                          className={rowCls}
                          style={inFinals ? { background: 'rgba(63,185,80,.03)' } : undefined}>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`ldr-pos${posClass(pos, inFinals)}`}>{pos}</span>
                          </td>
                          <td>
                            <Link to={`/leagues/${leagueId}/team/${s.team_id}`} className="ldr-name">
                              {s.team?.name}
                            </Link>
                          </td>
                          <td style={{ textAlign: 'center' }}>{s.wins + s.losses + s.draws}</td>
                          <td style={{ textAlign: 'center', ...(s.wins > 0 ? { color: '#3fb950', fontWeight: 600 } : {}) }}>{s.wins}</td>
                          <td style={{ textAlign: 'center', ...(s.losses > 0 ? { color: '#f85149', fontWeight: 600 } : {}) }}>{s.losses}</td>
                          <td className="ldr-hide-mobile" style={{ textAlign: 'center' }}>{s.draws}</td>
                          <td style={{ textAlign: 'center' }}><span className="ldr-pts">{s.ladder_points}</span></td>
                          <td className="ldr-hide-mobile" style={{ textAlign: 'right' }}>
                            {s.points_for > 0 ? Math.round(s.points_for) : '–'}
                          </td>
                          <td className="ldr-hide-mobile" style={{ textAlign: 'right' }}>
                            {s.points_against > 0 ? Math.round(s.points_against) : '–'}
                          </td>
                          <td className="ldr-hide-mobile" style={{ textAlign: 'right' }}>
                            <span className="ldr-pct"
                              style={
                                s.percentage >= 110 ? { color: '#3fb950' }
                                : s.percentage > 0 && s.percentage < 90 ? { color: '#f85149' }
                                : undefined
                              }>
                              {s.percentage > 0 ? `${s.percentage.toFixed(1)}%` : '–'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="ldr-footer">
                  <span>{finals_teams > 0 ? `Top ${finals_teams} qualify for finals` : ''}</span>
                  <span className="scoring-tag" data-type={scType}>{scoring.label}</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#484f58' }}>
              <i className="bi bi-bar-chart" style={{ fontSize: '2rem', display: 'block', marginBottom: 12, color: '#30363d' }}></i>
              <h4 style={{ color: '#8b949e', fontSize: '1rem', fontWeight: 600 }}>No teams yet</h4>
              <p style={{ fontSize: '.8rem' }}>Teams will appear here once they join the league.</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ POWER RANKINGS VIEW ═══ */}
      {view === 'rankings' && (
        hasRankings ? (
          <div className="ldr-wrap">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '.72rem', color: '#8b949e' }}>
                <i className="bi bi-graph-up-arrow me-1"></i>
                Round {rankings[0].afl_round} — Based on form, scoring power & strength of wins
              </span>
            </div>
            {rankings.map(pr => {
              const detail = ranking_details[String(pr.team_id)]
              const headline = detail?.headline || 'Steady'
              const form = team_form[String(pr.team_id)] || []
              const rankCls = pr.rank <= 3 ? `pr-rank-${pr.rank}` : 'pr-rank-other'
              return (
                <div key={pr.team_id} className="pr-row">
                  <span className={`pr-rank-num ${rankCls}`}>{pr.rank}</span>
                  <span className={`pr-move ${pr.movement > 0 ? 'pr-move-up' : pr.movement < 0 ? 'pr-move-down' : 'pr-move-same'}`}>
                    {pr.movement > 0 ? <><i className="bi bi-caret-up-fill"></i>{pr.movement}</>
                      : pr.movement < 0 ? <><i className="bi bi-caret-down-fill"></i>{Math.abs(pr.movement)}</>
                      : <>&mdash;</>}
                  </span>
                  <div className="pr-info">
                    <div className="pr-team">
                      {pr.team?.name}
                      <span className={`pr-headline pr-hl-${headlineSlug(headline)}`}>{headline}</span>
                    </div>
                    {detail && (
                      <>
                        <div className="pr-detail-row">
                          <span className="pr-detail-item"><b>{detail.record}</b></span>
                          <span className="pr-detail-sep"></span>
                          <span className="pr-detail-item">Avg <b>{detail.avg_score}</b></span>
                          <span className="pr-detail-sep"></span>
                          <span className={`pr-detail-item${detail.pct_above > 0 ? ' pr-detail-pos' : detail.pct_above < 0 ? ' pr-detail-neg' : ''}`}>
                            {detail.pct_above >= 0 ? '+' : ''}{detail.pct_above.toFixed(1)}% vs avg
                          </span>
                        </div>
                        <div className="pr-detail-row">
                          <span className="pr-detail-item">Best <b>{Math.round(detail.best_round)}</b></span>
                          <span className="pr-detail-sep"></span>
                          <span className="pr-detail-item">Worst <b>{Math.round(detail.worst_round)}</b></span>
                          <span className="pr-detail-sep"></span>
                          <span className="pr-detail-item">Form {detail.form_wins}W {detail.form_losses}L / {detail.form_total}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="pr-right">
                    <span className="pr-score-badge">{pr.score.toFixed(1)}</span>
                    <div className="pr-form-dots">
                      {form.map((r, i) => (
                        <span key={i} className={`pr-dot pr-dot-${r}`}>{r}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="ldr-wrap" style={{ textAlign: 'center', padding: '48px 20px', color: '#484f58' }}>
            <i className="bi bi-graph-up-arrow" style={{ fontSize: '2rem', display: 'block', marginBottom: 12, color: '#30363d' }}></i>
            <p style={{ fontSize: '.85rem' }}>Power rankings will appear after the first round is finalised.</p>
          </div>
        )
      )}
    </div>
  )
}
