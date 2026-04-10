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
}

interface ScoringContext {
  label: string
  [k: string]: unknown
}

interface FixtureData {
  league: { id: number; name: string }
  round_meta: Record<string, string>
  selected_round: number
  current_fixtures: Fixture[]
  is_commissioner: boolean
  scoring: ScoringContext
}

const S7F_CSS = `
.s7f-title { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
.s7f-title h3 { font-size:1.1rem; font-weight:700; color:#e6edf3; margin:0; }
.s7f-title-badge { font-size:.6rem; font-weight:700; padding:3px 8px; border-radius:4px; background:rgba(188,140,255,.1); color:#bc8cff; letter-spacing:.5px; }
.s7f-strip { display:flex; align-items:stretch; background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; margin-bottom:20px; }
.s7f-strip::-webkit-scrollbar { display:none; }
.s7f-item { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1 1 0; min-width:44px; padding:12px 2px 10px; text-decoration:none; border-right:1px solid #161b22; transition:background .12s; position:relative; cursor:pointer; color:inherit; }
.s7f-item:last-child { border-right:none; }
.s7f-item:hover { background:#161b22; }
.s7f-item.active { background:#161b22; }
.s7f-item.active::after { content:''; position:absolute; bottom:0; left:20%; right:20%; height:2px; background:#bc8cff; border-radius:1px 1px 0 0; box-shadow:0 0 6px rgba(188,140,255,.5); }
.s7f-num { font-size:.78rem; font-weight:600; color:#484f58; line-height:1; transition:color .12s; }
.s7f-item:hover .s7f-num { color:#8b949e; }
.s7f-item.active .s7f-num { color:#e6edf3; }
.s7f-item.s7f-done .s7f-num { color:#8b949e; }
.s7f-item.s7f-live .s7f-num { color:#3fb950; }
.s7f-dot { width:5px; height:5px; border-radius:50%; margin-top:4px; }
.s7f-dot-done { background:#bc8cff; }
.s7f-dot-live { background:#3fb950; animation:livePulse 1.8s ease-in-out infinite; }
.s7f-dot-none { background:transparent; }
@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(1.4);} }
.s7f-list { background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow:hidden; }
.s7f-row { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:14px 20px; gap:0; border-bottom:1px solid #161b22; transition:background .1s; }
.s7f-row:last-child { border-bottom:none; }
.s7f-row:hover { background:rgba(22,27,34,.6); }
.s7f-team { font-size:.85rem; font-weight:500; color:#c9d1d9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.s7f-team-home { text-align:left; padding-right:12px; }
.s7f-team-away { text-align:right; padding-left:12px; }
.s7f-team.won { color:#e6edf3; font-weight:700; }
.s7f-centre { display:flex; align-items:center; justify-content:center; min-width:100px; gap:0; }
.s7f-sc { font-size:.95rem; font-weight:700; min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
.s7f-sc.won { color:#3fb950; }
.s7f-sc.lost { color:#6e7681; }
.s7f-sep { color:#21262d; margin:0 4px; font-weight:300; font-size:.8rem; }
.s7f-vs { font-size:.65rem; font-weight:700; color:#30363d; letter-spacing:1.5px; text-transform:uppercase; }
.s7f-round-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #21262d; }
.s7f-round-hdr h3 { font-size:1.05rem; font-weight:700; color:#e6edf3; margin:0; }
.s7f-rh-badge { font-size:.6rem; font-weight:600; padding:2px 8px; border-radius:4px; letter-spacing:.3px; text-transform:uppercase; }
.s7f-rh-complete { background:rgba(188,140,255,.1); color:#bc8cff; }
.s7f-rh-live { background:rgba(63,185,80,.12); color:#3fb950; }
.s7f-empty { text-align:center; padding:60px 20px; color:#484f58; }
.s7f-empty i { font-size:2rem; margin-bottom:12px; display:block; color:#30363d; }
.s7f-empty h4 { color:#8b949e; font-size:1rem; font-weight:600; }
.s7-subnav { display:flex; gap:2px; margin-bottom:12px; border-bottom:1px solid #21262d; }
.s7-subnav-tab { padding:8px 16px; font-size:.78rem; font-weight:600; color:#8b949e; text-decoration:none; border-bottom:2px solid transparent; transition:all .15s; }
.s7-subnav-tab:hover { color:#c9d1d9; }
.s7-subnav-tab.active { color:#bc8cff; border-bottom-color:#bc8cff; }
`

