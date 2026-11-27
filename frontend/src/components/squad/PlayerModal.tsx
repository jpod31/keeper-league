import { clubVars, ratingTier } from '../../lib/clubs'
import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart,
} from 'recharts'
import { PlayerNotes } from '../ui/PlayerNotes'
import { Link } from 'react-router'
import { useRef, useState } from 'react'
import { SeasonTable, type SeasonTableData } from './SeasonTable'
import { Emblem, EmblemStars, emblemLabel, emblemTitle, type Honours } from '../honours/Emblem'

interface PreAfl {
  description?: string
  verdict?: { label: string; tone: 'good' | 'warn' | 'slow'; reasons: string[]; chance?: { any: number; ten: number } | null }
  pick?: number | null
  pick_kind?: string | null
  season_table?: SeasonTableData | null
  facts?: string[]
  honours?: string | null
  honour_note?: string | null
  pathway?: string | null
  headline?: {
    league: string; season: number; team: string | null; games: number | null
    stats: { label: string; value: number }[]
    ranks: { label: string; value: number; pct: number; text: string; class_text?: string; best?: boolean }[]
    pool: string
    group?: string
    col?: string
    class_col?: string | null
  } | null
  seasons: { season: number; league: string; team: string | null; games: number | null; disposals: number | null;
    goals: number | null; tackles: number | null; marks: number | null; fantasy: number | null }[]
  projection: { sc: number; season: number; tag: string | null } | null
  lines: string[]
}


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
  honours?: Honours
  pre_afl?: PreAfl | null
  season_table?: SeasonTableData | null
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
  const [slim, setSlim] = useState(false)
  const shellRef = useRef<HTMLDivElement>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const emblems = (p.honours?.emblems || []).slice(0, 5)
  const nextUp = p.honours?.next
  const pickedE = picked != null ? emblems[picked] : null

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

  const pos = (p.position || 'MID').split('/')
  const isNew = chartData.length === 0 && !!p.pre_afl
  const pa = p.pre_afl
  const faceVars = { ...clubVars(p.afl_team), ['--logo' as string]: logoUrl ? `url("${logoUrl}")` : 'none' } as React.CSSProperties

  const actions = (
    <div className="pmod-actions">
      <button type="button" className={`pmod-act${notesOpen ? ' on' : ''}`} onClick={() => setNotesOpen(o => !o)} aria-pressed={notesOpen} aria-label="My notes" title="My notes">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 2.5h7l3 3v8H3z M10 2.5v3h3 M5.5 8.5h5 M5.5 11h3.5" /></svg>
      </button>
      {_leagueId && (
        <Link to={`/leagues/${_leagueId}/player/${p.id}`} className="pmod-act pmod-act-wide">
          Full profile
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
        </Link>
      )}
      <button type="button" onClick={onClose} className="pmod-act" aria-label="Close"><i className="bi bi-x-lg"></i></button>
    </div>
  )
  const badges = (
    <>
      {pos.map(ps => <span key={ps} className={`pos-badge badge-${ps.toLowerCase()}${p.position_expected ? ' pos-expected' : ''}`} title={p.position_expected ? 'Expected position' : undefined}>{ps}</span>)}
      {p.is_new && <span className="pl-mark pl-mark-new">NEW</span>}
      {p.is_former && <span className="pl-mark pl-mark-off">OFF AFL LIST</span>}
    </>
  )

  return (
    <>
      <div onClick={onClose} className="pmod-backdrop" />
      {/* One card that scrolls as one, the buttons in the header, a slim bar
          with his name once you scroll. Lucas, 2026-11-27: "it just functions
          strangely now the middle section is scrollable". Mock agreed:
          artifact T2rjMtvmtFEGoWVTRG1NTv. */}
      <div role="dialog" aria-modal="true" className="pmod-shell pmod-v2" ref={shellRef}
        onScroll={e => setSlim((e.currentTarget as HTMLDivElement).scrollTop > 150)}>
        <div className={`pmod-slim${slim ? ' on' : ''}`} style={faceVars} aria-hidden={!slim}>
          {pos.map(ps => <span key={ps} className={`pos-badge badge-${ps.toLowerCase()}${p.position_expected ? ' pos-expected' : ''}`}>{ps}</span>)}<b>{p.name}</b>{actions}
        </div>
        <div className="pmod-face" style={{ ...faceVars,
          ['--pc' as string]: `var(--pos-${pos[0].toLowerCase()})`, ['--pc2' as string]: `var(--pos-${(pos[1] || pos[0]).toLowerCase()})` } as React.CSSProperties}>
          <div className="pmod-topline"><div className="pmod-face-top">{badges}</div>{actions}</div>
          <div className="pmod-upper">
            <div className="pmod-photo-box">
              {p.photo_url && !photoBad
                ? <img className="pmod-photo" src={p.photo_url} alt="" onError={() => setPhotoBad(true)} />
                : <svg className="pmod-photo pmod-sil" viewBox="0 0 240 240" aria-hidden="true"><circle cx="120" cy="92" r="46" /><path d="M30 240c4-58 44-92 90-92s86 34 90 92z" /></svg>}
            </div>
            <div className="pmod-upper-text">
              <div className="pmod-face-id">
                <div>
                  <div className="pmod-first">{p.name.split(' ')[0]}</div>
                  <div className="pmod-sur pmod-fit" style={{ ['--n' as string]: (p.name.split(' ').slice(1).join(' ') || p.name).length } as React.CSSProperties}>{p.name.split(' ').slice(1).join(' ') || p.name}</div>
                </div>
              </div>
              <div className="pmod-face-meta">
                <span className="pmod-club">{logoUrl && <img className="pmod-crest" src={logoUrl} alt="" />}{p.afl_team}</span>
                <span>Age {p.age}</span>
                {isNew ? (p.height_cm ? <span>{p.height_cm} cm</span> : null) : <span>{p.career_games || 0} games</span>}
              </div>
            </div>
          </div>
          <div className="pmod-nums">
            {isNew ? (
              <>
                <div className="pmod-num"><b>{pa?.pick ?? '-'}</b><span>{pa?.pick_kind && pa.pick_kind !== 'National' ? `${pa.pick_kind} pick` : 'Pick'}</span></div>
                <div className="pmod-num"><b><span className={`rt ${ratingTier(p.rating)}`}>{p.rating ?? '-'}</span></b><span>Rating</span></div>
                <div className="pmod-num"><b><span className={`rt rt-line ${ratingTier(p.potential)}`}>{p.potential ?? '-'}</span></b><span>Potential</span></div>
                <div className="pmod-num"><b>{pa?.verdict?.chance ? pa.verdict.chance.ten + '%' : '-'}</b><span>10+ games</span></div>
              </>
            ) : (
              <>
                <div className="pmod-num"><b>{p.sc_avg ? Math.round(p.sc_avg) : '-'}</b><span>{yrLabel} avg</span></div>
                <div className="pmod-num"><b>{l3 ?? '-'}{l3 != null && <i className={`pmod-trend ${l3 >= avg ? 'up' : 'down'}`}>{l3 >= avg ? '\u25B2' : '\u25BC'}</i>}</b><span>Last 3</span></div>
                <div className="pmod-num"><b><span className={`rt ${ratingTier(p.rating)}`}>{p.rating ?? '-'}</span></b><span>Rating</span></div>
                <div className="pmod-num"><b><span className={`rt rt-line ${ratingTier(p.potential)}`}>{p.potential ?? '-'}</span></b><span>Potential</span></div>
              </>
            )}
          </div>
        </div>

        <div className="pmod-body">
          {(p.is_former || p.injury_severity) && (
            <div className="pmod-flags">
              {p.injury_severity && <span className="pmod-flag pmod-flag-off">{p.injury_type || 'Injured'}, {p.injury_return || 'TBC'}</span>}
              {p.is_former && <span className="pmod-flag pmod-flag-off">Off AFL lists{p.left_afl_year ? ` since ${p.left_afl_year + 1}` : ''}. He will not score.</span>}
            </div>
          )}

          {notesOpen ? (
            <div className="pmod-notes">
              <button type="button" className="pmod-textbtn" onClick={() => setNotesOpen(false)}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>Back to his card
              </button>
              <PlayerNotes playerId={p.id} />
            </div>
          ) : isNew && pa ? (
            <>
              {pa.verdict && (
                <section className={'pa-verdict pa-' + pa.verdict.tone}>
                  <span className="pa-dot" />
                  <div><b>{pa.verdict.label}</b>{pa.verdict.reasons.slice(1).map((r, i) => <span key={i}>{r}</span>)}</div>
                </section>
              )}
              {pa.description && (
                <section className="pmod-sec">
                  <header className="pmod-sec-h"><h3>Scouting report</h3>{pa.honours && <span className="pmod-jhon" title={pa.honour_note || ''}>{pa.honours}</span>}</header>
                  <p className="pa-desc">{pa.description}</p>
                </section>
              )}
              {pa.headline && pa.headline.ranks.length > 0 && (
                <section className="pmod-sec">
                  <header className="pmod-sec-h"><h3>{pa.headline.season} {pa.headline.league}{pa.headline.group ? ', ' + pa.headline.group : ''}</h3><span className="pmod-sub">{pa.headline.team}{pa.headline.games ? ', ' + pa.headline.games + ' games' : ''}</span></header>
                  <table className="pa-rt" title={'Ranked against ' + pa.headline.pool}>
                    <thead><tr><th></th><th className="n">Avg</th><th>{pa.headline.col}</th>{pa.headline.class_col && <th className="n">{pa.headline.class_col}</th>}</tr></thead>
                    <tbody>
                      {pa.headline.ranks.map(r => (
                        <tr key={r.label} className={r.best ? 'pa-best' : undefined}>
                          <td>{r.label}</td>
                          <td className="n"><b>{fmt1(r.value)}</b></td>
                          <td><span className="pa-rk"><span className="pa-bar"><i style={{ width: Math.max(4, r.pct) + '%' }} /></span><b>{r.text}</b></span></td>
                          {pa.headline!.class_col && <td className="n"><b>{r.class_text ?? '-'}</b></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              {pa.season_table ? (
                <section className="pmod-sec">
                  <header className="pmod-sec-h"><h3>Every season</h3></header>
                  <SeasonTable data={pa.season_table} />
                </section>
              ) : !pa.headline && <p className="pa-none">No junior or state league games in any source we hold.</p>}
            </>
          ) : (
            <>
              {emblems.length > 0 ? (
                <section className="pmod-honours" aria-label="Honours">
                  <div className="pmod-shelf">
                    {emblems.map((e, i) => (
                      <button key={e.kind} type="button" className={`pmod-hon${picked === i ? ' on' : ''}`}
                        onClick={() => setPicked(picked === i ? null : i)} title={emblemTitle(e)}>
                        {e.times >= 2 && e.times <= 4 ? <EmblemStars n={e.times} /> : <span className="emblem-stars" />}
                        <Emblem kind={e.kind} tier={e.tier} step={e.step} size={58} />
                        <span>{emblemLabel(e)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="pmod-ledge" />
                  {pickedE && (
                    <ul className="pmod-hon-detail">
                      {pickedE.items.map((it, i) => <li key={i}>{[it.year, it.detail].filter(Boolean).join(', ')}</li>)}
                    </ul>
                  )}
                </section>
              ) : nextUp ? (
                <section className="pmod-honours pmod-honours-next" aria-label="Next milestone">
                  <Emblem kind={nextUp.kind} tier={nextUp.tier} step={nextUp.step} size={48} locked />
                  <div>
                    <b>Next: {nextUp.step} games for {nextUp.team}</b>
                    <span>{nextUp.games} so far, {nextUp.to_go} to go</span>
                  </div>
                </section>
              ) : null}

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

              {p.season_table ? (
                <section className="pmod-sec">
                  <header className="pmod-sec-h"><h3>Season averages</h3></header>
                  <SeasonTable data={p.season_table} />
                </section>
              ) : p.season_avg && (
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
        </div>
      </div>
    </>
  )
}
