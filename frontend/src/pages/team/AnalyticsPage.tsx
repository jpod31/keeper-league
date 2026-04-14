import { useParams, Link } from 'react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useAnalytics } from '../../hooks/useAnalytics'
import { TeamMobSubnav } from '../../components/nav/TeamMobSubnav'
import { Spinner } from '../../components/ui/Spinner'
import type { AnalyticsData, DynastyTeam, PlayerBayesian, DepthPlayer } from '../../types'
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, PolarRadiusAxis,
  CartesianGrid,
} from 'recharts'

const ANALYTICS_CSS = `
.wr-wrap { max-width: 960px; margin: 0 auto; padding-bottom: 80px; }
.wr-chapter { margin-bottom: 40px; animation: wrFadeIn .4s ease both; }
.wr-chapter:nth-child(1) { animation-delay: 0s; }
.wr-chapter:nth-child(2) { animation-delay: .06s; }
.wr-chapter:nth-child(3) { animation-delay: .12s; }
.wr-chapter:nth-child(4) { animation-delay: .18s; }
.wr-chapter:nth-child(5) { animation-delay: .24s; }
.wr-chapter:nth-child(6) { animation-delay: .30s; }
.wr-chapter:nth-child(7) { animation-delay: .36s; }
.wr-chapter:nth-child(8) { animation-delay: .42s; }
.wr-chapter:nth-child(9) { animation-delay: .48s; }
@keyframes wrFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.wr-label { font-size: .6rem; font-weight: 800; color: #484f58; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
.wr-title { font-size: 1.22rem; font-weight: 800; color: #e6edf3; line-height: 1.35; margin-bottom: 8px; letter-spacing: -.01em; }
.wr-body { font-size: .88rem; color: #c9d1d9; line-height: 1.7; max-width: 720px; }

.wr-card { background: linear-gradient(165deg, #161b22 0%, #0f141a 100%); border: 1px solid #21262d; border-radius: 14px; padding: 22px 22px; box-shadow: 0 1px 0 rgba(255,255,255,.03) inset, 0 20px 60px -20px rgba(0,0,0,.6); }
.wr-card-tight { padding: 16px 18px; }

/* Hero */
.wr-hero { display: grid; grid-template-columns: auto 1fr; gap: 22px; align-items: center; padding: 26px 26px; background: radial-gradient(circle at 20% 30%, rgba(63,185,80,.08), transparent 50%), radial-gradient(circle at 80% 70%, rgba(31,111,235,.08), transparent 50%), linear-gradient(165deg, #161b22, #0d1117); border: 1px solid #21262d; border-radius: 16px; margin-bottom: 24px; }
.wr-hero-ring { position: relative; width: 104px; height: 104px; flex-shrink: 0; }
.wr-hero-ring-num { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 1.9rem; font-weight: 900; color: #e6edf3; letter-spacing: -.02em; }
.wr-hero-ring-label { position: absolute; bottom: -18px; left: 50%; transform: translateX(-50%); font-size: .52rem; font-weight: 800; color: #6e7681; text-transform: uppercase; letter-spacing: 1.2px; white-space: nowrap; }
.wr-hero-title { font-size: 1.45rem; font-weight: 900; color: #e6edf3; margin: 0 0 6px; letter-spacing: -.02em; }
.wr-hero-verdict { font-size: .85rem; color: #c9d1d9; line-height: 1.55; margin: 0 0 12px; }
.wr-hero-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.wr-chip { font-size: .7rem; padding: 4px 10px; border-radius: 8px; background: rgba(255,255,255,.03); border: 1px solid #21262d; color: #8b949e; font-weight: 500; }
.wr-chip b { color: #e6edf3; font-weight: 700; margin-right: 2px; }
.wr-chip-window { border-width: 1px; font-weight: 700; }

/* Timeline */
.wr-tl { position: relative; padding: 8px 0 8px 28px; }
.wr-tl-line { position: absolute; left: 10px; top: 0; bottom: 0; width: 2px; background: linear-gradient(180deg, rgba(63,185,80,.6), rgba(88,166,255,.6), rgba(210,168,255,.4)); border-radius: 1px; }
.wr-tl-node { position: relative; padding-bottom: 18px; padding-left: 10px; }
.wr-tl-dot { position: absolute; left: -22px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #3fb950; box-shadow: 0 0 0 3px #0d1117, 0 0 14px rgba(63,185,80,.5); }
.wr-tl-year { font-size: .68rem; font-weight: 800; color: #6e7681; letter-spacing: .5px; }
.wr-tl-event { font-size: .88rem; color: #e6edf3; font-weight: 700; margin-top: 1px; }
.wr-tl-detail { font-size: .72rem; color: #8b949e; margin-top: 2px; }

/* Gap */
.wr-gap { display: flex; align-items: center; gap: 18px; padding: 16px 18px; background: #0d1117; border: 1px solid #21262d; border-radius: 10px; margin-top: 14px; }
.wr-gap-pos { font-size: .9rem; font-weight: 900; color: #e6edf3; letter-spacing: .5px; min-width: 40px; }
.wr-gap-bars { flex: 1; min-width: 0; }
.wr-gap-bar { position: relative; height: 12px; background: #21262d; border-radius: 6px; overflow: visible; margin-bottom: 6px; }
.wr-gap-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; background: linear-gradient(90deg, #ef4444, #fb923c); transition: width .6s ease; }
.wr-gap-bar-fill-ok { background: linear-gradient(90deg, #1f6feb, #3fb950); }
.wr-gap-mark { position: absolute; top: -4px; width: 3px; height: 20px; background: #fbbf24; border-radius: 1.5px; box-shadow: 0 0 8px rgba(251,191,36,.6); }
.wr-gap-labels { display: flex; justify-content: space-between; font-size: .66rem; color: #6e7681; }

/* Depth */
.wr-filters { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
.wr-fbtn { padding: 5px 14px; border-radius: 8px; border: 1px solid #30363d; background: transparent; color: #8b949e; font-size: .72rem; font-weight: 600; cursor: pointer; transition: all .12s; }
.wr-fbtn:hover { border-color: #484f58; color: #c9d1d9; }
.wr-fbtn.active { border-color: #58a6ff; color: #58a6ff; background: rgba(88,166,255,.08); }

.wr-depth-row { margin-bottom: 20px; }
.wr-depth-row:last-child { margin-bottom: 0; }
.wr-depth-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.wr-depth-hdr-left { display: flex; align-items: center; gap: 10px; }
.wr-depth-pos { display: inline-flex; align-items: center; justify-content: center; min-width: 40px; padding: 3px 10px; border-radius: 6px; font-size: .68rem; font-weight: 800; letter-spacing: .5px; }
.wr-depth-pos-DEF { background: rgba(88,166,255,.15); color: #58a6ff; }
.wr-depth-pos-MID { background: rgba(210,168,255,.15); color: #d2a8ff; }
.wr-depth-pos-RUC { background: rgba(63,185,80,.15); color: #3fb950; }
.wr-depth-pos-FWD { background: rgba(251,146,60,.15); color: #fb923c; }
.wr-depth-meta { font-size: .72rem; color: #8b949e; }
.wr-depth-meta b { color: #e6edf3; font-weight: 700; }
.wr-depth-diff { font-size: .68rem; font-weight: 700; padding: 3px 10px; border-radius: 6px; }
.wr-depth-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); gap: 8px; }
.wr-pc { position: relative; padding: 12px 14px; background: #0d1117; border: 1px solid #21262d; border-radius: 10px; cursor: pointer; transition: all .15s; overflow: hidden; }
.wr-pc::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
.wr-pc-up::before { background: linear-gradient(180deg, #3fb950, rgba(63,185,80,.4)); }
.wr-pc-down::before { background: linear-gradient(180deg, #ef4444, rgba(239,68,68,.4)); }
.wr-pc-flat::before { background: #30363d; }
.wr-pc:hover { transform: translateY(-2px); border-color: #484f58; box-shadow: 0 8px 24px rgba(0,0,0,.4); }
.wr-pc-name { font-size: .78rem; font-weight: 700; color: #e6edf3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wr-pc-sc { font-size: 1.15rem; font-weight: 900; margin: 2px 0; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.wr-pc-meta { font-size: .64rem; color: #6e7681; display: flex; align-items: center; gap: 6px; }
.wr-tag { font-size: .55rem; padding: 1px 6px; border-radius: 4px; font-weight: 700; }

.wr-pmodal { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 14px 0 10px; }
.wr-pmodal-stat { text-align: center; padding: 10px 4px; background: #0d1117; border: 1px solid #21262d; border-radius: 8px; }
.wr-pmodal-val { font-size: 1.05rem; font-weight: 800; color: #e6edf3; font-variant-numeric: tabular-nums; }
.wr-pmodal-lbl { font-size: .54rem; color: #6e7681; text-transform: uppercase; margin-top: 3px; letter-spacing: .5px; font-weight: 600; }

/* Trade */
.wr-trade-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.wr-trade-panel { background: #0d1117; border: 1px solid #21262d; border-radius: 12px; padding: 16px 18px; }
.wr-trade-title { font-size: .66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
.wr-trade-row { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid #161b22; font-size: .78rem; }
.wr-trade-row:last-child { border-bottom: none; }
.wr-trade-row-body { flex: 1; min-width: 0; }
.wr-trade-row-name { color: #e6edf3; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wr-trade-row-sub { font-size: .65rem; color: #6e7681; }
.wr-trade-row-score { font-weight: 800; min-width: 32px; text-align: right; font-variant-numeric: tabular-nums; }
.wr-trade-row-fills { font-size: .55rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: rgba(63,185,80,.14); color: #3fb950; text-transform: uppercase; letter-spacing: .5px; }
.wr-pos-pill { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; padding: 2px 6px; border-radius: 4px; font-size: .56rem; font-weight: 800; letter-spacing: .3px; }
.wr-surplus-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.wr-surplus-item { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #0d1117; border: 1px solid #21262d; border-radius: 8px; font-size: .76rem; }
.wr-surplus-name { color: #e6edf3; font-weight: 600; }
.wr-surplus-sc { color: #fb923c; font-weight: 800; }

/* AI sections */
.wr-ai { padding: 18px 22px; background: #0d1117; border: 1px solid #21262d; border-radius: 12px; margin-bottom: 10px; border-left: 4px solid; position: relative; }
.wr-ai-title { font-size: .66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.wr-ai-body { font-size: .86rem; color: #c9d1d9; line-height: 1.65; }

/* Two column health + league */
.wr-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }

/* League standings inline */
.wr-ls-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid #161b22; }
.wr-ls-row:last-child { border-bottom: none; }
.wr-ls-rank { width: 22px; text-align: center; font-size: .72rem; font-weight: 800; color: #484f58; font-variant-numeric: tabular-nums; }
.wr-ls-name { flex: 1; font-size: .78rem; color: #c9d1d9; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wr-ls-name-you { color: #58a6ff; font-weight: 800; }
.wr-ls-bar { width: 80px; height: 6px; background: #21262d; border-radius: 3px; overflow: hidden; flex-shrink: 0; }
.wr-ls-bar-fill { height: 100%; background: #30363d; transition: width .6s ease; }
.wr-ls-bar-fill-you { background: linear-gradient(90deg, #3fb950, #1f6feb); }
.wr-ls-sc { min-width: 38px; text-align: right; font-size: .78rem; font-weight: 700; color: #8b949e; font-variant-numeric: tabular-nums; }
.wr-ls-sc-you { color: #58a6ff; }

@media (max-width: 767.98px) {
  .wr-hero { grid-template-columns: 1fr; padding: 20px 18px; gap: 14px; text-align: center; }
  .wr-hero-ring { margin: 0 auto; }
  .wr-hero-chips { justify-content: center; }
  .wr-duo { grid-template-columns: 1fr; }
  .wr-trade-grid { grid-template-columns: 1fr; }
  .wr-pmodal { grid-template-columns: repeat(3, 1fr); }
}
`

