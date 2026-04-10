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
}

export function PlayerModal({ player: p, teamLogos, onClose }: Props) {
  const circumference = 2 * Math.PI * 24 // r=24
  const ratingOffset = circumference - (circumference * (p.rating || 0) / 100)
  const potentialOffset = circumference - (circumference * (p.potential || 0) / 100)
  const logoUrl = p.afl_team ? teamLogos[p.afl_team] : null

  // Sparkline
  const scores = (p.round_scores || []).slice(-5)
  const vals = scores.map(s => s.sc)
  const min = vals.length ? Math.min(...vals) - 5 : 0
  const max = vals.length ? Math.max(...vals) + 5 : 100
  const range = max - min || 1
  const points = vals.map((v, i) => {
    const x = vals.length === 1 ? 60 : (i / (vals.length - 1)) * 120
    const y = 36 - ((v - min) / range) * 32 - 2
    return `${x},${y}`
  }).join(' ')

  const STAT_KEYS: [string, string][] = [
    ['disposals', 'DIS'], ['kicks', 'KCK'], ['handballs', 'HBL'], ['marks', 'MRK'],
    ['goals', 'GLS'], ['behinds', 'BHD'], ['tackles', 'TKL'], ['hitouts', 'HO'],
    ['clearances', 'CLR'], ['inside_fifties', 'I50'], ['contested_possessions', 'CP'],
    ['pressure_acts', 'PA'],
  ]

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose}></div>
      <div className="modal fade show d-block" tabIndex={-1} onClick={onClose}>
        <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
          <div className="modal-content" style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #30363d', padding: '.75rem 1rem' }}>
              <h6 className="modal-title fw-bold" style={{ fontSize: '.95rem' }}>{p.name}</h6>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
            <div className="modal-body" style={{ padding: '1rem' }}>
              {/* Hero row */}
              <div className="pm-hero" style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ width: 40, height: 40, flexShrink: 0 }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span className="fv-logo-fallback" style={{ width: 40, height: 40 }}><i className="bi bi-shield-fill"></i></span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#e6edf3', fontSize: '.95rem' }}>{p.name}</div>
                  <div style={{ fontSize: '.78rem', color: '#8b949e' }}>{p.afl_team} &bull; {p.position}</div>
                  <div style={{ fontSize: '.78rem', color: '#8b949e' }}>
                    <strong>{p.age}</strong> age &nbsp; <strong>{p.height_cm || '-'}</strong> cm &nbsp; <strong>{p.career_games || '-'}</strong> career games
                  </div>
                  {p.injury_severity && (
                    <div style={{ marginTop: 4, fontSize: '.7rem', color: '#f85149' }}>
                      <i className="bi bi-bandaid me-1"></i>{p.injury_type || 'Injured'} — {p.injury_return || ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {/* Rating ring */}
                  <div style={{ textAlign: 'center' }}>
                    <div className="draft-ring" style={{ width: 56, height: 56 }}>
                      <svg width="56" height="56" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="#21262d" strokeWidth="4" />
                        <circle cx="28" cy="28" r="24" fill="none" stroke="#3fb950" strokeWidth="4"
                          strokeDasharray={circumference} strokeDashoffset={ratingOffset} strokeLinecap="round"
                          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                      </svg>
                      <div className="ring-value" style={{ fontSize: '.9rem' }}>{p.rating || '-'}</div>
                    </div>
                    <div style={{ fontSize: '.45rem', color: '#6e7681', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 2 }}>Rating</div>
                  </div>
                  {/* Potential ring */}
                  <div style={{ textAlign: 'center' }}>
                    <div className="draft-ring" style={{ width: 56, height: 56 }}>
                      <svg width="56" height="56" viewBox="0 0 56 56">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="#21262d" strokeWidth="4" />
                        <circle cx="28" cy="28" r="24" fill="none" stroke="#bc8cff" strokeWidth="4"
                          strokeDasharray={circumference} strokeDashoffset={potentialOffset} strokeLinecap="round"
                          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                      </svg>
                      <div className="ring-value" style={{ fontSize: '.9rem' }}>{p.potential || '-'}</div>
                    </div>
                    <div style={{ fontSize: '.45rem', color: '#6e7681', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 2 }}>Potential</div>
                  </div>
                </div>
              </div>

              {/* SC row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '12px', background: '#0d1117', borderRadius: 8, border: '1px solid #21262d' }}>
                <div>
                  <div style={{ fontSize: '.6rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '.5px' }}>SC Average</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#58a6ff' }}>{p.sc_avg ? Math.round(p.sc_avg) : '-'}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: '.6rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '.5px' }}>Form (last 5)</div>
                  {vals.length > 0 && (
                    <svg width="120" height="36" style={{ marginTop: 4 }}>
                      <polyline points={points} fill="none" stroke="#58a6ff" strokeWidth="2" />
                      {vals.map((v, i) => {
                        const x = vals.length === 1 ? 60 : (i / (vals.length - 1)) * 120
                        const y = 36 - ((v - min) / range) * 32 - 2
                        return <circle key={i} cx={x} cy={y} r="2.5" fill="#58a6ff" />
                      })}
                    </svg>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '.6rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '.5px' }}>Prev Avg</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#8b949e' }}>{p.sc_avg_prev ? Math.round(p.sc_avg_prev) : '-'}</div>
                </div>
              </div>

              {/* Last game stats */}
              {p.last_game && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Last Game</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 4 }}>
                    {STAT_KEYS.map(([key, label]) => {
                      const val = p.last_game?.[key]
                      if (val == null) return null
                      return (
                        <div key={key} style={{ textAlign: 'center', padding: '4px', background: '#0d1117', borderRadius: 4, border: '1px solid #21262d' }}>
                          <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#c9d1d9' }}>{val}</div>
                          <div style={{ fontSize: '.45rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Season averages */}
              {p.season_avg && (
                <div>
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                    Season Averages ({p.season_games} games)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 4 }}>
                    {STAT_KEYS.map(([key, label]) => {
                      const val = p.season_avg?.[key]
                      if (val == null) return null
                      return (
                        <div key={key} style={{ textAlign: 'center', padding: '4px', background: '#0d1117', borderRadius: 4, border: '1px solid #21262d' }}>
                          <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#c9d1d9' }}>{typeof val === 'number' ? val.toFixed(1) : val}</div>
                          <div style={{ fontSize: '.45rem', color: '#484f58', textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
