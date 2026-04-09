import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../../components/ui/Spinner'
import { useState } from 'react'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'

interface Standing {
  rank: number
  team_id: number
  name: string
  wins: number
  losses: number
  draws: number
  points: number
  pct: number
  for: number
  against: number
}

export function StandingsPage() {
  const { leagueId } = useParams()
  const { league } = useLeague()
  const { data, loading } = useFetch<Standing[]>(`/api/leagues/${leagueId}/standings`)
  const [view, setView] = useState<'ladder' | 'rankings'>('ladder')
  const finalsTeams = 0 // no finals highlight unless API says otherwise

  if (loading) return <Spinner text="Loading standings..." />
  if (!data) return <p className="text-danger">Failed to load standings</p>

  return (
    <div>
      {/* Inline styles from standings.html <style> block */}
      <style>{`
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
      `}</style>

      <LeagueSubnav active="ladder" leagueId={leagueId!} />

      {/* Toggle */}
      <div className="ldr-toggle">
        <button className={`ldr-toggle-btn${view === 'ladder' ? ' active' : ''}`} onClick={() => setView('ladder')}>Ladder</button>
        <button className={`ldr-toggle-btn${view === 'rankings' ? ' active' : ''}`} onClick={() => setView('rankings')}>Power Rankings</button>
      </div>

      {/* LADDER VIEW */}
      {view === 'ladder' && (
        <div>
          {/* Mobile cards */}
          <div className="d-lg-none">
            {data.map((s, i) => {
              const pos = i + 1
              const inFinals = finalsTeams > 0 && pos <= finalsTeams
              const isFinalsLine = inFinals && pos === finalsTeams
              const isMine = league?.user_team?.id === s.team_id
              return (
                <div key={s.team_id}
                  className={`ldr-mob-card${isMine ? ' ldr-mob-mine' : ''}${inFinals ? ' ldr-mob-finals' : ''}`}
                  style={isFinalsLine ? { borderBottom: '2px solid rgba(63,185,80,.5)' } : undefined}>
                  <span className={`ldr-mob-rank${pos === 1 ? ' ldr-pos-1' : pos === 2 ? ' ldr-pos-2' : pos === 3 ? ' ldr-pos-3' : inFinals ? ' ldr-pos-finals' : ' ldr-pos-out'}`}>
                    {pos}
                  </span>
                  <Link to={`/leagues/${leagueId}/team/${s.team_id}`} className="ldr-mob-name">{s.name}</Link>
                  <span className="ldr-mob-record">{s.wins}-{s.losses}{s.draws > 0 ? `-${s.draws}` : ''}</span>
                  <span className="ldr-mob-pts">{s.points}<span style={{ fontSize: '.65rem', fontWeight: 500, color: '#8b949e' }}> pts</span></span>
                </div>
              )
            })}
            {finalsTeams > 0 && (
              <div style={{ fontSize: '.65rem', color: '#484f58', padding: '8px 12px', textAlign: 'center', background: 'rgba(63,185,80,.03)' }}>
                <i className="bi bi-trophy-fill" style={{ color: '#2ea043', marginRight: 4 }}></i>Top {finalsTeams} qualify for finals
              </div>
            )}
          </div>

          {/* Desktop table */}
          <div className="d-none d-lg-block ldr-wrap" style={{ overflowX: 'auto' }}>
            <table className="ldr-table" style={{ minWidth: 580 }}>
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
                  <th style={{ textAlign: 'right' }}>Against</th>
                  <th style={{ textAlign: 'right' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s, i) => {
                  const pos = i + 1
                  const inFinals = finalsTeams > 0 && pos <= finalsTeams
                  return (
                    <tr key={s.team_id}
                      className={inFinals && pos === finalsTeams ? 'ldr-finals-line' : ''}
                      style={inFinals ? { background: 'rgba(63,185,80,.03)' } : undefined}>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`ldr-pos${pos === 1 ? ' ldr-pos-1' : pos === 2 ? ' ldr-pos-2' : pos === 3 ? ' ldr-pos-3' : inFinals ? ' ldr-pos-finals' : ' ldr-pos-out'}`}>
                          {pos}
                        </span>
                      </td>
                      <td>
                        <Link to={`/leagues/${leagueId}/team/${s.team_id}`} className="ldr-name">{s.name}</Link>
                      </td>
                      <td style={{ textAlign: 'center' }}>{s.wins + s.losses + s.draws}</td>
                      <td style={{ textAlign: 'center', ...(s.wins > 0 ? { color: '#3fb950', fontWeight: 600 } : {}) }}>{s.wins}</td>
                      <td style={{ textAlign: 'center', ...(s.losses > 0 ? { color: '#f85149', fontWeight: 600 } : {}) }}>{s.losses}</td>
                      <td style={{ textAlign: 'center' }}>{s.draws}</td>
                      <td style={{ textAlign: 'center' }}><span className="ldr-pts">{s.points}</span></td>
                      <td style={{ textAlign: 'right' }}>{s.for > 0 ? Math.round(s.for).toLocaleString() : '–'}</td>
                      <td style={{ textAlign: 'right' }}>{s.against > 0 ? Math.round(s.against).toLocaleString() : '–'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="ldr-pct" style={s.pct >= 110 ? { color: '#3fb950' } : s.pct > 0 && s.pct < 90 ? { color: '#f85149' } : undefined}>
                          {s.pct > 0 ? `${s.pct.toFixed(1)}%` : '–'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="ldr-footer">
              <span>{finalsTeams > 0 ? `Top ${finalsTeams} qualify for finals` : ''}</span>
              <span className="scoring-tag">SuperCoach</span>
            </div>
          </div>
        </div>
      )}

      {/* POWER RANKINGS VIEW */}
      {view === 'rankings' && (
        <div className="ldr-wrap" style={{ textAlign: 'center', padding: '48px 20px', color: '#484f58' }}>
          <i className="bi bi-graph-up-arrow" style={{ fontSize: '2rem', display: 'block', marginBottom: 12, color: '#30363d' }}></i>
          <p style={{ fontSize: '.85rem' }}>Power rankings will appear after the first round is finalised.</p>
        </div>
      )}
    </div>
  )
}
