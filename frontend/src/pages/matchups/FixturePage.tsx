import { useParams, Link, useSearchParams } from 'react-router'
import { useEffect, useRef } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'

interface Team { id: number; name: string; logo_url?: string | null }

interface Fixture {
  id: number
  home_team_id: number
  away_team_id: number
  home_team: Team | null
  away_team: Team | null
  home_score: number | null
  away_score: number | null
  status: string
  home_played?: number
  home_total?: number
  away_played?: number
  away_total?: number
}

interface ScoringContext {
  type: string
  label: string
  for_label: string
  against_label: string
  pct_label: string
  [k: string]: unknown
}

interface FixtureData {
  round_meta: Record<string, string>  // round_num → 'completed' | 'live' | 'partial' | 'scheduled'
  selected_round: number
  current_fixtures: Fixture[]
  max_round: number
  scoring: ScoringContext
  is_commissioner: boolean
}

// CSS from templates/matchups/fixture.html <style> block
const FX_CSS = `
.rnd-strip { display:flex; align-items:stretch; background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; margin-bottom:20px; }
.rnd-strip::-webkit-scrollbar { display:none; }
.rnd-item { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1 1 0; min-width:44px; padding:12px 2px 10px; text-decoration:none; border-right:1px solid #161b22; transition:background .12s; position:relative; cursor:pointer; color:inherit; }
.rnd-item:last-child { border-right:none; }
.rnd-item:hover { background:#161b22; }
.rnd-item.active { background:#161b22; }
.rnd-item.active::after { content:''; position:absolute; bottom:0; left:20%; right:20%; height:2px; background:#58a6ff; border-radius:1px 1px 0 0; box-shadow:0 0 6px rgba(88,166,255,.5); }
.rnd-num { font-size:.78rem; font-weight:600; color:#484f58; line-height:1; transition:color .12s; }
.rnd-item:hover .rnd-num { color:#8b949e; }
.rnd-item.active .rnd-num { color:#e6edf3; }
.rnd-item.rnd-done .rnd-num { color:#8b949e; }
.rnd-item.rnd-live .rnd-num { color:#3fb950; }
.rnd-dot { width:5px; height:5px; border-radius:50%; margin-top:4px; }
.rnd-dot-done { background:#484f58; }
.rnd-dot-live { background:#3fb950; animation:livePulse 1.8s ease-in-out infinite; }
.rnd-dot-part { background:#9e6a03; }
.rnd-dot-none { background:transparent; }
@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(1.4);} }
.round-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #21262d; }
.round-hdr-left { display:flex; align-items:baseline; gap:10px; }
.round-hdr h3 { font-size:1.05rem; font-weight:700; color:#e6edf3; margin:0; letter-spacing:-.01em; }
.round-hdr .rh-badge { font-size:.6rem; font-weight:600; padding:2px 8px; border-radius:4px; letter-spacing:.3px; text-transform:uppercase; }
.rh-complete { background:rgba(46,160,67,.1); color:#2ea043; }
.rh-live { background:rgba(63,185,80,.12); color:#3fb950; }
.rh-progress { background:rgba(158,106,3,.1); color:#d29922; }
.rh-actions { display:flex; gap:6px; align-items:center; }
.rh-btn { font-size:.7rem; padding:4px 10px; border-radius:6px; border:1px solid #30363d; background:transparent; color:#8b949e; text-decoration:none; transition:all .12s; cursor:pointer; }
.rh-btn:hover { border-color:#484f58; color:#c9d1d9; }
.rh-btn-primary { border-color:rgba(88,166,255,.3); color:#58a6ff; }
.rh-btn-primary:hover { border-color:#58a6ff; background:rgba(88,166,255,.06); }
.mx-list { background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow:hidden; }
.mx-row { display:grid; grid-template-columns:1fr auto 1fr auto; align-items:center; padding:14px 20px; gap:0; border-bottom:1px solid #161b22; transition:background .1s; text-decoration:none; color:inherit; cursor:pointer; }
.mx-row:last-child { border-bottom:none; }
.mx-row:hover { background:rgba(22,27,34,.6); }
.mx-team { font-size:.85rem; font-weight:500; color:#c9d1d9; text-decoration:none; transition:color .1s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mx-team:hover { color:#58a6ff; }
.mx-team-home { text-align:left; padding-right:12px; }
.mx-team-away { text-align:right; padding-left:12px; }
.mx-team.won { color:#e6edf3; font-weight:700; }
.mx-centre { display:flex; align-items:center; justify-content:center; min-width:100px; gap:0; }
.mx-sc { font-size:.95rem; font-weight:700; min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
.mx-sc.won { color:#3fb950; }
.mx-sc.lost { color:#6e7681; }
.mx-sc.draw { color:#8b949e; }
.mx-sep { color:#21262d; margin:0 4px; font-weight:300; font-size:.8rem; }
.mx-vs { font-size:.65rem; font-weight:700; color:#30363d; letter-spacing:1.5px; text-transform:uppercase; }
.mx-live-tag { font-size:.55rem; font-weight:700; color:#3fb950; letter-spacing:.5px; background:rgba(63,185,80,.08); padding:2px 6px; border-radius:3px; }
.mx-arrow { display:flex; align-items:center; justify-content:center; width:28px; color:#21262d; transition:color .1s; }
.mx-row:hover .mx-arrow { color:#484f58; }
.season-empty { text-align:center; padding:60px 20px; color:#484f58; }
.season-empty i { font-size:2rem; margin-bottom:12px; display:block; color:#30363d; }
.season-empty h4 { color:#8b949e; font-size:1rem; font-weight:600; margin-bottom:4px; }
.season-empty p { font-size:.8rem; }
.season-empty a { color:#58a6ff; }
`

