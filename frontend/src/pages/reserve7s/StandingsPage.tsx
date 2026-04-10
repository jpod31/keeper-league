import { useParams, Link } from 'react-router'
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

interface ScoringContext {
  label: string
  [k: string]: unknown
}

interface StandingsData {
  league: { id: number; name: string }
  scoring: ScoringContext
  finals_teams: number
  user_team_id: number | null
  standings: Standing[]
}

const S7_CSS = `
.s7-title { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
.s7-title h3 { font-size:1.1rem; font-weight:700; color:#e6edf3; margin:0; }
.s7-title-badge { font-size:.6rem; font-weight:700; padding:3px 8px; border-radius:4px; background:rgba(188,140,255,.1); color:#bc8cff; letter-spacing:.5px; }
.s7-wrap { background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow:hidden; }
.s7-table { width:100%; border-collapse:collapse; }
.s7-table th { font-size:.65rem; font-weight:600; color:#484f58; text-transform:uppercase; letter-spacing:.5px; padding:10px 12px; border-bottom:1px solid #21262d; white-space:nowrap; }
.s7-table td { font-size:.8rem; padding:10px 12px; border-bottom:1px solid #161b22; color:#8b949e; font-variant-numeric:tabular-nums; }
.s7-table tbody tr { transition:background .1s; }
.s7-table tbody tr:hover { background:rgba(22,27,34,.5); }
.s7-table tbody tr:last-child td { border-bottom:none; }
.s7-finals-line td { border-bottom:2px solid rgba(188,140,255,.4) !important; }
.s7-pos { display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:6px; font-size:.7rem; font-weight:700; }
.s7-pos-1 { background:rgba(255,215,0,.15); color:#FFD700; text-shadow:0 0 6px rgba(255,215,0,.4); }
.s7-pos-2 { background:rgba(192,192,192,.1); color:#C0C0C0; }
.s7-pos-finals { background:rgba(188,140,255,.08); color:#bc8cff; }
.s7-pos-out { color:#484f58; }
.s7-name { color:#e6edf3; font-weight:600; text-decoration:none; transition:color .1s; }
.s7-name:hover { color:#bc8cff; }
.s7-pts { color:#bc8cff; font-weight:700; }
.s7-pct { font-weight:500; }
.s7-footer { padding:8px 16px; font-size:.68rem; color:#30363d; border-top:1px solid #161b22; display:flex; justify-content:space-between; align-items:center; }
.s7-subnav { display:flex; gap:2px; margin-bottom:12px; border-bottom:1px solid #21262d; }
.s7-subnav-tab { padding:8px 16px; font-size:.78rem; font-weight:600; color:#8b949e; text-decoration:none; border-bottom:2px solid transparent; transition:all .15s; }
.s7-subnav-tab:hover { color:#c9d1d9; }
.s7-subnav-tab.active { color:#bc8cff; border-bottom-color:#bc8cff; }
`

function posClass(pos: number, inFinals: boolean): string {
  if (pos === 1) return ' s7-pos-1'
  if (pos === 2) return ' s7-pos-2'
  if (inFinals) return ' s7-pos-finals'
  return ' s7-pos-out'
}

