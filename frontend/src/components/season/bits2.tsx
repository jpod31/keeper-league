/**
 * Season Review — the immersive layer.
 *
 * Everything here exists to make the deck feel staged rather than rendered:
 * headlines that arrive word by word, counters whose digits physically roll,
 * a per-week presence strip, and a real oval to stand the Best 23 on.
 *
 * All motion is transform/opacity only, and every piece checks
 * prefers-reduced-motion before it animates.
 */

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { PlayerCard } from './types'
import { ClubMark, initials } from './bits'

export const reduced = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/* ── Beat: the choreography unit ─────────────────────────────────
   Slides schedule their content in beats rather than hand-tuned ms, so a
   slide reads as a sequence instead of everything landing at once. */

export const BEAT = 130

export type Entrance = 'rise' | 'pop' | 'wipe' | 'left' | 'right' | 'blur' | 'drop'

export function Beat({
  at = 0, kind = 'rise', className = '', style, children, as: Tag = 'div',
}: {
  at?: number
  kind?: Entrance
  className?: string
  style?: React.CSSProperties
  children: ReactNode
  as?: 'div' | 'span' | 'header' | 'section'
}) {
  return (
    <Tag
      className={`sr-in sr-in-${kind} ${className}`}
      style={{ animationDelay: `${at * BEAT}ms`, ...style }}
    >
      {children}
    </Tag>
  )
}

/* ── Kinetic headline ────────────────────────────────────────────
   Splits on words (never characters — long AFL surnames turn to soup) and
   lifts each from behind a mask. */

export function Kinetic({
  text, at = 0, accentFrom, className = '',
}: { text: string; at?: number; accentFrom?: number; className?: string }) {
  const words = text.split(' ').filter(Boolean)
  return (
    <span className={`sr-kin ${className}`}>
      {words.map((w, i) => (
        <span className="sr-kin-mask" key={`${w}-${i}`}>
          <span
            className={`sr-kin-w${accentFrom !== undefined && i >= accentFrom ? ' sr-grad' : ''}`}
            style={{ animationDelay: `${at * BEAT + i * 70}ms` }}
          >
            {w}
          </span>
        </span>
      ))}
    </span>
  )
}

/* ── Digit-roll counter ──────────────────────────────────────────
   Each digit is a 0–9 strip that spins two full turns and lands. Reads as a
   scoreboard settling rather than a number fading in. */

