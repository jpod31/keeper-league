import { useParams } from 'react-router'
import { useState, useEffect, useCallback } from 'react'
import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts'
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
  fantasy_team: string | null; coach: string | null
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

.scout-tag { font-size: .58rem; font-weight: 700; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
@media(max-width:768px) {
  .scout-tbl { font-size: .72rem; }
  .scout-tbl th, .scout-tbl td { padding: 6px 5px; }
  .scout-hide-mob { display: none; }
  .scout-detail { max-width: 100%; width: 100%; max-height: 92vh; border-radius: 16px 16px 0 0;
    top: auto; bottom: 0; left: 0; transform: none; }
}
`

interface Prediction {
  predicted_afl: Record<string, number>
  projections: Record<string, Record<string, number>>
  breakout_probability: number
  draft_probability: number | null
  age: number; position: string; position_group: string
  tag: string; tag_css: string
}

const TAG_COLORS: Record<string, [string, string]> = {
  'tag-star': ['rgba(188,140,255,.15)', '#bc8cff'],
  'tag-breakout': ['rgba(63,185,80,.15)', '#3fb950'],
  'tag-emerging': ['rgba(88,166,255,.15)', '#58a6ff'],
  'tag-developing': ['rgba(88,166,255,.1)', '#58a6ff'],
  'tag-watch': ['rgba(210,153,34,.15)', '#d29922'],
  'tag-radar': ['rgba(210,153,34,.1)', '#d29922'],
  'tag-veteran': ['rgba(139,148,158,.08)', '#6e7681'],
  'tag-depth': ['rgba(139,148,158,.1)', '#8b949e'],
  'tag-fringe': ['rgba(139,148,158,.08)', '#6e7681'],
  'tag-dev': ['rgba(139,148,158,.08)', '#6e7681'],
}

function PlayerDetail({ player, leagueId, onClose, logos }: { player: SLPlayer; leagueId: string; onClose: () => void; logos: Record<string, string> }) {
  const [career, setCareer] = useState<CareerSeason[] | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)

  useEffect(() => {
    // Career by name — works for ALL players, not just AFL-linked ones
    fetch(`/api/leagues/${leagueId}/state-league-stats/career-by-name?name=${encodeURIComponent(player.player_name)}`)
      .then(r => r.json()).then(setCareer).catch(() => {})
    fetch(`/api/leagues/${leagueId}/scouting/predict/${player.id}`)
      .then(r => r.ok ? r.json() : null).then(setPrediction).catch(() => {})
  }, [player.player_name, player.id, leagueId])

  const fmt = (v: number | null | undefined) => v == null ? '—' : typeof v === 'number' ? (v % 1 ? v.toFixed(1) : String(Math.round(v))) : '—'
  const tagCol = prediction ? (TAG_COLORS[prediction.tag_css] || TAG_COLORS['tag-depth']) : ['', '']

  return (
    <>
      <div className="scout-detail-overlay" onClick={onClose} />
      <div className="scout-detail" role="dialog">
        <div className="scout-detail-inner">
          {/* Header */}
          <div className="scout-detail-header">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {logos[player.team] ? (
                <img src={logos[player.team]} alt="" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 6, background: '#21262d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58', flexShrink: 0 }}>
                  <i className="bi bi-shield-fill"></i>
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="scout-detail-name">{player.player_name}</span>
                  {prediction && (
                    <span style={{ fontSize: '.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: tagCol[0], color: tagCol[1] }}>
                      {prediction.tag}
                    </span>
                  )}
                </div>
                <div className="scout-detail-sub">
                  {player.position && <span className={`pos-pill ${(player.position.split('/')[0] || '').toLowerCase()}`}>{player.position}</span>}
                  <span>{player.team} · {player.competition.toUpperCase()}</span>
                  {player.afl_team && <span style={{ color: '#58a6ff' }}>{player.afl_team}</span>}
                  {player.age && <span>{player.age}yo</span>}
                  <span>{player.matches}gm</span>
                  {player.coach && <span style={{ color: '#d29922', fontWeight: 600 }}>Owned: {player.coach}</span>}
                </div>
              </div>
            </div>
            <button className="scout-detail-close" onClick={onClose}><i className="bi bi-x-lg"></i></button>
          </div>

          {/* Projected AFL output — the hero section */}
          {prediction && (
            <div style={{ background: 'rgba(88,166,255,.04)', border: '1px solid rgba(88,166,255,.12)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: '.7rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Projected AFL Output
                </span>
                <span style={{ fontSize: '.65rem', color: '#6e7681' }}>
                  {prediction.breakout_probability > 0 && `${prediction.breakout_probability}% breakout`}
                  {prediction.draft_probability != null && prediction.draft_probability > 0 && ` · ${prediction.draft_probability}% draft chance`}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {[
                  ['afl_sc_avg', 'SC'], ['afl_disposals', 'DIS'], ['afl_contested_possessions', 'CP'], ['afl_clearances', 'CLR'],
                  ['afl_marks', 'MRK'], ['afl_goals', 'GLS'], ['afl_tackles', 'TKL'], ['afl_hitouts', 'HO'],
                ].map(([key, label]) => {
                  const val = prediction.predicted_afl[key]
                  if (val == null || (Math.round(val) === 0 && !['afl_goals'].includes(key))) return null
                  return (
                    <div key={key} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: key === 'afl_sc_avg' ? '#58a6ff' : '#c9d1d9' }}>{fmt(val)}</div>
                      <div style={{ fontSize: '.48rem', color: '#484f58', textTransform: 'uppercase' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3-year outlook — compact row */}
          {prediction && Object.keys(prediction.projections).length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {Object.entries(prediction.projections).map(([key, proj]) => (
                <div key={key} style={{ flex: 1, textAlign: 'center', padding: '8px 4px',
                  background: 'rgba(255,255,255,.02)', border: '1px solid rgba(48,54,61,.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: '.55rem', color: '#6e7681', marginBottom: 2 }}>{proj.year} · age {proj.age}</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 800, color: '#58a6ff' }}>{Math.round(proj.afl_sc_avg)}</div>
                  <div style={{ fontSize: '.48rem', color: '#484f58' }}>SC AVG</div>
                </div>
              ))}
            </div>
          )}

          {/* State league stats — compact grid */}
          <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase',
            letterSpacing: '.5px', marginBottom: 6 }}>
            {player.competition.toUpperCase()} {player.season} Averages
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(55px, 1fr))', gap: 4, marginBottom: 14 }}>
            {DETAIL_STATS.map(([key, label]) => {
              const val = player[key as keyof SLPlayer] as number
              if (val == null) return null
              return (
                <div key={key as string} style={{ textAlign: 'center', padding: '4px 2px' }}>
                  <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#c9d1d9' }}>{typeof val === 'number' && val % 1 ? val.toFixed(1) : val}</div>
                  <div style={{ fontSize: '.45rem', color: '#484f58', textTransform: 'uppercase' }}>{label}</div>
                </div>
              )
            })}
          </div>

          {/* Career */}
          {career && career.length >= 1 && (() => {
            const merged: Record<number, { season: number; afl_fan?: number; sl_fan?: number; afl_sc?: number; afl_gm?: number; sl_gm?: number; sl_level?: string; afl_team?: string; sl_team?: string }> = {}
            for (const h of career) {
              if (!merged[h.season]) merged[h.season] = { season: h.season }
              if (h.level === 'AFL') { merged[h.season].afl_fan = h.sc_avg ?? undefined; merged[h.season].afl_sc = h.sc_avg ?? undefined; merged[h.season].afl_gm = h.matches; merged[h.season].afl_team = h.team ?? undefined }
              else { merged[h.season].sl_fan = h.dreamteam_avg ?? undefined; merged[h.season].sl_gm = h.matches; merged[h.season].sl_level = h.level; merged[h.season].sl_team = h.team ?? undefined }
            }
            const chartData = Object.values(merged).sort((a, b) => a.season - b.season)
            const barSize = chartData.length <= 2 ? 28 : chartData.length <= 4 ? 22 : 18
            const chartWidth = chartData.length <= 3 ? Math.max(chartData.length * 80, 180) : undefined
            return (
              <>
                <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase',
                  letterSpacing: '.5px', marginBottom: 6 }}>Career</div>
                {chartData.length > 1 && (
                  <>
                    <div style={{ height: 150, display: 'flex', justifyContent: chartWidth ? 'center' : undefined }}>
                      <ResponsiveContainer width={chartWidth ?? '100%'} height="100%">
                        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barGap={2} barCategoryGap="30%">
                          <XAxis dataKey="season" stroke="#484f58" fontSize={10} tickLine={false} axisLine={{ stroke: '#21262d' }} />
                          <YAxis stroke="#484f58" fontSize={9} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{ fill: 'rgba(88,166,255,.08)', radius: 4 }} content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const d = payload[0]?.payload
                            if (!d) return null
                            return (
                              <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '8px 12px', fontSize: '.72rem' }}>
                                <div style={{ fontWeight: 800, color: '#f0f3f6', marginBottom: 4 }}>{d.season}</div>
                                {d.afl_fan != null && <div style={{ color: '#bc8cff' }}>AFL: {Math.round(d.afl_fan)} fantasy · {d.afl_gm}gm</div>}
                                {d.sl_fan != null && <div style={{ color: '#58a6ff' }}>{d.sl_level || 'VFL'}: {Math.round(d.sl_fan)} fantasy · {d.sl_gm}gm</div>}
                              </div>
                            )
                          }} />
                          <Bar dataKey="sl_fan" fill="#58a6ff" fillOpacity={0.7} radius={[3, 3, 0, 0]} barSize={barSize} name="SL Fantasy" />
                          <Bar dataKey="afl_fan" fill="#bc8cff" fillOpacity={0.7} radius={[3, 3, 0, 0]} barSize={barSize} name="AFL Fantasy" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4, marginBottom: 10, fontSize: '.6rem', color: '#6e7681' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#58a6ff', opacity: .7 }}></span> State League
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#bc8cff', opacity: .7 }}></span> AFL
                      </span>
                    </div>
                  </>
                )}
                {/* Season-by-season breakdown */}
                <div style={{ fontSize: '.7rem', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(48,54,61,.3)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '62px 1fr 32px 38px 32px 32px 32px 32px 38px', gap: 0,
                    padding: '5px 8px', background: '#161b22', color: '#6e7681', fontSize: '.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
                    <span>Year</span><span>Team</span><span style={{ textAlign: 'right' }}>GM</span>
                    <span style={{ textAlign: 'right' }}>DIS</span><span style={{ textAlign: 'right' }}>MRK</span>
                    <span style={{ textAlign: 'right' }}>TKL</span><span style={{ textAlign: 'right' }}>GLS</span>
                    <span style={{ textAlign: 'right' }}>HO</span><span style={{ textAlign: 'right' }}>FAN</span>
                  </div>
                  {career.map((s, i) => {
                    const isAfl = s.level === 'AFL'
                    const fan = s.sc_avg ?? s.dreamteam_avg
                    return (
                      <div key={i} style={{ display: 'grid', gridTemplateColumns: '62px 1fr 32px 38px 32px 32px 32px 32px 38px', gap: 0,
                        padding: '4px 8px', borderTop: '1px solid rgba(48,54,61,.15)',
                        background: isAfl ? 'rgba(188,140,255,.04)' : 'transparent' }}>
                        <span style={{ fontWeight: 700, color: isAfl ? '#bc8cff' : '#58a6ff', fontSize: '.65rem' }}>
                          {s.level} {s.season}
                        </span>
                        <span style={{ color: '#8b949e', fontSize: '.65rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.team}
                        </span>
                        <span style={{ textAlign: 'right', color: '#c9d1d9', fontWeight: 600 }}>{s.matches}</span>
                        <span style={{ textAlign: 'right', color: '#c9d1d9' }}>{s.disposals != null ? (typeof s.disposals === 'number' && s.disposals % 1 ? s.disposals.toFixed(1) : s.disposals) : '—'}</span>
                        <span style={{ textAlign: 'right', color: '#c9d1d9' }}>{s.marks != null ? (typeof s.marks === 'number' && s.marks % 1 ? s.marks.toFixed(1) : s.marks) : '—'}</span>
                        <span style={{ textAlign: 'right', color: '#c9d1d9' }}>{s.tackles != null ? (typeof s.tackles === 'number' && s.tackles % 1 ? s.tackles.toFixed(1) : s.tackles) : '—'}</span>
                        <span style={{ textAlign: 'right', color: '#c9d1d9' }}>{s.goals != null ? (typeof s.goals === 'number' && s.goals % 1 ? s.goals.toFixed(1) : s.goals) : '—'}</span>
                        <span style={{ textAlign: 'right', color: '#c9d1d9' }}>{s.hitouts != null && s.hitouts > 0 ? (typeof s.hitouts === 'number' && s.hitouts % 1 ? s.hitouts.toFixed(1) : s.hitouts) : '—'}</span>
                        <span style={{ textAlign: 'right', fontWeight: 800, color: isAfl ? '#bc8cff' : '#58a6ff' }}>
                          {fan != null ? Math.round(fan as number) : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}

          {/* Profile link */}
          {player.player_id && (
            <a href={`/player/${encodeURIComponent(player.player_name)}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: 10, borderRadius: 10, marginTop: 14,
                background: 'rgba(88,166,255,.06)', border: '1px solid rgba(88,166,255,.15)',
                color: '#58a6ff', fontSize: '.78rem', fontWeight: 700, textDecoration: 'none' }}>
              <i className="bi bi-person-lines-fill"></i>Full Profile
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
  const [teamFilter, setTeamFilter] = useState('')
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
    if (teamFilter) params.set('team', teamFilter)
    params.set('sort', sort)
    params.set('dir', dir)
    params.set('page', String(page))
    params.set('mode', mode)
    fetch(`/api/leagues/${leagueId}/state-league-stats?${params}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leagueId, comp, season, aflOnly, search, teamFilter, sort, dir, page, mode])

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
            style={{ minWidth: 140 }} />
          <select value={teamFilter} onChange={e => { setTeamFilter(e.target.value); setPage(1) }}>
            <option value="">All Teams</option>
            {data && [...new Set(data.players.map(p => p.team))].filter(Boolean).sort().map(t =>
              <option key={t} value={t}>{t}</option>
            )}
          </select>
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
                    <th className="scout-hide-mob" style={{ textAlign: 'left', minWidth: 60 }}>Owner</th>
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
                      <td className="scout-hide-mob" style={{ textAlign: 'left', fontSize: '.7rem' }}>
                        {p.coach ? (
                          <span style={{ color: '#d29922', fontWeight: 600 }}>{p.coach}</span>
                        ) : (
                          <span style={{ color: '#30363d', fontSize: '.65rem' }}>FA</span>
                        )}
                      </td>
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
