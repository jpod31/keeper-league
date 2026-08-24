/**
 * Season Review primitives — the small visual pieces every slide composes
 * from. Kept dependency-light: hand-rolled inline SVG rather than a chart
 * library, so each mark can carry the slide's theme colour and animate on
 * mount without a second bundle.
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { PlayerCard } from './types'

/** An <img> that steps aside for its fallback if the file isn't there.
 *  Team logos are optional on disk, so a missing one must not leave a
 *  broken-image glyph sitting in the middle of a crest. */
function SafeImg({ src, alt, fallback }: { src: string; alt: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <>{fallback}</>
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
}

/* ── Numbers that count up on mount ─────────────────────────────── */

export function CountUp({
  to, dur = 1100, decimals = 0, prefix = '', suffix = '',
}: { to: number; dur?: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || !dur) { setV(to); return }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      // easeOutExpo — fast out of the gate, long settle
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setV(to * e)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [to, dur])

  const shown = decimals > 0
    ? v.toFixed(decimals)
    : Math.round(v).toLocaleString()
  return <>{prefix}{shown}{suffix}</>
}

/* ── Identity marks ─────────────────────────────────────────────── */

export function initials(name?: string | null): string {
  if (!name) return '?'
  const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] || '?').slice(0, 2).toUpperCase()
}

/** Fantasy-team crest — the AI logo when one exists, otherwise a monogram
 *  in the team's stable accent colour. */
export function Crest({
  name, logo, accent, size = 'md',
}: { name: string; logo?: string | null; accent: string; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'sr-crest lg' : size === 'sm' ? 'sr-crest sm' : 'sr-crest'
  return (
    <span className={cls} style={{ '--row': accent } as React.CSSProperties}>
      {logo
        ? <SafeImg src={logo} alt="" fallback={<>{initials(name)}</>} />
        : initials(name)}
    </span>
  )
}

/** AFL club mark for a player — club logo on the club's own colour.
 *  (We hold no player headshots, so the club crest is the identity.) */
export function ClubMark({ p, size = 'md' }: { p: PlayerCard; size?: 'md' | 'lg' | 'hero' }) {
  const cls = size === 'hero' ? 'sr-hero-av' : size === 'lg' ? 'sr-pl-av lg' : 'sr-pl-av'
  return (
    <span
      className={cls}
      style={{ '--sr-club': p.club_bg, '--sr-club-fg': p.club_fg } as React.CSSProperties}
    >
      {p.logo
        ? <SafeImg src={p.logo} alt={p.afl_team} fallback={<span>{initials(p.name)}</span>} />
        : <span>{initials(p.name)}</span>}
    </span>
  )
}

export function Pos({ code }: { code: string }) {
  const primary = (code || 'MID').split('/')[0].toUpperCase()
  return <span className={`sr-pos ${primary}`}>{code}</span>
}

/* ── Player row ─────────────────────────────────────────────────── */

export function PlayerRow({
  p, rank, value, valueLabel, meta, delay = 0,
}: {
  p: PlayerCard
  rank?: number
  value: ReactNode
  valueLabel?: string
  meta?: ReactNode
  delay?: number
}) {
  return (
    <div
      className="sr-pl sr-rise"
      style={{ '--sr-club': p.club_bg, animationDelay: `${delay}ms` } as React.CSSProperties}
    >
      {rank !== undefined && <span className="sr-pl-rank">{rank}</span>}
      <ClubMark p={p} />
      <div className="sr-pl-body">
        <div className="sr-pl-name">{p.name}</div>
        <div className="sr-pl-meta">
          <Pos code={p.position} /> {meta ?? <>{p.afl_team}{p.team_name ? ` · ${p.team_name}` : ''}</>}
        </div>
      </div>
      <div className="sr-pl-right">
        <div className="sr-pl-v">{value}</div>
        {valueLabel && <div className="sr-pl-vl">{valueLabel}</div>}
      </div>
    </div>
  )
}

/* ── Stat tile ──────────────────────────────────────────────────── */

export function Tile({
  value, label, sub, accent, delay = 0,
}: { value: ReactNode; label: string; sub?: string; accent?: boolean; delay?: number }) {
  return (
    <div className="sr-card sr-tile sr-rise" style={{ animationDelay: `${delay}ms` }}>
      <div className={`sr-tile-v${accent ? ' accent' : ''}`}>{value}</div>
      <div className="sr-label sr-tile-l">{label}</div>
      {sub && <div className="sr-tile-s">{sub}</div>}
    </div>
  )
}

/* ── SVG: ladder-position ribbon ────────────────────────────────── */

export function PositionArc({
  rounds, teams, highlight, maxPos,
}: {
  rounds: number[]
  teams: { team_id: number; name: string; accent: string; positions: number[] }[]
  highlight?: number | null
  maxPos: number
}) {
  const W = 720, H = 240, PL = 34, PR = 14, PT = 16, PB = 24
  const n = rounds.length
  const x = (i: number) => PL + (i / Math.max(1, n - 1)) * (W - PL - PR)
  const y = (pos: number) => PT + ((pos - 1) / Math.max(1, maxPos - 1)) * (H - PT - PB)

  const path = (positions: number[]) =>
    positions.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sr-svg" style={{ width: '100%', height: 'auto' }} role="img"
         aria-label="Ladder position by round">
      {Array.from({ length: maxPos }, (_, i) => i + 1).map(p => (
        <g key={p}>
          <line x1={PL} x2={W - PR} y1={y(p)} y2={y(p)} stroke="rgba(255,255,255,.09)" strokeWidth="1" />
          <text x={PL - 9} y={y(p) + 3.5} textAnchor="end" fontSize="9" fill="rgba(255,255,255,.4)"
                fontWeight="800">{p}</text>
        </g>
      ))}
      {rounds.map((r, i) => (
        i % 4 === 0 ? (
          <text key={r} x={x(i)} y={H - 6} textAnchor="middle" fontSize="8.5"
                fill="rgba(255,255,255,.35)" fontWeight="700">R{r}</text>
        ) : null
      ))}
      {teams.map(t => {
        const on = highlight == null || t.team_id === highlight
        return (
          <path
            key={t.team_id}
            d={path(t.positions)}
            fill="none"
            stroke={t.accent}
            strokeWidth={on ? 3 : 1.6}
            strokeOpacity={on ? 1 : .24}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="sr-draw"
            style={{ filter: on ? `drop-shadow(0 0 7px ${t.accent})` : undefined }}
          />
        )
      })}
      {teams.filter(t => highlight != null && t.team_id === highlight).map(t => (
        <circle key={t.team_id} cx={x(n - 1)} cy={y(t.positions[n - 1])} r="5.5"
                fill={t.accent} stroke="#04060d" strokeWidth="2" />
      ))}
    </svg>
  )
}