export function Roll({
  value, at = 0, className = '',
}: { value: number; at?: number; className?: string }) {
  const text = Math.round(value).toLocaleString()
  if (reduced()) return <span className={className}>{text}</span>
  return (
    <span className={`sr-roll ${className}`} aria-label={text}>
      {text.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span className="sr-roll-col" key={i} aria-hidden>
            <span
              className="sr-roll-strip"
              style={{ '--d': Number(ch), animationDelay: `${at * BEAT + i * 55}ms` } as React.CSSProperties}
            >
              {'0123456789012345678901234567890'.split('').map((d, j) => (
                <span key={j}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span className="sr-roll-sep" key={i} aria-hidden>{ch}</span>
        ),
      )}
    </span>
  )
}

/* ── Presence strip ──────────────────────────────────────────────
   One cell per round of the season. Height carries the score, colour carries
   the state — so a glance shows both "was he in?" and "did he deliver?".

     2  named and played      1  club had no game (Opening Round / bye)
     0  named but didn't play  -1  left out of the 23
*/

export function Presence({
  weeks, pts, rounds, accent, at = 0, compact = false,
}: {
  weeks: number[]
  pts: number[]
  rounds: number[]
  accent: string
  at?: number
  compact?: boolean
}) {
  const peak = Math.max(120, ...pts)
  return (
    <div
      className={`sr-pres${compact ? ' compact' : ''}`}
      style={{ '--pres': accent } as React.CSSProperties}
      role="img"
      aria-label={`Weeks in the 23: ${weeks.filter(w => w === 2).length} of ${weeks.filter(w => w !== 1).length}`}
    >
      {weeks.map((w, i) => {
        const score = pts[i] || 0
        const h = w === 2 ? Math.max(0.22, Math.min(1, score / peak)) : w === 0 ? 0.14 : 0.1
        const cls = w === 2 ? 'played' : w === 1 ? 'bye' : w === 0 ? 'dnp' : 'out'
        return (
          <span
            className={`sr-pres-cell ${cls}`}
            key={i}
            style={{
              '--h': h,
              animationDelay: `${at * BEAT + i * 22}ms`,
            } as React.CSSProperties}
            title={
              w === 2 ? `R${rounds[i]} · ${score}`
                : w === 1 ? `R${rounds[i]} · club bye`
                  : w === 0 ? `R${rounds[i]} · named, didn't play`
                    : `R${rounds[i]} · left out`
            }
          />
        )
      })}
    </div>
  )
}

export function PresenceKey() {
  return (
    <div className="sr-pres-key">
      <span><i className="k played" />Played</span>
      <span><i className="k dnp" />Named, out</span>
      <span><i className="k bye" />Club bye</span>
      <span><i className="k out" />Dropped</span>
    </div>
  )
}

/* ── The oval ────────────────────────────────────────────────────
   A real AFL ground for the Best 23: boundary, centre square and circle,
   50m arcs, goal squares. Players are HTML chips positioned over it, so club
   marks and names keep normal text rendering. */

const OVAL_ROWS: Record<string, number[]> = {
  // code -> the y fractions each successive row of that line sits on
  FWD: [0.10, 0.225],
  MID: [0.36, 0.615, 0.735],
  RUC: [0.485],
  FLEX: [0.485],
  DEF: [0.845, 0.93],
}

/** Rows near the ends of the ground are narrower — the boundary curves in,
 *  and a chip hanging off the turf looks broken. */
function ovalSpan(y: number): number {
  const fromCentre = Math.abs(y - 0.5) * 2      // 0 at centre, 1 at the ends
  return 0.56 - 0.2 * fromCentre * fromCentre
}

function ovalX(count: number, i: number, y: number): number {
  if (count === 1) return 0.5
  const span = count >= 3 ? ovalSpan(y) : ovalSpan(y) * 0.62
  return 0.5 - span / 2 + (span * i) / (count - 1)
}

/** Team-sheet convention: everything after the given name, so
 *  "Nasiah Wanganeen-Milera" -> "Wanganeen-Milera" and "Callum Ah Chee"
 *  -> "Ah Chee". */
function surname(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? parts.slice(1).join(' ') : name
}

export function Oval({
  lines, at = 0,
}: { lines: { code: string; players: PlayerCard[] }[]; at?: number }) {
  const placed: { p: PlayerCard; x: number; y: number; i: number }[] = []
  let order = 0

  for (const line of lines) {
    const rows = OVAL_ROWS[line.code] || [0.5]
    const perRow = Math.ceil(line.players.length / rows.length) || 1
    line.players.forEach((p, idx) => {
      const rowIdx = Math.min(rows.length - 1, Math.floor(idx / perRow))
      const inRow = line.players.slice(rowIdx * perRow, rowIdx * perRow + perRow)
      const posInRow = idx - rowIdx * perRow
      const y = rows[rowIdx]
      let x = ovalX(inRow.length, posInRow, y)
      // Ruck and flex share the centre bounce — push them wide of the circle
      // and of each other so neither chip sits on top of the other.
      if (line.code === 'RUC') x = 0.245
      if (line.code === 'FLEX') x = 0.755
      placed.push({ p, x, y, i: order++ })
    })
  }

  return (
    <div className="sr-oval">
      <svg className="sr-oval-bg" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden>
        <defs>
          <radialGradient id="srTurf" cx="50%" cy="42%" r="72%">
            <stop offset="0%" stopColor="#1d6b46" />
            <stop offset="55%" stopColor="#125437" />
            <stop offset="100%" stopColor="#07281b" />
          </radialGradient>
          <linearGradient id="srMow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <clipPath id="srGround">
          <ellipse cx="500" cy="400" rx="492" ry="392" />
        </clipPath>
        <ellipse cx="500" cy="400" rx="492" ry="392" fill="url(#srTurf)" />
        {/* mow stripes, clipped to the turf so nothing squares off the ground */}
        <g clipPath="url(#srGround)">
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x="0" y={i * 57} width="1000" height="28.5"
                  fill="#ffffff" opacity={i % 2 ? 0.03 : 0} />
          ))}
        </g>
        <ellipse cx="500" cy="400" rx="492" ry="392" fill="none"
                 stroke="rgba(255,255,255,.5)" strokeWidth="3" />
        <ellipse cx="500" cy="400" rx="440" ry="345" fill="none"
                 stroke="rgba(255,255,255,.16)" strokeWidth="2" strokeDasharray="10 12" />
        {/* centre square + circles */}
        <rect x="390" y="290" width="220" height="220" fill="none"
              stroke="rgba(255,255,255,.42)" strokeWidth="2.5" />
        <circle cx="500" cy="400" r="52" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="2.5" />
        <circle cx="500" cy="400" r="18" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="2.5" />
        <line x1="500" y1="348" x2="500" y2="452" stroke="rgba(255,255,255,.3)" strokeWidth="2" />
        {/* goal squares + 50m arcs, both ends */}
        <rect x="437" y="8" width="126" height="66" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2.5" />
        <rect x="437" y="726" width="126" height="66" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="2.5" />
        <path d="M250,74 A280,240 0 0 0 750,74" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="2.5" />
        <path d="M250,726 A280,240 0 0 1 750,726" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="2.5" />
        {/* goal + behind posts */}
        {[437, 563].map(x => (
          <g key={x}>
            <line x1={x} y1="8" x2={x} y2="-16" stroke="rgba(255,255,255,.75)" strokeWidth="4" />
            <line x1={x} y1="792" x2={x} y2="816" stroke="rgba(255,255,255,.75)" strokeWidth="4" />
          </g>
        ))}
      </svg>

      {placed.map(({ p, x, y, i }) => (
        <div
          className={`sr-oval-chip${p.ever_present ? ' iron' : ''}`}
          key={`${p.id}-${i}`}
          style={{
            left: `${x * 100}%`,
            top: `${y * 100}%`,
            '--sr-club': p.club_bg,
            animationDelay: `${at * BEAT + i * 46}ms`,
          } as React.CSSProperties}
        >
          <ClubMark p={p} />
          <div className="sr-oval-body">
            <span className="sr-oval-name" title={p.name}>{surname(p.name)}</span>
            <span className="sr-oval-sub">{p.team_name}</span>
          </div>
          <span className="sr-oval-avg">{p.avg}</span>
          {p.ever_present && <i className="bi bi-shield-fill-check sr-oval-iron" title="Never missed a week" />}
        </div>
      ))}
    </div>
  )
}

