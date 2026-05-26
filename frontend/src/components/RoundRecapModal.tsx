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

  const outcome = recap.result?.outcome
  const outcomeTone = outcome === 'win' ? 'win' : outcome === 'loss' ? 'loss' : 'draw'
  const outcomeHeadline = recap.result
    ? (outcome === 'win'
        ? `WON BY ${recap.result.margin}`
        : outcome === 'loss'
          ? `LOST BY ${recap.result.margin}`
          : 'DRAW')
    : null

  return (
    <>
      <style>{`
        @keyframes klRecapIn { 0% { opacity: 0; transform: translateY(24px) scale(.96); } 100% { opacity: 1; transform: none; } }

        .kl-recap-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(5,9,18,.78);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .kl-recap-panel {
          position: relative;
          max-width: 540px;
          width: 100%;
          background: #0f1626;
          border: 1px solid rgba(110,130,180,.22);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,.7);
          animation: klRecapIn .5s cubic-bezier(.2,.8,.2,1);
        }
        /* Outcome-tinted top stripe */
        .kl-recap-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          z-index: 2;
        }
        .kl-recap-panel.win::before { background: linear-gradient(90deg, rgba(61,140,99,0), rgba(109,179,138,.9), rgba(61,140,99,0)); }
        .kl-recap-panel.loss::before { background: linear-gradient(90deg, rgba(184,90,74,0), rgba(224,122,108,.9), rgba(184,90,74,0)); }
        .kl-recap-panel.draw::before { background: linear-gradient(90deg, rgba(194,147,47,0), rgba(240,210,122,.9), rgba(194,147,47,0)); }

        .kl-recap-header {
          position: relative;
          padding: 22px 26px 18px;
          border-bottom: 1px solid rgba(110,130,180,.1);
        }
        .kl-recap-round-lbl {
          font-size: .58rem;
          color: #6c7892;
          text-transform: uppercase;
          letter-spacing: .22em;
          font-weight: 800;
        }
        .kl-recap-title {
          font-size: 1.5rem;
          font-weight: 800;
          color: #f5f8ff;
          margin: 4px 0 0;
          letter-spacing: -.015em;
          line-height: 1.15;
        }

        /* Headline outcome strip */
        .kl-recap-headline {
          padding: 18px 26px 16px;
          text-align: center;
          border-bottom: 1px solid rgba(110,130,180,.08);
        }
        .kl-recap-outcome {
          display: inline-block;
          font-size: 1.7rem;
          font-weight: 900;
          letter-spacing: .04em;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "zero" 0;
        }
        .kl-recap-outcome.win { color: #7dc99a; text-shadow: 0 0 24px rgba(61,140,99,.45); }
        .kl-recap-outcome.loss { color: #e07a6c; text-shadow: 0 0 24px rgba(184,90,74,.45); }
        .kl-recap-outcome.draw { color: #f0d27a; text-shadow: 0 0 24px rgba(194,147,47,.45); }
        .kl-recap-score {
          margin-top: 8px;
          font-size: .82rem;
          color: #97a3ba;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "zero" 0;
        }
        .kl-recap-score b { color: #dde4f1; font-weight: 700; }

        /* MVP hero card */
        .kl-recap-mvp {
          margin: 18px 22px 14px;
          padding: 16px 18px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(194,147,47,.18), rgba(194,147,47,.04));
          border: 1px solid rgba(194,147,47,.4);
          box-shadow: 0 0 28px -8px rgba(194,147,47,.35);
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .kl-recap-mvp-icon {
          width: 52px; height: 52px;
          border-radius: 12px;
          background: rgba(194,147,47,.22);
          border: 1px solid rgba(240,210,122,.48);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem;
          color: #f0d27a;
          flex-shrink: 0;
        }
        .kl-recap-mvp-body { flex: 1; min-width: 0; }
        .kl-recap-mvp-label {
          font-size: .54rem;
          color: #c2932f;
          text-transform: uppercase;
          letter-spacing: .18em;
          font-weight: 800;
        }
        .kl-recap-mvp-name {
          font-size: 1.1rem;
          font-weight: 800;
          color: #f5f8ff;
          margin-top: 4px;
          letter-spacing: -.005em;
          line-height: 1.15;
        }
        .kl-recap-mvp-sub {
          font-size: .72rem;
          color: #97a3ba;
          margin-top: 2px;
        }
        .kl-recap-mvp-cap {
          font-size: .54rem;
          padding: 1px 6px;
          margin-left: 8px;
          background: rgba(194,147,47,.24);
          color: #f0d27a;
          border: 1px solid rgba(194,147,47,.45);
          border-radius: 3px;
          font-weight: 800;
          letter-spacing: .08em;
          vertical-align: middle;
        }
        .kl-recap-mvp-score {
          font-size: 2.2rem;
          font-weight: 900;
          color: #f0d27a;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "zero" 0;
          letter-spacing: -.03em;
          line-height: 1;
          text-shadow: 0 0 20px rgba(194,147,47,.4);
          flex-shrink: 0;
        }

        /* Secondary rows */
        .kl-recap-rows {
          padding: 4px 22px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .kl-recap-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 12px;
          border-radius: 8px;
          background: rgba(20,28,45,.5);
          border: 1px solid rgba(110,130,180,.12);
        }
        .kl-recap-row-icon {
          width: 30px; height: 30px;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          font-size: .85rem;
          flex-shrink: 0;
        }
        .kl-recap-row-icon.bust { background: rgba(184,90,74,.14); color: #e07a6c; border: 1px solid rgba(184,90,74,.32); }
        .kl-recap-row-icon.top { background: rgba(58,125,196,.14); color: #82b3e4; border: 1px solid rgba(58,125,196,.32); }
        .kl-recap-row-icon.blowout { background: rgba(138,109,184,.14); color: #b39ed4; border: 1px solid rgba(138,109,184,.32); }
        .kl-recap-row-body { flex: 1; min-width: 0; }
        .kl-recap-row-label {
          font-size: .54rem;
          color: #6c7892;
          text-transform: uppercase;
          letter-spacing: .14em;
          font-weight: 800;
        }
        .kl-recap-row-value {
          font-size: .82rem;
          color: #dde4f1;
          font-weight: 600;
          margin-top: 2px;
          line-height: 1.25;
          word-break: break-word;
        }
        .kl-recap-row-sub {
          font-size: .66rem;
          color: #6c7892;
          margin-top: 1px;
        }
        .kl-recap-row-chip {
          font-size: .82rem;
          font-weight: 800;
          color: #f0f4fc;
          font-variant-numeric: tabular-nums;
          font-feature-settings: "tnum" 1, "zero" 0;
          padding: 4px 10px;
          border-radius: 5px;
          background: rgba(110,130,180,.14);
          border: 1px solid rgba(110,130,180,.2);
          margin-left: 8px;
          flex-shrink: 0;
        }
        .kl-recap-row-chip.bust { color: #e07a6c; background: rgba(184,90,74,.14); border-color: rgba(184,90,74,.3); }
        .kl-recap-row-chip.top { color: #82b3e4; background: rgba(58,125,196,.14); border-color: rgba(58,125,196,.3); }
        .kl-recap-row-chip.blowout { color: #b39ed4; background: rgba(138,109,184,.14); border-color: rgba(138,109,184,.3); }

        /* Footer */
        .kl-recap-footer {
          padding: 12px 22px 18px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          border-top: 1px solid rgba(110,130,180,.08);
        }
        .kl-recap-btn {
          padding: 7px 18px;
          border-radius: 8px;
          border: 1px solid rgba(110,130,180,.22);
          background: rgba(20,28,45,.5);
          color: #b6c0d3;
          font-size: .76rem;
          font-weight: 700;
          letter-spacing: .04em;
          cursor: pointer;
          transition: background .15s, color .15s, border-color .15s;
        }
        .kl-recap-btn:hover { background: rgba(28,38,58,.85); color: #f0f4fc; border-color: rgba(110,130,180,.32); }
        .kl-recap-btn.primary {
          background: rgba(58,125,196,.18);
          color: #a8c8ed;
          border-color: rgba(58,125,196,.45);
        }
        .kl-recap-btn.primary:hover { background: rgba(58,125,196,.3); color: #fff; border-color: rgba(58,125,196,.6); }

        @media (max-width: 600px) {
          .kl-recap-panel { border-radius: 14px; }
          .kl-recap-header { padding: 18px 18px 14px; }
          .kl-recap-title { font-size: 1.25rem; }
          .kl-recap-headline { padding: 14px 18px 12px; }
          .kl-recap-outcome { font-size: 1.45rem; }
          .kl-recap-mvp { margin: 14px 14px 10px; padding: 14px; gap: 10px; }
          .kl-recap-mvp-icon { width: 44px; height: 44px; font-size: 1.1rem; }
          .kl-recap-mvp-name { font-size: 1rem; }
          .kl-recap-mvp-score { font-size: 1.8rem; }
          .kl-recap-rows { padding: 4px 14px 14px; }
          .kl-recap-row { padding: 8px 10px; gap: 10px; }
          .kl-recap-footer { padding: 12px 16px 16px; }
        }
      `}</style>

      <div className="kl-recap-overlay" onClick={dismiss}>
        <div className={`kl-recap-panel ${outcomeTone}`} onClick={e => e.stopPropagation()}>
          <div className="kl-recap-header">
            <div className="kl-recap-round-lbl">Round {recap.recap_round} · Recap</div>
            <h2 className="kl-recap-title">{recap.team_name}</h2>
          </div>

          {recap.result && (
            <div className="kl-recap-headline">
              <span className={`kl-recap-outcome ${outcomeTone}`}>{outcomeHeadline}</span>
              <div className="kl-recap-score">
                <b>{recap.result.my_score}</b> – <b>{recap.result.opp_score}</b> · vs {recap.result.opp_name}
              </div>
            </div>
          )}

          {recap.mvp && (
            <div className="kl-recap-mvp">
              <div className="kl-recap-mvp-icon">
                <i className="bi bi-star-fill"></i>
              </div>
              <div className="kl-recap-mvp-body">
                <div className="kl-recap-mvp-label">Your MVP</div>
                <div className="kl-recap-mvp-name">
                  {recap.mvp.name}
                  {recap.mvp.is_captain && <span className="kl-recap-mvp-cap">C</span>}
                </div>
                <div className="kl-recap-mvp-sub">{recap.mvp.afl_team}</div>
              </div>
              <div className="kl-recap-mvp-score">{recap.mvp.score}</div>
            </div>
          )}

          {(recap.bust || recap.best_team || recap.biggest_margin) && (
            <div className="kl-recap-rows">
              {recap.bust && (
                <div className="kl-recap-row">
                  <div className="kl-recap-row-icon bust">
                    <i className="bi bi-emoji-dizzy"></i>
                  </div>
                  <div className="kl-recap-row-body">
                    <div className="kl-recap-row-label">Bust</div>
                    <div className="kl-recap-row-value">{recap.bust.name}</div>
                    <div className="kl-recap-row-sub">{recap.bust.afl_team}</div>
                  </div>
                  <span className="kl-recap-row-chip bust">{recap.bust.score}</span>
                </div>
              )}
              {recap.best_team && (
                <div className="kl-recap-row">
                  <div className="kl-recap-row-icon top">
                    <i className="bi bi-trophy"></i>
                  </div>
                  <div className="kl-recap-row-body">
                    <div className="kl-recap-row-label">League top score</div>
                    <div className="kl-recap-row-value">{recap.best_team.name}</div>
                  </div>
                  <span className="kl-recap-row-chip top">{recap.best_team.score}</span>
                </div>
              )}
              {recap.biggest_margin && (
                <div className="kl-recap-row">
                  <div className="kl-recap-row-icon blowout">
                    <i className="bi bi-arrows-expand"></i>
                  </div>
                  <div className="kl-recap-row-body">
                    <div className="kl-recap-row-label">Biggest blowout</div>
                    <div className="kl-recap-row-value">
                      {recap.biggest_margin.home} {recap.biggest_margin.home_score} – {recap.biggest_margin.away_score} {recap.biggest_margin.away}
                    </div>
                  </div>
                  <span className="kl-recap-row-chip blowout">+{recap.biggest_margin.margin}</span>
                </div>
              )}
            </div>
          )}

          <div className="kl-recap-footer">
            <button className="kl-recap-btn" onClick={dismiss}>Skip</button>
            <button className="kl-recap-btn primary" onClick={dismiss}>Got it</button>
          </div>
        </div>
      </div>
    </>
  )
}
