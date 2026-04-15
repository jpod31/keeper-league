import { useParams } from 'react-router'
import { useState, useEffect, useCallback } from 'react'
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart,
} from 'recharts'
import { Spinner } from '../../components/ui/Spinner'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'

interface CompSeason { comp: string; season: number; count: number }

interface SLPlayer {
  id: number; player_name: string; competition: string; season: number
  team: string; age: number; matches: number; is_afl_listed: boolean
  player_id: number | null; afl_team: string | null; position: string | null
  sc_avg: number | null; rating: number | null
  kicks: number; handballs: number; disposals: number; marks: number
  goals: number; goals_avg: number; behinds: number; tackles: number; hitouts: number
  contested_possessions: number; uncontested_possessions: number
  clearances: number; inside_fifties: number; rebounds: number
  disposal_efficiency: number; intercepts: number; score_involvements: number
  frees_for: number; frees_against: number; contested_marks: number
  tackles_inside_50: number; dreamteam_avg: number
  total_possessions: number; kick_percentage: number
  contested_possession_rate: number; score_involvement_pct: number
}

interface CareerSeason {
  level: string; season: number; team: string; age: number | null; matches: number
  kicks: number; handballs: number; disposals: number; marks: number
  goals: number; tackles: number; hitouts: number
  contested_possessions: number; clearances: number; inside_fifties: number
  intercepts: number; disposal_efficiency: number; dreamteam_avg: number | null
  sc_avg?: number | null; contested_marks: number; score_involvements: number
}

interface PageData { players: SLPlayer[]; total: number; page: number; pages: number; sl_logos: Record<string, string>; team_logos: Record<string, string> }

const STAT_COLS: [keyof SLPlayer, string, number][] = [
  ['disposals', 'DIS', 0], ['kicks', 'KCK', 0], ['marks', 'MRK', 0],
  ['goals', 'GLS', 0], ['tackles', 'TKL', 0], ['hitouts', 'HO', 0],
  ['contested_possessions', 'CP', 0], ['clearances', 'CLR', 0],
  ['inside_fifties', 'I50', 0], ['disposal_efficiency', 'DE%', 1],
  ['dreamteam_avg', 'FAN', 0],
]

const DETAIL_STATS: [keyof CareerSeason, string][] = [
  ['disposals', 'DIS'], ['kicks', 'KCK'], ['handballs', 'HBL'], ['marks', 'MRK'],
  ['goals', 'GLS'], ['tackles', 'TKL'], ['hitouts', 'HO'],
  ['contested_possessions', 'CP'], ['clearances', 'CLR'], ['inside_fifties', 'I50'],
  ['intercepts', 'INT'], ['contested_marks', 'CM'], ['score_involvements', 'SI'],
]

