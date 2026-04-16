import { useEffect, useState } from 'react'
import { useLeague } from '../contexts/LeagueContext'

interface Recap {
  recap_round: number
  has_recap: boolean
  team_name: string
  result: { outcome: 'win' | 'loss' | 'draw'; my_score: number; opp_score: number; opp_name: string; margin: number } | null
  mvp: { name: string; afl_team: string; score: number; is_captain: boolean } | null
  bust: { name: string; afl_team: string; score: number } | null
  best_team: { name: string; score: number } | null
  biggest_margin: { home: string; away: string; home_score: number; away_score: number; margin: number } | null
}

/**
 * Round Recap modal — shown once per user per completed round on first visit
 * after the round finishes. Triggers based on localStorage key.
 */
export function RoundRecapModal() {
  const { league } = useLeague()
  const [recap, setRecap] = useState<Recap | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!league || !league.user_team) return
    const lid = league.id
    const tid = league.user_team.id
    fetch(`/api/leagues/${lid}/team/${tid}/round-recap`, { credentials: 'include' })
      .then(r => r.json())
      .then((d: Recap) => {
        if (!d.has_recap || d.recap_round < 1) return
        const key = `kl_recap_seen_${lid}_${tid}`
        const seen = parseInt(localStorage.getItem(key) || '0', 10)
        if (d.recap_round > seen) {
          setRecap(d)
          setVisible(true)
        }
      })
      .catch(() => {})
  }, [league])

  function dismiss() {
    if (recap && league && league.user_team) {
      const key = `kl_recap_seen_${league.id}_${league.user_team.id}`
      localStorage.setItem(key, String(recap.recap_round))
    }
    setVisible(false)
  }

  if (!visible || !recap) return null

  const outcomeColor = recap.result?.outcome === 'win' ? '#3fb950'
    : recap.result?.outcome === 'loss' ? '#f85149' : '#d29922'
  const outcomeIcon = recap.result?.outcome === 'win' ? 'bi-trophy-fill'
    : recap.result?.outcome === 'loss' ? 'bi-emoji-frown' : 'bi-dash-circle'

  return (
    <>
      <style>{`
        @keyframes klRecapIn { 0% { opacity:0; transform:translateY(24px) scale(.96); } 100% { opacity:1; transform:none; } }
        @keyframes klRecapGlowIn { 0% { opacity:0; } 100% { opacity:.5; } }
        .kl-recap-overlay { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.7); backdrop-filter:blur(6px); display:flex; align-items:center; justify-content:center; padding:20px; }
        .kl-recap-panel { position:relative; max-width:520px; width:100%; background:linear-gradient(160deg, #161b22, #0d1117); border:1px solid #30363d; border-radius:16px; padding:0; overflow:hidden; box-shadow:0 20px 80px rgba(0,0,0,.6); animation:klRecapIn .5s cubic-bezier(.2,.8,.2,1); }
        .kl-recap-glow { position:absolute; inset:0; pointer-events:none; background:radial-gradient(circle at 30% 20%, ${outcomeColor}33, transparent 60%); animation:klRecapGlowIn 1s ease-in forwards; }
        .kl-recap-header { position:relative; padding:24px 28px 16px; border-bottom:1px solid rgba(139,148,158,.08); }
        .kl-recap-round-lbl { font-size:.68rem; color:#6e7681; text-transform:uppercase; letter-spacing:2px; font-weight:700; }
        .kl-recap-title { font-size:1.6rem; font-weight:900; color:#e6edf3; margin:6px 0 0; letter-spacing:-.02em; }
        .kl-recap-body { padding:20px 28px; display:flex; flex-direction:column; gap:14px; }
        .kl-recap-row { display:flex; align-items:center; gap:12px; }
        .kl-recap-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0; }
        .kl-recap-row-label { font-size:.7rem; color:#6e7681; text-transform:uppercase; letter-spacing:.5px; margin-bottom:2px; }
        .kl-recap-row-value { font-size:.95rem; color:#e6edf3; font-weight:600; line-height:1.3; }
        .kl-recap-row-sub { font-size:.74rem; color:#8b949e; margin-top:1px; }
        .kl-recap-footer { padding:14px 28px 22px; display:flex; justify-content:flex-end; gap:10px; }
        .kl-recap-btn { padding:8px 20px; border-radius:8px; border:1px solid #30363d; background:transparent; color:#c9d1d9; font-size:.78rem; font-weight:600; cursor:pointer; transition:all .15s; }
        .kl-recap-btn:hover { background:#21262d; color:#fff; }
        .kl-recap-btn-primary { background:#58a6ff; color:#0d1117; border-color:#58a6ff; }
        .kl-recap-btn-primary:hover { background:#79b8ff; color:#0d1117; }
      `}</style>
      <div className="kl-recap-overlay" onClick={dismiss}>
        <div className="kl-recap-panel" onClick={e => e.stopPropagation()}>
          <div className="kl-recap-glow" />
          <div className="kl-recap-header">
            <div className="kl-recap-round-lbl">Round {recap.recap_round} Recap</div>
            <h2 className="kl-recap-title">{recap.team_name}</h2>
          </div>

          <div className="kl-recap-body">
            {recap.result && (
              <div className="kl-recap-row">
                <div className="kl-recap-icon" style={{ background: `${outcomeColor}22`, color: outcomeColor }}>
                  <i className={`bi ${outcomeIcon}`}></i>
                </div>
                <div>
                  <div className="kl-recap-row-label">Result</div>
                  <div className="kl-recap-row-value" style={{ color: outcomeColor }}>
                    {recap.result.outcome.toUpperCase()} — {recap.result.my_score} to {recap.result.opp_score}
                  </div>
                  <div className="kl-recap-row-sub">vs {recap.result.opp_name} · margin {recap.result.margin}</div>
                </div>
              </div>
            )}

            {recap.mvp && (
              <div className="kl-recap-row">
                <div className="kl-recap-icon" style={{ background: 'rgba(210,153,34,.15)', color: '#d29922' }}>
                  <i className="bi bi-star-fill"></i>
                </div>
                <div>
                  <div className="kl-recap-row-label">MVP</div>
                  <div className="kl-recap-row-value">
                    {recap.mvp.name} <span style={{ color: '#d29922' }}>{recap.mvp.score}</span>
                    {recap.mvp.is_captain && <span style={{ fontSize: '.6rem', marginLeft: 6, color: '#d29922', fontWeight: 800 }}>(C)</span>}
                  </div>
                  <div className="kl-recap-row-sub">{recap.mvp.afl_team}</div>
                </div>
              </div>
            )}

            {recap.bust && (
              <div className="kl-recap-row">
                <div className="kl-recap-icon" style={{ background: 'rgba(248,81,73,.12)', color: '#f85149' }}>
                  <i className="bi bi-emoji-dizzy"></i>
                </div>
                <div>
                  <div className="kl-recap-row-label">Bust</div>
                  <div className="kl-recap-row-value">
                    {recap.bust.name} <span style={{ color: '#f85149' }}>{recap.bust.score}</span>
                  </div>
                  <div className="kl-recap-row-sub">{recap.bust.afl_team}</div>
                </div>
              </div>
            )}

            {recap.best_team && (
              <div className="kl-recap-row">
                <div className="kl-recap-icon" style={{ background: 'rgba(88,166,255,.15)', color: '#58a6ff' }}>
                  <i className="bi bi-trophy"></i>
                </div>
                <div>
                  <div className="kl-recap-row-label">League top score</div>
                  <div className="kl-recap-row-value">
                    {recap.best_team.name} <span style={{ color: '#58a6ff' }}>{recap.best_team.score}</span>
                  </div>
                </div>
              </div>
            )}

            {recap.biggest_margin && (
              <div className="kl-recap-row">
                <div className="kl-recap-icon" style={{ background: 'rgba(188,140,255,.15)', color: '#bc8cff' }}>
                  <i className="bi bi-arrows-expand"></i>
                </div>
                <div>
                  <div className="kl-recap-row-label">Biggest blowout</div>
                  <div className="kl-recap-row-value">
                    {recap.biggest_margin.home} {recap.biggest_margin.home_score} — {recap.biggest_margin.away_score} {recap.biggest_margin.away}
                  </div>
                  <div className="kl-recap-row-sub">margin {recap.biggest_margin.margin}</div>
                </div>
              </div>
            )}
          </div>

          <div className="kl-recap-footer">
            <button className="kl-recap-btn" onClick={dismiss}>Skip</button>
            <button className="kl-recap-btn kl-recap-btn-primary" onClick={dismiss}>Got it</button>
          </div>
        </div>
      </div>
    </>
  )
}
