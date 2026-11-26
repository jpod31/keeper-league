import { clubVars, ratingTier } from '../../lib/clubs'
import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart,
} from 'recharts'
import { PlayerNotes } from '../ui/PlayerNotes'
import { Link } from 'react-router'
import { useState } from 'react'

interface PlayerDetail {
  id: number; name: string; position: string; afl_team: string
  age: number; height_cm: number; career_games: number
  sc_avg: number; sc_avg_prev: number; rating: number; potential: number
  injury_type: string | null; injury_severity: string | null; injury_return: string | null
  round_scores: { round: number; sc: number }[]
  last_game: Record<string, number> | null
  season_avg: Record<string, number> | null
  season_games: number
  /** The season the averages, chart and last-3/last-5 come from. */
  stats_year?: number
  stats_are_last_season?: boolean
  position_expected?: boolean
  is_new?: boolean
  is_former?: boolean
  left_afl_year?: number | null
  photo_url?: string | null
}

interface Props {
  player: PlayerDetail
  teamLogos: Record<string, string>
  onClose: () => void
  leagueId?: string
}

// Six season averages, picked for his kind of player: a ruck's hitouts, a
// midfielder's clearances, a forward's goals.
function avgKeys(p: PlayerDetail): [string, string][] {
  const pos = (p.position || 'MID').split('/')
  const out: [string, string][] = [['disposals', 'Disposals'], ['marks', 'Marks'], ['tackles', 'Tackles']]
  if (pos.includes('RUC')) out.push(['hitouts', 'Hitouts'])
  if (pos.includes('MID') || pos.includes('RUC')) out.push(['clearances', 'Clearances'])
  if (pos.includes('FWD')) out.push(['goals', 'Goals'])
  if (pos.includes('DEF')) out.push(['rebounds', 'Rebound 50s'])
  const have = (k: string) => p.season_avg?.[k] != null
  const picked = out.filter(([k]) => have(k))
  for (const k of [['contested_possessions', 'Contested'], ['kicks', 'Kicks'], ['handballs', 'Handballs'], ['goals', 'Goals'],
    ['inside_fifties', 'Inside 50s'], ['hitouts', 'Hitouts'], ['behinds', 'Behinds']] as [string, string][]) {
    if (picked.length >= 6) break
    if (have(k[0]) && !picked.some(o => o[0] === k[0])) picked.push(k)
  }
  return picked.slice(0, 6)
}
const fmt1 = (v: number | undefined) => v == null ? '-' : Number.isInteger(v) ? String(v) : v.toFixed(1)

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const score = payload.find(p => p.name === 'sc')?.value ?? 0
  const ma = payload.find(p => p.name === 'ma')?.value ?? 0
  return (
    <div style={{ background: '#0e0d0f', border: '1px solid #2a292f', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
      <div style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f2f2f4' }}>{score}</div>
      {ma > 0 && <div style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)', marginTop: 2 }}>3-game avg: {ma}</div>}
    </div>
  )
}

export function PlayerModal({ player: p, teamLogos, onClose, leagueId: _leagueId }: Props) {
  const logoUrl = p.afl_team ? teamLogos[p.afl_team] : null
  const [photoBad, setPhotoBad] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)

  const scores = p.round_scores || []
  const vals = scores.map(s => s.sc)
  const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0

  // Chart data with 3-game moving average
  const chartData = scores.map((s, i) => {
    const window = vals.slice(Math.max(0, i - 2), i + 1)
    const ma = Math.round(window.reduce((a, b) => a + b, 0) / window.length * 10) / 10
    return { label: `R${s.round}`, sc: s.sc, ma }
  })

  const l3 = vals.length >= 3 ? Math.round(vals.slice(-3).reduce((a, b) => a + b, 0) / 3) : null
  const l5 = vals.length >= 5 ? Math.round(vals.slice(-5).reduce((a, b) => a + b, 0) / 5) : null

  // Every score here is from one season. Before the new one starts that is
  // last season, so each label names the year rather than saying "season".
  const yr = p.stats_year
  const yrLabel = yr ? String(yr) : 'Season'
  const prevLabel = yr ? String(yr - 1) : 'Prev yr'

  return (
    <>
      <div onClick={onClose} className="pmod-backdrop" />
      <div role="dialog" aria-modal="true" className="pmod-shell">
        {/* Header: the same club-coloured face as his card. */}
        <div className="pmod-face" style={{ ...clubVars(p.afl_team), ['--logo' as string]: logoUrl ? `url("${logoUrl}")` : 'none',
          ['--pc' as string]: `var(--pos-${(p.position || 'MID').split('/')[0].toLowerCase()})`, ['--pc2' as string]: `var(--pos-${((p.position || 'MID').split('/')[1] || (p.position || 'MID').split('/')[0]).toLowerCase()})` } as React.CSSProperties}>
          <button type="button" onClick={onClose} className="pmod-close" aria-label="Close"><i className="bi bi-x-lg"></i></button>
          {/* His photo on the left, standing on the numbers bar; positions,
              name and club to its right. */}
          <div className="pmod-upper">
            <div className="pmod-photo-box">
              {p.photo_url && !photoBad
                ? <img className="pmod-photo" src={p.photo_url} alt="" onError={() => setPhotoBad(true)} />
                : <svg className="pmod-photo pmod-sil" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="92" r="46" /><path d="M30 240c4-58 44-92 90-92s86 34 90 92z" /></svg>}
            </div>
            <div className="pmod-upper-text">
              <div className="pmod-face-top">
                {(p.position || 'MID').split('/').map(ps => (
                  <span key={ps} className={`pos-badge badge-${ps.toLowerCase()}${p.position_expected ? ' pos-expected' : ''}`}>{ps}</span>
                ))}
                {p.is_new && <span className="pl-mark pl-mark-new">NEW</span>}
                {p.is_former && <span className="pl-mark pl-mark-off">OFF AFL LIST</span>}
              </div>
              <div className="pmod-face-id">
                <div>
                  <div className="pmod-first">{p.name.split(' ')[0]}</div>
                  <div className="pmod-sur pmod-fit" style={{ ['--n' as string]: (p.name.split(' ').slice(1).join(' ') || p.name).length } as React.CSSProperties}>{p.name.split(' ').slice(1).join(' ') || p.name}</div>
                </div>
              </div>
              <div className="pmod-face-meta">
                <span className="pmod-club">{logoUrl && <img className="pmod-crest" src={logoUrl} alt="" />}{p.afl_team}</span>
                <span>Age {p.age}</span>
                <span>{p.career_games || 0} games</span>
              </div>
            </div>
          </div>
          <div className="pmod-nums">
            <div className="pmod-num"><b>{p.sc_avg ? Math.round(p.sc_avg) : '-'}</b><span>{yrLabel} avg</span></div>
            <div className="pmod-num"><b>{p.sc_avg_prev ? Math.round(p.sc_avg_prev) : '-'}</b><span>{prevLabel} avg</span></div>
            <div className="pmod-num"><b><span className={`rt ${ratingTier(p.rating)}`}>{p.rating ?? '-'}</span></b><span>Rating</span></div>
            <div className="pmod-num"><b><span className={`rt rt-line ${ratingTier(p.potential)}`}>{p.potential ?? '-'}</span></b><span>Potential</span></div>
          </div>
        </div>

        {/* One screen, no scrolling: a flag line if he has one, his form,
            six season averages, notes on demand, and the way to the full
            page. Lucas, 2026-11-26: "dont want the right side pane
            scrollable ... i hate all those shitty boxes". */}
        <div className="pmod-body">
          {(p.position_expected || p.is_former || p.injury_severity) && (
            <div className="pmod-flags">
              {p.injury_severity && <span className="pmod-flag pmod-flag-off">{p.injury_type || 'Injured'}, {p.injury_return || 'TBC'}</span>}
              {p.is_former && <span className="pmod-flag pmod-flag-off">Off AFL lists{p.left_afl_year ? ` since ${p.left_afl_year + 1}` : ''}. He will not score.</span>}
              {p.position_expected && <span className="pmod-flag">Expected position, no SuperCoach position yet.</span>}
            </div>
          )}

          {notesOpen ? (
            <div className="pmod-notes">
              <button type="button" className="pmod-textbtn" onClick={() => setNotesOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>Back to his form
              </button>
              <PlayerNotes playerId={p.id} />
            </div>
          ) : (
            <>
              <section className="pmod-sec pmod-form">
                <header className="pmod-sec-h">
                  <h3>{yrLabel} form</h3>
                  {vals.length > 0 && (
                    <div className="pmod-figs">
                      <span><b>{Math.round(avg)}</b>avg</span>
                      {l3 != null && <span><b className={l3 >= avg ? 'up' : 'down'}>{l3}</b>last 3</span>}
                      {l5 != null && <span><b className={l5 >= avg ? 'up' : 'down'}>{l5}</b>last 5</span>}
                    </div>
                  )}
                </header>
                {chartData.length > 0 ? (
                  <div className="pmod-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 6, right: 2, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                        <XAxis dataKey="label" stroke="#ececf1" tick={{ fill: '#ececf1', fontSize: 13 }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
                        <YAxis stroke="#ececf1" tick={{ fill: '#ececf1', fontSize: 13 }} tickLine={false} axisLine={false} width={34}
                          domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.8)), 'auto']} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(236,236,246,.04)' }} />
                        <Bar isAnimationActive={false} dataKey="sc" fill="var(--pmod-bar)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                        <Line isAnimationActive={false} type="monotone" dataKey="ma" stroke="#ffffff" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="pmod-none">No games yet.</p>}
              </section>

              {p.season_avg && (
                <section className="pmod-sec">
                  <header className="pmod-sec-h"><h3>{yrLabel} averages</h3><span className="pmod-sub">{p.season_games} games</span></header>
                  <div className="pmod-avgs">
                    {avgKeys(p).map(([key, label]) => (
                      <div key={key}><b>{fmt1(p.season_avg?.[key])}</b><span>{label}</span></div>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <div className="pmod-foot">
            {!notesOpen && (
              <button type="button" className="pmod-notesbtn" onClick={() => setNotesOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 2.5h7l3 3v8H3z M10 2.5v3h3 M5.5 8.5h5 M5.5 11h3.5" /></svg>
                My notes
              </button>
            )}
            {_leagueId && (
              <Link to={`/leagues/${_leagueId}/player/${p.id}`} className="pmod-more">
                More details
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