/* ── SVG: per-round score bars against the league average ───────── */

export function ScoreBars({
  rounds, scores, leagueAvg, accent,
}: { rounds: number[]; scores: number[]; leagueAvg: number[]; accent: string }) {
  const W = 720, H = 170, PL = 8, PR = 8, PT = 10, PB = 20
  const vals = scores.filter(v => v > 0)
  const lo = Math.min(...vals, ...leagueAvg.filter(v => v > 0)) * 0.92
  const hi = Math.max(...scores, ...leagueAvg) * 1.03
  const bw = (W - PL - PR) / Math.max(1, rounds.length)
  const y = (v: number) => PT + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - PT - PB)

  const avgPath = leagueAvg
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(PL + bw * i + bw / 2).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img"
         aria-label="Round score against the league average">
      {scores.map((v, i) => {
        if (!v) return null
        const beat = v >= (leagueAvg[i] || 0)
        const top = y(v)
        return (
          <rect
            key={i}
            x={PL + bw * i + 1.5}
            y={top}
            width={Math.max(2, bw - 3)}
            height={Math.max(1, H - PB - top)}
            rx="2"
            fill={beat ? accent : 'rgba(255,255,255,.22)'}
            opacity={beat ? .95 : .8}
            className="sr-bar-grow"
            style={{ animationDelay: `${i * 22}ms`, transformOrigin: `0 ${H - PB}px` }}
          />
        )
      })}
      <path d={avgPath} fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="1.6"
            strokeDasharray="4 3" />
      {rounds.map((r, i) => (
        i % 4 === 0
          ? <text key={r} x={PL + bw * i + bw / 2} y={H - 5} textAnchor="middle" fontSize="8.5"
                  fill="rgba(255,255,255,.34)" fontWeight="700">R{r}</text>
          : null
      ))}
    </svg>
  )
}

