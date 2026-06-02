import { useParams, Link, useNavigate } from 'react-router'
import { useState, useMemo, useRef, useLayoutEffect, useEffect, lazy, Suspense } from 'react'
const ValueCloud3D = lazy(() => import('./ValueCloud3D'))
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  ReferenceArea, Tooltip, BarChart, Bar, Cell, LabelList, LineChart, Line, ComposedChart,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  AreaChart, Area, ReferenceLine,
} from 'recharts'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { TeamMobSubnav } from '../../components/nav/TeamMobSubnav'
import { CommandDeck } from './CommandDeck'

interface Player {
  id: number
  name: string
  position: string
  afl_team: string
  age: number | null
  sc_avg: number
  sc_avg_prev: number | null
  career_games: number
  games_played: number
  draft_score: number | null
  rating: number | null
  potential: number | null
  keeper_value: number | null
  height_cm: number | null
  cba_pct: number | null
  cba_trend: number | null
  injury_severity: string | null
}

interface StatsData {
  league: { id: number; name: string }
  team: { id: number; name: string; logo_url: string | null }
  players: Player[]
  total_sc: number
  avg_age: number
  position_counts: Record<string, number>
}

const POS_COLOR: Record<string, string> = {
  DEF: '#58a6ff', MID: '#bc8cff', FWD: '#f0883e', RUC: '#3fb950',
}
function posCode(pos: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}
interface DraftRoiData {
  has_data: boolean
  team: { player_id: number; name: string; position: string; pick: number; value: number; expected: number; residual: number; verdict: string }[]
  curve: { pick: number; expected: number }[]
  resid_sd: number
}
const VERDICT_COLOR: Record<string, string> = { steal: '#4ec77a', fair: '#5aa0ff', bust: '#ef6b5e' }

// ── Watchlist auto-flags (Idea #29) — derived purely from available fields ──
type FlagKey = 'sellHigh' | 'buyLow' | 'breakout' | 'decline' | 'injury' | 'keep' | 'roleRiser' | 'roleFaller'
interface FlagDef { key: FlagKey; label: string; icon: string; color: string; test: (p: Player) => boolean; reason: (p: Player) => string }
const FLAGS: FlagDef[] = [
  { key: 'keep', label: 'Keep locks', icon: 'bi-shield-fill-check', color: '#a98bff',
    test: p => (p.keeper_value ?? 0) >= 80,
    reason: p => `Keeper Value ${Math.round(p.keeper_value!)}` },
  { key: 'breakout', label: 'Breakout watch', icon: 'bi-rocket-takeoff-fill', color: '#3fc4c4',
    test: p => (p.age ?? 99) <= 23 && p.potential != null && p.rating != null && (p.potential - p.rating) >= 6,
    reason: p => `Age ${p.age}, +${p.potential! - p.rating!} rating runway` },
  { key: 'roleRiser', label: 'Role riser', icon: 'bi-arrow-up-right-circle-fill', color: '#bc8cff',
    test: p => (p.cba_pct ?? 0) >= 25 && (p.cba_trend ?? 0) >= 12,
    reason: p => `CBA +${p.cba_trend} recent — winning more midfield time` },
  { key: 'roleFaller', label: 'Role faller', icon: 'bi-arrow-down-right-circle-fill', color: '#d2884f',
    test: p => (p.cba_pct ?? 0) >= 25 && (p.cba_trend ?? 0) <= -12,
    reason: p => `CBA ${p.cba_trend} recent — losing midfield time` },
  { key: 'sellHigh', label: 'Sell-high', icon: 'bi-graph-up-arrow', color: '#4ec77a',
    test: p => p.sc_avg_prev != null && p.sc_avg - p.sc_avg_prev >= 12,
    reason: p => `+${(p.sc_avg - p.sc_avg_prev!).toFixed(0)} SC vs last year` },
  { key: 'buyLow', label: 'Buy-low', icon: 'bi-graph-down-arrow', color: '#5aa0ff',
    test: p => p.sc_avg_prev != null && p.sc_avg - p.sc_avg_prev <= -12,
    reason: p => `${(p.sc_avg - p.sc_avg_prev!).toFixed(0)} SC vs last year` },
  { key: 'decline', label: 'Decline risk', icon: 'bi-hourglass-bottom', color: '#e0a93f',
    test: p => (p.age ?? 0) >= 30 && p.sc_avg >= 90,
    reason: p => `Age ${p.age}, ${p.sc_avg.toFixed(0)} SC — sell before the cliff` },
  { key: 'injury', label: 'Injured', icon: 'bi-bandaid-fill', color: '#ef6b5e',
    test: p => p.injury_severity === 'short' || p.injury_severity === 'long',
    reason: () => 'Currently injured' },
]


// ── Squad Intelligence types + cockpit components ──
interface IntelPlayer {
  id: number; name: string; pos: string; primary: string; afl_team: string
  age: number | null; height: number | null; injury: string | null
  rating: number | null; potential: number | null; keeper_value: number | null
  cba_pct: number | null; cba_trend: number | null
  sc_avg: number; sc_prev: number | null; ceiling: number | null; floor: number | null
  consistency: number | null; boom_pct: number | null
  proj: number | null; proj_lo: number | null; proj_hi: number | null
  vorp: number | null; sc_pctile: number | null
  form_z: number; round_form: { round: number; sc: number; z: number }[]
  team_games: number; bench_rounds: number; captain_games: number; sevens_games: number
  emg_activated: number; points_banked: number; contribution_pct: number
}
interface SquadIntel {
  has_data: boolean; team: { id: number; name: string }; replacement: Record<string, number>
  players: IntelPlayer[]
  team_metrics: {
    vorp_total: number; avg_age: number
    depth: Record<string, { count: number; above_repl: number; replacement: number }>
    health: number | null; health_rank: number | null; descriptor: string | null; n_teams: number
  }
  insights: { kind: string; headline: string; detail?: string; player?: number }[]
}

