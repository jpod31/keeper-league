import { useId } from 'react'

/* The honours emblems: metal and enamel pieces drawn in SVG, one shape per
   honour, the metal set by how many times he has won it (models/player_honours.py
   tier_for). Agreed on the honours cabinet page, 2026-11-26. */

export type Tier = 'gold' | 'plat' | 'ruby' | 'sapph' | 'black' | 'silver' | 'bronze'
export type Kind = 'premiership' | 'champion' | 'leaguemedal' | 'allleague' | 'topscorer' | 'rising'
  | 'matchwinner' | 'rock' | 'breakout' | 'bargain' | 'captain' | 'clubgames' | 'leaguegames'

const METAL: Record<string, string[]> = {
  gold: ['#fff6cf', '#f0c35a', '#b07d22', '#5c3b08'],
  silver: ['#ffffff', '#dfe3ea', '#9aa1ad', '#3f4550'],
  bronze: ['#ffe0bf', '#d99a5b', '#9b5d27', '#4a2a0c'],
  plat: ['#ffffff', '#e3f3f7', '#9cc3cc', '#3d6670'],
  black: ['#9a9aa4', '#45454e', '#1e1e24', '#08080a'],
}
const TIER: Record<Tier, { m: string; e: string; g: string }> = {
  gold: { m: 'gold', e: '#121419', g: 'gold' },
  plat: { m: 'plat', e: '#0f1f36', g: 'plat' },
  ruby: { m: 'gold', e: '#6d1020', g: 'gold' },
  sapph: { m: 'plat', e: '#0b2c6b', g: 'plat' },
  black: { m: 'black', e: '#050506', g: 'gold' },
  silver: { m: 'silver', e: '#121419', g: 'silver' },
  bronze: { m: 'bronze', e: '#121419', g: 'bronze' },
}