const windowColors: Record<string, string> = {
  'Win Now': '#fbbf24', 'Building': '#58a6ff', 'Declining': '#ef4444',
  'Balanced': '#8b949e', 'Dominant & Improving': '#3fb950',
}

const tagColors: Record<string, string> = {
  Elite: '#ffd700', 'Elite Veteran': '#c084fc', Premium: '#fb923c',
  'Emerging Star': '#10b981', Breakout: '#06b6d4', Proven: '#3b82f6',
  Steady: '#94a3b8', Developing: '#4ade80', Project: '#eab308',
  Declining: '#ef4444', Veteran: '#a8a29e', Fringe: '#71717a',
}

function tagStyle(tag: string): React.CSSProperties {
  const c = tagColors[tag] || '#8b949e'
  return { color: c, background: `${c}20`, border: `1px solid ${c}40` }
}

function HealthRing({ score }: { score: number }) {
  const stroke = score >= 70 ? '#3fb950' : score >= 45 ? '#fbbf24' : '#ef4444'
  const circumference = 2 * Math.PI * 42
  const dash = (score / 100) * circumference
  return (
    <div className="wr-hero-ring">
      <svg width={104} height={104} viewBox="0 0 104 104" style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <filter id="wrGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={52} cy={52} r={42} fill="none" stroke="#21262d" strokeWidth={7} />
        <circle
          cx={52} cy={52} r={42} fill="none"
          stroke={stroke} strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          filter="url(#wrGlow)"
          style={{ transition: 'stroke-dasharray .8s ease' }}
        />
      </svg>
      <div className="wr-hero-ring-num">{Math.round(score)}</div>
      <div className="wr-hero-ring-label">Health</div>
    </div>
  )
}

