import { useParams, Link } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface AflPlayer {
  name: string; position: string; jumper: number | null
  sc_score: number; kicks: number; handballs: number; disposals: number
  marks: number; tackles: number; goals: number; behinds: number; hitouts: number
  is_live: boolean
}

interface AflGameData {
  game: { home_team: string; away_team: string; status: string; home_score: number | null; away_score: number | null }
  home: AflPlayer[]; away: AflPlayer[]
  team_logos: Record<string, string>
}

export function AflGamePage() {
  const { leagueId, gameId } = useParams()
  const { data, loading } = useFetch<AflGameData>(`/leagues/${leagueId}/gameday/api/afl-game/${gameId}`)
  const [showTeam, setShowTeam] = useState<'home' | 'away'>('home')
  const [sortCol, setSortCol] = useState('sc')
  const [sortDir, setSortDir] = useState(-1)

  if (loading) return <Spinner />
  if (!data) return <p className="text-danger">Failed to load game</p>

  const g = data.game
  const players = showTeam === 'home' ? data.home : data.away
  const sorted = [...players].sort((a, b) => {
    const key = sortCol === 'sc' ? 'sc_score' : sortCol
    const av = Number((a as unknown as Record<string, unknown>)[key] ?? 0)
    const bv = Number((b as unknown as Record<string, unknown>)[key] ?? 0)
    return sortDir === -1 ? bv - av : av - bv
  })

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d * -1)
    else { setSortCol(col); setSortDir(-1) }
  }

  return (
    <div>
      <style>{`
        .ag-wrap { max-width: 1100px; margin: 0 auto; padding: .5rem; }
        .ag-back { color: #ececf6; font-size: .8125rem; text-decoration: none; display: inline-block; margin-bottom: .5rem; }
        .ag-back:hover { text-decoration: underline; }
        .ag-hero { display: flex; align-items: center; justify-content: space-between; background: var(--kl-bg-card); border: 1px solid #2a292f; border-radius: 10px; padding: 12px 16px; margin-bottom: .75rem; }
        .ag-hero-team { text-align: center; flex: 1; }
        .ag-hero-logo { width: 36px; height: 36px; margin-bottom: 4px; }
        .ag-hero-name { font-size: .8125rem; font-weight: 700; color: #ebebee; }
        .ag-hero-score { font-size: 1.8rem; font-weight: 800; color: #ebebee; }
        .ag-hero-center { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .ag-hero-vs { color: var(--kl-text-primary); font-size: .8125rem; }
        .ag-badge { font-size: .8125rem; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
        .ag-badge-live { background: rgba(86,211,100,.15); color: #56d364; border: 1px solid rgba(86,211,100,.3); }
        .ag-badge-ft { background: rgba(226,224,235,.15); color: #a855f7; }
        .ag-badge-sched { background: rgba(99,97,109,.3); color: var(--kl-text-primary); }
        .ag-toggle { display: flex; margin-bottom: .5rem; border-radius: 8px; overflow: hidden; border: 1px solid #2a292f; }
        .ag-toggle-btn { flex: 1; padding: 8px; text-align: center; font-size: .8125rem; font-weight: 600; background: transparent; color: var(--kl-text-primary); border: none; cursor: pointer; transition: all .15s; }
        .ag-toggle-btn.active { background: #1e1d21; color: #ebebee; }
        .ag-toggle-btn:hover:not(.active) { color: var(--kl-text-primary); }
        .ag-table { width: 100%; border-collapse: collapse; font-size: .8125rem; }
        .ag-table th { text-align: center; padding: 8px 6px; color: var(--kl-text-primary); font-weight: 600; border-bottom: 1px solid #2a292f; white-space: nowrap; background: #0e0d0f; }
        .ag-sortable { cursor: pointer; user-select: none; }
        .ag-sortable:hover { color: #ececf6 !important; }
        .ag-table td { text-align: center; padding: 6px 5px; border-bottom: 1px solid #151518; color: var(--kl-text-primary); white-space: nowrap; }
        .ag-table th:first-child, .ag-table td:first-child { text-align: left; padding-left: 10px; }
        .ag-player-name { font-weight: 600; color: #ebebee; }
        .ag-jumper { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 20px; font-size: .8125rem; font-weight: 700; color: var(--kl-text-primary); background: #1e1d21; border: 1px solid #2a292f; border-radius: 4px; margin-right: 6px; vertical-align: middle; }
        .ag-pos { font-size: .8125rem; font-weight: 700; padding: 2px 6px; border-radius: 3px; display: inline-block; min-width: 30px; text-align: center; }
        .ag-pos-fwd { background: rgba(222,220,233,.15); color: #dedce9; }
        .ag-pos-mid { background: rgba(251,191,36,.15); color: #fbbf24; }
        .ag-pos-def { background: rgba(52,211,153,.15); color: #34d399; }
        .ag-pos-ruc { background: rgba(244,114,182,.15); color: #f472b6; }
        .ag-sc { font-weight: 700; color: #ebebee; font-size: .8125rem; }
        .ag-sc-live { color: #56d364; }
        .ag-live-dot { font-size: .8125rem; color: #56d364; margin-left: 2px; animation: agPulse 2s infinite; }
        @keyframes agPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        .ag-table-wrap { border: 1px solid #2a292f; border-radius: 8px; overflow: hidden; }
        @media (max-width: 767.98px) { .ag-wrap { padding: .25rem; } .ag-hero-score { font-size: 1.4rem; } .ag-hero-logo { width: 28px; height: 28px; } .ag-table { font-size: .8125rem; } .ag-table td, .ag-table th { padding: 5px 3px; } .ag-pos { font-size: .8125rem; padding: 1px 4px; min-width: 24px; } }
      `}</style>

      <div className="ag-wrap">
        <Link to={`/leagues/${leagueId}/afl-live`} className="ag-back"><i className="bi bi-arrow-left me-1"></i>All Games</Link>

        <div className="ag-hero">
          <div className="ag-hero-team">
            {data.team_logos?.[g.home_team] && <img src={data.team_logos[g.home_team]} className="ag-hero-logo" alt="" />}
            <div className="ag-hero-name">{g.home_team}</div>
            {g.home_score != null && <div className="ag-hero-score">{g.home_score}</div>}
          </div>
          <div className="ag-hero-center">
            {g.status === 'live' && <span className="ag-badge ag-badge-live"><i className="bi bi-broadcast me-1"></i>LIVE</span>}
            {g.status === 'complete' && <span className="ag-badge ag-badge-ft">FINAL</span>}
            {g.status !== 'live' && g.status !== 'complete' && <span className="ag-badge ag-badge-sched">UPCOMING</span>}
            <span className="ag-hero-vs">v</span>
          </div>
          <div className="ag-hero-team">
            {data.team_logos?.[g.away_team] && <img src={data.team_logos[g.away_team]} className="ag-hero-logo" alt="" />}
            <div className="ag-hero-name">{g.away_team}</div>
            {g.away_score != null && <div className="ag-hero-score">{g.away_score}</div>}
          </div>
        </div>

        <div className="ag-toggle">
          <button className={`ag-toggle-btn${showTeam === 'home' ? ' active' : ''}`} onClick={() => setShowTeam('home')}>
            {data.team_logos?.[g.home_team] && <img src={data.team_logos[g.home_team]} style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 4 }} alt="" />}
            {g.home_team}
          </button>
          <button className={`ag-toggle-btn${showTeam === 'away' ? ' active' : ''}`} onClick={() => setShowTeam('away')}>
            {data.team_logos?.[g.away_team] && <img src={data.team_logos[g.away_team]} style={{ width: 16, height: 16, verticalAlign: 'middle', marginRight: 4 }} alt="" />}
            {g.away_team}
          </button>
        </div>

        <div className="ag-table-wrap">
          <table className="ag-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th className="ag-sortable" onClick={() => toggleSort('sc')} style={sortCol === 'sc' ? { color: '#ececf6' } : undefined}>SC</th>
                <th className="ag-sortable" onClick={() => toggleSort('kicks')} style={sortCol === 'kicks' ? { color: '#ececf6' } : undefined}>K</th>
                <th className="ag-sortable" onClick={() => toggleSort('handballs')} style={sortCol === 'handballs' ? { color: '#ececf6' } : undefined}>HB</th>
                <th className="ag-sortable" onClick={() => toggleSort('disposals')} style={sortCol === 'disposals' ? { color: '#ececf6' } : undefined}>D</th>
                <th className="ag-sortable" onClick={() => toggleSort('marks')} style={sortCol === 'marks' ? { color: '#ececf6' } : undefined}>M</th>
                <th className="ag-sortable" onClick={() => toggleSort('tackles')} style={sortCol === 'tackles' ? { color: '#ececf6' } : undefined}>T</th>
                <th className="ag-sortable" onClick={() => toggleSort('goals')} style={sortCol === 'goals' ? { color: '#ececf6' } : undefined}>G</th>
                <th className="ag-sortable" onClick={() => toggleSort('behinds')} style={sortCol === 'behinds' ? { color: '#ececf6' } : undefined}>B</th>
                <th className="ag-sortable" onClick={() => toggleSort('hitouts')} style={sortCol === 'hitouts' ? { color: '#ececf6' } : undefined}>HO</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={11} style={{ color: 'var(--kl-text-primary)', textAlign: 'center', padding: '1rem' }}>No scores yet</td></tr>
              )}
              {sorted.map((p, i) => {
                const posKey = (p.position || '').split('/')[0].substring(0, 3).toUpperCase()
                const posCls = posKey === 'FWD' ? 'fwd' : posKey === 'MID' ? 'mid' : posKey === 'DEF' ? 'def' : posKey === 'RUC' ? 'ruc' : ''
                return (
                  <tr key={i}>
                    <td>{p.jumper && <span className="ag-jumper">{p.jumper}</span>}<span className="ag-player-name">{p.name}</span></td>
                    <td><span className={`ag-pos${posCls ? ` ag-pos-${posCls}` : ''}`}>{posKey}</span></td>
                    <td className={`ag-sc${p.is_live ? ' ag-sc-live' : ''}`}>{p.sc_score}{p.is_live && <i className="bi bi-circle-fill ag-live-dot"></i>}</td>
                    <td>{p.kicks}</td>
                    <td>{p.handballs}</td>
                    <td>{p.disposals}</td>
                    <td>{p.marks}</td>
                    <td>{p.tackles}</td>
                    <td>{p.goals}</td>
                    <td>{p.behinds}</td>
                    <td>{p.hitouts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
