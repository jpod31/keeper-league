import { useEffect, useState } from 'react'

interface WinProb {
  fixture_id: number
  afl_round: number
  home_team: { id: number; name: string; current_score: number; projected_mean: number; remaining_players: number; p10: number; p50: number; p90: number }
  away_team: { id: number; name: string; current_score: number; projected_mean: number; remaining_players: number; p10: number; p50: number; p90: number }
  home_win_pct: number
  away_win_pct: number
  tie_pct: number
  simulations: number
}

interface Props {
  leagueId: string | number
  fixtureId: string | number
  /** Auto-refresh interval in ms (default 45s during live scoring). 0 disables. */
  refreshMs?: number
}

/**
 * Monte Carlo win-probability gauge for a matchup. Gives p(win) for each
 * side with a projected score range band. Auto-refreshes during live rounds.
 */
export function WinProbabilityGauge({ leagueId, fixtureId, refreshMs = 45000 }: Props) {
  const [data, setData] = useState<WinProb | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    function load() {
      fetch(`/api/leagues/${leagueId}/matchup/${fixtureId}/win-probability`, { credentials: 'include' })
        .then(r => r.json()).then(d => { if (active) { setData(d); setLoading(false) } })
        .catch(() => { if (active) setLoading(false) })
    }
    load()
    let id: number | undefined
    if (refreshMs > 0) id = window.setInterval(load, refreshMs)
    return () => { active = false; if (id) window.clearInterval(id) }
  }, [leagueId, fixtureId, refreshMs])

  if (loading || !data) return null

  const homeWin = data.home_win_pct
  const awayWin = data.away_win_pct
  const leader = homeWin >= awayWin ? 'home' : 'away'

  return (
    <div style={{
      background: 'linear-gradient(135deg, #161b22, #0d1117)',
      border: '1px solid #21262d',
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    }}>
      <style>{`
        .wp-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .wp-title { font-size:.72rem; color:#8b949e; text-transform:uppercase; letter-spacing:.5px; font-weight:700; margin:0; }
        .wp-meta { font-size:.66rem; color:#6e7681; }
        .wp-bar-container { position:relative; height:40px; border-radius:10px; overflow:hidden; background:#21262d; }
        .wp-bar-home { position:absolute; top:0; bottom:0; left:0; background:linear-gradient(90deg,#3fb950,#238636); transition:width .6s cubic-bezier(.2,.8,.2,1); }
        .wp-bar-away { position:absolute; top:0; bottom:0; right:0; background:linear-gradient(90deg,#1f6feb,#1f6feb); transition:width .6s cubic-bezier(.2,.8,.2,1); }
        .wp-label { position:absolute; top:50%; transform:translateY(-50%); font-size:.78rem; font-weight:800; color:#fff; text-shadow:0 1px 3px rgba(0,0,0,.5); letter-spacing:.3px; }
        .wp-footer { display:flex; justify-content:space-between; margin-top:8px; font-size:.7rem; color:#8b949e; }
        .wp-range { display:flex; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid rgba(139,148,158,.1); gap:20px; }
        .wp-side { flex:1; min-width:0; }
        .wp-side-name { font-size:.72rem; font-weight:700; color:#c9d1d9; }
        .wp-side-score { font-size:.68rem; color:#6e7681; margin-top:2px; }
        .wp-dist-bar { position:relative; height:6px; background:#21262d; border-radius:3px; margin-top:6px; }
        .wp-dist-fill { position:absolute; height:100%; border-radius:3px; }
      `}</style>
      <div className="wp-hdr">
        <p className="wp-title"><i className="bi bi-graph-up-arrow me-1"></i>Win Probability</p>
        <span className="wp-meta">{data.simulations.toLocaleString()} sims</span>
      </div>

      <div className="wp-bar-container" title={`${data.home_team.name} ${homeWin}% · ${data.away_team.name} ${awayWin}%`}>
        <div className="wp-bar-home" style={{ width: `${homeWin}%` }} />
        <div className="wp-bar-away" style={{ width: `${awayWin}%` }} />
        <span className="wp-label" style={{ left: 12, opacity: leader === 'home' ? 1 : .8 }}>{homeWin.toFixed(0)}%</span>
        <span className="wp-label" style={{ right: 12, opacity: leader === 'away' ? 1 : .8 }}>{awayWin.toFixed(0)}%</span>
      </div>

      <div className="wp-footer">
        <span style={{ color: '#3fb950', fontWeight: 600 }}>{data.home_team.name}</span>
        <span style={{ color: '#1f6feb', fontWeight: 600 }}>{data.away_team.name}</span>
      </div>

      <div className="wp-range">
        {[data.home_team, data.away_team].map((t, i) => {
          const col = i === 0 ? '#3fb950' : '#1f6feb'
          const fullRange = Math.max(t.p90, 1)
          return (
            <div key={t.id} className="wp-side">
              <div className="wp-side-name" style={{ color: col }}>{t.name}</div>
              <div className="wp-side-score">
                Now <b style={{ color: '#c9d1d9' }}>{t.current_score}</b> · Proj mid <b style={{ color: '#c9d1d9' }}>{t.p50}</b>
              </div>
              <div className="wp-side-score" style={{ fontSize: '.62rem' }}>
                Range: {t.p10} – {t.p90} · {t.remaining_players} left
              </div>
              <div className="wp-dist-bar">
                <div className="wp-dist-fill" style={{
                  left: `${(t.p10 / fullRange) * 100}%`,
                  width: `${((t.p90 - t.p10) / fullRange) * 100}%`,
                  background: `${col}44`,
                }} />
                <div className="wp-dist-fill" style={{
                  left: `${(t.p50 / fullRange) * 100 - 0.5}%`,
                  width: '2px', background: col,
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