function Hero({ data }: { data: AnalyticsData }) {
  const a = data.analytics
  const n = data.narrative
  const wColor = a.window ? (windowColors[a.window] || '#8b949e') : undefined
  const rank = a.league_context?.avg_sc_rank

  return (
    <div className="wr-hero">
      <HealthRing score={a.health_score || 0} />
      <div style={{ minWidth: 0 }}>
        <h1 className="wr-hero-title">{data.team.name}</h1>
        {n?.verdict && <p className="wr-hero-verdict">{n.verdict}</p>}
        <div className="wr-hero-chips">
          <span className="wr-chip"><b>{Math.round(a.season_avg || 0)}</b>avg/round</span>
          {rank && <span className="wr-chip"><b>{rank.rank}/{rank.of}</b>in league</span>}
          <span className="wr-chip"><b>{a.avg_age || 0}</b>avg age</span>
          {a.window && wColor && (
            <span className="wr-chip wr-chip-window" style={{ color: wColor, borderColor: wColor }}>{a.window}</span>
          )}
          {n?.dependency && (
            <span className="wr-chip">
              <span style={{ color: n.dependency.level === 'low' ? '#3fb950' : n.dependency.level === 'high' ? '#ef4444' : '#fbbf24', fontWeight: 700 }}>
                {n.dependency.level} dependency
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Chapter({ label, title, body, children }: { label: string; title: string; body?: string; children?: React.ReactNode }) {
  return (
    <section className="wr-chapter">
      <div className="wr-label">{label}</div>
      <div className="wr-title">{title}</div>
      {body && <div className="wr-body">{body}</div>}
      {children}
    </section>
  )
}

/* ═══ Dynasty Race (animated horizontal bar chart) ═══ */
function DynastyRace({ dynasty, teamId }: { dynasty: Record<string, DynastyTeam>; teamId: number }) {
  const tids = Object.keys(dynasty)
  const years = dynasty[tids[0]]?.years.map(y => y.year) ?? []
  const [yearIdx, setYearIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setYearIdx(p => {
        if (p >= years.length - 1) { setPlaying(false); return years.length - 1 }
        return p + 1
      })
    }, 1100)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, years.length])

  const ranked = useMemo(() => {
    return tids.map(tid => {
      const t = dynasty[tid]
      const y = t.years[yearIdx]
      return { id: tid, name: t.name, total: y?.total || 0, isYou: Number(tid) === teamId, year: y?.year }
    }).sort((a, b) => b.total - a.total)
  }, [dynasty, tids, yearIdx, teamId])

  const currentYear = ranked[0]?.year ?? ''
  const maxTotal = Math.max(...ranked.map(r => r.total), 1)

  return (
    <div className="wr-card wr-card-tight">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#e6edf3', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{currentYear}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, marginLeft: 16 }}>
          <button
            type="button"
            className="wr-fbtn"
            style={{ padding: '4px 14px', whiteSpace: 'nowrap' }}
            onClick={() => {
              if (!playing && yearIdx >= years.length - 1) setYearIdx(0)
              setPlaying(p => !p)
            }}
          >
            <i className={`bi bi-${playing ? 'pause-fill' : 'play-fill'}`}></i> {playing ? 'Pause' : 'Play'}
          </button>
          <input
            type="range" min={0} max={Math.max(0, years.length - 1)} value={yearIdx}
            onChange={e => { setPlaying(false); setYearIdx(Number(e.target.value)) }}
            style={{ flex: 1, accentColor: '#58a6ff', height: 4 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ranked.map((t, i) => {
          const pct = (t.total / maxTotal) * 100
          return (
            <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr 60px', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '.7rem', fontWeight: 800, color: t.isYou ? '#58a6ff' : '#484f58', textAlign: 'center' }}>{i + 1}</span>
              <div style={{ position: 'relative', height: 30, background: 'rgba(255,255,255,.02)', borderRadius: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${pct}%`,
                    background: t.isYou
                      ? 'linear-gradient(90deg, #3fb950, #1f6feb)'
                      : 'linear-gradient(90deg, #30363d, #484f58)',
                    borderRadius: 6,
                    transition: 'width .7s cubic-bezier(.4,0,.2,1)',
                    boxShadow: t.isYou ? '0 0 16px rgba(88,166,255,.3)' : 'none',
                  }}
                />
                <div style={{
                  position: 'absolute', left: 12, top: 0, bottom: 0,
                  display: 'flex', alignItems: 'center',
                  fontSize: '.78rem', fontWeight: 700,
                  color: t.isYou ? '#e6edf3' : '#c9d1d9',
                  textShadow: '0 1px 2px rgba(0,0,0,.5)',
                }}>
                  {t.name}
                </div>
              </div>
              <span style={{ textAlign: 'right', fontSize: '.82rem', fontWeight: 800, color: t.isYou ? '#58a6ff' : '#8b949e', fontVariantNumeric: 'tabular-nums' }}>{t.total.toLocaleString()}</span>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: '.6rem', color: '#484f58', textAlign: 'center', marginTop: 10 }}>
        Best 22 auto-selected per year · kids develop and displace veterans over time
      </div>
    </div>
  )
}

/* ═══ Kid Timeline ═══ */
function KidTimeline({ kids }: { kids: { year: number; enters: string; replaces: string; enters_age: number; enters_sc: number }[] }) {
  return (
    <div className="wr-card wr-card-tight">
      <div className="wr-tl">
        <div className="wr-tl-line"></div>
        {kids.map((k, i) => (
          <div key={i} className="wr-tl-node">
            <div className="wr-tl-dot"></div>
            <div className="wr-tl-year">{k.year}</div>
            <div className="wr-tl-event">{k.enters} enters the lineup</div>
            <div className="wr-tl-detail">Replaces {k.replaces} · Projected SC {Math.round(k.enters_sc)} · age {k.enters_age}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══ Gap visual ═══ */
function GapVisual({ gap }: { gap: NonNullable<AnalyticsData['narrative']['biggest_gap']> }) {
  const max = 130
  const yourPct = Math.min(100, (gap.your_avg / max) * 100)
  const leaguePct = Math.min(100, (gap.league_avg / max) * 100)
  const deficit = gap.gap < -5
  return (
    <div className="wr-gap">
      <span className="wr-gap-pos">{gap.position}</span>
      <div className="wr-gap-bars">
        <div className="wr-gap-bar">
          <div className={`wr-gap-bar-fill${!deficit ? ' wr-gap-bar-fill-ok' : ''}`} style={{ width: `${yourPct}%` }} />
          <div className="wr-gap-mark" style={{ left: `${leaguePct}%` }} title="League average" />
        </div>
        <div className="wr-gap-labels">
          <span>Your avg: <b style={{ color: '#e6edf3' }}>{gap.your_avg}</b></span>
          <span style={{ color: '#fbbf24' }}>League: {gap.league_avg}</span>
        </div>
      </div>
    </div>
  )
}

/* ═══ Depth Board ═══ */
function DepthBoard({
  depth, players, onSelect,
}: {
  depth: AnalyticsData['squad_depth']
  players: PlayerBayesian[]
  onSelect: (p: PlayerBayesian) => void
}) {
  const [filter, setFilter] = useState<'all' | 'DEF' | 'MID' | 'RUC' | 'FWD'>('all')
  const playerByName = useMemo(() => {
    const m: Record<string, PlayerBayesian> = {}
    players.forEach(p => { m[p.name] = p })
    return m
  }, [players])

  const positions: ('DEF' | 'MID' | 'RUC' | 'FWD')[] = ['DEF', 'MID', 'RUC', 'FWD']

  return (
    <>
      <div className="wr-filters">
        <button type="button" className={`wr-fbtn${filter === 'all' ? ' active' : ''}`} onClick={() => setFilter('all')}>All</button>
        {positions.map(p => (
          <button key={p} type="button" className={`wr-fbtn${filter === p ? ' active' : ''}`} onClick={() => setFilter(p)}>{p}</button>
        ))}
      </div>
      <div className="wr-card wr-card-tight">
        {positions.filter(p => filter === 'all' || filter === p).map(pos => {
          const pd = depth[pos]
          if (!pd) return null
          const diff = pd.diff || 0
          const diffBg = diff > 3 ? 'rgba(63,185,80,.14)' : diff < -3 ? 'rgba(239,68,68,.14)' : 'rgba(139,148,158,.12)'
          const diffColor = diff > 3 ? '#3fb950' : diff < -3 ? '#ef4444' : '#8b949e'
          return (
            <div key={pos} className="wr-depth-row">
              <div className="wr-depth-hdr">
                <div className="wr-depth-hdr-left">
                  <span className={`wr-depth-pos wr-depth-pos-${pos}`}>{pos}</span>
                  <span className="wr-depth-meta">{pd.count} players · avg <b>{pd.avg_sc}</b></span>
                </div>
                <span className="wr-depth-diff" style={{ background: diffBg, color: diffColor }}>
                  {diff > 0 ? '+' : ''}{Math.round(diff)} vs league
                </span>
              </div>
              <div className="wr-depth-grid">
                {(pd.players as DepthPlayer[]).slice(0, 8).map(p => {
                  const bayes = playerByName[p.name]
                  const trajectoryClass = p.trajectory === 'up' ? 'wr-pc-up' : p.trajectory === 'down' ? 'wr-pc-down' : 'wr-pc-flat'
                  const scColor = p.sc >= 100 ? '#3fb950' : p.sc >= 80 ? '#e6edf3' : '#8b949e'
                  return (
                    <div key={p.name} className={`wr-pc ${trajectoryClass}`} onClick={() => bayes && onSelect(bayes)}>
                      <div className="wr-pc-name">{p.name}</div>
                      <div className="wr-pc-sc" style={{ color: scColor }}>{Math.round(p.sc)}</div>
                      <div className="wr-pc-meta">
                        <span>{p.age}y</span>
                        {p.tag && <span className="wr-tag" style={tagStyle(p.tag)}>{p.tag}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ═══ Player Detail Modal ═══ */
function PlayerDetailModal({ player, onClose, leagueId }: { player: PlayerBayesian | null; onClose: () => void; leagueId: string }) {
  if (!player) return null

  const scores = player.round_scores || []
  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

  // Build chart data with 3-game moving average
  const chartData = scores.map((score, i) => {
    const window = scores.slice(Math.max(0, i - 2), i + 1)
    const ma = window.reduce((a, b) => a + b, 0) / window.length
    return { round: `R${i + 1}`, score, ma: Math.round(ma * 10) / 10 }
  })

  const roleLabels: Record<string, string> = {
    small_fwd: 'Small Fwd', mid_fwd: 'Med Fwd', key_fwd: 'Key Fwd',
    small_mid: 'Small Mid', tall_mid: 'Tall Mid',
    small_def: 'Small Def', key_def: 'Key Def', ruck: 'Ruck',
  }

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    const score = payload.find(p => p.name === 'score')?.value ?? 0
    const ma = payload.find(p => p.name === 'ma')?.value ?? 0
    return (
      <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
        <div style={{ fontSize: '.72rem', color: '#8b949e', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: score >= 100 ? '#3fb950' : score >= 70 ? '#58a6ff' : '#8b949e' }}>
          {score}
        </div>
        <div style={{ fontSize: '.65rem', color: '#6e7681', marginTop: 2 }}>3-game avg: {ma}</div>
      </div>
    )
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', zIndex: 1055 }} />
      <div role="dialog" aria-modal="true" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1060,
        maxHeight: '88vh',
        background: 'linear-gradient(180deg, #1c2330 0%, #141a22 100%)',
        borderRadius: '20px 20px 0 0',
        padding: '0',
        boxShadow: '0 -16px 60px rgba(0,0,0,.7)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        animation: 'klBsSlideUp .25s cubic-bezier(.32,.72,.24,1)',
      }}>
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(139,148,158,.35)' }} />
        </div>

        <div style={{ padding: '8px 22px 28px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#f0f3f6', letterSpacing: '-.02em', lineHeight: 1.2 }}>{player.name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 5, fontSize: '.78rem', color: '#8b949e', flexWrap: 'wrap' }}>
                <span className={`pos-badge badge-${player.position.split('/')[0].toLowerCase()}`} style={{ fontSize: '.6rem', padding: '2px 6px' }}>{player.position}</span>
                <span>{roleLabels[player.role_bucket] || player.position}</span>
                <span>·</span>
                <span>{player.age}yo</span>
                <span>·</span>
                <span>{player.games} games</span>
                {player.tag && <span className="wr-tag" style={tagStyle(player.tag)}>{player.tag}</span>}
              </div>
            </div>
            <button type="button" onClick={onClose}
              style={{ background: 'rgba(255,255,255,.05)', border: 'none', color: '#8b949e', fontSize: '1rem', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, flexShrink: 0 }}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          {/* Stat tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
            <div className="wr-pmodal-stat">
              <div className="wr-pmodal-val" style={{ color: '#58a6ff' }}>{Math.round(player.raw_avg || 0)}</div>
              <div className="wr-pmodal-lbl">SC Avg</div>
            </div>
            <div className="wr-pmodal-stat">
              <div className="wr-pmodal-val">{Math.round(player.true_talent || 0)}</div>
              <div className="wr-pmodal-lbl">True Talent</div>
            </div>
            <div className="wr-pmodal-stat">
              <div className="wr-pmodal-val" style={{ color: '#3fb950' }}>{Math.round(player.ceiling || 0)}</div>
              <div className="wr-pmodal-lbl">Ceiling</div>
            </div>
            <div className="wr-pmodal-stat">
              <div className="wr-pmodal-val" style={{ color: '#ef4444' }}>{Math.round(player.floor || 0)}</div>
              <div className="wr-pmodal-lbl">Floor</div>
            </div>
          </div>

          {/* Season form chart — bar + moving average line */}
          {chartData.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
                {new Date().getFullYear()} Season Form
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
                    <XAxis dataKey="round" stroke="#484f58" fontSize={10} tickLine={false} axisLine={{ stroke: '#21262d' }} />
                    <YAxis stroke="#484f58" fontSize={10} tickLine={false} axisLine={false}
                      domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.8)), 'auto']} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(88,166,255,.04)' }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={32}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.score >= 120 ? '#3fb950' : d.score >= 100 ? '#2ea043' : d.score >= 80 ? '#58a6ff' : d.score >= 60 ? '#484f58' : '#30363d'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Moving average summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '.72rem', color: '#6e7681' }}>
                <span>Season avg: <b style={{ color: '#c9d1d9' }}>{Math.round(avg)}</b></span>
                {scores.length >= 3 && (
                  <span>Last 3: <b style={{ color: chartData[chartData.length - 1]?.ma >= avg ? '#3fb950' : '#f85149' }}>
                    {chartData[chartData.length - 1]?.ma}
                  </b></span>
                )}
                {scores.length >= 5 && (() => {
                  const l5 = scores.slice(-5)
                  const l5avg = Math.round(l5.reduce((a, b) => a + b, 0) / l5.length)
                  return <span>Last 5: <b style={{ color: l5avg >= avg ? '#3fb950' : '#f85149' }}>{l5avg}</b></span>
                })()}
              </div>
            </div>
          )}

          {/* Additional insights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(48,54,61,.3)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: '.62rem', color: '#6e7681', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Consistency</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#c9d1d9' }}>
                {scores.length >= 3 ? (() => {
                  const std = Math.sqrt(scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) / scores.length)
                  const cv = avg > 0 ? Math.round((1 - std / avg) * 100) : 0
                  return <><span style={{ color: cv >= 70 ? '#3fb950' : cv >= 50 ? '#d29922' : '#f85149' }}>{cv}%</span></>
                })() : '—'}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(48,54,61,.3)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: '.62rem', color: '#6e7681', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>100+ Rate</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#c9d1d9' }}>
                {scores.length > 0 ? (
                  <span style={{ color: '#3fb950' }}>{Math.round(scores.filter(s => s >= 100).length / scores.length * 100)}%</span>
                ) : '—'}
              </div>
            </div>
          </div>

          {/* Link to full profile */}
          <Link
            to={`/leagues/${leagueId}/players/compare?p=${encodeURIComponent(player.name)}`}
            onClick={onClose}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', borderRadius: 12,
              background: 'rgba(88,166,255,.08)', border: '1px solid rgba(88,166,255,.2)',
              color: '#58a6ff', fontSize: '.82rem', fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            <i className="bi bi-person-lines-fill"></i>
            View Full Player Profile
          </Link>
        </div>
      </div>
    </>
  )
}

/* ═══ Trade Market ═══ */
function TradeMarket({ table }: { table: AnalyticsData['trade_table'] }) {
  return (
    <div className="wr-card wr-card-tight">
      <div className="wr-trade-grid">
        <div className="wr-trade-panel">
          <div className="wr-trade-title" style={{ color: '#3fb950' }}>
            <i className="bi bi-broadcast-pin"></i>Free Agents
          </div>
          {(table.free_agents || []).slice(0, 8).map((fa, i) => (
            <div key={i} className="wr-trade-row">
              <span className="wr-pos-pill" style={{ background: 'rgba(63,185,80,.15)', color: '#3fb950' }}>{fa.position}</span>
              <div className="wr-trade-row-body">
                <div className="wr-trade-row-name">{fa.name}</div>
                <div className="wr-trade-row-sub">{fa.age}y{fa.tag ? ` · ${fa.tag}` : ''}</div>
              </div>
              {fa.fills_gap && <span className="wr-trade-row-fills">fills gap</span>}
              <span className="wr-trade-row-score" style={{ color: '#3fb950' }}>{Math.round(fa.sc_avg)}</span>
            </div>
          ))}
          {(!table.free_agents || table.free_agents.length === 0) && (
            <div style={{ fontSize: '.74rem', color: '#484f58', textAlign: 'center', padding: 12 }}>No free agents</div>
          )}
        </div>

        <div className="wr-trade-panel">
          <div className="wr-trade-title" style={{ color: '#58a6ff' }}>
            <i className="bi bi-arrow-left-right"></i>Surplus on Other Teams
          </div>
          {(table.trade_targets || []).slice(0, 8).map((bt, i) => (
            <div key={i} className="wr-trade-row">
              <span className="wr-pos-pill" style={{ background: 'rgba(88,166,255,.15)', color: '#58a6ff' }}>{bt.position}</span>
              <div className="wr-trade-row-body">
                <div className="wr-trade-row-name">{bt.name}</div>
                <div className="wr-trade-row-sub">{bt.owner ?? ''}</div>
              </div>
              {bt.fills_gap && <span className="wr-trade-row-fills">fills gap</span>}
              <span className="wr-trade-row-score" style={{ color: '#58a6ff' }}>{Math.round(bt.sc_avg)}</span>
            </div>
          ))}
          {(!table.trade_targets || table.trade_targets.length === 0) && (
            <div style={{ fontSize: '.74rem', color: '#484f58', textAlign: 'center', padding: 12 }}>No trade targets</div>
          )}
        </div>
      </div>

      {table.surplus && table.surplus.length > 0 && (
        <>
          <div style={{ marginTop: 18, marginBottom: 6 }} className="wr-trade-title">
            <span style={{ color: '#fb923c' }}><i className="bi bi-gift"></i> Your Tradeable Assets</span>
          </div>
          <div className="wr-surplus-grid">
            {table.surplus.slice(0, 10).map((s, i) => (
              <div key={i} className="wr-surplus-item">
                <span className="wr-pos-pill" style={{ background: 'rgba(251,146,60,.15)', color: '#fb923c' }}>{s.position}</span>
                <span className="wr-surplus-name">{s.name}</span>
                <span className="wr-surplus-sc">{Math.round(s.sc_avg)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ═══ Team Radar + League ═══ */
function HealthRadar({ components }: { components: Record<string, number> }) {
  const data = [
    { axis: 'Scoring', value: components.power ?? 0 },
    { axis: 'Depth', value: components.depth ?? 0 },
    { axis: 'Balance', value: components.balance ?? 0 },
    { axis: 'Youth', value: components.youth ?? 0 },
    { axis: 'Trajectory', value: components.trajectory ?? 0 },
    { axis: 'Durability', value: components.durability ?? 0 },
  ]
  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="#21262d" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: '#8b949e', fontSize: 11, fontWeight: 600 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Health"
          dataKey="value"
          stroke="#58a6ff"
          strokeWidth={2}
          fill="#58a6ff"
          fillOpacity={0.25}
          dot={{ fill: '#58a6ff', strokeWidth: 2, stroke: '#0d1117', r: 4 }}
        />
        <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, fontSize: '.78rem' }} />
      </RadarChart>
    </ResponsiveContainer>
  )
}

function LeagueStandings({ landscape, teamId }: { landscape: AnalyticsData['landscape']; teamId: number }) {
  const sorted = [...landscape].sort((a, b) => b.total_sc - a.total_sc)
  const maxSc = Math.max(...sorted.map(t => t.total_sc), 1)
  return (
    <div>
      {sorted.map((t, i) => {
        const you = t.team_id === teamId
        return (
          <div key={t.team_id} className="wr-ls-row">
            <span className="wr-ls-rank" style={{ color: you ? '#58a6ff' : '#484f58' }}>{i + 1}</span>
            <span className={`wr-ls-name${you ? ' wr-ls-name-you' : ''}`}>
              {t.name}{you && <span style={{ fontSize: '.6rem', color: '#6e7681', fontWeight: 500, marginLeft: 4 }}>(you)</span>}
            </span>
            <div className="wr-ls-bar">
              <div className={`wr-ls-bar-fill${you ? ' wr-ls-bar-fill-you' : ''}`} style={{ width: `${(t.total_sc / maxSc) * 100}%` }} />
            </div>
            <span className={`wr-ls-sc${you ? ' wr-ls-sc-you' : ''}`}>{Math.round(t.avg_sc)}</span>
          </div>
        )
      })}
    </div>
  )
}

/* ═══ Round-by-round ═══ */
function RoundChart({ rounds }: { rounds: { round: number; score: number }[] }) {
  const data = rounds.map(r => ({ label: `R${r.round}`, score: r.score }))
  const avg = data.reduce((s, d) => s + d.score, 0) / (data.length || 1)
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#161b22" vertical={false} />
        <XAxis dataKey="label" stroke="#6e7681" fontSize={11} tickLine={false} axisLine={{ stroke: '#21262d' }} />
        <YAxis stroke="#6e7681" fontSize={10} tickLine={false} axisLine={false} domain={[(dataMin: number) => Math.floor(dataMin * 0.9), 'auto']} />
        <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, fontSize: '.78rem', color: '#c9d1d9' }} cursor={{ fill: 'rgba(88,166,255,.05)' }} />
        <Bar dataKey="score" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.score >= avg * 1.05 ? '#3fb950' : d.score >= avg * 0.95 ? '#58a6ff' : '#ef4444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ═══ MAIN ═══ */
export function AnalyticsPage() {
  const { leagueId, teamId } = useParams()
  const [rebuild, setRebuild] = useState(false)
  const apiUrl = `/leagues/${leagueId}/team/${teamId}/analytics/api${rebuild ? '?rebuild=1' : ''}`
  const { data, loading, error } = useAnalytics(apiUrl)
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerBayesian | null>(null)

  function handleRebuild() {
    setRebuild(true)
    window.location.href = `/leagues/${leagueId}/team/${teamId}/analytics`
  }

  if (loading) return <Spinner text={rebuild ? "Rebuilding analytics..." : "Loading analytics..."} />
  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p className="text-danger">Failed to load analytics. Try refreshing.</p>
      </div>
    )
  }

  const a = data.analytics
  const n = data.narrative
  const kids = (n.kid_timeline || []).filter(k => k.replaces)
  const gap = n.biggest_gap
  const hasDepth = data.squad_depth && Object.keys(data.squad_depth).length > 0
  const hasTrade = data.trade_table && (data.trade_table.free_agents?.length || data.trade_table.trade_targets?.length)
  const hasHealth = a.health_components && Object.keys(a.health_components).length > 0
  const hasRounds = (a.round_data?.length || 0) > 1
  const aiSections = (data.ai_sections || []).slice(1) // first section is usually the verdict already shown in hero
  const hasDynasty = data.dynasty && Object.keys(data.dynasty).length > 0

  return (
    <>
      <style>{ANALYTICS_CSS}</style>
      <TeamMobSubnav active="analytics" leagueId={leagueId!} teamId={teamId!} />

      <div className="wr-wrap">
        {/* 1. Hero / Verdict */}
        <Hero data={data} />

        {/* 2. Dynasty race */}
        {hasDynasty && (
          <Chapter label="Your Dynasty" title="5-Year Franchise Race">
            <DynastyRace dynasty={data.dynasty} teamId={Number(teamId)} />
          </Chapter>
        )}

        {/* 3. Kid timeline */}
        {kids.length > 0 && (
          <Chapter
            label="The Next Generation"
            title="When your kids take over"
            body="Your youth pipeline is your biggest asset. Here's when each young player is projected to break into the best 22 — and who they replace."
          >
            <KidTimeline kids={kids} />
          </Chapter>
        )}

        {/* 4. The Gap */}
        {gap && (
          <Chapter
            label="The Gap"
            title={`Your ${gap.position} line is ${Math.abs(gap.gap).toFixed(0)} points below league average`}
          >
            <div className="wr-body">
              Your {gap.position} group averages {gap.your_avg} per player vs the league average of {gap.league_avg}. <strong style={{ color: '#e6edf3' }}>{gap.weakest}</strong> ({Math.round(gap.weakest_sc)}) is the weakest link.
              {gap.best_fill_name && (
                <> <strong style={{ color: '#3fb950' }}>{gap.best_fill_name} ({Math.round(gap.best_fill_sc)})</strong> is available as a free agent.</>
              )}
            </div>
            <GapVisual gap={gap} />
          </Chapter>
        )}

        {/* 5. Squad depth */}
        {hasDepth && (
          <Chapter label="Your Roster" title="Squad Depth">
            <DepthBoard
              depth={data.squad_depth}
              players={a.player_bayesian || []}
              onSelect={setSelectedPlayer}
            />
          </Chapter>
        )}

        {/* 6. Trade market */}
        {hasTrade && (
          <Chapter label="The Market" title="Available Upgrades">
            <TradeMarket table={data.trade_table} />
          </Chapter>
        )}

        {/* 7. Team health + league landscape */}
        {(hasHealth || data.landscape?.length > 0) && (
          <Chapter label="The Field" title="Team Health & League">
            <div className="wr-duo">
              {hasHealth && (
                <div className="wr-card wr-card-tight">
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Team Radar</div>
                  <HealthRadar components={a.health_components} />
                </div>
              )}
              {data.landscape?.length > 0 && (
                <div className="wr-card wr-card-tight">
                  <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>League Standings (by avg)</div>
                  <LeagueStandings landscape={data.landscape} teamId={Number(teamId)} />
                </div>
              )}
            </div>
          </Chapter>
        )}

        {/* 8. AI Scouting */}
        {aiSections.length > 0 && (
          <Chapter label="Deep Dive" title="AI Scouting Report">
            {aiSections.map((sec, i) => {
              const colors = ['#58a6ff', '#ef4444', '#d2a8ff', '#fb923c', '#10b981']
              const c = colors[i % colors.length]
              return (
                <div key={i} className="wr-ai" style={{ borderLeftColor: c }}>
                  {sec.title && <div className="wr-ai-title" style={{ color: c }}>{sec.title}</div>}
                  <div className="wr-ai-body">{sec.body}</div>
                </div>
              )
            })}
          </Chapter>
        )}

        {/* 9. Round-by-round */}
        {hasRounds && (
          <Chapter label="Season So Far" title="Round-by-Round">
            <div className="wr-card wr-card-tight">
              <RoundChart rounds={a.round_data} />
              <div style={{ fontSize: '.62rem', color: '#6e7681', textAlign: 'center', marginTop: 6 }}>
                Green above +5%, blue near average, red below -5% vs season avg
              </div>
            </div>
          </Chapter>
        )}

        <div style={{ textAlign: 'center', marginTop: 10, paddingBottom: 30 }}>
          <Link to={`/leagues/${leagueId}/team/${teamId}`} style={{ color: '#6e7681', fontSize: '.78rem', textDecoration: 'none' }}>
            <i className="bi bi-arrow-left me-1"></i>Back to squad
          </Link>
          <button
            type="button"
            onClick={handleRebuild}
            style={{ background: 'none', border: '1px solid var(--kl-border)', color: '#8b949e', fontSize: '.72rem', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', marginLeft: 12 }}
          >
            <i className="bi bi-arrow-clockwise me-1"></i>Rebuild
          </button>
        </div>
      </div>

      <PlayerDetailModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} leagueId={leagueId!} />
    </>
  )
}