/* ── Ticker ──────────────────────────────────────────────────────
   A slow marquee of one-line facts. Cheap way to make a slide feel alive
   without another chart. */

export function Ticker({ items }: { items: string[] }) {
  if (!items.length) return null
  const loop = [...items, ...items]
  return (
    <div className="sr-ticker" aria-hidden>
      <div className="sr-ticker-track">
        {loop.map((t, i) => <span key={i}>{t}</span>)}
      </div>
    </div>
  )
}

/* ── Pointer parallax ────────────────────────────────────────────
   Publishes normalised pointer position as CSS vars on the root so the
   background planes and content can drift at different rates. */

export function useParallax(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || reduced()) return
    let raf = 0
    let tx = 0, ty = 0, cx = 0, cy = 0
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2
      ty = (e.clientY / window.innerHeight - 0.5) * 2
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const tick = () => {
      cx += (tx - cx) * 0.08
      cy += (ty - cy) * 0.08
      el.style.setProperty('--px', cx.toFixed(4))
      el.style.setProperty('--py', cy.toFixed(4))
      raf = Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001
        ? requestAnimationFrame(tick)
        : 0
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref])
}

/* ── Team crest with an ever-present shield ──────────────────────*/

export function IronBadge({ played, available }: { played: number; available: number }) {
  if (!available || played < available) return null
  return (
    <span className="sr-iron" title={`Played every one of ${available} weeks`}>
      <i className="bi bi-shield-fill-check" />Ever-present
    </span>
  )
}

export { initials }
