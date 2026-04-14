import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart,
} from 'recharts'

interface PlayerDetail {
  id: number; name: string; position: string; afl_team: string
  age: number; height_cm: number; career_games: number
  sc_avg: number; sc_avg_prev: number; rating: number; potential: number
  injury_type: string | null; injury_severity: string | null; injury_return: string | null
  round_scores: { round: number; sc: number }[]
  last_game: Record<string, number> | null
  season_avg: Record<string, number> | null
  season_games: number
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
    <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
      <div style={{ fontSize: '.72rem', color: '#8b949e', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#f0f3f6' }}>{score}</div>
      {ma > 0 && <div style={{ fontSize: '.65rem', color: '#6e7681', marginTop: 2 }}>3-game avg: {ma}</div>}
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

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 1055 }} />
      <div role="dialog" aria-modal="true" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 1060,
        width: '94%', maxWidth: 520, maxHeight: '90vh',
        background: 'linear-gradient(165deg, #1c2330 0%, #141a22 100%)',
        borderRadius: 16, border: '1px solid rgba(48,54,61,.4)',
        boxShadow: '0 24px 80px rgba(0,0,0,.7)',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ padding: '18px 20px 24px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 18 }}>
            <div style={{ width: 44, height: 44, flexShrink: 0 }}>
              {logoUrl ? (
                <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58' }}>
                  <i className="bi bi-shield-fill"></i>
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f0f3f6', letterSpacing: '-.02em', lineHeight: 1.2 }}>{p.name}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, fontSize: '.78rem', color: '#8b949e', flexWrap: 'wrap' }}>
                <span className={`pos-badge badge-${(p.position || 'MID').split('/')[0].toLowerCase()}`} style={{ fontSize: '.6rem', padding: '2px 6px' }}>{p.position}</span>
                <span>{p.afl_team}</span>
                <span>·</span>
                <span>{p.age}yo</span>
                <span>·</span>
                <span>{p.career_games || 0} career</span>
              </div>
              {p.injury_severity && (
                <div style={{ marginTop: 5, fontSize: '.72rem', color: '#f85149', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <i className="bi bi-bandaid-fill" style={{ fontSize: '.65rem' }}></i>
                  {p.injury_type || 'Injured'} — {p.injury_return || 'TBC'}
                </div>
              )}
            </div>
            <button type="button" onClick={onClose}
              style={{ background: 'rgba(255,255,255,.05)', border: 'none', color: '#8b949e', fontSize: '1rem', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, flexShrink: 0 }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          {/* Key numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 18 }}>
            {[
              { val: p.sc_avg ? Math.round(p.sc_avg) : '—', label: 'SC Avg', color: '#58a6ff' },
              { val: p.sc_avg_prev ? Math.round(p.sc_avg_prev) : '—', label: 'Prev Yr', color: '#8b949e' },
              { val: p.rating || '—', label: 'Rating', color: '#3fb950' },
              { val: p.potential || '—', label: 'Potential', color: '#bc8cff' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '10px 4px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(48,54,61,.3)', borderRadius: 10 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
                <div style={{ fontSize: '.55rem', color: '#6e7681', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Season form chart */}
          {chartData.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                Season Form
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                    <XAxis dataKey="label" stroke="#484f58" fontSize={10} tickLine={false} axisLine={{ stroke: '#21262d' }} />
                    <YAxis stroke="#484f58" fontSize={10} tickLine={false} axisLine={false}
                      domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.8)), 'auto']} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(88,166,255,.04)' }} />
                    <Bar dataKey="sc" fill="#58a6ff" radius={[4, 4, 0, 0]} maxBarSize={28} fillOpacity={0.85} />
                    <Line type="monotone" dataKey="ma" stroke="#d29922" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '.72rem', color: '#6e7681' }}>
                <span>Avg: <b style={{ color: '#c9d1d9' }}>{Math.round(avg)}</b></span>
                {l3 != null && <span>L3: <b style={{ color: l3 >= avg ? '#3fb950' : '#f85149' }}>{l3}</b></span>}
                {l5 != null && <span>L5: <b style={{ color: l5 >= avg ? '#3fb950' : '#f85149' }}>{l5}</b></span>}
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
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>Last Game</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(55px, 1fr))', gap: 5 }}>
                {STAT_KEYS.map(([key, label]) => {
                  const val = p.last_game?.[key]
                  if (val == null) return null
                  return (
                    <div key={key} style={{ textAlign: 'center', padding: '5px 3px', background: 'rgba(255,255,255,.02)', borderRadius: 6, border: '1px solid rgba(48,54,61,.25)' }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#d1d5db' }}>{val}</div>
                      <div style={{ fontSize: '.48rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Season averages */}
          {p.season_avg && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                Season Averages · {p.season_games} games
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(55px, 1fr))', gap: 5 }}>
                {STAT_KEYS.map(([key, label]) => {
                  const val = p.season_avg?.[key]
                  if (val == null) return null
                  return (
                    <div key={key} style={{ textAlign: 'center', padding: '5px 3px', background: 'rgba(255,255,255,.02)', borderRadius: 6, border: '1px solid rgba(48,54,61,.25)' }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 800, color: '#d1d5db' }}>{typeof val === 'number' ? val.toFixed(1) : val}</div>
                      <div style={{ fontSize: '.48rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Full player profile */}
          <a
            href={`/player/${encodeURIComponent(p.name)}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', borderRadius: 12,
              background: 'rgba(88,166,255,.08)', border: '1px solid rgba(88,166,255,.2)',
              color: '#58a6ff', fontSize: '.82rem', fontWeight: 700,
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