function grads(id: string, t: Tier) {
  const m = METAL[TIER[t].m], g = METAL[TIER[t].g]
  return `<defs>
  <linearGradient id="m${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m[0]}"/><stop offset=".35" stop-color="${m[1]}"/><stop offset=".7" stop-color="${m[2]}"/><stop offset="1" stop-color="${m[3]}"/></linearGradient>
  <linearGradient id="r${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m[3]}"/><stop offset=".5" stop-color="${m[2]}"/><stop offset="1" stop-color="${m[0]}"/></linearGradient>
  <linearGradient id="g${id}" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset=".45" stop-color="${g[1]}"/><stop offset="1" stop-color="${g[2]}"/></linearGradient>
  <radialGradient id="e${id}" cx=".5" cy=".3" r=".8"><stop offset="0" stop-color="${TIER[t].e}" stop-opacity=".75"/><stop offset="1" stop-color="${TIER[t].e}"/></radialGradient>
  </defs>`
}
const sc = (k: number, cx: number, cy: number) => `transform="translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})"`
function starPts(cx: number, cy: number, R: number, r: number, n = 5, rot = -90) {
  const p: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const a = (rot + i * 180 / n) * Math.PI / 180, rr = i % 2 ? r : R
    p.push((cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2))
  }
  return p.join(' ')
}
function laurel(id: string, cx: number, cy: number, R: number, from: number, to: number, n: number, side: number) {
  let s = ''
  for (let i = 0; i < n; i++) {
    const a = (from + (to - from) * i / (n - 1)) * Math.PI / 180
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a)
    const deg = a * 180 / Math.PI + (side > 0 ? 55 : 125)
    s += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="2.4" ry="5.2" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="url(#g${id})" stroke="#000" stroke-opacity=".35" stroke-width=".5"/>`
  }
  return s
}
function body(id: string, d: string, cx: number, cy: number, black: boolean) {
  const edge = black ? ' stroke="#f0c35a" stroke-width="1.6"' : ''
  return `<path d="${d}" fill="#000" opacity=".55" transform="translate(0 3)"/>
  <path d="${d}" fill="url(#m${id})"${edge}/>
  <path d="${d}" fill="url(#r${id})" ${sc(.92, cx, cy)}/>
  <path d="${d}" fill="url(#e${id})" ${sc(.85, cx, cy)}/>
  <path d="${d}" fill="none" stroke="url(#m${id})" stroke-width="1" opacity=".55" ${sc(.78, cx, cy)}/>`
}
const num = (id: string, x: number, y: number, txt: string, size: number) =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="Geist,Inter,system-ui,sans-serif" font-weight="900" font-size="${size}" letter-spacing="-1" fill="url(#g${id})" stroke="#000" stroke-opacity=".45" stroke-width=".8">${txt}</text>`
const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`
function polyD(cx: number, cy: number, r: number, n: number, rot: number) {
  const p: string[] = []
  for (let i = 0; i < n; i++) { const a = (rot + i * 360 / n) * Math.PI / 180; p.push((cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2)) }
  return 'M' + p.join(' L') + 'Z'
}
function burstD(cx: number, cy: number, R: number, r: number, n: number) {
  const p: string[] = []
  for (let i = 0; i < n * 2; i++) { const a = (-90 + i * 180 / n) * Math.PI / 180, rr = i % 2 ? r : R; p.push((cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2)) }
  return 'M' + p.join(' L') + 'Z'
}
const ribbonV = `<path d="M34 4 H52 L62 46 H46 Z" fill="#f2f2f4"/><path d="M40 4 H46 L56 46 H50 Z" fill="#111"/>
  <path d="M86 4 H68 L58 46 H74 Z" fill="#f2f2f4"/><path d="M80 4 H74 L64 46 H70 Z" fill="#111"/>`
const cup = (id: string, cx: number, cy: number, k = 1) => `<g transform="translate(${cx} ${cy}) scale(${k})" stroke="#000" stroke-opacity=".45" stroke-width=".8">
  <path d="M-13 -16 H13 V-8 C13 3 7 9 0 9 C-7 9 -13 3 -13 -8 Z" fill="url(#g${id})"/>
  <path d="M-13 -12 C-22 -12 -22 0 -11 1 M13 -12 C22 -12 22 0 11 1" fill="none" stroke="url(#g${id})" stroke-width="3.2" stroke-opacity="1"/>
  <rect x="-3" y="9" width="6" height="6" fill="url(#g${id})"/><path d="M-10 15 H10 L12 21 H-12 Z" fill="url(#g${id})"/>
  <path d="M-15 -18 H15 V-15 H-15 Z" fill="url(#g${id})"/></g>`
const star = (id: string, cx: number, cy: number, R: number, r: number) =>
  `<polygon points="${starPts(cx, cy, R, r)}" fill="url(#g${id})" stroke="#000" stroke-opacity=".45" stroke-width=".8"/>`

type Draw = (id: string, b: boolean, label: string) => string
const KINDS: Record<Kind, Draw> = {
  premiership: (id, b) => {
    const d = 'M22 22 H98 V32 L60 112 L22 32 Z'
    return `<rect x="10" y="10" width="100" height="9" rx="4.5" fill="#000" opacity=".5" transform="translate(0 3)"/>
      <rect x="10" y="10" width="100" height="9" rx="4.5" fill="url(#m${id})"/>
      <circle cx="10" cy="14.5" r="6" fill="url(#m${id})"/><circle cx="110" cy="14.5" r="6" fill="url(#m${id})"/>
      ${body(id, d, 60, 52, b)}<path d="M30 36 H90" stroke="url(#g${id})" stroke-width="2"/>${cup(id, 60, 60, 1.05)}`
  },
  champion: (id, b) => ribbonV + body(id, circ(60, 76, 38), 60, 76, b)
    + laurel(id, 60, 76, 24, 115, 215, 7, -1) + laurel(id, 60, 76, 24, 65, -35, 7, 1) + star(id, 60, 74, 15, 6.3),
  leaguemedal: (id, b) => `<path d="M46 4 H74 L70 30 H50 Z" fill="#f2f2f4"/><path d="M56 4 H64 L62 30 H58 Z" fill="#111"/>`
    + body(id, burstD(60, 72, 44, 36, 18), 60, 72, b)
    + `<circle cx="60" cy="72" r="20" fill="none" stroke="url(#g${id})" stroke-width="2"/>` + star(id, 60, 72, 14, 5.6),
  allleague: (id, b) => body(id, 'M60 6 L104 20 V54 C104 82 86 102 60 114 C34 102 16 82 16 54 V20 Z', 60, 58, b)
    + `<polygon points="${starPts(40, 38, 7.5, 3.1)}" fill="url(#g${id})"/><polygon points="${starPts(60, 33, 9, 3.7)}" fill="url(#g${id})"/><polygon points="${starPts(80, 38, 7.5, 3.1)}" fill="url(#g${id})"/>
       <path d="M30 50 H90" stroke="url(#g${id})" stroke-width="1.6"/>` + num(id, 60, 88, '23', 34),
  topscorer: (id, b) => body(id, 'M14 92 L10 36 L36 60 L60 20 L84 60 L110 36 L106 92 Z', 60, 62, b)
    + `<rect x="14" y="92" width="92" height="16" rx="3" fill="#000" opacity=".5" transform="translate(0 3)"/>
       <rect x="14" y="92" width="92" height="16" rx="3" fill="url(#m${id})"/>
       <circle cx="10" cy="34" r="6" fill="url(#g${id})"/><circle cx="60" cy="18" r="7" fill="url(#g${id})"/><circle cx="110" cy="34" r="6" fill="url(#g${id})"/>
       <circle cx="38" cy="100" r="3.5" fill="#c3243a"/><circle cx="60" cy="100" r="3.5" fill="#1f5fd1"/><circle cx="82" cy="100" r="3.5" fill="#c3243a"/>
       <path d="M60 46 L66 64 L60 82 L54 64 Z" fill="url(#g${id})" stroke="#000" stroke-opacity=".4" stroke-width=".8"/>`,
  rising: (id, b) => `<path d="M8 104 L44 74" stroke="url(#m${id})" stroke-width="5" stroke-linecap="round" opacity=".9"/>
      <path d="M4 86 L34 66" stroke="url(#m${id})" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      <path d="M26 112 L52 84" stroke="url(#m${id})" stroke-width="3" stroke-linecap="round" opacity=".6"/>`
    + body(id, 'M' + starPts(66, 58, 48, 21).split(' ').join(' L') + 'Z', 66, 60, b) + star(id, 66, 59, 15, 6.5),
  matchwinner: (id, b) => {
    let ticks = ''
    for (let i = 0; i < 12; i++) {
      const a = i * 30 * Math.PI / 180, r1 = i % 3 ? 27 : 24, r2 = 31
      ticks += `<path d="M${(60 + r1 * Math.sin(a)).toFixed(2)} ${(66 - r1 * Math.cos(a)).toFixed(2)} L${(60 + r2 * Math.sin(a)).toFixed(2)} ${(66 - r2 * Math.cos(a)).toFixed(2)}" stroke="url(#g${id})" stroke-width="${i % 3 ? 1.6 : 3}"/>`
    }
    return `<rect x="52" y="6" width="16" height="10" rx="2" fill="url(#m${id})"/><rect x="56" y="14" width="8" height="10" fill="url(#m${id})"/>
      <rect x="92" y="20" width="10" height="7" rx="2" fill="url(#m${id})" transform="rotate(45 97 23)"/>`
      + body(id, circ(60, 66, 44), 60, 66, b) + ticks
      + `<path d="M60 66 L60 35 A31 31 0 0 1 75.5 39.2 Z" fill="#d22a3c" opacity=".9"/>
       <path d="M60 66 L60 36" stroke="url(#g${id})" stroke-width="3.5" stroke-linecap="round"/>
       <circle cx="60" cy="66" r="5" fill="url(#g${id})" stroke="#000" stroke-opacity=".4"/>`
  },
  rock: (id, b) => {
    let riv = ''
    for (let i = 0; i < 8; i++) {
      const a = (22.5 + i * 45) * Math.PI / 180
      riv += `<circle cx="${(60 + 40 * Math.cos(a)).toFixed(2)}" cy="${(62 + 40 * Math.sin(a)).toFixed(2)}" r="2.6" fill="url(#g${id})" stroke="#000" stroke-opacity=".4" stroke-width=".6"/>`
    }
    return body(id, polyD(60, 62, 50, 8, 22.5), 60, 62, b) + riv
      + `<path d="M30 82 L50 46 L60 60 L70 42 L92 82 Z" fill="url(#g${id})" stroke="#000" stroke-opacity=".45" stroke-width=".8"/>
       <path d="M50 46 L45 56 L55 54 Z M70 42 L64 54 L76 52 Z" fill="#fff" opacity=".55"/>`
  },
  bargain: (id, b) => body(id, 'M24 34 L42 12 H78 L96 34 L60 112 Z', 60, 52, b)
    + `<g fill="none" stroke="url(#g${id})" stroke-width="1.6" stroke-linejoin="round">
       <path d="M30 36 H90"/><path d="M47 20 L42 36 L60 96 L78 36 L73 20"/><path d="M42 36 L60 20 L78 36"/></g>
       <path d="M60 20 L42 36 H78 Z" fill="url(#g${id})" opacity=".85"/>`,
  breakout: (id, b) => body(id, 'M60 6 L108 54 H82 V112 H38 V54 H12 Z', 60, 60, b)
    + `<g fill="none" stroke="url(#g${id})" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
       <path d="M44 74 L60 58 L76 74"/><path d="M44 94 L60 78 L76 94" opacity=".7"/></g>`,
  captain: (id, b) => body(id, 'M8 40 Q60 28 112 40 V84 Q60 72 8 84 Z', 60, 62, b)
    + `<path d="M8 40 Q60 28 112 40" fill="none" stroke="url(#g${id})" stroke-width="2"/><path d="M8 84 Q60 72 112 84" fill="none" stroke="url(#g${id})" stroke-width="2"/>`
    + num(id, 60, 76, 'C', 40),
  clubgames: (id, b, label) => body(id, 'M38 12 L22 20 L6 44 L22 54 L28 48 V112 H92 V48 L98 54 L114 44 L98 20 L82 12 C77 22 69 26 60 26 C51 26 43 22 38 12 Z', 60, 60, b)
    + `<path d="M38 12 C43 22 51 26 60 26 C69 26 77 22 82 12" fill="none" stroke="url(#g${id})" stroke-width="2.4"/>`
    + num(id, 60, 90, label, label.length > 2 ? 27 : 42),
  leaguegames: (id, b, label) => body(id, polyD(60, 62, 52, 6, -90), 60, 62, b)
    + laurel(id, 60, 62, 33, 105, 160, 4, -1) + laurel(id, 60, 62, 33, 75, 20, 4, 1)
    + `<polygon points="${starPts(60, 34, 6, 2.5)}" fill="url(#g${id})"/>`
    + num(id, 60, 72, label, label.length > 2 ? 26 : 34),
}

export function emblemSvg(kind: Kind, tier: Tier, label: string, uid: string) {
  const id = uid.replace(/[^a-zA-Z0-9]/g, '')
  return grads(id, tier) + KINDS[kind](id, tier === 'black', label)
}

interface Props {
  kind: Kind
  tier: Tier
  /** The number on a milestone emblem. */
  label?: string | number
  size?: number
  title?: string
  className?: string
  /** Drawn faint: an honour he has not reached yet. */
  locked?: boolean
}

export function Emblem({ kind, tier, label, size = 56, title, className, locked }: Props) {
  const uid = useId()
  return (
    <svg className={`emblem${locked ? ' emblem-locked' : ''}${className ? ' ' + className : ''}`} width={size} height={size * 124 / 120}
      viewBox="0 -2 120 124" role="img" aria-label={title || kind}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title.replace(/[<&>]/g, '')}</title>` : '') + emblemSvg(kind, tier, label != null ? String(label) : '', uid) }} />
  )
}

/** Gold stars above an emblem, one per win, two to four. */
export function EmblemStars({ n }: { n: number }) {
  if (n < 2 || n > 4) return null
  return (
    <span className="emblem-stars" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20"><polygon points={starPts(10, 10.5, 9.5, 4)} fill="#f0c35a" /></svg>
      ))}
    </span>
  )
}

export interface HonourEmblem {
  kind: Kind; name: string; tier: Tier; times: number; step: number | null
  items: { year: number | null; team: string; detail: string }[]
}
export interface Honours {
  emblems: HonourEmblem[]
  next: { kind: Kind; name: string; step: number; games: number; to_go: number; team: string; tier: Tier } | null
}

/** One line under an emblem: "Club champion" or "Match winner x3". */
export function emblemLabel(e: HonourEmblem) {
  if (e.step) return `${e.step} ${e.kind === 'clubgames' ? 'club' : 'league'} games`
  return e.times > 1 ? `${e.name} x${e.times}` : e.name
}

/** What a tap or hover says: every time he won it. */
export function emblemTitle(e: HonourEmblem) {
  const head = emblemLabel(e)
  const lines = e.items.map(i => [i.year, i.detail].filter(Boolean).join(', '))
  return [head, ...lines].join('\n')
}
