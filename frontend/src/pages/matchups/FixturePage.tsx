import { useParams, Link, useSearchParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'
import { useEffect, useRef } from 'react'

interface FixtureMatch {
  fixture_id: number; home: string; away: string; home_score: number; away_score: number; completed: boolean; status: string
}
interface FixtureRound {
  round: number
  matches: FixtureMatch[]
}

export function FixturePage() {
  const { leagueId } = useParams()
  const [searchParams] = useSearchParams()
  const { data, loading } = useFetch<FixtureRound[]>(`/api/leagues/${leagueId}/fixture`)
  const stripRef = useRef<HTMLDivElement>(null)

  // Find selected round (from URL or latest with results)
  const urlRound = searchParams.get('round')
  const selectedRound = urlRound ? Number(urlRound) :
    (data ? Math.max(...data.filter(r => r.matches.some(m => m.completed)).map(r => r.round), data[0]?.round || 1) : 1)

  // Auto-scroll round strip
  useEffect(() => {
    if (stripRef.current) {
      const active = stripRef.current.querySelector('.rnd-item.active') as HTMLElement
      if (active) {
        const offset = active.offsetLeft - stripRef.current.offsetWidth / 2 + active.offsetWidth / 2
        stripRef.current.scrollLeft = Math.max(0, offset)
      }
    }
  }, [selectedRound, data])

  if (loading) return <Spinner />
  if (!data) return <p className="text-danger">Failed to load fixture</p>

  const currentRound = data.find(r => r.round === selectedRound) || data[0]
  const allCompleted = currentRound?.matches.every(m => m.completed) && (currentRound?.matches.length || 0) > 0
  const roundHasLive = currentRound?.matches.some(m => m.status === 'live')
  const roundPartial = !allCompleted && currentRound?.matches.some(m => m.completed)

  return (
    <div>
      {/* Inline styles from fixture.html */}
      <style>{`
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
        .rnd-dot { width:5px; height:5px; border-radius:50%; margin-top:4px; }
        .rnd-dot-done { background:#484f58; }
        .rnd-dot-live { background:#3fb950; animation:livePulse 1.8s ease-in-out infinite; }
        .rnd-dot-part { background:#9e6a03; }
        .rnd-dot-none { background:transparent; }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.35;transform:scale(1.4);} }
        .rnd-item.rnd-live .rnd-num { color:#3fb950; }
        .mx-live-tag { font-size:.55rem; font-weight:700; color:#3fb950; letter-spacing:.5px; background:rgba(63,185,80,.08); padding:2px 6px; border-radius:3px; }
        .round-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #21262d; }
        .round-hdr-left { display:flex; align-items:baseline; gap:10px; }
        .round-hdr h3 { font-size:1.05rem; font-weight:700; color:#e6edf3; margin:0; letter-spacing:-.01em; }
        .rh-badge { font-size:.6rem; font-weight:600; padding:2px 8px; border-radius:4px; letter-spacing:.3px; text-transform:uppercase; }
        .rh-complete { background:rgba(46,160,67,.1); color:#2ea043; }
        .rh-live { background:rgba(63,185,80,.12); color:#3fb950; }
        .rh-progress { background:rgba(158,106,3,.1); color:#d29922; }
        .mx-list { background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow:hidden; }
        .mx-row { display:grid; grid-template-columns:1fr auto 1fr auto; align-items:center; padding:14px 20px; gap:0; border-bottom:1px solid #161b22; transition:background .1s; text-decoration:none; color:inherit; cursor:pointer; }
        .mx-row:last-child { border-bottom:none; }
        .mx-row:hover { background:rgba(22,27,34,.6); }
        .mx-team { font-size:.85rem; font-weight:500; color:#c9d1d9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .mx-team-home { text-align:left; padding-right:12px; }
        .mx-team-away { text-align:right; padding-left:12px; }
        .mx-team.won { color:#e6edf3; font-weight:700; }
        .mx-centre { display:flex; align-items:center; justify-content:center; min-width:100px; gap:0; }
        .mx-sc { font-size:.95rem; font-weight:700; min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
        .mx-sc.won { color:#3fb950; }
        .mx-sc.lost { color:#6e7681; }
        .mx-sep { color:#21262d; margin:0 4px; font-weight:300; font-size:.8rem; }
        .mx-vs { font-size:.65rem; font-weight:700; color:#30363d; letter-spacing:1.5px; text-transform:uppercase; }
        .mx-arrow { display:flex; align-items:center; justify-content:center; width:28px; color:#21262d; transition:color .1s; }
        .mx-row:hover .mx-arrow { color:#484f58; }
        .season-empty { text-align:center; padding:60px 20px; color:#484f58; }
        .season-empty i { font-size:2rem; margin-bottom:12px; display:block; color:#30363d; }
        .season-empty h4 { color:#8b949e; font-size:1rem; font-weight:600; margin-bottom:4px; }
      `}</style>

      <LeagueSubnav active="fixture" leagueId={leagueId!} />

      {data.length === 0 ? (
        <div className="season-empty">
          <i className="bi bi-calendar-week"></i>
          <h4>No fixture generated</h4>
          <p style={{ fontSize: '.8rem' }}>The commissioner hasn't set up the fixture yet.</p>
        </div>
      ) : (
        <>
          {/* Round strip */}
          <div className="rnd-strip" ref={stripRef}>
            {data.map(r => {
              const hasLive = r.matches.some(m => m.status === 'live')
              const allDone = r.matches.every(m => m.completed) && r.matches.length > 0
              const partial = !allDone && r.matches.some(m => m.completed)
              const dotClass = hasLive ? 'rnd-dot-live' : allDone ? 'rnd-dot-done' : partial ? 'rnd-dot-part' : 'rnd-dot-none'
              const itemClass = hasLive ? ' rnd-live' : allDone ? ' rnd-done' : ''
              return (
                <Link key={r.round}
                  to={`/leagues/${leagueId}/fixture?round=${r.round}`}
                  className={`rnd-item${r.round === selectedRound ? ' active' : ''}${itemClass}`}>
                  <span className="rnd-num">{r.round === 0 ? 'PS' : r.round}</span>
                  <span className={`rnd-dot ${dotClass}`}></span>
                </Link>
              )
            })}
          </div>

          {/* Round header */}
          {currentRound && (
            <>
              <div className="round-hdr">
                <div className="round-hdr-left">
                  <h3>{selectedRound === 0 ? 'Pre-Season' : `Round ${selectedRound}`}</h3>
                  {allCompleted && (
                    <span className="rh-badge rh-complete">Complete</span>
                  )}
                  {roundHasLive && (
                    <span className="rh-badge rh-live"><i className="bi bi-broadcast me-1" style={{ fontSize: '.5rem' }}></i>Live</span>
                  )}
                  {roundPartial && !roundHasLive && (
                    <span className="rh-badge rh-progress">In Progress</span>
                  )}
                </div>
              </div>

              {/* Matchup list */}
              <div className="mx-list">
                {currentRound.matches.map(m => {
                  const homeWon = m.completed && m.home_score > m.away_score
                  const awayWon = m.completed && m.away_score > m.home_score
                  return (
                    <Link key={m.fixture_id} to={`/leagues/${leagueId}/matchup/${m.fixture_id}`}
                      className="mx-row" style={{ position: 'relative' }}>
                      <span className={`mx-team mx-team-home${homeWon ? ' won' : ''}`}>{m.home}</span>
                      <div className="mx-centre">
                        {m.completed ? (
                          <>
                            <span className={`mx-sc${homeWon ? ' won' : awayWon ? ' lost' : ' draw'}`}>{Math.round(m.home_score)}</span>
                            <span className="mx-sep">&ndash;</span>
                            <span className={`mx-sc${awayWon ? ' won' : homeWon ? ' lost' : ' draw'}`}>{Math.round(m.away_score)}</span>
                          </>
                        ) : m.status === 'live' ? (
                          <span className="mx-live-tag"><i className="bi bi-broadcast me-1"></i>LIVE</span>
                        ) : (
                          <span className="mx-vs">vs</span>
                        )}
                      </div>
                      <span className={`mx-team mx-team-away${awayWon ? ' won' : ''}`}>{m.away}</span>
                      <div className="mx-arrow">
                        <i className="bi bi-chevron-right" style={{ fontSize: '.65rem' }}></i>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