function TheRead({ intel }: { intel: SquadIntel }) {
  const m = intel.team_metrics
  const thin = Object.entries(m.depth).filter(([, d]) => d.count > 0)
    .sort((a, b) => a[1].above_repl - b[1].above_repl)[0]
  // keeper-relevant chips only — never surface niche per-player usage (e.g. CBA) as a team headline
  const chips = intel.insights
    .filter(i => i.kind !== 'window' && !/cba|midfield role/i.test(`${i.headline} ${i.detail || ''}`))
    .slice(0, 3)
  return (
    <div className="si-header">
      <div className="si-header-main">
        <div className="si-window">{m.descriptor || 'Squad overview'}</div>
        <div className="si-chips">
          {chips.map((i, n) => (
            <span key={n} className="si-chip"><i className="bi bi-lightning-charge-fill"></i>{i.headline}{i.detail ? <em> · {i.detail}</em> : ''}</span>
          ))}
        </div>
      </div>
      <div className="si-tiles">
        {m.health_rank != null && m.n_teams > 1 && (
          <div className="si-tile"><div className="si-tile-v">#{m.health_rank}<span style={{ fontSize: '.7rem', color: '#6e7681' }}> of {m.n_teams}</span></div><div className="si-tile-l">League rank</div><div className="si-tile-s">by squad strength</div></div>
        )}
        <div className="si-tile"><div className="si-tile-v">{m.health ?? '–'}</div><div className="si-tile-l">Squad strength</div><div className="si-tile-s">health composite</div></div>
        <div className="si-tile"><div className="si-tile-v">{m.vorp_total}</div><div className="si-tile-l">Squad VORP</div><div className="si-tile-s">value over replacement</div></div>
        <div className="si-tile"><div className="si-tile-v">{m.avg_age}</div><div className="si-tile-l">Avg age</div><div className="si-tile-s">contention window</div></div>
        {thin && <div className="si-tile"><div className="si-tile-v" style={{ color: '#e0a93f' }}>{thin[0]}</div><div className="si-tile-l">Thinnest line</div><div className="si-tile-s">{thin[1].above_repl} above repl</div></div>}
      </div>
    </div>
  )
}