/* ── SVG: percentage ring ───────────────────────────────────────── */

export function Ring({
  pct, label, value, accent, size = 148,
}: { pct: number; label: string; value: string; accent: string; size?: number }) {
  const r = 62, c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, pct))
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label={`${label} ${value}`}>
      <defs>
        <linearGradient id={`srg-${label.replace(/\W/g, '')}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor="#ffffff" stopOpacity=".85" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,.11)" strokeWidth="11" />
      <circle
        cx="80" cy="80" r={r} fill="none"
        stroke={`url(#srg-${label.replace(/\W/g, '')})`}
        strokeWidth="11" strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - clamped)}
        transform="rotate(-90 80 80)"
        style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(.2,.85,.25,1)',
                 filter: `drop-shadow(0 0 10px ${accent})` }}
      />
      <text x="80" y="76" textAnchor="middle" fontSize="30" fontWeight="900" fill="#fff"
            letterSpacing="-1">{value}</text>
      <text x="80" y="98" textAnchor="middle" fontSize="9" fontWeight="800" fill="rgba(255,255,255,.5)"
            letterSpacing="2.2">{label.toUpperCase()}</text>
    </svg>
  )
}

/* ── SVG: horizontal comparison bars ────────────────────────────── */

export function CompareBars({
  rows, unit = '', invert = false, highlight,
}: {
  rows: { id: number; name: string; value: number; accent: string }[]
  unit?: string
  invert?: boolean
  highlight?: number | null
}) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="sr-stack">
      {rows.map((r, i) => (
        <div key={r.id} className="sr-rise" style={{ animationDelay: `${i * 55}ms` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{
              fontSize: '.74rem', fontWeight: 750,
              color: highlight === r.id ? '#fff' : 'rgba(255,255,255,.75)',
            }}>
              {r.name}
            </span>
            <span style={{ fontSize: '.74rem', fontWeight: 900, color: r.accent }}>
              {r.value.toLocaleString()}{unit}
            </span>
          </div>
          <div style={{
            height: 8, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden',
          }}>
            <div
              className="sr-bar-w"
              style={{
                width: `${(r.value / max) * 100}%`,
                height: '100%',
                borderRadius: 999,
                background: invert
                  ? `linear-gradient(90deg, ${r.accent}, rgba(255,255,255,.35))`
                  : `linear-gradient(90deg, ${r.accent}, ${r.accent}88)`,
                boxShadow: `0 0 12px -2px ${r.accent}`,
                animationDelay: `${i * 55}ms`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Confetti burst ─────────────────────────────────────────────── */

const CONFETTI_COLOURS = ['#ffd666', '#7c5cff', '#ff5fa2', '#4ade80', '#38bdf8', '#fb923c']

export function Confetti({ count = 90 }: { count?: number }) {
  const pieces = useRef(
    Array.from({ length: count }, (_, i) => ({
      left: (i * 37 % 100) + Math.random() * 3,
      dx: `${(Math.random() * 60 - 30).toFixed(0)}px`,
      rot: `${(Math.random() * 1080 + 360).toFixed(0)}deg`,
      dur: 3 + Math.random() * 2.6,
      delay: Math.random() * 2.4,
      colour: CONFETTI_COLOURS[i % CONFETTI_COLOURS.length],
      w: 5 + Math.random() * 6,
      h: 9 + Math.random() * 9,
    })),
  ).current

  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) return null

  return (
    <div className="sr-confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="sr-conf"
          style={{
            left: `${p.left}%`,
            width: p.w, height: p.h,
            background: p.colour,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            animationIterationCount: 'infinite',
            '--dx': p.dx,
            '--rot': p.rot,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

/* ── Section heading ────────────────────────────────────────────── */

export function Head({
  eyebrow, title, sub, accentWord,
}: { eyebrow: string; title: ReactNode; sub?: ReactNode; accentWord?: string }) {
  return (
    <header style={{ marginBottom: 20 }} className="sr-rise">
      <div className="sr-eyebrow">{eyebrow}</div>
      <h2 className="sr-h1">
        {title}{accentWord && <> <span className="sr-grad">{accentWord}</span></>}
      </h2>
      {sub && <p className="sr-sub">{sub}</p>}
    </header>
  )
}