export function Reserve7sStandingsPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<StandingsData>(`/leagues/${leagueId}/reserve7s/standings?format=json`)

  if (loading) return <Spinner text="Loading 7s ladder..." />
  if (!data) return <p className="text-danger">Failed to load 7s standings</p>

  const { scoring, finals_teams, user_team_id, standings } = data

  return (
    <div>
      <style>{S7_CSS}</style>
      <LeagueSubnav active="7s" leagueId={leagueId!} />

      <div className="s7-subnav">
        <Link to={`/leagues/${leagueId}/reserve7s/standings`} className="s7-subnav-tab active">Ladder</Link>
        <Link to={`/leagues/${leagueId}/reserve7s/fixture`} className="s7-subnav-tab">Fixture</Link>
        <Link to={`/leagues/${leagueId}/reserve7s/gameday`} className="s7-subnav-tab">Gameday</Link>
        <Link to={`/leagues/${leagueId}/reserve7s/team`} className="s7-subnav-tab">My 7s</Link>
      </div>

      <div className="s7-title">
        <h3><i className="bi bi-7-circle me-1" style={{ color: '#bc8cff' }}></i>Reserve 7s Ladder</h3>
        <span className="s7-title-badge">RESERVE 7s</span>
      </div>

      {standings.length > 0 ? (
        <>
          {/* Mobile cards */}
          <div className="d-lg-none ldr-cards-mobile" style={{ borderColor: 'rgba(188,140,255,.2)' }}>
            {standings.map((s, i) => {
              const pos = i + 1
              const inFinals = finals_teams > 0 && pos <= finals_teams
              const isFinalsLine = inFinals && pos === finals_teams
              const isMine = user_team_id === s.team_id
              return (
                <div
                  key={s.team_id}
                  className={`ldr-mob-card${isMine ? ' ldr-mob-mine' : ''}`}
                  style={inFinals
                    ? { background: 'rgba(188,140,255,.04)', ...(isFinalsLine ? { borderBottom: '2px solid rgba(188,140,255,.4)' } : {}) }
                    : undefined}
                >
                  <span className="ldr-mob-rank" style={
                    pos === 1 ? { background: 'rgba(255,215,0,.15)', color: '#FFD700' }
                    : pos === 2 ? { background: 'rgba(192,192,192,.1)', color: '#C0C0C0' }
                    : inFinals ? { background: 'rgba(188,140,255,.08)', color: '#bc8cff' }
                    : { color: '#484f58' }
                  }>{pos}</span>
                  <Link to={`/leagues/${leagueId}/team/${s.team_id}`} className="ldr-mob-name">{s.team?.name}</Link>
                  <span className="ldr-mob-record">
                    {s.wins}-{s.losses}{s.draws > 0 ? `-${s.draws}` : ''}
                  </span>
                  <span className="ldr-mob-pts" style={{ color: '#bc8cff' }}>
                    {s.ladder_points}
                    <span style={{ fontSize: '.65rem', fontWeight: 500, color: '#8b949e' }}> pts</span>
                  </span>
                </div>
              )
            })}
            {finals_teams > 0 && (
              <div style={{ fontSize: '.65rem', color: '#484f58', padding: '8px 12px', textAlign: 'center', background: 'rgba(188,140,255,.03)' }}>
                <i className="bi bi-trophy-fill" style={{ color: '#bc8cff', marginRight: 4 }}></i>
                Top {finals_teams} qualify for 7s Finals
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="d-none d-lg-block s7-wrap" style={{ overflowX: 'auto' }}>
            <table className="s7-table" style={{ minWidth: 580 }}>
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>#</th>
                  <th>Team</th>
                  <th style={{ textAlign: 'center' }}>P</th>
                  <th style={{ textAlign: 'center' }}>W</th>
                  <th style={{ textAlign: 'center' }}>L</th>
                  <th style={{ textAlign: 'center' }}>D</th>
                  <th style={{ textAlign: 'center' }}>Pts</th>
                  <th style={{ textAlign: 'right' }}>For</th>
                  <th style={{ textAlign: 'right' }}>Agst</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => {
                  const pos = i + 1
                  const inFinals = finals_teams > 0 && pos <= finals_teams
                  const rowCls = inFinals && pos === finals_teams ? 's7-finals-line' : undefined
                  return (
                    <tr
                      key={s.team_id}
                      className={rowCls}
                      style={inFinals ? { background: 'rgba(188,140,255,.03)' } : undefined}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <span className={`s7-pos${posClass(pos, inFinals)}`}>{pos}</span>
                      </td>
                      <td>
                        <Link to={`/leagues/${leagueId}/team/${s.team_id}`} className="s7-name">
                          {s.team?.name}
                        </Link>
                      </td>
                      <td style={{ textAlign: 'center' }}>{s.wins + s.losses + s.draws}</td>
                      <td style={{ textAlign: 'center', ...(s.wins > 0 ? { color: '#3fb950', fontWeight: 600 } : {}) }}>{s.wins}</td>
                      <td style={{ textAlign: 'center', ...(s.losses > 0 ? { color: '#f85149', fontWeight: 600 } : {}) }}>{s.losses}</td>
                      <td style={{ textAlign: 'center' }}>{s.draws}</td>
                      <td style={{ textAlign: 'center' }}><span className="s7-pts">{s.ladder_points}</span></td>
                      <td style={{ textAlign: 'right' }}>{s.points_for > 0 ? Math.round(s.points_for) : '–'}</td>
                      <td style={{ textAlign: 'right' }}>{s.points_against > 0 ? Math.round(s.points_against) : '–'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="s7-pct" style={
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
            <div className="s7-footer">
              {finals_teams > 0 ? <span>Top {finals_teams} qualify for 7s Finals</span> : <span>No finals this season</span>}
              <span className="s7-title-badge">{scoring.label}</span>
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
  )
}
