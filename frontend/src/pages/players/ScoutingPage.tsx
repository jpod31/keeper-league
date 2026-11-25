import { useParams } from 'react-router'
import { useState, useEffect, useCallback } from 'react'
import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts'
import { Spinner } from '../../components/ui/Spinner'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'
import { usePageState } from '../../lib/pageMemory'

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
  potential: number | null
}

interface CareerSeason {
  level: string; season: number; team: string; age: number | null; matches: number
  kicks: number; handballs: number; disposals: number; marks: number
  goals: number; tackles: number; hitouts: number
  contested_possessions: number; clearances: number; inside_fifties: number
  intercepts: number; disposal_efficiency: number; dreamteam_avg: number | null
  sc_avg?: number | null; contested_marks: number; score_involvements: number
}

interface TeamColour { bg: string; fg: string }
interface PageData { players: SLPlayer[]; total: number; page: number; pages: number; teams: string[]; sl_logos: Record<string, string>; team_logos: Record<string, string>; team_colours: Record<string, TeamColour> }

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
.scout-title { color: #f2f2f4; font-weight: 800; font-size: 1.1rem; display: flex; align-items: center; gap: 8px; }
.scout-title i { color: #ececf6; }
.scout-count { font-size: .8125rem; color: var(--kl-text-primary); font-weight: 400; }
.scout-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
.scout-filters select, .scout-filters input {
  background: #0e0d0f; border: 1px solid #2a292f; color: var(--kl-text-primary); border-radius: 8px;
  padding: 8px 12px; font-size: .82rem; outline: none; transition: border-color .15s;
}
.scout-filters select:focus, .scout-filters input:focus { border-color: #ececf6; }
.scout-toggle { display: flex; align-items: center; gap: 6px; font-size: .8125rem; color: var(--kl-text-primary); cursor: pointer; }
.scout-toggle input { accent-color: #ececf6; }

.scout-tbl-wrap { overflow-x: auto; border: 1px solid #1e1d21; border-radius: 12px; background: #0e0d0f; }
.scout-tbl { width: 100%; border-collapse: collapse; font-size: .8125rem; }
.scout-tbl th { background: #151518; color: var(--kl-text-primary); font-size: .8125rem;
  text-transform: uppercase; letter-spacing: .5px; padding: 10px 8px; text-align: right;
  cursor: pointer; user-select: none; white-space: nowrap; border-bottom: 1px solid #1e1d21; }
.scout-tbl th:first-child { text-align: left; padding-left: 14px; border-radius: 12px 0 0 0; }
.scout-tbl th:nth-child(2) { text-align: center; }
.scout-tbl th:last-child { border-radius: 0 12px 0 0; }
.scout-tbl th:hover { color: #f2f2f4; }
.scout-tbl th.sorted { color: #ececf6; }
.scout-tbl th .sort-arrow { font-size: .8125rem; margin-left: 2px; }
.scout-tbl td { padding: 8px 8px; border-bottom: 1px solid rgba(42,41,47,.25); color: var(--kl-text-primary);
  text-align: right; font-variant-numeric: tabular-nums; }
.scout-tbl td:first-child { text-align: left; padding-left: 14px; }
.scout-tbl td:nth-child(2) { text-align: center; }
.scout-tbl tr { cursor: pointer; transition: background .1s; }
.scout-tbl tr:hover td { background: rgba(236,236,246,.05); }
.scout-tbl tr.selected td { background: rgba(236,236,246,.08); }
.scout-tbl tr:last-child td:first-child { border-radius: 0 0 0 12px; }
.scout-tbl tr:last-child td:last-child { border-radius: 0 0 12px 0; }

.scout-player-info { display: flex; align-items: center; gap: 10px; }
.scout-player-info .scout-text { display: flex; flex-direction: column; gap: 2px; }
.scout-logo { width: 28px; height: 28px; object-fit: contain; flex-shrink: 0; border-radius: 4px; }
.scout-logo-placeholder { width: 28px; height: 28px; flex-shrink: 0; border-radius: 4px;
  background: #1e1d21; display: flex; align-items: center; justify-content: center; color: var(--kl-text-primary); font-size: .8125rem; }
.scout-name { font-weight: 700; color: #f2f2f4; font-size: .82rem; }
.scout-meta { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; }
.scout-afl-badge { font-size: .8125rem; color: #ececf6; font-weight: 600; }
.scout-comp-badge { font-size: .8125rem; color: var(--kl-text-primary); text-transform: uppercase; background: rgba(160,160,172,.1);
  padding: 1px 5px; border-radius: 3px; font-weight: 600; }
.pos-pill { font-size: .8125rem; padding: 1px 5px; border-radius: 4px; font-weight: 700; }
.pos-pill.def { background: #58a6ff; color: #050506; }
.pos-pill.mid { background: #bc8cff; color: #050506; }
.pos-pill.fwd { background: #f0883e; color: #050506; }
.pos-pill.ruc { background: #3fb950; color: #050506; }
.unlisted-badge { font-size: .8125rem; padding: 1px 5px; border-radius: 4px; font-weight: 600;
  background: rgba(160,160,172,.1); color: var(--kl-text-primary); }
.listed-badge { font-size: .8125rem; padding: 1px 5px; border-radius: 4px; font-weight: 600;
  background: rgba(63,185,80,.1); color: #3fb950; }

.scout-gp { display: inline-flex; align-items: center; justify-content: center;
  min-width: 28px; padding: 2px 6px; border-radius: 6px; font-weight: 700; font-size: .8125rem;
  background: rgba(236,236,246,.08); color: var(--kl-text-primary); }

.scout-pagination { display: flex; justify-content: center; gap: 4px; margin-top: 14px; }
.scout-pagination button { background: #151518; border: 1px solid #2a292f; color: var(--kl-text-primary);
  border-radius: 6px; padding: 5px 10px; font-size: .8125rem; cursor: pointer; transition: all .15s; }
.scout-pagination button:hover:not(:disabled) { border-color: #ececf6; color: var(--kl-text-primary); }
.scout-pagination button:disabled { opacity: .3; cursor: default; }
.scout-pagination button.active { background: #ececf6; color: #0e0d0f; border-color: #ececf6; font-weight: 700; }

/* Detail panel */
.scout-detail-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.65); backdrop-filter: blur(6px);
  z-index: 1055; }
.scout-detail { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  z-index: 1060; width: 94%; max-width: 560px; max-height: 88vh;
  background: linear-gradient(165deg, #1d1c21 0%, #151417 100%);
  border-radius: 16px; border: 1px solid rgba(42,41,47,.4);
  box-shadow: 0 24px 80px rgba(0,0,0,.7); overflow-y: auto; }
.scout-detail-inner { padding: 20px; }
.scout-detail-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.scout-detail-name { font-size: 1.25rem; font-weight: 900; color: #f2f2f4; letter-spacing: -.02em; }
.scout-detail-sub { font-size: .8125rem; color: var(--kl-text-primary); margin-top: 3px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.scout-detail-close { background: rgba(255,255,255,.05); border: none; color: var(--kl-text-primary); font-size: 1rem;
  cursor: pointer; padding: 6px 8px; border-radius: 8px; }
.scout-detail-section { font-size: .8125rem; font-weight: 700; color: var(--kl-text-primary); text-transform: uppercase;
  letter-spacing: .5px; margin-bottom: 8px; margin-top: 18px; }
.scout-detail-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); gap: 5px; }
.scout-stat-cell { text-align: center; padding: 6px 3px; background: rgba(255,255,255,.02);
  border-radius: 6px; border: 1px solid rgba(42,41,47,.25); }
.scout-stat-val { font-size: .85rem; font-weight: 800; color: #d3d2da; }
.scout-stat-label { font-size: .8125rem; color: var(--kl-text-primary); text-transform: uppercase; letter-spacing: .3px; margin-top: 1px; }
.scout-history-row { display: grid; grid-template-columns: 80px 1fr 50px; gap: 8px; align-items: center;
  padding: 8px 0; border-bottom: 1px solid rgba(42,41,47,.2); font-size: .8125rem; }
.scout-history-season { font-weight: 700; color: #f2f2f4; }
.scout-history-team { color: var(--kl-text-primary); font-size: .8125rem; }
.scout-history-disp { font-weight: 700; color: #ececf6; text-align: right; }
.scout-trend-up { color: #3fb950; }
.scout-trend-down { color: #f85149; }

.scout-tag { font-size: .8125rem; font-weight: 700; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
@media(max-width:768px) {
  .scout-tbl { font-size: .8125rem; }
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
  'tag-emerging': ['rgba(236,236,246,.15)', '#ececf6'],
  'tag-developing': ['rgba(236,236,246,.1)', '#ececf6'],
  'tag-watch': ['rgba(210,153,34,.15)', '#d29922'],
  'tag-radar': ['rgba(210,153,34,.1)', '#d29922'],
  'tag-veteran': ['rgba(160,160,172,.08)', '#ececf1'],
  'tag-depth': ['rgba(160,160,172,.1)', '#ececf1'],
  'tag-fringe': ['rgba(160,160,172,.08)', '#ececf1'],
  'tag-dev': ['rgba(160,160,172,.08)', '#ececf1'],
}

function PlayerDetail({ player, leagueId, onClose, logos }: { player: SLPlayer; leagueId: string; onClose: () => void; logos: Record<string, string> }) {
  const [career, setCareer] = useState<CareerSeason[] | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)

  useEffect(() => {
    // Career by name, works for ALL players, not just AFL-linked ones
    fetch(`/api/leagues/${leagueId}/state-league-stats/career-by-name?name=${encodeURIComponent(player.player_name)}`)
      .then(r => r.json()).then(setCareer).catch(() => {})
    fetch(`/api/leagues/${leagueId}/scouting/predict/${player.id}`)
      .then(r => r.ok ? r.json() : null).then(setPrediction).catch(() => {})
  }, [player.player_name, player.id, leagueId])

  const fmt = (v: number | null | undefined) => v == null ? '-' : typeof v === 'number' ? (v % 1 ? v.toFixed(1) : String(Math.round(v))) : '-'
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
                <div style={{ width: 36, height: 36, borderRadius: 6, background: '#1e1d21', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--kl-text-primary)', flexShrink: 0 }}>
                  <i className="bi bi-shield-fill"></i>
                </div>
              )}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="scout-detail-name">{player.player_name}</span>
                  {prediction && (
                    <span style={{ fontSize: '.8125rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: tagCol[0], color: tagCol[1] }}>
                      {prediction.tag}
                    </span>
                  )}
                </div>
                <div className="scout-detail-sub">
                  {player.position && player.position.split('/').map(ps => <span key={ps} className={`pos-badge badge-${ps.toLowerCase()}`}>{ps}</span>)}
                  <span>{player.team}, {player.competition.toUpperCase()}</span>
                  {player.afl_team && <span style={{ color: '#ececf6' }}>{player.afl_team}</span>}
                  {player.age && <span>{player.age}yo</span>}
                  <span>{player.matches}gm</span>
                  {player.coach && <span style={{ color: '#d29922', fontWeight: 600 }}>Owned: {player.coach}</span>}
                </div>
              </div>
            </div>
            <button className="scout-detail-close" onClick={onClose}><i className="bi bi-x-lg"></i></button>
          </div>

          {/* Projected AFL output, the hero section */}
          {prediction && (
            <div style={{ background: 'rgba(236,236,246,.04)', border: '1px solid rgba(236,236,246,.12)',
              borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: '.8125rem', fontWeight: 700, color: 'var(--kl-text-primary)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  Projected AFL Output
                </span>
                <span style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)' }}>
                  {prediction.breakout_probability > 0 && `${prediction.breakout_probability}% breakout`}
                  {prediction.draft_probability != null && prediction.draft_probability > 0 && `, ${prediction.draft_probability}% draft chance`}
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
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: key === 'afl_sc_avg' ? '#ececf6' : '#ececf1' }}>{fmt(val)}</div>
                      <div style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)', textTransform: 'uppercase' }}>{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3-year outlook, compact row */}
          {prediction && Object.keys(prediction.projections).length > 0 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
              {Object.entries(prediction.projections).map(([key, proj]) => (
                <div key={key} style={{ flex: 1, textAlign: 'center', padding: '8px 4px',
                  background: 'rgba(255,255,255,.02)', border: '1px solid rgba(42,41,47,.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)', marginBottom: 2 }}>{proj.year}, age {proj.age}</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 800, color: '#ececf6' }}>{Math.round(proj.afl_sc_avg)}</div>
                  <div style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)' }}>SC AVG</div>
                </div>
              ))}
            </div>
          )}

          {/* State league stats, compact grid */}
          <div style={{ fontSize: '.8125rem', fontWeight: 700, color: 'var(--kl-text-primary)', textTransform: 'uppercase',
            letterSpacing: '.5px', marginBottom: 6 }}>
            {player.competition.toUpperCase()} {player.season} Averages
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(55px, 1fr))', gap: 4, marginBottom: 14 }}>
            {DETAIL_STATS.map(([key, label]) => {
              const val = player[key as keyof SLPlayer] as number
              if (val == null) return null
              return (
                <div key={key as string} style={{ textAlign: 'center', padding: '4px 2px' }}>
                  <div style={{ fontSize: '.8125rem', fontWeight: 700, color: 'var(--kl-text-primary)' }}>{typeof val === 'number' && val % 1 ? val.toFixed(1) : val}</div>
                  <div style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)', textTransform: 'uppercase' }}>{label}</div>
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
                <div style={{ fontSize: '.8125rem', fontWeight: 700, color: 'var(--kl-text-primary)', textTransform: 'uppercase',
                  letterSpacing: '.5px', marginBottom: 6 }}>Career</div>
                {chartData.length > 1 && (
                  <>
                    <div style={{ height: 150, display: 'flex', justifyContent: chartWidth ? 'center' : undefined }}>
                      <ResponsiveContainer width={chartWidth ?? '100%'} height="100%">
                        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barGap={2} barCategoryGap="30%">
                          <XAxis dataKey="season" stroke="#63616d" fontSize={13} tickLine={false} axisLine={{ stroke: '#1e1d21' }} />
                          <YAxis stroke="#63616d" fontSize={13} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{ fill: 'rgba(236,236,246,.08)', radius: 4 }} content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const d = payload[0]?.payload
                            if (!d) return null
                            return (
                              <div style={{ background: '#0e0d0f', border: '1px solid #2a292f', borderRadius: 8, padding: '8px 12px', fontSize: '.8125rem' }}>
                                <div style={{ fontWeight: 800, color: '#f2f2f4', marginBottom: 4 }}>{d.season}</div>
                                {d.afl_fan != null && <div style={{ color: '#bc8cff' }}>AFL: {Math.round(d.afl_fan)} fantasy, {d.afl_gm}gm</div>}
                                {d.sl_fan != null && <div style={{ color: '#ececf6' }}>{d.sl_level || 'VFL'}: {Math.round(d.sl_fan)} fantasy, {d.sl_gm}gm</div>}
                              </div>
                            )
                          }} />
                          <Bar dataKey="sl_fan" fill="#ececf6" fillOpacity={0.7} radius={[3, 3, 0, 0]} barSize={barSize} name="SL Fantasy" />
                          <Bar dataKey="afl_fan" fill="#bc8cff" fillOpacity={0.7} radius={[3, 3, 0, 0]} barSize={barSize} name="AFL Fantasy" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4, marginBottom: 10, fontSize: '.8125rem', color: 'var(--kl-text-primary)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#ececf6', opacity: .7 }}></span> State League
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: '#bc8cff', opacity: .7 }}></span> AFL
                      </span>
                    </div>
                  </>
                )}
                {/* Season-by-season breakdown */}
                <div style={{ fontSize: '.8125rem', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(42,41,47,.3)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '62px 1fr 32px 38px 32px 32px 32px 32px 38px', gap: 0,
                    padding: '5px 8px', background: '#151518', color: 'var(--kl-text-primary)', fontSize: '.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>
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
                        padding: '4px 8px', borderTop: '1px solid rgba(42,41,47,.15)',
                        background: isAfl ? 'rgba(188,140,255,.04)' : 'transparent' }}>
                        <span style={{ fontWeight: 700, color: isAfl ? '#bc8cff' : '#ececf6', fontSize: '.8125rem' }}>
                          {s.level} {s.season}
                        </span>
                        <span style={{ color: 'var(--kl-text-primary)', fontSize: '.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.team}
                        </span>
                        <span style={{ textAlign: 'right', color: 'var(--kl-text-primary)', fontWeight: 600 }}>{s.matches}</span>
                        <span style={{ textAlign: 'right', color: 'var(--kl-text-primary)' }}>{s.disposals != null ? (typeof s.disposals === 'number' && s.disposals % 1 ? s.disposals.toFixed(1) : s.disposals) : '-'}</span>
                        <span style={{ textAlign: 'right', color: 'var(--kl-text-primary)' }}>{s.marks != null ? (typeof s.marks === 'number' && s.marks % 1 ? s.marks.toFixed(1) : s.marks) : '-'}</span>
                        <span style={{ textAlign: 'right', color: 'var(--kl-text-primary)' }}>{s.tackles != null ? (typeof s.tackles === 'number' && s.tackles % 1 ? s.tackles.toFixed(1) : s.tackles) : '-'}</span>
                        <span style={{ textAlign: 'right', color: 'var(--kl-text-primary)' }}>{s.goals != null ? (typeof s.goals === 'number' && s.goals % 1 ? s.goals.toFixed(1) : s.goals) : '-'}</span>
                        <span style={{ textAlign: 'right', color: 'var(--kl-text-primary)' }}>{s.hitouts != null && s.hitouts > 0 ? (typeof s.hitouts === 'number' && s.hitouts % 1 ? s.hitouts.toFixed(1) : s.hitouts) : '-'}</span>
                        <span style={{ textAlign: 'right', fontWeight: 800, color: isAfl ? '#bc8cff' : '#ececf6' }}>
                          {fan != null ? Math.round(fan as number) : '-'}
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
                background: 'rgba(236,236,246,.06)', border: '1px solid rgba(236,236,246,.15)',
                color: '#ececf6', fontSize: '.8125rem', fontWeight: 700, textDecoration: 'none' }}>
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
  const [comp, setComp] = usePageState('comp', '')
  const [season, setSeason] = usePageState<number | ''>('season', '')
  const [aflOnly, setAflOnly] = usePageState('aflOnly', true)
  const [search, setSearch] = usePageState('search', '')
  const [teamFilter, setTeamFilter] = usePageState('teamFilter', '')
  const [sort, setSort] = usePageState('sort', 'disposals')
  const [dir, setDir] = usePageState<'desc' | 'asc'>('dir', 'desc')
  const [page, setPage] = usePageState('page', 1)
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = usePageState<SLPlayer | null>('selected', null)
  const [mode, setMode] = usePageState<'avg' | 'total'>('mode', 'avg')

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
    // Don't fetch until we have a season set (wait for comps to load)
    if (!season) return
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
  }, [leagueId, comp, season, aflOnly, search, teamFilter, sort, dir, page, mode, comps.length])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleSort = (col: string) => {
    if (sort === col) setDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSort(col); setDir('desc') }
    setPage(1)
  }

  const fmt = (v: number | null, dec: number) => v == null ? '-' : dec ? v.toFixed(dec) : Math.round(v).toString()

  return (
    <>
      <style>{CSS}</style>
      <PlayersSubnav active="scouting" leagueId={leagueId!} />
      <div className="scout-wrap">
        <div className="scout-header">
          <div className="page-header" style={{ marginBottom: 0 }}>
            <h2>State league scouting</h2>
            {data && <p className="pool-line">{data.total} players</p>}
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
            {data?.teams?.map(t =>
              <option key={t} value={t}>{t}</option>
            )}
          </select>
          <label className="scout-toggle">
            <input type="checkbox" checked={aflOnly} onChange={e => { setAflOnly(e.target.checked); setPage(1) }} />
            AFL-listed only
          </label>
          <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #2a292f', overflow: 'hidden', marginLeft: 'auto' }}>
            <button onClick={() => setMode('avg')}
              style={{ padding: '6px 12px', fontSize: '.8125rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                background: mode === 'avg' ? '#ececf6' : '#0e0d0f', color: mode === 'avg' ? '#0e0d0f' : '#ececf1' }}>
              AVG
            </button>
            <button onClick={() => setMode('total')}
              style={{ padding: '6px 12px', fontSize: '.8125rem', fontWeight: 600, border: 'none', cursor: 'pointer',
                borderLeft: '1px solid #2a292f',
                background: mode === 'total' ? '#ececf6' : '#0e0d0f', color: mode === 'total' ? '#0e0d0f' : '#ececf1' }}>
              TOT
            </button>
          </div>
        </div>

        {loading ? <Spinner text="Loading state league stats..." /> : !data?.players.length ? (
          <p style={{ color: 'var(--kl-text-primary)', textAlign: 'center', padding: 40 }}>No data found.</p>
        ) : (
          <>
            <div className="scout-tbl-wrap">
              <table className="scout-tbl">
                <thead>
                  <tr>
                    <th className={sort === 'player_name' ? 'sorted' : ''} onClick={() => toggleSort('player_name')}>
                      Player {sort === 'player_name' && <span className="sort-arrow">{dir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    <th className="scout-hide-mob" style={{ textAlign: 'right', width: 36 }}>Rtg</th>
                    <th className="scout-hide-mob" style={{ textAlign: 'right', width: 36 }}>Pot</th>
                    <th className={sort === 'matches' ? 'sorted' : ''} onClick={() => toggleSort('matches')} style={{ textAlign: 'center' }}>
                      GP {sort === 'matches' && <span className="sort-arrow">{dir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                    {STAT_COLS.map(([key, label]) => (
                      <th key={key as string} className={`${sort === key ? 'sorted' : ''} scout-hide-mob`}
                        onClick={() => toggleSort(key as string)}>
                        {label} {sort === key && <span className="sort-arrow">{dir === 'asc' ? '▲' : '▼'}</span>}
                      </th>
                    ))}
                    <th className="scout-hide-mob" style={{ textAlign: 'center', minWidth: 70 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map(p => {
                    const tc = p.fantasy_team ? data.team_colours?.[p.fantasy_team] : null
                    return (
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
                              {p.position && p.position.split('/').map(ps => <span key={ps} className={`pos-badge badge-${ps.toLowerCase()}`}>{ps}</span>)}
                              {p.is_afl_listed && p.afl_team && <span className="scout-afl-badge">{p.afl_team}</span>}
                              {!p.is_afl_listed && <span className="unlisted-badge">Unlisted</span>}
                              <span className="scout-comp-badge">{p.team}, {p.competition.toUpperCase()}</span>
                              {p.age && <span style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)' }}>{p.age}yo</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="scout-hide-mob" style={{ textAlign: 'right' }}>
                        {p.rating ? <span style={{ color: 'var(--kl-text-primary)', fontWeight: 600 }}>{p.rating}</span> : <span style={{ color: 'var(--kl-text-primary)' }}>-</span>}
                      </td>
                      <td className="scout-hide-mob" style={{ textAlign: 'right' }}>
                        {p.potential ? <span style={{ color: 'var(--kl-text-primary)', fontWeight: 600 }}>{p.potential}</span> : <span style={{ color: 'var(--kl-text-primary)' }}>-</span>}
                      </td>
                      <td><span className="scout-gp">{p.matches ?? '-'}</span></td>
                      {STAT_COLS.map(([key, , dec]) => (
                        <td key={key as string} className="scout-hide-mob">{fmt(p[key] as number, dec)}</td>
                      ))}
                      <td className="scout-hide-mob" style={{ textAlign: 'center' }}>
                        {p.fantasy_team ? (
                          <span style={{ fontSize: '.8125rem', fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                            whiteSpace: 'nowrap', background: tc?.bg || '#1e1d21', color: tc?.fg || '#ececf1' }}>
                            {p.fantasy_team}
                          </span>
                        ) : (
                          <span style={{ fontSize: '.8125rem', fontWeight: 600, color: '#3fb950' }}>FA</span>
                        )}
                      </td>
                    </tr>
                  )})}
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