function scoringTagType(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('supercoach')) return 'sc'
  if (l.includes('fantasy')) return 'af'
  if (l.includes('ultimate')) return 'uf'
  if (l.includes('hybrid')) return 'hybrid'
  return 'custom'
}

interface FixturePageProps {
  mode?: 'main' | 'sevens'
}

export function FixturePage({ mode = 'main' }: FixturePageProps = {}) {
  const { leagueId } = useParams()
  const [searchParams] = useSearchParams()
  const urlRound = searchParams.get('round')
  const isSevens = mode === 'sevens'
  const basePath = isSevens ? `/leagues/${leagueId}/reserve7s/fixture` : `/leagues/${leagueId}/fixture`
  const gamedayPath = isSevens ? `/leagues/${leagueId}/reserve7s/gameday` : `/leagues/${leagueId}/gameday`
  const matchupPathFor = (fid: number) =>
    isSevens ? `/leagues/${leagueId}/reserve7s/matchup/${fid}` : `/leagues/${leagueId}/matchup/${fid}`
  const apiUrl = isSevens
    ? `/leagues/${leagueId}/reserve7s/fixture?format=json${urlRound ? `&round=${urlRound}` : ''}`
    : `/leagues/${leagueId}/fixture?format=json${urlRound ? `&round=${urlRound}` : ''}`

  const { data, loading } = useFetch<FixtureData>(apiUrl)
  const stripRef = useRef<HTMLDivElement>(null)

  // Auto-scroll round strip to center the active round
  useEffect(() => {
    if (stripRef.current) {
      const active = stripRef.current.querySelector('.rnd-item.active') as HTMLElement | null
      if (active) {
        const offset = active.offsetLeft - stripRef.current.offsetWidth / 2 + active.offsetWidth / 2
        stripRef.current.scrollLeft = Math.max(0, offset)
      }
    }
  }, [data?.selected_round])

  if (loading) return <Spinner text="Loading fixture..." />
  if (!data) return <p className="text-danger">Failed to load fixture</p>

  const { round_meta, selected_round, current_fixtures, scoring, is_commissioner } = data
  const sortedRounds = Object.keys(round_meta).map(Number).sort((a, b) => a - b)
  const rs = round_meta[String(selected_round)] || 'scheduled'
  const scType = scoringTagType(scoring.label)
  const hasFixtures = sortedRounds.length > 0

  const mainColor = '#58a6ff'
  const sevensColor = '#bc8cff'
  const activeColor = isSevens ? sevensColor : mainColor
  const activeBg = isSevens ? 'rgba(188,140,255,.08)' : 'rgba(88,166,255,.08)'
  const activeBorder = isSevens ? 'rgba(188,140,255,.3)' : 'rgba(88,166,255,.3)'

  // 7s theme override — every green accent becomes 7s purple (#bc8cff)
  const SEVENS_OVERRIDE = `
    .fx-sevens .mx-sc.won { color: #bc8cff !important; }
    .fx-sevens .mx-live-tag { color: #bc8cff !important; background: rgba(188,140,255,.1) !important; }
    .fx-sevens .rnd-item.active::after { background: #bc8cff !important; box-shadow: 0 0 6px rgba(188,140,255,.5) !important; }
    .fx-sevens .rnd-dot-live { background: #bc8cff !important; }
    .fx-sevens .rnd-item.rnd-live .rnd-num { color: #bc8cff !important; }
    .fx-sevens .rh-complete { background: rgba(188,140,255,.15) !important; color: #bc8cff !important; }
    .fx-sevens .rh-live { background: rgba(188,140,255,.15) !important; color: #bc8cff !important; }
    .fx-sevens .rh-btn-primary { color: #bc8cff !important; border-color: rgba(188,140,255,.3) !important; }
    .fx-sevens .rh-btn-primary:hover { border-color: #bc8cff !important; background: rgba(188,140,255,.06) !important; }
  `

  return (
    <div className={isSevens ? 'fx-sevens' : ''}>
      <style>{FX_CSS}</style>
      {isSevens && <style>{SEVENS_OVERRIDE}</style>}
      <div className="d-none d-lg-block"><LeagueSubnav active="fixture" leagueId={leagueId!} /></div>

      {/* Competition toggle: Main ↔ 7s */}
      <div className="comp-toggle">
        {isSevens ? (
          <Link to={`/leagues/${leagueId}/fixture`} className="comp-toggle-btn text-decoration-none" style={{ borderColor: '#30363d', color: '#8b949e', borderRadius: '8px 0 0 8px' }}>Main</Link>
        ) : (
          <span className="comp-toggle-btn" style={{ borderColor: activeBorder, color: activeColor, background: activeBg, borderRadius: '8px 0 0 8px' }}>Main</span>
        )}
        {isSevens ? (
          <span className="comp-toggle-btn" style={{ borderColor: activeBorder, color: activeColor, background: activeBg, borderRadius: '0 8px 8px 0', borderLeft: 0 }}>7s</span>
        ) : (
          <Link to={`/leagues/${leagueId}/reserve7s/fixture`} className="comp-toggle-btn text-decoration-none" style={{ borderColor: '#30363d', color: '#8b949e', borderRadius: '0 8px 8px 0', borderLeft: 0 }}>7s</Link>
        )}
      </div>

      {hasFixtures ? (
        <>
          {/* Round strip */}
          <div className="rnd-strip" ref={stripRef}>
            {sortedRounds.map(rnd => {
              const st = round_meta[String(rnd)]
              const dotCls = st === 'completed' ? 'rnd-dot-done'
                : st === 'live' ? 'rnd-dot-live'
                : st === 'partial' ? 'rnd-dot-part'
                : 'rnd-dot-none'
              const itemCls = st === 'completed' ? ' rnd-done' : st === 'live' ? ' rnd-live' : ''
              return (
                <Link key={rnd}
                  to={`${basePath}?round=${rnd}`}
                  className={`rnd-item${rnd === selected_round ? ' active' : ''}${itemCls}`}>
                  <span className="rnd-num">{rnd === 0 ? 'PS' : rnd}</span>
                  <span className={`rnd-dot ${dotCls}`}></span>
                </Link>
              )
            })}
          </div>

          {/* Round header */}
          <div className="round-hdr">
            <div className="round-hdr-left">
              <h3>{selected_round === 0 ? 'Pre-Season' : `Round ${selected_round}`}</h3>
              {rs === 'completed' && <span className="rh-badge rh-complete">Complete</span>}
              {rs === 'live' && (
                <span className="rh-badge rh-live">
                  <i className="bi bi-broadcast me-1" style={{ fontSize: '.5rem' }}></i>Live
                </span>
              )}
              {rs === 'partial' && <span className="rh-badge rh-progress">In Progress</span>}
              <span className="scoring-tag" data-type={scType}>{scoring.label}</span>
            </div>
            <div className="rh-actions">
              {current_fixtures.length > 0 && (rs === 'live' || rs === 'completed' || rs === 'partial') && (
                <Link to={`${gamedayPath}?round=${selected_round}`} className="rh-btn">
                  <i className="bi bi-broadcast me-1"></i>Live
                </Link>
              )}
            </div>
          </div>

          {/* Matchup list — live/current round rows go to gameday (live scores),
              completed rounds go to the matchup detail breakdown. */}
          <div className="mx-list">
            {current_fixtures.map(f => {
              const homeWon = f.status === 'completed' && (f.home_score || 0) > (f.away_score || 0)
              const awayWon = f.status === 'completed' && (f.away_score || 0) > (f.home_score || 0)
              const isLiveRound = rs === 'live' || rs === 'partial'
              const to = isLiveRound
                ? `${gamedayPath}?round=${selected_round}&fixture=${f.id}`
                : matchupPathFor(f.id)
              const isLive = f.status === 'live' || f.status === 'partial'
              const homeLeading = isLive && (f.home_score || 0) > (f.away_score || 0)
              const awayLeading = isLive && (f.away_score || 0) > (f.home_score || 0)
              const showScore = f.status === 'completed' || isLive || (f.home_score != null && f.away_score != null)
              const showProgress = isLive && f.home_total && f.away_total
              return (
                <Link key={f.id}
                  to={to}
                  className="mx-row"
                  style={{ position: 'relative' }}>
                  <span className={`mx-team mx-team-home${homeWon || homeLeading ? ' won' : ''}`}>
                    {f.home_team?.name}
                  </span>
                  <div className="mx-centre" style={{ flexDirection: 'column', gap: 2 }}>
                    {showScore ? (
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className={`mx-sc${homeWon || homeLeading ? ' won' : awayWon || awayLeading ? ' lost' : ' draw'}`}>
                          {Math.round(f.home_score || 0)}
                        </span>
                        <span className="mx-sep">&ndash;</span>
                        <span className={`mx-sc${awayWon || awayLeading ? ' won' : homeWon || homeLeading ? ' lost' : ' draw'}`}>
                          {Math.round(f.away_score || 0)}
                        </span>
                      </div>
                    ) : (
                      <span className="mx-vs">vs</span>
                    )}
                    {isLive && (
                      <span className="mx-live-tag" style={{ fontSize: '.55rem' }}>
                        <i className="bi bi-broadcast me-1"></i>LIVE
                      </span>
                    )}
                    {showProgress && (
                      <span style={{ fontSize: '.62rem', color: '#6e7681', fontVariantNumeric: 'tabular-nums' }}>
                        {f.home_played}/{f.home_total} · {f.away_played}/{f.away_total} played
                      </span>
                    )}
                  </div>
                  <span className={`mx-team mx-team-away${awayWon || awayLeading ? ' won' : ''}`}>
                    {f.away_team?.name}
                  </span>
                  <div className="mx-arrow">
                    <i className="bi bi-chevron-right" style={{ fontSize: '.65rem' }}></i>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      ) : (
        <div className="season-empty">
          <i className="bi bi-calendar-week"></i>
          <h4>No fixture generated</h4>
          <p>
            {is_commissioner
              ? <>Head to <Link to={`/leagues/${leagueId}/settings`}>Settings</Link> to generate the season fixture.</>
              : "The commissioner hasn't set up the fixture yet."}
          </p>
        </div>
      )}
    </div>
  )
}
