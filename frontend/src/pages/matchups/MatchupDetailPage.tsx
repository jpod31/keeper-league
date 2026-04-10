import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'

interface Team { id: number; name: string; logo_url?: string | null }

interface Fixture {
  id: number
  afl_round: number
  home_team_id: number
  away_team_id: number
  home_team: Team | null
  away_team: Team | null
  home_score: number | null
  away_score: number | null
  status: string
  is_final: boolean
  final_type: string | null
}

interface ScoringContext {
  type: string
  label: string
  score_label: string
  for_label: string
  against_label: string
  pct_label: string
  [k: string]: unknown
}

interface UfBreakdownRow {
  stat: string
  home: number
  away: number
  winner: 'home' | 'away' | 'draw'
}

interface CustomBreakdownRow {
  stat: string
  home_raw: number
  away_raw: number
  home_pts: number
  away_pts: number
  points_per: number
  winner: 'home' | 'away' | 'draw'
}

interface PlayerBreakdownEntry {
  name: string
  score: number
  is_emergency: boolean
  subbed_on?: boolean
  is_dnp?: boolean
  replaces?: string
}

interface PlayerBreakdown {
  home: PlayerBreakdownEntry[]
  away: PlayerBreakdownEntry[]
  home_total: number
  away_total: number
  home_captain_bonus: number
  away_captain_bonus: number
}

interface MatchupData {
  fixture: Fixture
  scoring: ScoringContext
  uf_breakdown: UfBreakdownRow[] | null
  custom_breakdown: CustomBreakdownRow[] | null
  player_breakdown: PlayerBreakdown | null
}

// CSS from templates/matchups/detail.html <style> block
const MU_CSS = `
.mu-hero { background:#0d1117; border:1px solid #21262d; border-radius:10px; padding:28px 24px; margin-bottom:20px; overflow:hidden; }
.mu-hero-grid { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:16px; }
.mu-hero-team { text-decoration:none; transition:color .1s; text-align:center; display:block; color:inherit; }
.mu-hero-team:hover .mu-tname { color:#58a6ff; }
.mu-tname { font-size:1rem; font-weight:700; color:#e6edf3; margin-bottom:4px; transition:color .1s; }
.mu-tname.lost { color:#6e7681; }
.mu-tscore { font-size:2.2rem; font-weight:800; line-height:1; font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
.mu-tscore.won { color:#3fb950; }
.mu-tscore.lost { color:#484f58; }
.mu-tscore.draw { color:#8b949e; }
.mu-tscore.pending { color:#21262d; font-size:1.6rem; }
.mu-centre { display:flex; flex-direction:column; align-items:center; gap:4px; }
.mu-status { font-size:.6rem; font-weight:600; padding:2px 8px; border-radius:4px; letter-spacing:.3px; text-transform:uppercase; }
.mu-final { background:rgba(46,160,67,.08); color:#2ea043; }
.mu-sched { color:#30363d; font-size:.7rem; font-weight:600; letter-spacing:1.5px; }
.mu-margin { font-size:.65rem; color:#484f58; margin-top:2px; }
.mu-actions { display:flex; gap:8px; margin-top:16px; justify-content:center; padding-top:16px; border-top:1px solid #161b22; flex-wrap:wrap; }
.mu-act { font-size:.7rem; padding:5px 12px; border-radius:6px; border:1px solid #21262d; background:transparent; color:#8b949e; text-decoration:none; transition:all .12s; }
.mu-act:hover { border-color:#30363d; color:#c9d1d9; }
.bd-wrap { background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow:hidden; margin-bottom:20px; }
.bd-hdr { padding:10px 16px; border-bottom:1px solid #21262d; font-size:.75rem; font-weight:600; color:#8b949e; display:flex; justify-content:space-between; align-items:center; }
.bd-row { display:grid; grid-template-columns:1fr auto 1fr; padding:8px 16px; border-bottom:1px solid #161b22; font-size:.8rem; align-items:center; }
.bd-row:last-child { border-bottom:none; }
.bd-row:nth-child(even) { background:rgba(22,27,34,.3); }
.bd-row-total { border-top:2px solid #30363d; background:rgba(22,27,34,.6); }
.bd-val { font-variant-numeric:tabular-nums; }
.bd-val.bd-w { color:#3fb950; font-weight:600; }
.bd-val.bd-l { color:#6e7681; }
.bd-stat { text-align:center; font-size:.7rem; color:#8b949e; text-transform:capitalize; }
.bd-stat-sub { font-size:.55rem; color:#30363d; font-weight:400; }
.pb-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; }
.pb-side { padding:0; }
.pb-side + .pb-side { border-left:1px solid #21262d; }
.pb-side-hdr { padding:8px 16px; border-bottom:1px solid #161b22; font-size:.7rem; font-weight:600; color:#8b949e; }
.pb-player { display:flex; justify-content:space-between; align-items:center; padding:6px 16px; border-bottom:1px solid #161b22; font-size:.78rem; color:#8b949e; }
.pb-player:last-child { border-bottom:none; }
.pb-player-name { color:#c9d1d9; }
.pb-player-em { font-style:italic; color:#484f58; }
.pb-player-score { font-variant-numeric:tabular-nums; font-weight:600; color:#c9d1d9; }
.pb-total { display:flex; justify-content:space-between; align-items:center; padding:8px 16px; border-top:1px solid #21262d; background:rgba(22,27,34,.4); font-size:.78rem; }
.pb-total.pb-won { border-top:2px solid #3fb950; }
.pb-total.pb-lost { border-top:2px solid rgba(248,81,73,.3); }
.pb-total-label { color:#8b949e; font-weight:600; }
.pb-total-val { color:#e6edf3; font-weight:700; font-variant-numeric:tabular-nums; }
.pb-cap-row { display:flex; justify-content:space-between; padding:4px 16px; font-size:.7rem; color:#484f58; border-top:1px solid #161b22; }
`