export function Reserve7sFixturePage() {
  const { leagueId } = useParams()
  const [searchParams] = useSearchParams()
  const urlRound = searchParams.get('round')
  const url = `/leagues/${leagueId}/reserve7s/fixture?format=json${urlRound ? `&round=${urlRound}` : ''}`
  const { data, loading } = useFetch<FixtureData>(url)
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (stripRef.current) {
      const active = stripRef.current.querySelector('.s7f-item.active') as HTMLElement | null
      if (active) {
        const offset = active.offsetLeft - stripRef.current.offsetWidth / 2 + active.offsetWidth / 2
        stripRef.current.scrollLeft = Math.max(0, offset)
      }
    }
  }, [data?.selected_round])

  if (loading) return <Spinner text="Loading 7s fixture..." />
  if (!data) return <p className="text-danger">Failed to load 7s fixture</p>

  const { round_meta, selected_round, current_fixtures, scoring } = data
  const sortedRounds = Object.keys(round_meta).map(Number).sort((a, b) => a - b)
  const rs = round_meta[String(selected_round)] || 'scheduled'
  const hasFixtures = sortedRounds.length > 0

  return (
    <div>
      <style>{S7F_CSS}</style>
      <LeagueSubnav active="7s" leagueId={leagueId!} />

      <div className="s7-subnav">
        <Link to={`/leagues/${leagueId}/reserve7s/standings`} className="s7-subnav-tab">Ladder</Link>
        <Link to={`/leagues/${leagueId}/reserve7s/fixture`} className="s7-subnav-tab active">Fixture</Link>
        <Link to={`/leagues/${leagueId}/reserve7s/gameday`} className="s7-subnav-tab">Gameday</Link>
        <Link to={`/leagues/${leagueId}/reserve7s/team`} className="s7-subnav-tab">My 7s</Link>
      </div>

      <div className="s7f-title">
        <h3><i className="bi bi-7-circle me-1" style={{ color: '#bc8cff' }}></i>Reserve 7s Season</h3>
        <span className="s7f-title-badge">RESERVE 7s</span>
      </div>

      {hasFixtures ? (
        <>
          <div className="s7f-strip" ref={stripRef}>
            {sortedRounds.map(rnd => {
              const st = round_meta[String(rnd)]
              const dotCls = st === 'completed' ? 's7f-dot-done' : st === 'live' ? 's7f-dot-live' : 's7f-dot-none'
              const itemCls = st === 'completed' ? ' s7f-done' : st === 'live' ? ' s7f-live' : ''
              return (
                <Link
                  key={rnd}
                  to={`/leagues/${leagueId}/reserve7s/fixture?round=${rnd}`}
                  className={`s7f-item${rnd === selected_round ? ' active' : ''}${itemCls}`}
                >
                  <span className="s7f-num">{rnd}</span>
                  <span className={`s7f-dot ${dotCls}`}></span>
                </Link>
              )
            })}
          </div>

          <div className="s7f-round-hdr">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h3>Round {selected_round}</h3>
              {rs === 'completed' && <span className="s7f-rh-badge s7f-rh-complete">Complete</span>}
              {rs === 'live' && (
                <span className="s7f-rh-badge s7f-rh-live">
                  <i className="bi bi-broadcast me-1"></i>Live
                </span>
              )}
              <span className="s7f-title-badge">{scoring.label}</span>
            </div>
          </div>

          <div className="s7f-list">
            {current_fixtures.map(f => {
              const homeWon = f.status === 'completed' && (f.home_score || 0) > (f.away_score || 0)
              const awayWon = f.status === 'completed' && (f.away_score || 0) > (f.home_score || 0)
              return (
                <div key={f.id} className="s7f-row">
                  <span className={`s7f-team s7f-team-home${homeWon ? ' won' : ''}`}>{f.home_team?.name}</span>
                  <div className="s7f-centre">
                    {f.status === 'completed' ? (
                      <>
                        <span className={`s7f-sc${homeWon ? ' won' : ' lost'}`}>{Math.round(f.home_score || 0)}</span>
                        <span className="s7f-sep">–</span>
                        <span className={`s7f-sc${awayWon ? ' won' : ' lost'}`}>{Math.round(f.away_score || 0)}</span>
                      </>
                    ) : (
                      <span className="s7f-vs">vs</span>
                    )}
                  </div>
                  <span className={`s7f-team s7f-team-away${awayWon ? ' won' : ''}`}>{f.away_team?.name}</span>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div className="s7f-empty">
          <i className="bi bi-calendar-week"></i>
          <h4>No Reserve 7s fixture yet</h4>
          <p style={{ fontSize: '.8rem' }}>The 7s fixture auto-generates when the main season fixture is created.</p>
        </div>
      )}
    </div>
  )
}