function siFmt(v: number | null | undefined, d = 0): string {
  return v == null ? '–' : d ? v.toFixed(d) : String(Math.round(v))
}
function MicroSpark({ form }: { form: { sc: number; z: number }[] }) {
  const vals = form.map(f => f.sc)
  if (vals.length < 2) return <span style={{ color: '#484f58' }}>–</span>
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1
  const W = 58, H = 18
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / rng) * H}`).join(' ')
  const last = form[form.length - 1]
  const col = last.z >= 0.5 ? '#4ec77a' : last.z <= -0.5 ? '#ef6b5e' : '#8b949e'
  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={W} cy={H - ((vals[vals.length - 1] - min) / rng) * H} r="2" fill={col} />
    </svg>
  )
}
function MiniBar({ value, max, color, signed }: { value: number | null; max: number; color: string; signed?: boolean }) {
  if (value == null) return <span style={{ color: '#484f58' }}>–</span>
  const pct = Math.max(0, Math.min(100, (Math.abs(value) / max) * 100))
  return (
    <div className="si-mx-bar">
      <div className="si-mx-bar-track"><div className="si-mx-bar-fill" style={{ width: `${pct}%`, background: color }}></div></div>
      <span className="si-mx-bar-val" style={signed ? { color } : undefined}>{signed && value > 0 ? '+' : ''}{Math.round(value)}</span>
    </div>
  )
}

type MxCol = { k: string; l: string; align?: string; num: (p: IntelPlayer) => number | null; cell: (p: IntelPlayer) => React.ReactNode }
// One focused value table — the columns that actually inform a keeper decision.
const SQUAD_COLS: MxCol[] = [
  { k: 'sc_avg', l: 'SC avg', align: 'end', num: p => p.sc_avg, cell: p => <b>{siFmt(p.sc_avg, 1)}</b> },
  { k: 'form_z', l: 'Form', align: 'center', num: p => p.form_z, cell: p => <MicroSpark form={p.round_form} /> },
  { k: 'ceiling', l: 'Ceiling', align: 'end', num: p => p.ceiling, cell: p => <span style={{ color: '#a98bff' }}>{siFmt(p.ceiling)}</span> },
  { k: 'floor', l: 'Floor', align: 'end', num: p => p.floor, cell: p => <span style={{ color: '#8b949e' }}>{siFmt(p.floor)}</span> },
  { k: 'boom_pct', l: 'Boom%', align: 'end', num: p => p.boom_pct, cell: p => p.boom_pct == null ? '–' : `${p.boom_pct}%` },
  { k: 'vorp', l: 'VORP', align: 'end', num: p => p.vorp, cell: p => <MiniBar value={p.vorp} max={40} color={(p.vorp ?? 0) >= 0 ? '#4ec77a' : '#ef6b5e'} signed /> },
  { k: 'keeper_value', l: 'Keeper', align: 'end', num: p => p.keeper_value, cell: p => <span style={{ color: (p.keeper_value ?? 0) >= 70 ? '#a98bff' : '#8b949e', fontWeight: 700 }}>{siFmt(p.keeper_value)}</span> },
  { k: 'age', l: 'Age', align: 'center', num: p => p.age, cell: p => p.age ?? '–' },
]

function SquadMatrix({ players, flagMap, activeFlag, compareSet, toggleCompare, onSelect }: {
  players: IntelPlayer[]
  flagMap: Map<number, FlagDef[]>
  activeFlag: FlagKey | null
  compareSet: number[]
  toggleCompare: (id: number) => void
  onSelect: (id: number) => void
}) {
  const [pos, setPos] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState('sc_avg')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const cols = SQUAD_COLS
  const numOf = (p: IntelPlayer, k: string) => cols.find(c => c.k === k)?.num(p) ?? null

  let rows = players.filter(p => !pos || p.primary === pos)
  if (activeFlag) rows = rows.filter(p => flagMap.get(p.id)?.some(f => f.key === activeFlag))
  rows = [...rows].sort((a, b) => {
    const av = numOf(a, sortKey), bv = numOf(b, sortKey)
    const an = av == null ? -Infinity : av, bn = bv == null ? -Infinity : bv
    return sortDir === 'desc' ? bn - an : an - bn
  })
  function sortBy(k: string) {
    if (k === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(k); setSortDir('desc') }
  }
  const ind = (k: string) => k === sortKey ? (sortDir === 'desc' ? ' ▾' : ' ▴') : ''

  // FLIP: smoothly slide rows to their new positions when the sort changes
  const tbodyRef = useRef<HTMLTableSectionElement>(null)
  const prevPos = useRef<Map<number, number>>(new Map())
  useLayoutEffect(() => {
    const tb = tbodyRef.current
    if (!tb) return
    const trs = Array.from(tb.querySelectorAll('tr[data-id]')) as HTMLElement[]
    trs.forEach(r => {
      const id = Number(r.dataset.id)
      const top = r.offsetTop
      const old = prevPos.current.get(id)
      if (old != null && old !== top) {
        r.style.transition = 'none'
        r.style.transform = `translateY(${old - top}px)`
        requestAnimationFrame(() => {
          r.style.transition = 'transform .4s cubic-bezier(.2,.8,.2,1)'
          r.style.transform = ''
        })
      }
    })
    const m = new Map<number, number>()
    trs.forEach(r => m.set(Number(r.dataset.id), r.offsetTop))
    prevPos.current = m
  }, [sortKey, sortDir, pos])

  return (
    <div className="card si-matrix-card">
      <div className="card-header si-mx-head">
        <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
          <i className="bi bi-table me-2" style={{ color: '#8b949e' }}></i>Squad value table
          <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>tap a column to sort · click a player to open</span>
        </h5>
        <div className="si-mx-filter">
          {[null, 'DEF', 'MID', 'FWD', 'RUC'].map(pp => (
            <button key={pp ?? 'all'} className={`si-mx-pos${pos === pp ? ' active' : ''}`} onClick={() => setPos(pp)}>{pp ?? 'All'}</button>
          ))}
        </div>
      </div>
      <div className="card-body p-0" style={{ overflowX: 'auto' }}>
        <table className="si-matrix">
          <thead>
            <tr>
              <th className="si-mx-chk"></th>
              <th className="si-mx-player">Player</th>
              {cols.map(c => <th key={c.k} className={`si-mx-sort text-${c.align || 'end'}`} onClick={() => sortBy(c.k)}>{c.l}{ind(c.k)}</th>)}
            </tr>
          </thead>
          <tbody ref={tbodyRef} className="si-mx-body">
            {rows.map(p => {
              const inC = compareSet.includes(p.id)
              const flags = flagMap.get(p.id) || []
              return (
                <tr key={p.id} data-id={p.id} className={inC ? 'si-mx-row sel' : 'si-mx-row'}>
                  <td className="si-mx-chk"><input type="checkbox" className="stats-cmp-check" checked={inC}
                    disabled={!inC && compareSet.length >= 4} onChange={() => toggleCompare(p.id)} title="Compare" /></td>
                  <td className="si-mx-player" onClick={() => onSelect(p.id)}>
                    <span className={`pos-dot pos-${p.primary}`}></span>
                    <span className="si-mx-name">{p.name}</span>
                    {p.injury && <i className="bi bi-bandaid-fill" style={{ color: '#ef6b5e', fontSize: '.6rem', marginLeft: 4 }}></i>}
                    {flags.map(f => <i key={f.key} className={`bi ${f.icon}`} style={{ color: f.color, fontSize: '.6rem', marginLeft: 3 }} title={f.label}></i>)}
                  </td>
                  {cols.map(c => <td key={c.k} className={`text-${c.align || 'end'}`} onClick={() => onSelect(p.id)}>{c.cell(p)}</td>)}
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="text-secondary" style={{ padding: 20, textAlign: 'center' }}>No players match.</div>}
      </div>
    </div>
  )
}

// ── Scouting Map — signature ECharts scatter (output × reliability) ──
const SM_POS_COLOR: Record<string, string> = { DEF: '#58a6ff', MID: '#bc8cff', FWD: '#f0883e', RUC: '#3fb950' }
function ScoutingMap({ players, onSelect }: { players: IntelPlayer[]; onSelect: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const onSel = useRef(onSelect); onSel.current = onSelect
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const pool = players.filter(p => (p.sc_avg || 0) > 0 && p.consistency != null)
  useEffect(() => {
    if (mode !== '2d' || !ref.current || pool.length === 0) return
    let chart: any = null  // eslint-disable-line @typescript-eslint/no-explicit-any
    let disposed = false
    const onResize = () => chart && chart.resize()
    import('echarts').then(echarts => {
      if (disposed || !ref.current) return
      chart = echarts.init(ref.current, null, { renderer: 'canvas' })
      const xs = pool.map(p => p.sc_avg), ys = pool.map(p => p.consistency as number)
      const xMid = xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]
      const yMid = ys.slice().sort((a, b) => a - b)[Math.floor(ys.length / 2)]
      const series = ['DEF', 'MID', 'FWD', 'RUC'].map(pos => ({
        name: pos, type: 'scatter', emphasis: { focus: 'series', scale: 1.4 },
        symbolSize: (v: number[]) => 9 + Math.max(0, v[2]) * 0.7,
        itemStyle: { color: SM_POS_COLOR[pos], opacity: 0.82, borderColor: 'rgba(0,0,0,.3)' },
        data: pool.filter(p => p.primary === pos).map(p => ({ value: [p.sc_avg, p.consistency, Math.max(0, p.vorp ?? 0)], name: p.name, id: p.id })),
      }))
      chart.setOption({
        backgroundColor: 'transparent',
        legend: { data: ['DEF', 'MID', 'FWD', 'RUC'], textStyle: { color: '#8b949e' }, top: 2, icon: 'circle' },
        grid: { left: 52, right: 22, top: 34, bottom: 44 },
        tooltip: {
          backgroundColor: '#161d27', borderColor: 'rgba(110,130,180,.3)', textStyle: { color: '#e6edf3', fontSize: 12 },
          formatter: (p: { data: { name: string; value: number[] } }) => `<b>${p.data.name}</b><br/>SC ${p.data.value[0]} · consistency ${p.data.value[1]} · VORP +${Math.round(p.data.value[2])}`,
        },
        xAxis: { name: 'SC output ▶', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: '#6e7681', fontSize: 11 }, axisLabel: { color: '#8b949e' }, axisLine: { lineStyle: { color: '#30363d' } }, splitLine: { lineStyle: { color: '#1c2230' } } },
        yAxis: { name: 'reliability ▲', nameLocation: 'middle', nameGap: 34, nameTextStyle: { color: '#6e7681', fontSize: 11 }, axisLabel: { color: '#8b949e' }, axisLine: { lineStyle: { color: '#30363d' } }, splitLine: { lineStyle: { color: '#1c2230' } } },
        series: [...series, { type: 'scatter', data: [], markLine: { silent: true, symbol: 'none', lineStyle: { color: '#3a4150', type: 'dashed' }, label: { show: false }, data: [{ xAxis: xMid }, { yAxis: yMid }] } }],
        animationDuration: 600,
      })
      chart.on('click', (p: { data?: { id?: number } }) => { if (p.data?.id) onSel.current(p.data.id) })
    })
    window.addEventListener('resize', onResize)
    return () => { disposed = true; window.removeEventListener('resize', onResize); if (chart) chart.dispose() }
  }, [pool, mode])
  if (pool.length === 0) return null
  return (
    <div className="card mb-4">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
          <i className="bi bi-bullseye me-2" style={{ color: '#8b949e' }}></i>Scouting Map
          <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>output × reliability{mode === '3d' ? ' × VORP' : ''} · {mode === '3d' ? 'drag to orbit' : 'top-right = safe studs'} · click to drill</span>
        </h5>
        <div className="si-mx-views">
          <button className={`si-mx-view${mode === '2d' ? ' active' : ''}`} onClick={() => setMode('2d')}>2D</button>
          <button className={`si-mx-view${mode === '3d' ? ' active' : ''}`} onClick={() => setMode('3d')}>3D</button>
        </div>
      </div>
      <div className="card-body">
        {mode === '3d'
          ? <Suspense fallback={<div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', fontSize: '.85rem' }}><Spinner /><span className="ms-2">Building value cloud…</span></div>}>
              <ValueCloud3D players={pool} onSelect={id => onSel.current(id)} />
            </Suspense>
          : <div ref={ref} style={{ width: '100%', height: 360 }} />}
      </div>
    </div>
  )
}

// ── Keeper tab (keep/trade board + contention window + makeup) ──
interface KeeperRow {
  id: number; name: string; primary: string; age: number | null; sc_avg: number
  keeper_value: number | null; vorp: number | null; sc_pctile: number | null
  proj: number | null; bucket: string; why: string
}
interface DynastyData {
  has_data: boolean; trajectory: { year: number; output: number; avg_age: number }[]
  peak_year: number; window: number[]; current: number; archetypes: { type: string; count: number }[]
  keeper_board?: KeeperRow[]
}
const KEEPER_BUCKETS: { key: string; label: string; color: string; blurb: string; icon: string }[] = [
  { key: 'Cornerstone', label: 'Cornerstones', color: '#a98bff', icon: 'bi-gem', blurb: 'Build around — keep no matter what' },
  { key: 'Keep', label: 'Keep', color: '#4ec77a', icon: 'bi-check-circle-fill', blurb: 'Solid value, at or before peak' },
  { key: 'Develop', label: 'Develop', color: '#58a6ff', icon: 'bi-arrow-up-right-circle-fill', blurb: 'Young upside — stash and grow' },
  { key: 'Sell-high', label: 'Sell high', color: '#e0a93f', icon: 'bi-cash-coin', blurb: 'Aging but still has trade value' },
  { key: 'Hold', label: 'Hold / watch', color: '#8b949e', icon: 'bi-eye', blurb: 'Fringe — wait and see' },
  { key: 'Replaceable', label: 'Replaceable', color: '#ef6b5e', icon: 'bi-arrow-down-circle', blurb: 'Below replacement — upgrade target' },
]
function KeeperBoard({ board, onSelect }: { board: KeeperRow[]; onSelect: (id: number) => void }) {
  const groups = KEEPER_BUCKETS.map(b => ({ ...b, rows: board.filter(r => r.bucket === b.key) })).filter(g => g.rows.length)
  return (
    <div className="kb-board mb-4">
      {groups.map(g => (
        <div key={g.key} className="kb-col" style={{ ['--kb' as string]: g.color } as React.CSSProperties}>
          <div className="kb-col-head">
            <span className="kb-col-title"><i className={`bi ${g.icon}`}></i>{g.label}</span>
            <span className="kb-col-count">{g.rows.length}</span>
          </div>
          <div className="kb-col-blurb">{g.blurb}</div>
          <div className="kb-col-rows">
            {g.rows.map(r => (
              <button key={r.id} className="kb-card" onClick={() => onSelect(r.id)}>
                <div className="kb-card-top">
                  <span className={`pos-dot pos-${r.primary}`}></span>
                  <span className="kb-card-name">{r.name}</span>
                  <span className="kb-card-sc">{r.sc_avg || '–'}</span>
                </div>
                <div className="kb-card-why">{r.why}</div>
                <div className="kb-card-meta">
                  {r.age != null && <span>{r.age}yo</span>}
                  {r.keeper_value != null && <span>KV {r.keeper_value}</span>}
                  {r.proj != null && <span className={r.proj >= r.sc_avg ? 'kb-up' : 'kb-down'}>→ {r.proj}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
function KeeperTab({ leagueId, teamId, onSelect }: { leagueId: string; teamId: string; onSelect: (id: number) => void }) {
  const { data, loading } = useFetch<DynastyData>(`/leagues/${leagueId}/team/${teamId}/dynasty?format=json`)
  if (loading || !data) return <div className="text-secondary" style={{ padding: 40, textAlign: 'center' }}>Reading the squad…</div>
  const board = data.keeper_board || []
  const win = data.window || []
  const winLabel = win.length ? (win.length > 1 ? `${win[0]}–${win[win.length - 1]}` : `${win[0]}`) : '—'
  const maxArch = Math.max(1, ...(data.archetypes || []).map(a => a.count))
  return (
    <>
      <div className="card mb-4">
        <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
          <i className="bi bi-clipboard-check me-2" style={{ color: '#8b949e' }}></i>Keep / Trade board
          <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>every player sorted by what to do with them · click to open</span></h5></div>
        <div className="card-body">
          {board.length
            ? <KeeperBoard board={board} onSelect={onSelect} />
            : <div className="text-secondary" style={{ padding: 20, textAlign: 'center' }}>Not enough scoring data yet to grade keepers.</div>}
        </div>
      </div>
      {data.has_data && (<>
        <div className="card mb-4">
          <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-graph-up-arrow me-2" style={{ color: '#8b949e' }}></i>Contention window
            <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>projected squad output as your core ages · window {winLabel}</span></h5></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.trajectory} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
                <defs><linearGradient id="dyn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#58a6ff" stopOpacity={0.5} /><stop offset="100%" stopColor="#58a6ff" stopOpacity={0.04} />
                </linearGradient></defs>
                <XAxis dataKey="year" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                <Tooltip contentStyle={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, fontSize: '.78rem' }} />
                <ReferenceLine x={data.peak_year} stroke="#4ec77a" strokeDasharray="4 3" label={{ value: 'peak', fill: '#4ec77a', fontSize: 10, position: 'top' }} />
                <Area type="monotone" dataKey="output" stroke="#58a6ff" strokeWidth={2} fill="url(#dyn)" dot={{ r: 3, fill: '#58a6ff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-pie-chart-fill me-2" style={{ color: '#8b949e' }}></i>Squad makeup
            <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>player archetypes</span></h5></div>
          <div className="card-body">
            {(data.archetypes || []).map(a => (
              <div key={a.type} className="bm-row" style={{ gridTemplateColumns: '150px 1fr 30px' }}>
                <div className="bm-label">{a.type}</div>
                <div className="bm-track"><div className="bm-fill" style={{ width: `${a.count / maxArch * 100}%`, background: '#5aa0ff' }}></div></div>
                <div className="bm-pct" style={{ color: '#c9d1d9' }}>{a.count}</div>
              </div>
            ))}
          </div>
        </div>
      </>)}
    </>
  )
}

// ── This Round (matchup projection + per-starter read) ──
interface RoundStarter {
  id: number; name: string; pos: string; proj: number; adj: number; cap: boolean
  afl_opp: string | null; venue: string | null; opp_diff: number | null; venue_diff: number | null
  bye: boolean; injury: string | null
}
interface ThisRoundData {
  has_data: boolean; round?: number; note?: string
  your_proj: number; your_lo: number; your_hi: number; n_starters: number; captain_scoring: boolean
  opp_id: number | null; opp_name: string | null; opp_proj?: number; opp_lo?: number; opp_hi?: number; win_prob?: number
  starters: RoundStarter[]; captain: { id: number; name: string; why: string; is_current: boolean } | null
}
function ThisRound({ leagueId, teamId, onSelect }: { leagueId: string; teamId: string; onSelect: (id: number) => void }) {
  const { data, loading } = useFetch<ThisRoundData>(`/leagues/${leagueId}/team/${teamId}/this-round?format=json`)
  if (loading || !data) return <div className="text-secondary" style={{ padding: 40, textAlign: 'center' }}>Running this round's simulation…</div>
  if (!data.has_data) return <div className="text-secondary" style={{ padding: 30, textAlign: 'center' }}>{data.note || 'Not enough data to project this round.'}</div>
  const wp = data.win_prob
  const cap = data.captain
  return (
    <>
      {data.opp_name && wp != null ? (
        <div className="card pred-matchup mb-4">
          <div className="pred-head">Round {data.round} · projected matchup</div>
          <div className="pred-scores">
            <div className="pred-side">
              <div className="pred-score" style={{ color: wp >= 50 ? '#4ec77a' : '#c9d1d9' }}>{data.your_proj}</div>
              <div className="pred-team">You</div><div className="pred-range">{data.your_lo}–{data.your_hi}</div>
            </div>
            <div className="pred-winwrap">
              <div className="pred-winlabel">win probability</div>
              <div className="pred-winprob" style={{ color: wp >= 50 ? '#4ec77a' : '#ef6b5e' }}>{wp}%</div>
              <div className="pred-winbar"><div style={{ width: `${wp}%`, background: wp >= 50 ? '#4ec77a' : '#ef6b5e' }}></div></div>
            </div>
            <div className="pred-side">
              <div className="pred-score" style={{ color: wp < 50 ? '#ef6b5e' : '#c9d1d9' }}>{data.opp_proj}</div>
              <div className="pred-team">{data.opp_name}</div><div className="pred-range">{data.opp_lo}–{data.opp_hi}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card pred-matchup mb-4">
          <div className="pred-head">Round {data.round} · projection</div>
          <div className="pred-scores" style={{ justifyContent: 'flex-start', gap: 28 }}>
            <div className="pred-side"><div className="pred-score">{data.your_proj}</div><div className="pred-team">projected</div><div className="pred-range">{data.your_lo}–{data.your_hi}</div></div>
            {data.note && <div className="tr-note">{data.note}</div>}
          </div>
        </div>
      )}
      {cap && (
        <div className={`tr-captain ${cap.is_current ? 'ok' : 'sug'}`} onClick={() => onSelect(cap.id)}>
          <i className="bi bi-star-fill"></i>
          <span><b>Captain:</b> {cap.name} <span className="tr-cap-why">{cap.why}</span></span>
          <span className="tr-cap-tag">{cap.is_current ? 'current pick ✓' : 'top projected — consider'}</span>
        </div>
      )}
      <div className="card">
        <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
          <i className="bi bi-people me-2" style={{ color: '#8b949e' }}></i>On-field starters
          <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>{data.n_starters} on field · {data.captain_scoring ? 'captain ×2' : 'no captain bonus'} · matchup-adjusted</span></h5></div>
        <div className="card-body p-0">
          <table className="tr-table">
            <thead><tr><th>Player</th><th className="text-end">Proj</th><th>This week</th><th className="text-end">Adj</th></tr></thead>
            <tbody>
              {data.starters.map(s => (
                <tr key={s.id} onClick={() => onSelect(s.id)}>
                  <td className="tr-name">
                    <span className={`pos-dot pos-${s.pos}`}></span>{s.name}
                    {s.cap && <span className="pred-c">C</span>}
                    {s.bye && <span className="tr-flag bye">BYE</span>}
                    {s.injury && <span className="tr-flag inj">{s.injury}</span>}
                  </td>
                  <td className="text-end fw-bold">{s.proj}</td>
                  <td className="tr-match">
                    {s.bye ? <span className="text-secondary">no game</span>
                      : s.afl_opp ? <span>vs {s.afl_opp}{s.venue ? ` · ${s.venue}` : ''}{s.opp_diff != null ? <span className={s.opp_diff >= 0 ? 'kb-up' : 'kb-down'}> {s.opp_diff >= 0 ? '+' : ''}{s.opp_diff}</span> : ''}</span>
                        : <span className="text-secondary">—</span>}
                  </td>
                  <td className="text-end" style={{ color: s.adj >= s.proj ? '#4ec77a' : '#ef6b5e' }}>{s.adj}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── League comparison (how you stack up) ──
interface LeagueTeamRow {
  team_id: number; name: string; avg_rating: number; avg_sc: number; avg_age: number
  keeper_value: number; squad_size: number; by_pos: Record<string, number>
  health: number | null; descriptor: string | null; rank: number
}
interface LeagueCompare {
  has_data: boolean; n_teams: number; teams: LeagueTeamRow[]
  league_avg: { avg_rating: number; avg_sc: number; avg_age: number; by_pos: Record<string, number> }
  your_team_id: number; your_ranks: Record<string, number | null>
  radar: { pos: string; you: number; league: number; best: number }[]
}

function LeagueComparison({ leagueId, teamId }: { leagueId: string; teamId: string }) {
  const { data, loading } = useFetch<LeagueCompare>(`/leagues/${leagueId}/team/${teamId}/league-compare?format=json`)
  if (loading || !data) return <div className="text-secondary" style={{ padding: 40, textAlign: 'center' }}>Loading league comparison…</div>
  if (!data.has_data) return <div className="text-secondary" style={{ padding: 30, textAlign: 'center' }}>No league data yet.</div>
  const yr = data.your_ranks
  const tiles: [string, string][] = [['health', 'Squad Health'], ['avg_rating', 'Squad Rating'], ['avg_sc', 'Avg SC'], ['keeper_value', 'Keeper Value']]
  const me = data.teams.find(t => t.team_id === data.your_team_id)
  return (
    <>
      <div className="si-rank-tiles">
        {tiles.map(([k, l]) => (
          <div key={k} className="si-rank-tile">
            <div className="si-rank-v">#{yr[k] ?? '–'}<span className="si-rank-of">of {data.n_teams}</span></div>
            <div className="si-rank-l">{l}</div>
          </div>
        ))}
        {me?.descriptor && <div className="si-rank-tile wide"><div className="si-rank-desc">{me.descriptor}</div><div className="si-rank-l">your window</div></div>}
      </div>

      <div className="row g-4 mb-4">
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
              <i className="bi bi-radar me-2" style={{ color: '#8b949e' }}></i>Positional Strength
              <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>you vs league avg</span></h5></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={data.radar} outerRadius="72%">
                  <PolarGrid stroke="#30363d" />
                  <PolarAngleAxis dataKey="pos" tick={{ fill: '#c9d1d9', fontSize: 12 }} />
                  <PolarRadiusAxis tick={{ fill: '#6e7681', fontSize: 10 }} stroke="#30363d" angle={90} />
                  <Radar name="League avg" dataKey="league" stroke="#8b949e" fill="#8b949e" fillOpacity={0.12} />
                  <Radar name="You" dataKey="you" stroke="#58a6ff" fill="#58a6ff" fillOpacity={0.35} />
                  <Legend wrapperStyle={{ fontSize: '.72rem' }} />
                  <Tooltip contentStyle={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, fontSize: '.78rem' }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
              <i className="bi bi-list-ol me-2" style={{ color: '#8b949e' }}></i>League Ladder by Squad Strength
              <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>{data.n_teams} teams</span></h5></div>
            <div className="card-body p-0" style={{ overflowX: 'auto' }}>
              <table className="si-matrix">
                <thead><tr>
                  <th style={{ width: 30 }}>#</th><th className="si-mx-player">Team</th>
                  <th className="text-end">Health</th><th className="text-end">Rating</th>
                  <th className="text-end">Avg SC</th><th className="text-center">Age</th><th className="text-end">Keeper</th>
                </tr></thead>
                <tbody>
                  {data.teams.map(t => (
                    <tr key={t.team_id} className={t.team_id === data.your_team_id ? 'si-mx-row sel' : 'si-mx-row'}>
                      <td style={{ color: t.rank <= 3 ? '#e8c25b' : '#6e7681', fontWeight: 700 }}>{t.rank}</td>
                      <td className="si-mx-player"><span className="si-mx-name">{t.name}</span>{t.team_id === data.your_team_id && <span style={{ color: '#58a6ff', fontSize: '.7rem', marginLeft: 5 }}>you</span>}</td>
                      <td className="text-end fw-bold">{t.health ?? '–'}</td>
                      <td className="text-end">{t.avg_rating}</td>
                      <td className="text-end">{t.avg_sc || '–'}</td>
                      <td className="text-center" style={{ color: '#8b949e' }}>{t.avg_age}</td>
                      <td className="text-end" style={{ color: '#8b949e' }}>{t.keeper_value || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function TeamStatsPage() {
  const { leagueId, teamId } = useParams()
  const { data, loading } = useFetch<StatsData>(`/leagues/${leagueId}/team/${teamId}/stats?format=json`)
  const { data: roi } = useFetch<DraftRoiData>(`/leagues/${leagueId}/team/${teamId}/draft-roi?format=json`)
  const { data: intel } = useFetch<SquadIntel>(`/leagues/${leagueId}/team/${teamId}/squad-intel?format=json`)
  const navigate = useNavigate()
  const openPlayer = (id: number) => navigate(`/leagues/${leagueId}/team/${teamId}/player/${id}`)
  const [activeFlag, setActiveFlag] = useState<FlagKey | null>(null)
  const [section, setSection] = useState<'deck' | 'keeper' | 'squad' | 'this-round' | 'league'>('deck')
  const [compareSet, setCompareSet] = useState<number[]>([])
  const [showCompare, setShowCompare] = useState(false)
  function toggleCompare(id: number) {
    setCompareSet(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= 4 ? s : [...s, id])
  }

  const flagMap = useMemo(() => {
    const m = new Map<number, FlagDef[]>()
    if (!data) return m
    for (const p of data.players) {
      const hits = FLAGS.filter(f => f.test(p))
      if (hits.length) m.set(p.id, hits)
    }
    return m
  }, [data])

  if (loading) return <Spinner text="Loading stats..." />
  if (!data) return <p className="text-danger">Failed to load team stats</p>

  const { league, team, players, total_sc } = data
  const showLeague = (intel?.team_metrics?.n_teams ?? 1) > 1

  // Flag tallies for the watchlist shelf
  const flagCounts = FLAGS.map(f => ({ ...f, players: players.filter(p => f.test(p)) }))
    .filter(f => f.players.length > 0)

  // Development-curve scatter points
  const scatter = players
    .filter(p => p.age != null && p.sc_avg > 0)
    .map(p => ({ x: p.age!, y: p.sc_avg, z: Math.max(p.career_games || 1, 1), pos: posCode(p.position), name: p.name }))

  // Age pyramid buckets
  const AGE_BUCKETS = [
    { label: '≤21', min: 0, max: 21 }, { label: '22–24', min: 22, max: 24 },
    { label: '25–27', min: 25, max: 27 }, { label: '28–30', min: 28, max: 30 },
    { label: '31+', min: 31, max: 999 },
  ]
  const pyramid = AGE_BUCKETS.map(b => {
    const inBucket = players.filter(p => p.age != null && p.age >= b.min && p.age <= b.max)
    const scMass = inBucket.reduce((s, p) => s + (p.sc_avg || 0), 0)
    const scShare = total_sc > 0 ? Math.round((scMass / total_sc) * 100) : 0
    return { bucket: b.label, count: inBucket.length, scShare, scShareLabel: `${scShare}%` }
  })

  return (
    <div>
      <TeamMobSubnav active="stats" leagueId={leagueId!} teamId={teamId!} />
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link>
          {' / '}<Link to={`/leagues/${leagueId}/team/${teamId}`}>{team.name}</Link>
          {' / '}Stats
        </div>
        <div className="d-flex justify-content-between align-items-start">
          <h2>{team.name} — Stats</h2>
          <div className="d-flex gap-2 d-none d-lg-flex">
            <Link to={`/leagues/${leagueId}/team/${teamId}`} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-people me-1"></i>Squad
            </Link>
          </div>
        </div>
      </div>

      {/* The Read — keeper-framed verdict band (Deck has its own headline) */}
      {intel?.has_data && section !== 'deck' && <TheRead intel={intel} />}

      <div className="si-sectionnav">
        <button className={`si-sectiontab${section === 'deck' ? ' active' : ''}`} onClick={() => setSection('deck')}><i className="bi bi-grid-1x2-fill"></i>Deck</button>
        <button className={`si-sectiontab${section === 'keeper' ? ' active' : ''}`} onClick={() => setSection('keeper')}><i className="bi bi-clipboard-check"></i>Keeper</button>
        <button className={`si-sectiontab${section === 'squad' ? ' active' : ''}`} onClick={() => setSection('squad')}><i className="bi bi-people-fill"></i>Squad</button>
        <button className={`si-sectiontab${section === 'this-round' ? ' active' : ''}`} onClick={() => setSection('this-round')}><i className="bi bi-cpu-fill"></i>This Round</button>
        {showLeague && <button className={`si-sectiontab${section === 'league' ? ' active' : ''}`} onClick={() => setSection('league')}><i className="bi bi-trophy-fill"></i>League</button>}
      </div>

      {section === 'deck' && <CommandDeck leagueId={leagueId!} teamId={teamId!} descriptor={intel?.team_metrics?.descriptor ?? null} />}
      {section === 'keeper' && <KeeperTab leagueId={leagueId!} teamId={teamId!} onSelect={openPlayer} />}
      {section === 'this-round' && <ThisRound leagueId={leagueId!} teamId={teamId!} onSelect={openPlayer} />}
      {section === 'league' && showLeague && <LeagueComparison leagueId={leagueId!} teamId={teamId!} />}

      {section === 'squad' && (<>
      {intel?.has_data && <ScoutingMap players={intel.players} onSelect={openPlayer} />}
      {intel?.has_data
        ? <SquadMatrix players={intel.players} flagMap={flagMap} activeFlag={activeFlag}
            compareSet={compareSet} toggleCompare={toggleCompare} onSelect={openPlayer} />
        : <div className="text-secondary" style={{ padding: 20, textAlign: 'center' }}>Loading squad intelligence…</div>}


      {/* Watchlist auto-flags shelf */}
      {flagCounts.length > 0 && (
        <div className="card mb-4">
          <div className="card-header d-flex align-items-center justify-content-between">
            <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
              <i className="bi bi-binoculars-fill me-2" style={{ color: '#d29922' }}></i>Watchlist
            </h5>
            {activeFlag && (
              <button className="btn btn-sm btn-outline-secondary py-0" style={{ fontSize: '.72rem' }}
                onClick={() => setActiveFlag(null)}>Clear filter</button>
            )}
          </div>
          <div className="card-body d-flex flex-wrap gap-2">
            {flagCounts.map(f => (
              <button key={f.key}
                onClick={() => setActiveFlag(activeFlag === f.key ? null : f.key)}
                className="stats-flag-chip"
                style={{
                  ['--fc' as string]: f.color,
                  borderColor: activeFlag === f.key ? f.color : 'rgba(110,130,180,.25)',
                  background: activeFlag === f.key ? `${f.color}22` : 'rgba(110,130,180,.07)',
                } as React.CSSProperties}>
                <i className={`bi ${f.icon}`} style={{ color: f.color }}></i>
                <span className="stats-flag-label">{f.label}</span>
                <span className="stats-flag-count" style={{ background: f.color }}>{f.players.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Development curve + Age pyramid */}
      <div className="row g-4 mb-4">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-graph-up me-2" style={{ color: '#8b949e' }}></i>Development Curve
                <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>age vs SC · peak window shaded</span>
              </h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 12, bottom: 18, left: -8 }}>
                  <ReferenceArea x1={24} x2={28} fill="#3fb950" fillOpacity={0.07} />
                  <XAxis type="number" dataKey="x" name="Age" domain={[17, 'dataMax + 1']}
                    tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d"
                    label={{ value: 'Age', position: 'insideBottom', offset: -8, fill: '#6e7681', fontSize: 11 }} />
                  <YAxis type="number" dataKey="y" name="SC Avg" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                  <ZAxis type="number" dataKey="z" range={[40, 320]} name="Career games" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ScatterTip />} />
                  {['DEF', 'MID', 'FWD', 'RUC'].map(pos => (
                    <Scatter key={pos} name={pos} data={scatter.filter(d => d.pos === pos)} fill={POS_COLOR[pos]} fillOpacity={0.78} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div className="d-flex gap-3 justify-content-center mt-1" style={{ fontSize: '.72rem' }}>
                {Object.entries(POS_COLOR).map(([pos, c]) => (
                  <span key={pos}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: c, marginRight: 4 }}></span>{pos}</span>
                ))}
                <span className="text-secondary">• bubble = career games</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-bar-chart-steps me-2" style={{ color: '#8b949e' }}></i>Age Profile
                <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>% of squad SC by age</span>
              </h5>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={pyramid} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 6 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="bucket" tick={{ fill: '#c9d1d9', fontSize: 12 }} stroke="#30363d" width={48} />
                  <Tooltip content={<PyramidTip />} cursor={{ fill: 'rgba(110,130,180,.08)' }} />
                  <Bar dataKey="scShare" radius={[0, 5, 5, 0]}>
                    <LabelList dataKey="scShareLabel" position="right" fill="#8b949e" fontSize={11} />
                    {pyramid.map((b, i) => {
                      const c = b.bucket === '≤21' || b.bucket === '22–24' ? '#3fb950'
                        : b.bucket === '25–27' ? '#58a6ff' : b.bucket === '28–30' ? '#d29922' : '#f85149'
                      return <Cell key={i} fill={c} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Draft-value ROI */}
      {roi?.has_data && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
              <i className="bi bi-bullseye me-2" style={{ color: '#8b949e' }}></i>Draft Value ROI
              <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>where you picked vs what they return · dashed = expected</span>
            </h5>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart margin={{ top: 10, right: 16, bottom: 18, left: -8 }}>
                <XAxis dataKey="pick" type="number" domain={[1, 'dataMax']} allowDuplicatedCategory={false}
                  tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d"
                  label={{ value: 'Draft pick', position: 'insideBottom', offset: -8, fill: '#6e7681', fontSize: 11 }} />
                <YAxis type="number" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d"
                  label={{ value: 'SC avg', angle: -90, position: 'insideLeft', offset: 16, fill: '#6e7681', fontSize: 11 }} />
                <Tooltip content={<RoiTip />} cursor={{ strokeDasharray: '3 3' }} />
                <Line data={roi.curve} dataKey="expected" type="monotone" stroke="#6e7681" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Scatter data={roi.team} dataKey="value" isAnimationActive={false}>
                  {roi.team.map((d, i) => <Cell key={i} fill={VERDICT_COLOR[d.verdict] || '#5aa0ff'} />)}
                </Scatter>
              </ComposedChart>
            </ResponsiveContainer>
            <div className="d-flex gap-3 justify-content-center mt-1" style={{ fontSize: '.72rem' }}>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#4ec77a', marginRight: 4 }}></span>Steal</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#5aa0ff', marginRight: 4 }}></span>Fair</span>
              <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#ef6b5e', marginRight: 4 }}></span>Bust</span>
            </div>
          </div>
        </div>
      )}
      </>)}

      {compareSet.length > 0 && (
        <div className="cmp-tray">
          <div className="cmp-tray-chips">
            <span className="cmp-tray-label"><i className="bi bi-layout-split me-1"></i>Compare</span>
            {compareSet.map(id => {
              const pl = players.find(p => p.id === id)
              return (
                <span key={id} className="cmp-tray-chip">
                  {pl?.name ?? id}
                  <i className="bi bi-x-lg" onClick={() => toggleCompare(id)}></i>
                </span>
              )
            })}
          </div>
          <div className="cmp-tray-actions">
            <button className="cmp-tray-clear" onClick={() => setCompareSet([])}>Clear</button>
            <button className="cmp-tray-go" disabled={compareSet.length < 2} onClick={() => setShowCompare(true)}>
              Compare {compareSet.length}
            </button>
          </div>
        </div>
      )}
      {showCompare && (
        <CompareModal leagueId={leagueId!} teamId={teamId!} ids={compareSet} onClose={() => setShowCompare(false)} />
      )}
    </div>
  )
}

// ── Side-by-side compare (#30) ──
interface ComparePlayer {
  player_id: number; name: string; position: string; afl_team: string; age: number | null
  sc_avg: number | null; rating: number | null; potential: number | null; keeper_value: number | null
  cba_pct: number | null
  ceiling: number | null; floor: number | null; consistency: number | null; next_season: number | null
  points_banked: number | null; team_games: number | null; captain_games: number | null
  season_trend: { year: number; avg: number }[]
}
const CMP_PALETTE = ['#58a6ff', '#4ec77a', '#e0a93f', '#bc8cff']
const CMP_ROWS: { k: keyof ComparePlayer; label: string; hb: boolean }[] = [
  { k: 'sc_avg', label: 'SuperCoach avg', hb: true },
  { k: 'rating', label: 'Rating', hb: true },
  { k: 'potential', label: 'Potential', hb: true },
  { k: 'keeper_value', label: 'Keeper Value', hb: true },
  { k: 'cba_pct', label: 'CBA% (mid role)', hb: true },
  { k: 'age', label: 'Age', hb: false },
  { k: 'ceiling', label: 'Ceiling', hb: true },
  { k: 'floor', label: 'Floor', hb: true },
  { k: 'consistency', label: 'Consistency', hb: true },
  { k: 'next_season', label: 'Proj. next season', hb: true },
  { k: 'points_banked', label: 'Banked for you', hb: true },
  { k: 'team_games', label: 'Games for you', hb: true },
]

function CompareModal({ leagueId, teamId, ids, onClose }: {
  leagueId: string; teamId: string; ids: number[]; onClose: () => void
}) {
  const { data, loading } = useFetch<{ players: ComparePlayer[] }>(
    `/leagues/${leagueId}/team/${teamId}/compare?ids=${ids.join(',')}&format=json`)
  const players = data?.players ?? []

  const bestIdx = (row: typeof CMP_ROWS[number]): number => {
    let bi = -1, bv: number | null = null
    players.forEach((p, i) => {
      const v = p[row.k] as number | null
      if (v == null) return
      if (bv == null || (row.hb ? v > bv : v < bv)) { bv = v; bi = i }
    })
    return bi
  }

  // Merge season trends into one dataset for the overlaid chart
  const years = Array.from(new Set(players.flatMap(p => p.season_trend.map(s => s.year)))).sort()
  const chartData = years.map(y => {
    const row: Record<string, number> = { year: y }
    players.forEach(p => { const t = p.season_trend.find(s => s.year === y); if (t) row[p.name] = t.avg })
    return row
  })

  return (
    <div className="usage-overlay" onClick={onClose}>
      <div className="usage-modal cmp-modal" onClick={e => e.stopPropagation()}>
        <div className="usage-head">
          <div className="usage-name">Compare players</div>
          <button className="usage-close" onClick={onClose} aria-label="Close"><i className="bi bi-x-lg"></i></button>
        </div>
        {loading || !data ? (
          <div className="usage-body"><div className="text-secondary" style={{ padding: 30, textAlign: 'center' }}>Loading comparison…</div></div>
        ) : (
          <div className="usage-body">
            <div style={{ overflowX: 'auto' }}>
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th></th>
                    {players.map((p, i) => (
                      <th key={p.player_id}>
                        <span className="cmp-dot" style={{ background: CMP_PALETTE[i] }}></span>
                        <div className="cmp-name">{p.name}</div>
                        <div className="cmp-meta">{posCode(p.position)} · {p.afl_team}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CMP_ROWS.map(row => {
                    const best = bestIdx(row)
                    return (
                      <tr key={row.k as string}>
                        <td className="cmp-row-label">{row.label}</td>
                        {players.map((p, i) => {
                          const v = p[row.k] as number | null
                          return <td key={p.player_id} className={`cmp-cell${i === best && players.length > 1 ? ' cmp-best' : ''}`}>{v == null ? '–' : v}</td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {chartData.length > 1 && (
              <div className="usage-timeline-wrap">
                <div className="usage-section-title">Career arc — SC average by season</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 8, right: 14, bottom: 0, left: -18 }}>
                    <XAxis dataKey="year" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                    <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                    <Tooltip cursor={{ stroke: '#30363d' }}
                      contentStyle={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, fontSize: '.78rem' }} />
                    {players.map((p, i) => (
                      <Line key={p.player_id} type="monotone" dataKey={p.name} stroke={CMP_PALETTE[i]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ScatterTip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; x: number; y: number; z: number; pos: string } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, padding: '7px 10px', fontSize: '.78rem' }}>
      <div style={{ fontWeight: 700, color: '#e6edf3' }}>{d.name}</div>
      <div style={{ color: '#8b949e' }}>{d.pos} · Age {d.x} · {d.y.toFixed(1)} SC · {d.z} gms</div>
    </div>
  )
}

function RoiTip({ active, payload }: { active?: boolean; payload?: { payload: { name?: string; pick: number; value?: number; expected: number; residual?: number; verdict?: string } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  if (d.name == null) return null   // hovering the expectation line, not a player
  const c = VERDICT_COLOR[d.verdict || 'fair']
  return (
    <div style={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, padding: '7px 10px', fontSize: '.78rem' }}>
      <div style={{ fontWeight: 700, color: '#e6edf3' }}>{d.name}</div>
      <div style={{ color: '#8b949e' }}>Pick {d.pick} · {d.value} SC · exp {d.expected}</div>
      <div style={{ color: c, fontWeight: 700, textTransform: 'capitalize' }}>{d.verdict} ({(d.residual ?? 0) >= 0 ? '+' : ''}{d.residual} vs pick)</div>
    </div>
  )
}

function PyramidTip({ active, payload }: { active?: boolean; payload?: { payload: { bucket: string; count: number; scShare: number } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, padding: '7px 10px', fontSize: '.78rem' }}>
      <div style={{ fontWeight: 700, color: '#e6edf3' }}>Age {d.bucket}</div>
      <div style={{ color: '#8b949e' }}>{d.count} player{d.count === 1 ? '' : 's'} · {d.scShare}% of squad SC</div>
    </div>
  )
}