function scoringTagType(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('supercoach')) return 'sc'
  if (l.includes('fantasy')) return 'af'
  if (l.includes('ultimate')) return 'uf'
  if (l.includes('hybrid')) return 'hybrid'
  return 'custom'
}

export function MatchupDetailPage() {
  const { leagueId, fixtureId } = useParams()
  const { data, loading } = useFetch<MatchupData>(`/leagues/${leagueId}/matchup/${fixtureId}?format=json`)

  if (loading) return <Spinner text="Loading matchup..." />
  if (!data) return <p className="text-danger">Failed to load matchup</p>

  const { fixture, scoring, uf_breakdown, custom_breakdown, player_breakdown } = data
  const homeScore = fixture.home_score || 0
  const awayScore = fixture.away_score || 0
  const homeWon = fixture.status === 'completed' && homeScore > awayScore
  const awayWon = fixture.status === 'completed' && awayScore > homeScore
  const margin = Math.abs(homeScore - awayScore)
  const scType = scoringTagType(scoring.label)

  return (
    <div>
      <style>{MU_CSS}</style>
      <LeagueSubnav active="fixture" leagueId={leagueId!} />

      <div className="page-header" style={{ marginTop: 0 }}>
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}/fixture?round=${fixture.afl_round}`}>Season</Link>
          {' / '}Round {fixture.afl_round}
          {fixture.is_final && fixture.final_type && <> / {fixture.final_type}</>}
        </div>
      </div>

      {/* Hero */}
      <div className="mu-hero">
        <div className="mu-hero-grid">
          <Link to={`/leagues/${leagueId}/team/${fixture.home_team_id}`} className="mu-hero-team">
            <div className={`mu-tname${awayWon ? ' lost' : ''}`}>{fixture.home_team?.name}</div>
            {fixture.status === 'completed' ? (
              <div className={`mu-tscore${homeWon ? ' won' : awayWon ? ' lost' : ' draw'}`}>
                {Math.round(homeScore)}
              </div>
            ) : (
              <div className="mu-tscore pending">&ndash;</div>
            )}
          </Link>

          <div className="mu-centre">
            {fixture.status === 'completed' ? (
              <>
                <span className="mu-status mu-final">Final</span>
                {margin > 0 && (
                  <span className="mu-margin">by {Math.round(margin)} {scoring.score_label?.toLowerCase() || 'pts'}</span>
                )}
              </>
            ) : (
              <span className="mu-sched">VS</span>
            )}
            <span className="scoring-tag" data-type={scType}>{scoring.label}</span>
          </div>

          <Link to={`/leagues/${leagueId}/team/${fixture.away_team_id}`} className="mu-hero-team">
            <div className={`mu-tname${homeWon ? ' lost' : ''}`}>{fixture.away_team?.name}</div>
            {fixture.status === 'completed' ? (
              <div className={`mu-tscore${awayWon ? ' won' : homeWon ? ' lost' : ' draw'}`}>
                {Math.round(awayScore)}
              </div>
            ) : (
              <div className="mu-tscore pending">&ndash;</div>
            )}
          </Link>
        </div>

        <div className="mu-actions">
          <Link to={`/leagues/${leagueId}/team/${fixture.home_team_id}`} className="mu-act">
            {fixture.home_team?.name} Squad
          </Link>
          <Link to={`/leagues/${leagueId}/team/${fixture.home_team_id}/lineup/${fixture.afl_round}`} className="mu-act">
            {(fixture.home_team?.name || '').substring(0, 8)} Lineup
          </Link>
          <Link to={`/leagues/${leagueId}/team/${fixture.away_team_id}/lineup/${fixture.afl_round}`} className="mu-act">
            {(fixture.away_team?.name || '').substring(0, 8)} Lineup
          </Link>
          <Link to={`/leagues/${leagueId}/team/${fixture.away_team_id}`} className="mu-act">
            {fixture.away_team?.name} Squad
          </Link>
        </div>
      </div>

      {/* Ultimate Footy: Category Breakdown */}
      {uf_breakdown && uf_breakdown.length > 0 && (
        <div className="bd-wrap">
          <div className="bd-hdr">
            <span>Category Breakdown</span>
            <span className="scoring-tag" data-type={scType}>{scoring.label}</span>
          </div>
          {uf_breakdown.map((row, i) => (
            <div key={i} className="bd-row">
              <div className={`bd-val${row.winner === 'home' ? ' bd-w' : ' bd-l'}`} style={{ textAlign: 'left' }}>
                {row.home}
                {row.winner === 'home' && <> <i className="bi bi-check2" style={{ fontSize: '.7rem' }}></i></>}
              </div>
              <div className="bd-stat">{row.stat.replace(/_/g, ' ')}</div>
              <div className={`bd-val${row.winner === 'away' ? ' bd-w' : ' bd-l'}`} style={{ textAlign: 'right' }}>
                {row.winner === 'away' && <><i className="bi bi-check2" style={{ fontSize: '.7rem' }}></i> </>}
                {row.away}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom / Hybrid: Stat Contribution Breakdown */}
      {custom_breakdown && custom_breakdown.length > 0 && (() => {
        const homeTotal = custom_breakdown.reduce((s, r) => s + r.home_pts, 0)
        const awayTotal = custom_breakdown.reduce((s, r) => s + r.away_pts, 0)
        return (
          <div className="bd-wrap">
            <div className="bd-hdr">
              <span>Stat Breakdown</span>
              <span className="scoring-tag" data-type={scType}>{scoring.label}</span>
            </div>
            {custom_breakdown.map((row, i) => (
              <div key={i} className="bd-row">
                <div className={`bd-val${row.winner === 'home' ? ' bd-w' : ' bd-l'}`} style={{ textAlign: 'left' }}>
                  {Math.round(row.home_pts)}
                  <span style={{ fontSize: '.65rem', color: '#484f58', marginLeft: 4 }}>({Math.round(row.home_raw)})</span>
                </div>
                <div className="bd-stat">
                  {row.stat.replace(/_/g, ' ')}
                  <br /><span className="bd-stat-sub">&times;{row.points_per}</span>
                </div>
                <div className={`bd-val${row.winner === 'away' ? ' bd-w' : ' bd-l'}`} style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '.65rem', color: '#484f58', marginRight: 4 }}>({Math.round(row.away_raw)})</span>
                  {Math.round(row.away_pts)}
                </div>
              </div>
            ))}
            <div className="bd-row bd-row-total">
              <div className="bd-val bd-w" style={{ textAlign: 'left' }}>{Math.round(homeTotal)}</div>
              <div className="bd-stat" style={{ fontWeight: 600, color: '#8b949e' }}>Total</div>
              <div className="bd-val bd-w" style={{ textAlign: 'right' }}>{Math.round(awayTotal)}</div>
            </div>
          </div>
        )
      })()}

      {/* Player Scores */}
      {player_breakdown && (player_breakdown.home.length > 0 || player_breakdown.away.length > 0) && (
        <div className="bd-wrap">
          <div className="bd-hdr">
            <span>Player Scores</span>
            <span className="scoring-tag" data-type={scType}>{scoring.label}</span>
          </div>
          <div className="pb-grid">
            <div className="pb-side">
              <div className="pb-side-hdr">{fixture.home_team?.name}</div>
              {player_breakdown.home.map((p, i) => (
                <div key={i} className="pb-player">
                  <span className={`pb-player-name${p.is_emergency ? ' pb-player-em' : ''}`}>
                    {p.name}{p.is_emergency && ' (EM)'}
                  </span>
                  <span className="pb-player-score">{Math.round(p.score)}</span>
                </div>
              ))}
              {player_breakdown.home_captain_bonus > 0 && (
                <div className="pb-cap-row">
                  <span>Captain Bonus</span>
                  <span>+{Math.round(player_breakdown.home_captain_bonus)}</span>
                </div>
              )}
              <div className={`pb-total${homeWon ? ' pb-won' : awayWon ? ' pb-lost' : ''}`}>
                <span className="pb-total-label">Total</span>
                <span className="pb-total-val">{Math.round(player_breakdown.home_total)}</span>
              </div>
            </div>
            <div className="pb-side">
              <div className="pb-side-hdr">{fixture.away_team?.name}</div>
              {player_breakdown.away.map((p, i) => (
                <div key={i} className="pb-player">
                  <span className={`pb-player-name${p.is_emergency ? ' pb-player-em' : ''}`}>
                    {p.name}{p.is_emergency && ' (EM)'}
                  </span>
                  <span className="pb-player-score">{Math.round(p.score)}</span>
                </div>
              ))}
              {player_breakdown.away_captain_bonus > 0 && (
                <div className="pb-cap-row">
                  <span>Captain Bonus</span>
                  <span>+{Math.round(player_breakdown.away_captain_bonus)}</span>
                </div>
              )}
              <div className={`pb-total${awayWon ? ' pb-won' : homeWon ? ' pb-lost' : ''}`}>
                <span className="pb-total-label">Total</span>
                <span className="pb-total-val">{Math.round(player_breakdown.away_total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