const CSS = `
.scout-wrap { padding: 16px 20px 80px; max-width: 1200px; margin: 0 auto; }
.scout-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 10px; }
.scout-title { color: #f0f3f6; font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; }
.scout-title i { color: #58a6ff; }
.scout-count { font-size: .72rem; color: #484f58; font-weight: 400; }
.scout-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
.scout-filters select, .scout-filters input {
  background: #0d1117; border: 1px solid #30363d; color: #c9d1d9; border-radius: 8px;
  padding: 8px 12px; font-size: .82rem; outline: none; transition: border-color .15s;
}
.scout-filters select:focus, .scout-filters input:focus { border-color: #58a6ff; }
.scout-toggle { display: flex; align-items: center; gap: 6px; font-size: .75rem; color: #8b949e; cursor: pointer; }
.scout-toggle input { accent-color: #58a6ff; }

.scout-tbl-wrap { overflow-x: auto; border: 1px solid #21262d; border-radius: 12px; background: #0d1117; }
.scout-tbl { width: 100%; border-collapse: collapse; font-size: .78rem; }
.scout-tbl th { background: #161b22; color: #8b949e; font-size: .62rem;
  text-transform: uppercase; letter-spacing: .5px; padding: 10px 8px; text-align: right;
  cursor: pointer; user-select: none; white-space: nowrap; border-bottom: 1px solid #21262d; }
.scout-tbl th:first-child { text-align: left; padding-left: 14px; border-radius: 12px 0 0 0; }
.scout-tbl th:nth-child(2) { text-align: center; }
.scout-tbl th:last-child { border-radius: 0 12px 0 0; }
.scout-tbl th:hover { color: #f0f3f6; }
.scout-tbl th.sorted { color: #58a6ff; }
.scout-tbl th .sort-arrow { font-size: .55rem; margin-left: 2px; }
.scout-tbl td { padding: 8px 8px; border-bottom: 1px solid rgba(48,54,61,.25); color: #c9d1d9;
  text-align: right; font-variant-numeric: tabular-nums; }
.scout-tbl td:first-child { text-align: left; padding-left: 14px; }
.scout-tbl td:nth-child(2) { text-align: center; }
.scout-tbl tr { cursor: pointer; transition: background .1s; }
.scout-tbl tr:hover td { background: rgba(88,166,255,.05); }
.scout-tbl tr.selected td { background: rgba(88,166,255,.08); }
.scout-tbl tr:last-child td:first-child { border-radius: 0 0 0 12px; }
.scout-tbl tr:last-child td:last-child { border-radius: 0 0 12px 0; }

.scout-player-info { display: flex; align-items: center; gap: 10px; }
.scout-player-info .scout-text { display: flex; flex-direction: column; gap: 2px; }
.scout-logo { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; border-radius: 4px; }
.scout-logo-placeholder { width: 28px; height: 28px; flex-shrink: 0; border-radius: 4px;
  background: #21262d; display: flex; align-items: center; justify-content: center; color: #484f58; font-size: .6rem; }
.scout-name { font-weight: 700; color: #f0f3f6; font-size: .82rem; }
.scout-meta { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.scout-afl-badge { font-size: .62rem; color: #58a6ff; font-weight: 600; }
.scout-comp-badge { font-size: .58rem; color: #8b949e; text-transform: uppercase; background: rgba(139,148,158,.1);
  padding: 1px 5px; border-radius: 3px; font-weight: 600; }
.pos-pill { font-size: .58rem; padding: 1px 5px; border-radius: 4px; font-weight: 700; }
.pos-pill.def { background: rgba(88,166,255,.12); color: #58a6ff; }
.pos-pill.mid { background: rgba(188,140,255,.12); color: #bc8cff; }
.pos-pill.fwd { background: rgba(210,153,34,.12); color: #d29922; }
.pos-pill.ruc { background: rgba(63,185,80,.12); color: #3fb950; }
.unlisted-badge { font-size: .58rem; padding: 1px 5px; border-radius: 4px; font-weight: 600;
  background: rgba(139,148,158,.1); color: #6e7681; }
.listed-badge { font-size: .58rem; padding: 1px 5px; border-radius: 4px; font-weight: 600;
  background: rgba(63,185,80,.1); color: #3fb950; }

.scout-gp { display: inline-flex; align-items: center; justify-content: center;
  min-width: 28px; padding: 2px 6px; border-radius: 6px; font-weight: 700; font-size: .75rem;
  background: rgba(88,166,255,.08); color: #8b949e; }

.scout-pagination { display: flex; justify-content: center; gap: 4px; margin-top: 14px; }
.scout-pagination button { background: #161b22; border: 1px solid #30363d; color: #8b949e;
  border-radius: 6px; padding: 5px 10px; font-size: .75rem; cursor: pointer; transition: all .15s; }
.scout-pagination button:hover:not(:disabled) { border-color: #58a6ff; color: #c9d1d9; }
.scout-pagination button:disabled { opacity: .3; cursor: default; }
.scout-pagination button.active { background: #58a6ff; color: #0d1117; border-color: #58a6ff; font-weight: 700; }

/* Detail panel */
.scout-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.65); backdrop-filter: blur(6px);
  z-index: 1055; }
.scout-detail { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  z-index: 1060; width: 94%; max-width: 560px; max-height: 88vh;
  background: linear-gradient(165deg, #1c2330 0%, #141a22 100%);
  border-radius: 16px; border: 1px solid rgba(48,54,61,.4);
  box-shadow: 0 24px 80px rgba(0,0,0,.7); overflow-y: auto; }
.scout-detail-inner { padding: 20px; }
.scout-detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.scout-detail-name { font-size: 1.25rem; font-weight: 900; color: #f0f3f6; letter-spacing: -.02em; }
.scout-detail-sub { font-size: .78rem; color: #8b949e; margin-top: 3px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.scout-detail-close { background: rgba(255,255,255,.05); border: none; color: #8b949e; font-size: 1rem;
  cursor: pointer; padding: 6px 8px; border-radius: 8px; }
.scout-detail-section { font-size: .68rem; font-weight: 700; color: #8b949e; text-transform: uppercase;
  letter-spacing: .5px; margin-bottom: 8px; margin-top: 18px; }
.scout-detail-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); gap: 5px; }
.scout-stat-cell { text-align: center; padding: 6px 3px; background: rgba(255,255,255,.02);
  border-radius: 6px; border: 1px solid rgba(48,54,61,.25); }
.scout-stat-val { font-size: .85rem; font-weight: 800; color: #d1d5db; }
.scout-stat-label { font-size: .48rem; color: #484f58; text-transform: uppercase; letter-spacing: .3px; margin-top: 1px; }
.scout-history-row { display: grid; grid-template-columns: 80px 1fr 50px; gap: 8px; align-items: center;
  padding: 8px 0; border-bottom: 1px solid rgba(48,54,61,.2); font-size: .78rem; }
.scout-history-season { font-weight: 700; color: #f0f3f6; }
.scout-history-team { color: #8b949e; font-size: .72rem; }
.scout-history-disp { font-weight: 700; color: #58a6ff; text-align: right; }
.scout-trend-up { color: #3fb950; }
.scout-trend-down { color: #f85149; }

@media(max-width:768px) {
  .scout-tbl { font-size: .72rem; }
  .scout-tbl th, .scout-tbl td { padding: 6px 5px; }
  .scout-hide-mob { display: none; }
  .scout-detail { max-width: 100%; width: 100%; max-height: 92vh; border-radius: 16px 16px 0 0;
    top: auto; bottom: 0; left: 0; transform: none; }
}
`

function DetailTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
      <div style={{ fontSize: '.7rem', color: '#8b949e' }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f0f3f6' }}>{payload[0].value.toFixed(1)}</div>
    </div>
  )
}

interface Prediction {
  predicted_afl: Record<string, number>
  projections: Record<string, Record<string, number>>
  breakout_probability: number
  age: number; position: string; position_group: string; age_factor: number
}

function PlayerDetail({ player, leagueId, onClose, logos }: { player: SLPlayer; leagueId: string; onClose: () => void; logos: Record<string, string> }) {
  const [career, setCareer] = useState<CareerSeason[] | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)

  useEffect(() => {
    if (player.player_id) {
      fetch(`/api/leagues/${leagueId}/state-league-stats/player/${player.player_id}`)
        .then(r => r.json()).then(setCareer).catch(() => {})
    }
    fetch(`/api/leagues/${leagueId}/scouting/predict/${player.id}`)
      .then(r => r.ok ? r.json() : null).then(setPrediction).catch(() => {})
  }, [player.player_id, player.id, leagueId])

  const chartData = career?.map(h => ({
    label: `${h.level} ${String(h.season).slice(-2)}`,
    disp: h.disposals,
    isAfl: h.level === 'AFL',
  })) ?? []

  const fmt = (v: number | null | undefined) => v == null ? '—' : typeof v === 'number' ? (v % 1 ? v.toFixed(1) : String(v)) : '—'

  const hasAfl = career?.some(c => c.level === 'AFL')
  const hasSL = career?.some(c => c.level !== 'AFL')

  return (
    <>
      <div className="scout-detail-overlay" onClick={onClose} />
      <div className="scout-detail" role="dialog">
        <div className="scout-detail-inner">
          <div className="scout-detail-header">
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {logos[player.team] ? (
                <img src={logos[player.team]} alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58', flexShrink: 0 }}>
                  <i className="bi bi-shield-fill"></i>
                </div>
              )}
              <div>
              <div className="scout-detail-name">{player.player_name}</div>
              <div className="scout-detail-sub">
                {player.position && <span className={`pos-pill ${(player.position.split('/')[0] || '').toLowerCase()}`}>{player.position}</span>}
                {player.afl_team && <span>{player.afl_team}</span>}
                <span>{player.team} ({player.competition.toUpperCase()})</span>
                {player.age && <span>{player.age}yo</span>}
              </div>
              </div>
            </div>
            <button className="scout-detail-close" onClick={onClose}><i className="bi bi-x-lg"></i></button>
          </div>

          {/* Key numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 4 }}>
            {[
              { val: fmt(player.disposals), label: `${player.competition.toUpperCase()} DIS`, color: '#58a6ff' },
              { val: player.matches ?? '—', label: 'GP', color: '#8b949e' },
              { val: fmt(player.dreamteam_avg), label: `${player.competition.toUpperCase()} FAN`, color: '#3fb950' },
              { val: player.sc_avg ? Math.round(player.sc_avg) : '—', label: 'AFL SC', color: '#bc8cff' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '10px 4px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(48,54,61,.3)', borderRadius: 10 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.val}</div>
                <div style={{ fontSize: '.52rem', color: '#6e7681', textTransform: 'uppercase', letterSpacing: '.5px', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* AFL Projection */}
          {prediction && (
            <>
              <div className="scout-detail-section" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>AFL Projection</span>
                <span style={{ fontSize: '.7rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                  background: prediction.breakout_probability >= 50 ? 'rgba(63,185,80,.15)' : prediction.breakout_probability >= 30 ? 'rgba(210,153,34,.15)' : 'rgba(139,148,158,.1)',
                  color: prediction.breakout_probability >= 50 ? '#3fb950' : prediction.breakout_probability >= 30 ? '#d29922' : '#8b949e' }}>
                  {prediction.breakout_probability}% breakout
                </span>
              </div>
              <div className="scout-detail-stats">
                {[
                  ['afl_sc_avg', 'SC AVG'], ['afl_disposals', 'DIS'], ['afl_marks', 'MRK'],
                  ['afl_goals', 'GLS'], ['afl_tackles', 'TKL'], ['afl_hitouts', 'HO'],
                  ['afl_contested_possessions', 'CP'], ['afl_clearances', 'CLR'],
                ].map(([key, label]) => {
                  const val = prediction.predicted_afl[key]
                  if (val == null || (val === 0 && !['afl_goals', 'afl_hitouts'].includes(key))) return null
                  return (
                    <div key={key} className="scout-stat-cell" style={{ borderColor: 'rgba(88,166,255,.15)' }}>
                      <div className="scout-stat-val" style={{ color: '#58a6ff' }}>{val % 1 ? val.toFixed(1) : val}</div>
                      <div className="scout-stat-label">{label}</div>
                    </div>
                  )
                })}
              </div>
              {/* 3-year projection */}
              {Object.keys(prediction.projections).length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {Object.entries(prediction.projections).map(([key, proj]) => (
                    <div key={key} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: 'rgba(88,166,255,.03)',
                      border: '1px solid rgba(48,54,61,.2)', borderRadius: 8 }}>
                      <div style={{ fontSize: '.58rem', color: '#6e7681', textTransform: 'uppercase', marginBottom: 3 }}>{proj.year}</div>
                      <div style={{ fontSize: '.95rem', fontWeight: 800, color: '#58a6ff' }}>{Math.round(proj.afl_sc_avg)}</div>
                      <div style={{ fontSize: '.5rem', color: '#484f58' }}>SC AVG</div>
                      <div style={{ fontSize: '.7rem', color: '#c9d1d9', marginTop: 2 }}>{proj.afl_disposals?.toFixed(1)} dis</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Current season stats */}
          <div className="scout-detail-section">
            {player.competition.toUpperCase()} Season Averages · {player.season}
          </div>
          <div className="scout-detail-stats">
            {DETAIL_STATS.map(([key, label]) => {
              const val = player[key as keyof SLPlayer] as number
              if (val == null) return null
              return (
                <div key={key as string} className="scout-stat-cell">
                  <div className="scout-stat-val">{typeof val === 'number' && val % 1 ? val.toFixed(1) : val}</div>
                  <div className="scout-stat-label">{label}</div>
                </div>
              )
            })}
          </div>

          {/* Career pipeline chart */}
          {chartData.length > 1 && (
            <>
              <div className="scout-detail-section">
                Career Pipeline {hasSL && hasAfl ? '· State League → AFL' : ''}
              </div>
              <div style={{ height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                    <XAxis dataKey="label" stroke="#484f58" fontSize={9} tickLine={false} axisLine={{ stroke: '#21262d' }} />
                    <YAxis stroke="#484f58" fontSize={9} tickLine={false} axisLine={false} />
                    <Tooltip content={<DetailTooltip />} cursor={{ fill: 'rgba(88,166,255,.04)' }} />
                    <Bar dataKey="disp" radius={[4, 4, 0, 0]} maxBarSize={32} fillOpacity={0.85}
                      fill="#58a6ff"
                      shape={(props: any) => {
                        const { x, y, width, height, index } = props
                        const isAfl = chartData[index]?.isAfl
                        return <rect x={x} y={y} width={width} height={height} rx={4} fill={isAfl ? '#bc8cff' : '#58a6ff'} fillOpacity={0.85} />
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 6, fontSize: '.65rem', color: '#6e7681' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#58a6ff', display: 'inline-block' }}></span>
                  State League
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#bc8cff', display: 'inline-block' }}></span>
                  AFL
                </span>
              </div>
            </>
          )}

          {/* Full career timeline */}
          {career && career.length > 0 && (
            <>
              <div className="scout-detail-section">Career Timeline</div>
              {career.slice().reverse().map((h, i, arr) => {
                const next = arr[i + 1]
                const trend = next && next.disposals && h.disposals ? h.disposals - next.disposals : 0
                const levelChange = next && h.level !== next.level
                return (
                  <div key={`${h.level}-${h.season}`}>
                    {levelChange && (
                      <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '.6rem', color: '#58a6ff', fontWeight: 700, letterSpacing: '.5px' }}>
                        ▲ PROMOTED TO {h.level}
                      </div>
                    )}
                    <div className="scout-history-row">
                      <div>
                        <div className="scout-history-season" style={{ color: h.level === 'AFL' ? '#bc8cff' : '#f0f3f6' }}>
                          {h.season}
                        </div>
                        <div style={{ fontSize: '.58rem', color: '#6e7681' }}>
                          {h.level} · {h.matches}gm
                        </div>
                      </div>
                      <div className="scout-history-team">
                        {h.team}
                        {h.level === 'AFL' && h.sc_avg && (
                          <span style={{ marginLeft: 6, fontSize: '.65rem', color: '#bc8cff', fontWeight: 700 }}>
                            SC {Math.round(h.sc_avg)}
                          </span>
                        )}
                      </div>
                      <div className="scout-history-disp">
                        {h.disposals?.toFixed(1)}
                        {trend !== 0 && (
                          <span style={{ fontSize: '.6rem', marginLeft: 3 }} className={trend > 0 ? 'scout-trend-up' : 'scout-trend-down'}>
                            {trend > 0 ? '▲' : '▼'}{Math.abs(trend).toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Link to full profile */}
          {player.player_id && (
            <a href={`/player/${encodeURIComponent(player.player_name)}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: 12, borderRadius: 12, marginTop: 16,
                background: 'rgba(88,166,255,.08)', border: '1px solid rgba(88,166,255,.2)',
                color: '#58a6ff', fontSize: '.82rem', fontWeight: 700, textDecoration: 'none' }}>
              <i className="bi bi-person-lines-fill"></i>Full Player Profile
            </a>
          )}
        </div>
      </div>
    </>
  )
}

export function ScoutingPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [comps, setComps] = useState<CompSeason[]>([])
  const [comp, setComp] = useState('')
  const [season, setSeason] = useState<number | ''>('')
  const [aflOnly, setAflOnly] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('disposals')
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SLPlayer | null>(null)
  const [mode, setMode] = useState<'avg' | 'total'>('avg')

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/state-league-stats/comps`)
      .then(r => r.json()).then(setComps).catch(() => {})
  }, [leagueId])

  const filteredComps = comp ? comps.filter(c => c.comp === comp) : comps
  const filteredSeasons = season ? comps.filter(c => c.season === season) : comps
  const seasons = [...new Set(filteredComps.map(c => c.season))].sort((a, b) => b - a)
  const compList = [...new Set(filteredSeasons.map(c => c.comp))].sort()

  useEffect(() => {
    if (seasons.length && !season) setSeason(seasons[0])
  }, [comps])

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (comp) params.set('comp', comp)
    if (season) params.set('season', String(season))
    params.set('afl_only', String(aflOnly))
    if (search) params.set('search', search)
    params.set('sort', sort)
    params.set('dir', dir)
    params.set('page', String(page))
    params.set('mode', mode)
    fetch(`/api/leagues/${leagueId}/state-league-stats?${params}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leagueId, comp, season, aflOnly, search, sort, dir, page, mode])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleSort = (col: string) => {
    if (sort === col) setDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSort(col); setDir('desc') }
    setPage(1)
  }

  const fmt = (v: number | null, dec: number) => v == null ? '—' : dec ? v.toFixed(dec) : Math.round(v).toString()

  return (
    <>
      <style>{CSS}</style>
      <PlayersSubnav active="scouting" leagueId={leagueId!} />
      <div className="scout-wrap">
        <div className="scout-header">
          <div className="scout-title">
            <i className="bi bi-binoculars"></i>
            State League Scouting
            {data && <span className="scout-count">({data.total} players)</span>}
          </div>
        </div>

        <div className="scout-filters">
          <select value={comp} onChange={e => {
            const newComp = e.target.value
            setComp(newComp)
            setPage(1)
            if (newComp && season) {
              const available = comps.filter(c => c.comp === newComp).map(c => c.season)
              if (!available.includes(season as number)) setSeason(available[0] ?? '')
            }
          }}>
            <option value="">All Comps</option>
            {compList.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
          <select value={season} onChange={e => { setSeason(e.target.value ? Number(e.target.value) : ''); setPage(1) }}>
            <option value="">All Seasons</option>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input placeholder="Search player..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ minWidth: 160 }} />
          <label className="scout-toggle">
            <input type="checkbox" checked={aflOnly} onChange={e => { setAflOnly(e.target.checked); setPage(1) }} />
            AFL-listed only
          </label>
          <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #30363d', overflow: 'hidden', marginLeft: 'auto' }}>
            <button onClick={() => setMode('avg')}
              style={{ padding: '6px 12px', fontSize: '.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: mode === 'avg' ? '#58a6ff' : '#0d1117', color: mode === 'avg' ? '#0d1117' : '#8b949e' }}>
              AVG
            </button>
            <button onClick={() => setMode('total')}
              style={{ padding: '6px 12px', fontSize: '.75rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                borderLeft: '1px solid #30363d',
                background: mode === 'total' ? '#58a6ff' : '#0d1117', color: mode === 'total' ? '#0d1117' : '#8b949e' }}>
              TOT
            </button>
          </div>
        </div>

        {loading ? <Spinner text="Loading state league stats..." /> : !data?.players.length ? (
          <p style={{ color: '#8b949e', textAlign: 'center', padding: 40 }}>No data found.</p>
        ) : (
          <>
            <div className="scout-tbl-wrap">
              <table className="scout-tbl">
                <thead>
                  <tr>
                    <th className={sort === 'player_name' ? 'sorted' : ''} onClick={() => toggleSort('player_name')}>
                      Player {sort === 'player_name' && <span className="sort-arrow">{dir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className={sort === 'matches' ? 'sorted' : ''} onClick={() => toggleSort('matches')} style={{ textAlign: 'center' }}>
                      GP {sort === 'matches' && <span className="sort-arrow">{dir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    {STAT_COLS.map(([key, label]) => (
                      <th key={key as string} className={`${sort === key ? 'sorted' : ''} scout-hide-mob`}
                        onClick={() => toggleSort(key as string)}>
                        {label} {sort === key && <span className="sort-arrow">{dir === 'asc' ? '▲' : '▼'}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.players.map(p => (
                    <tr key={p.id} onClick={() => setSelected(p)} className={selected?.id === p.id ? 'selected' : ''}>
                      <td>
                        <div className="scout-player-info">
                          {(() => {
                            const logo = data.sl_logos[p.team]
                            return logo ? <img src={logo} alt="" className="scout-logo" /> : <div className="scout-logo-placeholder"><i className="bi bi-shield-fill"></i></div>
                          })()}
                          <div className="scout-text">
                            <span className="scout-name">{p.player_name}</span>
                            <div className="scout-meta">
                              {p.position && <span className={`pos-pill ${(p.position.split('/')[0] || '').toLowerCase()}`}>{p.position}</span>}
                              {p.is_afl_listed && p.afl_team && <span className="scout-afl-badge">{p.afl_team}</span>}
                              {!p.is_afl_listed && <span className="unlisted-badge">Unlisted</span>}
                              <span className="scout-comp-badge">{p.team} · {p.competition.toUpperCase()}</span>
                              {p.age && <span style={{ fontSize: '.65rem', color: '#6e7681' }}>{p.age}yo</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><span className="scout-gp">{p.matches ?? '—'}</span></td>
                      {STAT_COLS.map(([key, , dec]) => (
                        <td key={key as string} className="scout-hide-mob">{fmt(p[key] as number, dec)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.pages > 1 && (
              <div className="scout-pagination">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <i className="bi bi-chevron-left"></i>
                </button>
                {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 3, data.pages - 6))
                  const p = start + i
                  if (p > data.pages) return null
                  return <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
                })}
                <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
                  <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <PlayerDetail player={selected} leagueId={leagueId!} onClose={() => setSelected(null)} logos={data?.sl_logos ?? {}} />
      )}
    </>
  )
}
