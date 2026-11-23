import { useEffect, useState } from 'react'
import { useTeamAccent } from './ui/TeamBadge'

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
  const accentOf = useTeamAccent()

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
  // Each side in its own team colour.
  const cols = [accentOf(data.home_team.id).hex, accentOf(data.away_team.id).hex]

  return (
    <div style={{
      background: 'linear-gradient(135deg, #151518, #0e0d0f)',
      border: '1px solid #1e1d21',
      borderRadius: 12,
      padding: 16,
      marginTop: 16,
    }}>
      <style>{`
        .wp-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .wp-title { font-size:.8125rem; color:var(--kl-text-primary); text-transform:uppercase; letter-spacing:.5px; font-weight:700; margin:0; }
        .wp-meta { font-size:.8125rem; color:var(--kl-text-primary); }
        .wp-bar-container { position:relative; height:40px; border-radius:6px; overflow:hidden; background:#1e1d21; }
        .wp-bar-home { position:absolute; top:0; bottom:0; left:0; background:linear-gradient(90deg,#3fb950,#238636); transition:width .6s cubic-bezier(.2,.8,.2,1); }
        .wp-bar-away { position:absolute; top:0; bottom:0; right:0; background:linear-gradient(90deg,#514e5f,#514e5f); transition:width .6s cubic-bezier(.2,.8,.2,1); }
        .wp-label { position:absolute; top:50%; transform:translateY(-50%); font-size:.875rem; font-weight:700; color:#fff; background:#050506; padding:2px 7px; border-radius:4px; }
        .wp-footer { display:flex; justify-content:space-between; margin-top:8px; font-size:.8125rem; color:var(--kl-text-primary); }
        .wp-range { display:flex; justify-content:space-between; margin-top:10px; padding-top:10px; border-top:1px solid rgba(160,160,172,.1); gap:20px; }
        .wp-side { flex:1; min-width:0; }
        .wp-side-name { font-size:.8125rem; font-weight:700; color:var(--kl-text-primary); }
        .wp-side-score { font-size:.8125rem; color:var(--kl-text-primary); margin-top:2px; }
        .wp-dist-bar { position:relative; height:6px; background:#1e1d21; border-radius:3px; margin-top:6px; }
        .wp-dist-fill { position:absolute; height:100%; border-radius:3px; }
      `}</style>
      <div className="wp-hdr">
        <p className="wp-title"><i className="bi bi-graph-up-arrow me-1"></i>Win Probability</p>
        <span className="wp-meta">{data.simulations.toLocaleString()} sims</span>
      </div>

      <div className="wp-bar-container" title={`${data.home_team.name} ${homeWin}%, ${data.away_team.name} ${awayWin}%`}>
        <div className="wp-bar-home" style={{ width: `${homeWin}%`, background: cols[0] }} />
        <div className="wp-bar-away" style={{ width: `${awayWin}%`, background: cols[1] }} />
        <span className="wp-label" style={{ left: 12 }}>{homeWin.toFixed(0)}%</span>
        <span className="wp-label" style={{ right: 12 }}>{awayWin.toFixed(0)}%</span>
      </div>

      <div className="wp-footer">
        <span style={{ fontWeight: 600 }}>{data.home_team.name}</span>
        <span style={{ color: 'var(--kl-text-primary)', fontWeight: 600 }}>{data.away_team.name}</span>
      </div>

      <div className="wp-range">
        {[data.home_team, data.away_team].map((t, i) => {
          const col = cols[i]
          const fullRange = Math.max(t.p90, 1)
          return (
            <div key={t.id} className="wp-side">
              <div className="wp-side-name">{t.name}</div>
              <div className="wp-side-score">
                Now <b style={{ color: 'var(--kl-text-primary)' }}>{t.current_score}</b>, Proj mid <b style={{ color: 'var(--kl-text-primary)' }}>{t.p50}</b>
              </div>
              <div className="wp-side-score" style={{ fontSize: '.8125rem' }}>
                Range: {t.p10} – {t.p90}, {t.remaining_players} left
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
