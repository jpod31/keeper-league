import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart,
} from 'recharts'
import { PlayerNotes } from '../ui/PlayerNotes'

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
      <div style={{ fontSize: '.72rem', color: '#a0a0ac', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f2f2f4' }}>{score}</div>
      {ma > 0 && <div style={{ fontSize: '.65rem', color: '#8a8895', marginTop: 2 }}>3-game avg: {ma}</div>}
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
        <div style={{ padding: '18px 20px 24px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, flexShrink: 0 }}>
              {logoUrl ? (
                <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: '#1e1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#63616d' }}>
                  <i className="bi bi-shield-fill"></i>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f2f2f4', letterSpacing: '-.02em', lineHeight: 1.2 }}>{p.name}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, fontSize: '.78rem', color: '#a0a0ac', flexWrap: 'wrap' }}>
                <span className={`pos-badge badge-${(p.position || 'MID').split('/')[0].toLowerCase()}${p.position_expected ? ' pos-expected' : ''}`} style={{ fontSize: '.6rem', padding: '2px 6px' }}>{p.position}{p.position_expected ? ' exp' : ''}</span>
                {p.is_new && <span className="pl-mark pl-mark-new">NEW</span>}
                {p.is_former && <span className="pl-mark pl-mark-off">OFF AFL LIST</span>}
                <span>{p.afl_team}</span>
                <span>·</span>
                <span>{p.age}yo</span>
                <span>·</span>
                <span>{p.career_games || 0} career</span>
              </div>
              {p.position_expected && (
                <div className="pmod-flag">Expected position. He has no SuperCoach position yet.</div>
              )}
              {p.is_former && (
                <div className="pmod-flag pmod-flag-off">
                  No longer on an AFL list{p.left_afl_year ? ` (last listed ${p.left_afl_year})` : ''}. He will not score.
                </div>
              )}
              {p.injury_severity && (
                <div style={{ marginTop: 5, fontSize: '.72rem', color: '#f85149', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <i className="bi bi-bandaid-fill" style={{ fontSize: '.65rem' }}></i>
                  {p.injury_type || 'Injured'} — {p.injury_return || 'TBC'}
                </div>
              )}
            </div>
            <button type="button" onClick={onClose}
              style={{ background: 'rgba(255,255,255,.05)', border: 'none', color: '#a0a0ac', fontSize: '1rem', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, flexShrink: 0 }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          {/* Key numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
            {[
              { val: p.sc_avg ? Math.round(p.sc_avg) : '—', label: `${yrLabel} avg`, color: '#ececf6' },
              { val: p.sc_avg_prev ? Math.round(p.sc_avg_prev) : '—', label: `${prevLabel} avg`, color: '#a0a0ac' },
              { val: p.rating || '—', label: 'Rating', color: '#3fb950' },
              { val: p.potential || '—', label: 'Potential', color: '#bc8cff' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '10px 4px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(42,41,47,.3)', borderRadius: 10 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
                <div style={{ fontSize: '.55rem', color: '#8a8895', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Season form chart */}
          {chartData.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#a0a0ac', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                {yrLabel} form
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1d21" vertical={false} />
                    <XAxis dataKey="label" stroke="#63616d" fontSize={10} tickLine={false} axisLine={{ stroke: '#1e1d21' }} />
                    <YAxis stroke="#63616d" fontSize={10} tickLine={false} axisLine={false}
                      domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.8)), 'auto']} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(236,236,246,.04)' }} />
                    <Bar dataKey="sc" fill="#ececf6" radius={[4, 4, 0, 0]} maxBarSize={28} fillOpacity={0.85} />
                    <Line type="monotone" dataKey="ma" stroke="#d29922" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '.72rem', color: '#8a8895' }}>
                <span>Avg: <b style={{ color: '#cfcfd6' }}>{Math.round(avg)}</b></span>
                {l3 != null && <span>Last 3{p.stats_are_last_season ? ` of ${yr}` : ''}: <b style={{ color: l3 >= avg ? '#3fb950' : '#f85149' }}>{l3}</b></span>}
                {l5 != null && <span>Last 5{p.stats_are_last_season ? ` of ${yr}` : ''}: <b style={{ color: l5 >= avg ? '#3fb950' : '#f85149' }}>{l5}</b></span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 12, height: 2, background: '#d29922', display: 'inline-block' }}></span>
                  <span style={{ fontSize: '.62rem' }}>3-game avg</span>
                </span>
              </div>
            </div>
          )}

          {/* Last game stats */}
          {p.last_game && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#a0a0ac', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Last Game</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(55px, 1fr))', gap: 5 }}>
                {STAT_KEYS.map(([key, label]) => {
                  const val = p.last_game?.[key]
                  if (val == null) return null
                  return (
                    <div key={key} style={{ textAlign: 'center', padding: '5px 3px', background: 'rgba(255,255,255,.02)', borderRadius: 6, border: '1px solid rgba(42,41,47,.25)' }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#d3d2da' }}>{val}</div>
                      <div style={{ fontSize: '.48rem', color: '#63616d', textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Season averages */}
          {p.season_avg && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#a0a0ac', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                {yrLabel} averages · {p.season_games} games
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(55px, 1fr))', gap: 5 }}>
                {STAT_KEYS.map(([key, label]) => {
                  const val = p.season_avg?.[key]
                  if (val == null) return null
                  return (
                    <div key={key} style={{ textAlign: 'center', padding: '5px 3px', background: 'rgba(255,255,255,.02)', borderRadius: 6, border: '1px solid rgba(42,41,47,.25)' }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#d3d2da' }}>{typeof val === 'number' ? val.toFixed(1) : val}</div>
                      <div style={{ fontSize: '.48rem', color: '#63616d', textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <PlayerNotes playerId={p.id} />

          {/* Full player profile */}
          <a
            href={`/player/${encodeURIComponent(p.name)}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', borderRadius: 12,
              background: 'rgba(236,236,246,.08)', border: '1px solid rgba(236,236,246,.2)',
              color: '#ececf6', fontSize: '.82rem', fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <i className="bi bi-person-lines-fill"></i>
            Full Player Profile
          </a>
        </div>
      </div>
    </>
  )
}
