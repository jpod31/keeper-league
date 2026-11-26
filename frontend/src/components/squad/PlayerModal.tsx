import { clubVars, ratingTier } from '../../lib/clubs'
import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart,
} from 'recharts'
import { PlayerNotes } from '../ui/PlayerNotes'
import { Link } from 'react-router'

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
}

interface Props {
  player: PlayerDetail
  teamLogos: Record<string, string>
  onClose: () => void
  leagueId?: string
}

const STAT_KEYS: [string, string][] = [
  ['disposals', 'DIS'], ['kicks', 'KCK'], ['handballs', 'HBL'], ['marks', 'MRK'],
  ['goals', 'GLS'], ['behinds', 'BHD'], ['tackles', 'TKL'], ['hitouts', 'HO'],
  ['clearances', 'CLR'], ['inside_fifties', 'I50'], ['contested_possessions', 'CP'],
  ['pressure_acts', 'PA'],
]

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
          <div className="pmod-face-top">
            {(p.position || 'MID').split('/').map(ps => (
              <span key={ps} className={`pos-badge badge-${ps.toLowerCase()}${p.position_expected ? ' pos-expected' : ''}`}>{ps}</span>
            ))}
            {p.is_new && <span className="pl-mark pl-mark-new">NEW</span>}
            {p.is_former && <span className="pl-mark pl-mark-off">OFF AFL LIST</span>}
          </div>
          <div className="pmod-face-id">
            {logoUrl && <img className="pmod-crest" src={logoUrl} alt="" />}
            <div style={{ minWidth: 0 }}>
              <div className="pmod-first">{p.name.split(' ')[0]}</div>
              <div className="pmod-sur">{p.name.split(' ').slice(1).join(' ') || p.name}</div>
            </div>
          </div>
          <div className="pmod-face-meta">
            <span>{p.afl_team}</span>
            <span>Age {p.age}</span>
            <span>{p.career_games || 0} games</span>
          </div>
          <div className="pmod-nums">
            <div className="pmod-num"><b>{p.sc_avg ? Math.round(p.sc_avg) : '-'}</b><span>{yrLabel} avg</span></div>
            <div className="pmod-num"><b>{p.sc_avg_prev ? Math.round(p.sc_avg_prev) : '-'}</b><span>{prevLabel} avg</span></div>
            <div className="pmod-num"><b><span className={`rt ${ratingTier(p.rating)}`}>{p.rating ?? '-'}</span></b><span>Rating</span></div>
            <div className="pmod-num"><b><span className={`rt rt-line ${ratingTier(p.potential)}`}>{p.potential ?? '-'}</span></b><span>Potential</span></div>
          </div>
        </div>

        <div style={{ padding: '18px 20px 24px' }}>
          {p.position_expected && (
            <div className="pmod-flag">Expected position. He has no SuperCoach position yet.</div>
          )}
          {p.is_former && (
            <div className="pmod-flag pmod-flag-off">
              No longer on an AFL list{p.left_afl_year ? ` (last listed ${p.left_afl_year})` : ''}. He will not score.
            </div>
          )}
          {p.injury_severity && (
            <div className="pmod-flag pmod-flag-off">{p.injury_type || 'Injured'}, {p.injury_return || 'TBC'}</div>
          )}

          {/* Season form chart */}
          {chartData.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 700, color: 'var(--kl-text-primary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                {yrLabel} form
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1d21" vertical={false} />
                    <XAxis dataKey="label" stroke="#63616d" fontSize={13} tickLine={false} axisLine={{ stroke: '#1e1d21' }} />
                    <YAxis stroke="#63616d" fontSize={13} tickLine={false} axisLine={false}
                      domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.8)), 'auto']} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(236,236,246,.04)' }} />
                    <Bar dataKey="sc" fill="#ececf6" radius={[4, 4, 0, 0]} maxBarSize={28} fillOpacity={0.85} />
                    <Line type="monotone" dataKey="ma" stroke="#d29922" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="pmod-formnums">
                <div className="pmod-tile"><b>{Math.round(avg)}</b><span>Average</span></div>
                {l3 != null && <div className="pmod-tile"><b className={l3 >= avg ? 'up' : 'down'}>{l3}</b><span>Last 3{p.stats_are_last_season ? ` of ${yr}` : ''}</span></div>}
                {l5 != null && <div className="pmod-tile"><b className={l5 >= avg ? 'up' : 'down'}>{l5}</b><span>Last 5{p.stats_are_last_season ? ` of ${yr}` : ''}</span></div>}
              </div>
              <p className="pmod-legend"><i></i>Dashed line is the 3-game average</p>
            </div>
          )}

          {/* Last game stats */}
          {p.last_game && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 700, color: 'var(--kl-text-primary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Last Game</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {STAT_KEYS.map(([key, label]) => {
                  const val = p.last_game?.[key]
                  if (val == null) return null
                  return (
                    <div key={key} className="pmod-tile">
                      <b>{val}</b>
                      <span>{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Season averages */}
          {p.season_avg && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '.8125rem', fontWeight: 700, color: 'var(--kl-text-primary)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                {yrLabel} averages, {p.season_games} games
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {STAT_KEYS.map(([key, label]) => {
                  const val = p.season_avg?.[key]
                  if (val == null) return null
                  return (
                    <div key={key} className="pmod-tile">
                      <b>{typeof val === 'number' ? val.toFixed(1) : val}</b>
                      <span>{label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <PlayerNotes playerId={p.id} />

          {/* The full player page: career, ratings, his keeper league story. */}
          {_leagueId && (
            <Link to={`/leagues/${_leagueId}/player/${p.id}`} className="pmod-more">
              More details
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
