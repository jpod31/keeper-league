import { useId } from 'react'

/* Honours v3 emblems (2026-11-27): every honour is its own object, drawn as a
   real piece in SVG, the metal set by how many times he has won it
   (models/player_honours.py tier_for). 7s honours carry a stylised purple 7.
   Drawings agreed on the honours proposal (artifact 6Bp96JykZHQTjzFspYyx8M). */

export type Tier = 'gold' | 'plat' | 'ruby' | 'sapph' | 'black' | 'silver' | 'bronze'
export type Kind = 'flag' | 'keepermedal' | 'champion' | 'allleague' | 'rising' | 'siren'
  | 'flag7' | 'medal7' | 'calledup' | 'clubgames' | 'triple' | 'hof' | 'legend'

const MET: Record<string, string[]> = {
  gold: ['#fff8d6', '#f4cf6a', '#c08a26', '#6b4309'],
  silver: ['#ffffff', '#e4e8ee', '#a3aab6', '#4a505b'],
  bronze: ['#ffe2c4', '#e0a067', '#a3632b', '#4f2c0d'],
  plat: ['#ffffff', '#e8f6fa', '#a9cdd6', '#46707a'],
  black: ['#b9b9c4', '#5a5a64', '#26262d', '#0b0b0d'],
}
const TIERS: Record<Tier, { m: string; base: [string, string]; gold?: boolean }> = {
  gold: { m: 'gold', base: ['#2c2c33', '#0b0b0e'] },
  plat: { m: 'plat', base: ['#2c2c33', '#0b0b0e'] },
  ruby: { m: 'gold', base: ['#6e1424', '#2a050c'] },
  sapph: { m: 'plat', base: ['#143a86', '#06142f'] },
  black: { m: 'black', base: ['#1a1a1f', '#020203'], gold: true },
  silver: { m: 'silver', base: ['#2c2c33', '#0b0b0e'] },
  bronze: { m: 'bronze', base: ['#2c2c33', '#0b0b0e'] },
}

function defs(id: string, tier: Tier) {
  const t = TIERS[tier], m = MET[t.m], g = t.gold ? MET.gold : m
  return `<defs>
  <linearGradient id="c${id}" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${m[3]}"/><stop offset=".16" stop-color="${m[2]}"/><stop offset=".36" stop-color="${m[1]}"/><stop offset=".47" stop-color="${m[0]}"/><stop offset=".58" stop-color="${m[1]}"/><stop offset=".84" stop-color="${m[2]}"/><stop offset="1" stop-color="${m[3]}"/></linearGradient>
  <linearGradient id="f${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${g[0]}"/><stop offset=".35" stop-color="${g[1]}"/><stop offset=".72" stop-color="${g[2]}"/><stop offset="1" stop-color="${g[3]}"/></linearGradient>
  <linearGradient id="d${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m[2]}"/><stop offset="1" stop-color="${m[3]}"/></linearGradient>
  <radialGradient id="r${id}" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="${m[0]}"/><stop offset=".35" stop-color="${m[1]}"/><stop offset=".8" stop-color="${m[2]}"/><stop offset="1" stop-color="${m[3]}"/></radialGradient>
  <linearGradient id="b${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.base[0]}"/><stop offset="1" stop-color="${t.base[1]}"/></linearGradient>
  <linearGradient id="p${id}" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#d6c4ff"/><stop offset=".4" stop-color="#9461ff"/><stop offset="1" stop-color="#4a17a8"/></linearGradient>
  </defs>`
}
const L = 'stroke="#000" stroke-opacity=".4" stroke-width=".7"'
const FONT = 'font-family="Geist,system-ui,sans-serif" font-weight="900"'

function plinth(id: string, cx: number, top: number, w: number, h = 15) {
  const x = cx - w / 2
  return `<ellipse cx="${cx}" cy="${top + h + 1.5}" rx="${w / 2 + 2}" ry="2.6" fill="#000" opacity=".55"/>
  <rect x="${x + 5}" y="${top - 5}" width="${w - 10}" height="6" rx="1.2" fill="url(#b${id})"/>
  <rect x="${x + 5}" y="${top - 5}" width="${w - 10}" height="1.2" fill="#fff" opacity=".18"/>
  <rect x="${x}" y="${top}" width="${w}" height="${h}" rx="2" fill="url(#b${id})"/>
  <rect x="${x}" y="${top}" width="${w}" height="1.4" fill="#fff" opacity=".2"/>
  <rect x="${cx - 12}" y="${top + 4.5}" width="24" height="${h - 9}" rx="1" fill="url(#f${id})"/>`
}
function starPts(cx: number, cy: number, R: number, r: number, n = 5, rot = -90): [number, number][] {
  const p: [number, number][] = []
  for (let i = 0; i < n * 2; i++) { const a = (rot + i * 180 / n) * Math.PI / 180, rr = i % 2 ? r : R; p.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]) }
  return p
}
const pts = (a: [number, number][]) => a.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join(' ')
function facetStar(id: string, cx: number, cy: number, R: number, r: number, n = 5) {
  const p = starPts(cx, cy, R, r, n)
  let s = ''
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length]
    s += `<polygon points="${pts([[cx, cy], a, b])}" fill="${i % 2 ? `url(#d${id})` : `url(#f${id})`}"/>`
  }
  return s + `<polygon points="${pts(p)}" fill="none" ${L}/>`
}
function leaves(id: string, cx: number, cy: number, R: number, from: number, to: number, n: number, side: number) {
  let s = ''
  for (let i = 0; i < n; i++) {
    const a = (from + (to - from) * i / (n - 1)) * Math.PI / 180, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a)
    const deg = a * 180 / Math.PI + (side > 0 ? 50 : 130)
    s += `<ellipse cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" rx="2.6" ry="6" transform="rotate(${deg.toFixed(1)} ${x.toFixed(2)} ${y.toFixed(2)})" fill="url(#f${id})" ${L}/>`
  }
  return s
}
function footy(id: string, cx: number, cy: number, rx: number, ry: number, rot: number, fill?: string) {
  return `<g transform="rotate(${rot} ${cx} ${cy})">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill || `url(#r${id})`}" ${L}/>
    <path d="M${cx - rx * .92} ${cy} Q${cx} ${cy - ry * .32} ${cx + rx * .92} ${cy}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>
    ${[-.35, -.17, 0, .17, .35].map(f => `<path d="M${cx + rx * f} ${cy - ry * .22 - 2.6} v5" stroke="#fff" stroke-opacity=".85" stroke-width="1.5" stroke-linecap="round"/>`).join('')}
    <ellipse cx="${cx - rx * .3}" cy="${cy - ry * .45}" rx="${rx * .35}" ry="${ry * .16}" fill="#fff" opacity=".35"/></g>`
}
function cup(id: string, cx: number, top: number, k = 1) {
  return `<g transform="translate(${cx} ${top}) scale(${k}) translate(-60 -8)">
    <path d="M37 33 C21 31 19 55 41 59" fill="none" stroke="url(#c${id})" stroke-width="5.2" stroke-linecap="round"/>
    <path d="M83 33 C99 31 101 55 79 59" fill="none" stroke="url(#c${id})" stroke-width="5.2" stroke-linecap="round"/>
    <path d="M37 33 C21 31 19 55 41 59 M83 33 C99 31 101 55 79 59" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.1"/>
    <path d="M44 93 C46 87 53 85 56 80 H64 C67 85 74 87 76 93 Z" fill="url(#c${id})" ${L}/>
    <rect x="56.5" y="66" width="7" height="15" fill="url(#c${id})"/>
    <ellipse cx="60" cy="74" rx="6.5" ry="2.8" fill="url(#c${id})" ${L}/>
    <path d="M36 30 H84 C84 50 76 63 60 67 C44 63 36 50 36 30 Z" fill="url(#c${id})" ${L}/>
    <path d="M37.6 41 H82.4" stroke="url(#f${id})" stroke-width="2.4"/>
    <path d="M38.5 44 H81.5" stroke="#000" stroke-opacity=".25" stroke-width=".8"/>
    <ellipse cx="60" cy="30" rx="24" ry="4.6" fill="url(#f${id})" ${L}/>
    <path d="M41 29 C43 20 51 16 60 16 C69 16 77 20 79 29 Z" fill="url(#c${id})" ${L}/>
    <ellipse cx="60" cy="29" rx="19" ry="2.4" fill="url(#f${id})"/>
    <rect x="58.6" y="8" width="2.8" height="9" fill="url(#c${id})"/>
    <circle cx="60" cy="7" r="3.6" fill="url(#r${id})" ${L}/>
    <path d="M43 34 C43 48 48 58 55 63" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2"/></g>`
}

type Shape = (id: string, label: string) => string
const SHAPES: Record<string, Shape> = {
  flag: id => plinth(id, 60, 99, 52) + cup(id, 60, 8),
  keepermedal: id => `
    <path d="M40 13 H80 L75 54 H45 Z" fill="#111116"/>
    <path d="M47 13 L50.5 54 M73 13 L69.5 54" stroke="url(#f${id})" stroke-width="3.4"/>
    <path d="M45 54 L60 62 L75 54 Z" fill="#050507"/>
    <rect x="34" y="4" width="52" height="10" rx="2.5" fill="url(#f${id})" ${L}/>
    <circle cx="34" cy="9" r="5" fill="url(#r${id})" ${L}/><circle cx="86" cy="9" r="5" fill="url(#r${id})" ${L}/>
    <circle cx="60" cy="61" r="5.5" fill="none" stroke="url(#f${id})" stroke-width="3"/>
    <circle cx="60" cy="90" r="27" fill="#000" opacity=".5" transform="translate(0 2)"/>
    <circle cx="60" cy="90" r="27" fill="url(#r${id})" ${L}/>
    <circle cx="60" cy="90" r="22.5" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>
    <circle cx="60" cy="90" r="24.5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8"/>
    ${leaves(id, 60, 90, 17, 110, 200, 5, -1)}${leaves(id, 60, 90, 17, 70, -20, 5, 1)}
    ${footy(id, 60, 88, 10, 6.5, -28, `url(#f${id})`)}`,
  sevensmedal: id => `
    <path d="M40 13 H80 L75 54 H45 Z" fill="#6d3df0"/>
    <path d="M52 13 L54 54 M68 13 L66 54" stroke="#ffffff" stroke-width="4"/>
    <path d="M45 54 L60 62 L75 54 Z" fill="#3a1597"/>
    <rect x="34" y="4" width="52" height="10" rx="2.5" fill="url(#f${id})" ${L}/>
    <circle cx="60" cy="61" r="5.5" fill="none" stroke="url(#f${id})" stroke-width="3"/>
    <polygon points="${pts(starPts(60, 90, 30, 19, 7))}" fill="#000" opacity=".5" transform="translate(0 2)"/>
    ${facetStar(id, 60, 90, 30, 19, 7)}
    <circle cx="60" cy="90" r="12" fill="url(#r${id})" ${L}/>`,
  champion: id => `
    <rect x="22" y="6" width="76" height="108" rx="11" fill="#000" opacity=".5" transform="translate(0 3)"/>
    <rect x="22" y="6" width="76" height="108" rx="11" fill="url(#b${id})"/>
    <rect x="27" y="11" width="66" height="98" rx="8" fill="none" stroke="url(#f${id})" stroke-width="1.3" opacity=".8"/>
    <path d="M60 20 L86 28 V56 C86 74 75 86 60 94 C45 86 34 74 34 56 V28 Z" fill="url(#c${id})" ${L}/>
    <path d="M60 27 L80 33 V56 C80 70 72 80 60 87 C48 80 40 70 40 56 V33 Z" fill="url(#d${id})" opacity=".55"/>
    <path d="M40 58 L60 46 L80 58 V64 L60 52 L40 64 Z" fill="url(#f${id})" ${L}/>
    <polygon points="${pts(starPts(60, 72, 7.5, 3.1))}" fill="url(#f${id})" ${L}/>
    <rect x="44" y="99" width="32" height="6" rx="1" fill="url(#f${id})"/>`,
  // All-League: the blazer of the side, three stars on the pocket
  allleague: id => `
    <path d="M28 28 L46 18 L60 34 L74 18 L92 28 L100 110 H20 Z" fill="#000" opacity=".5" transform="translate(0 3)"/>
    <path d="M28 28 L46 18 L60 34 L74 18 L92 28 L100 110 H20 Z" fill="#15151b"/>
    <path d="M28 28 L46 18 L60 34 L74 18 L92 28 L100 110 H20 Z" fill="none" stroke="url(#f${id})" stroke-width="2"/>
    <path d="M49 19 L60 33 L71 19 Z" fill="#ececf1"/>
    <path d="M57.5 26 L62.5 26 L64 60 L60 66 L56 60 Z" fill="url(#c${id})"/>
    <path d="M46 18 L54 64 L60 34 Z" fill="#0a0a0e" stroke="url(#f${id})" stroke-width="1.2"/>
    <path d="M74 18 L66 64 L60 34 Z" fill="#0a0a0e" stroke="url(#f${id})" stroke-width="1.2"/>
    <path d="M68 50 H90 V66 C90 73 85 78 79 80 C73 78 68 73 68 66 Z" fill="url(#f${id})" ${L}/>
    <text x="79" y="71" text-anchor="middle" ${FONT} font-size="13" fill="#15151b">23</text>
    <circle cx="60" cy="76" r="2.4" fill="url(#r${id})"/><circle cx="60" cy="90" r="2.4" fill="url(#r${id})"/>`,
  rising: id => plinth(id, 60, 101, 38) + `
    <rect x="57" y="66" width="6" height="35" fill="url(#c${id})"/>
    <ellipse cx="60" cy="67" rx="7" ry="2.2" fill="url(#f${id})"/>
    <polygon points="${pts(starPts(60, 39, 33, 14))}" fill="#000" opacity=".45" transform="translate(0 2.5)"/>
    ${facetStar(id, 60, 39, 33, 14)}`,
  siren: id => plinth(id, 60, 101, 40) + `
    <rect x="56.5" y="60" width="7" height="41" fill="url(#c${id})"/>
    <path d="M38 62 L52 54 L83 25 C91 28 96 38 94 47 L60 63 L46 68 Z" fill="url(#c${id})" ${L}/>
    <ellipse cx="89" cy="36" rx="7" ry="12.5" transform="rotate(-38 89 36)" fill="url(#d${id})" ${L}/>
    <ellipse cx="89" cy="36" rx="4.2" ry="9" transform="rotate(-38 89 36)" fill="#0b0b0e"/>
    <circle cx="48" cy="62" r="7" fill="url(#r${id})" ${L}/>
    <path d="M99 18 C106 24 108 34 104 44 M104 9 C115 18 118 34 111 50" fill="none" stroke="url(#f${id})" stroke-width="2.6" stroke-linecap="round"/>`,
  framed: (id, label) => `
    <rect x="14" y="8" width="92" height="104" rx="3" fill="#000" opacity=".5" transform="translate(0 3)"/>
    <rect x="14" y="8" width="92" height="104" rx="3" fill="url(#c${id})" ${L}/>
    <rect x="21" y="15" width="78" height="90" fill="#0d0d11"/>
    <path d="M44 24 L32 30 L24 46 L34 52 L38 48 V96 H82 V48 L86 52 L96 46 L88 30 L76 24 C72 31 66 34 60 34 C54 34 48 31 44 24 Z" fill="#1c1c23" stroke="url(#f${id})" stroke-width="1.5"/>
    <text x="60" y="${label.length > 2 ? 80 : 83}" text-anchor="middle" ${FONT} font-size="${label.length > 2 ? 24 : 32}" letter-spacing="-1" fill="url(#f${id})" ${L}>${label}</text>`,
  key: id => `
    <g transform="rotate(-35 60 60)">
    <circle cx="60" cy="28" r="19" fill="url(#r${id})" ${L}/>
    <circle cx="60" cy="28" r="9" fill="#0b0b0e"/>
    ${[0, 90, 180, 270].map(a => `<circle cx="${60 + 15 * Math.cos(a * Math.PI / 180)}" cy="${28 + 15 * Math.sin(a * Math.PI / 180)}" r="5" fill="url(#f${id})" ${L}/>`).join('')}
    <rect x="56" y="45" width="8" height="64" rx="2" fill="url(#c${id})" ${L}/>
    <rect x="52" y="50" width="16" height="5" rx="1.5" fill="url(#f${id})"/>
    <path d="M64 92 H76 V98 H70 V102 H76 V108 H64 Z" fill="url(#c${id})" ${L}/></g>`,
  triple: id => `
    <path d="M14 92 L10 34 L36 58 L60 18 L84 58 L110 34 L106 92 Z" fill="#000" opacity=".45" transform="translate(0 3)"/>
    <path d="M14 92 L10 34 L36 58 L60 18 L84 58 L110 34 L106 92 Z" fill="url(#c${id})" ${L}/>
    <path d="M14 92 L10 34 L36 58 L60 18 L60 92 Z" fill="#fff" opacity=".12"/>
    <rect x="12" y="90" width="96" height="18" rx="3" fill="url(#f${id})" ${L}/>
    <circle cx="10" cy="32" r="6" fill="url(#r${id})"/><circle cx="60" cy="16" r="7" fill="url(#r${id})"/><circle cx="110" cy="32" r="6" fill="url(#r${id})"/>
    <circle cx="36" cy="99" r="4" fill="#c3243a"/><circle cx="60" cy="99" r="4.5" fill="#1f5fd1"/><circle cx="84" cy="99" r="4" fill="#1f9d55"/>`,
  hof: id => `
    <ellipse cx="60" cy="112" rx="52" ry="3" fill="#000" opacity=".5"/>
    <path d="M10 44 L60 12 L110 44 Z" fill="url(#f${id})" ${L}/>
    <path d="M24 40 L60 18 L96 40 Z" fill="#000" opacity=".22"/>
    <rect x="12" y="44" width="96" height="7" fill="url(#c${id})" ${L}/>
    ${[22, 42, 62, 82].map(x => `<rect x="${x}" y="53" width="12" height="42" fill="url(#c${id})" ${L}/>`).join('')}
    <rect x="8" y="95" width="104" height="7" fill="url(#c${id})" ${L}/>
    <rect x="4" y="102" width="112" height="8" fill="url(#d${id})" ${L}/>
    <polygon points="${pts(starPts(60, 33, 6.5, 2.7))}" fill="#fff" opacity=".9"/>`,
  legend: id => {
    let rays = ''
    for (let i = 0; i < 24; i++) {
      const a = i * 15 * Math.PI / 180, r1 = 30, r2 = i % 2 ? 46 : 54
      rays += `<path d="M${(60 + r1 * Math.cos(a)).toFixed(1)} ${(60 + r1 * Math.sin(a)).toFixed(1)} L${(60 + r2 * Math.cos(a)).toFixed(1)} ${(60 + r2 * Math.sin(a)).toFixed(1)}" stroke="url(#f${id})" stroke-width="${i % 2 ? 2 : 3.4}" stroke-linecap="round"/>`
    }
    return rays + `<circle cx="60" cy="60" r="31" fill="url(#r${id})" ${L}/><circle cx="60" cy="60" r="25" fill="#0b0b0e"/>` + facetStar(id, 60, 61, 20, 8.5)
  },
  ticket: id => `
    <g transform="rotate(-12 60 60)">
    <path d="M10 36 H110 V52 A8 8 0 0 0 110 68 V84 H10 V68 A8 8 0 0 0 10 52 Z" fill="#000" opacity=".45" transform="translate(0 3)"/>
    <path d="M10 36 H110 V52 A8 8 0 0 0 110 68 V84 H10 V68 A8 8 0 0 0 10 52 Z" fill="url(#f${id})" ${L}/>
    <path d="M82 38 V82" stroke="#000" stroke-opacity=".35" stroke-width="1.4" stroke-dasharray="3 3"/>
    <rect x="18" y="44" width="58" height="32" rx="2" fill="none" stroke="#000" stroke-opacity=".35"/>
    <text x="47" y="66" text-anchor="middle" ${FONT} font-size="15" fill="#2a1a05" opacity=".8">SENIORS</text>
    <polygon points="${pts(starPts(96, 60, 8, 3.4))}" fill="#2a1a05" opacity=".7"/></g>`,
}

// The stylised purple 7 on every 7s honour: a heavy italic 7, two facets, no roundel.
const sevenMark = (id: string) => `<g>
  <path d="M79 79 H115 L111 90 L94 118 H80 L96 91 H76 Z" fill="#000" opacity=".55" transform="translate(1.5 2)"/>
  <path d="M79 79 H115 L111 90 L94 118 H80 L96 91 H76 Z" fill="url(#p${id})" stroke="#1b0640" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M79.6 80.2 H113.4 L112.2 84 H78.2 Z" fill="#fff" opacity=".55"/>
  <path d="M96 91 L111 90 L94 118 H87 Z" fill="#000" opacity=".22"/></g>`

/** Which object draws each honour. */
function shapeOf(kind: Kind, step: number | null | undefined): [string, string, boolean] {
  switch (kind) {
    case 'flag7': return ['flag', '', true]
    case 'medal7': return ['sevensmedal', '', true]
    case 'calledup': return ['ticket', '', true]
    case 'clubgames': return step === 100 ? ['key', '', false] : ['framed', String(step ?? ''), false]
    default: return [kind, '', false]
  }
}

export function emblemSvg(kind: Kind, tier: Tier, uid: string, step?: number | null) {
  const id = uid.replace(/[^a-zA-Z0-9]/g, '')
  const [shape, label, seven] = shapeOf(kind, step)
  const draw = SHAPES[shape] || SHAPES.flag
  return defs(id, tier) + draw(id, label) + (seven ? sevenMark(id) : '')
}

interface Props {
  kind: Kind
  tier: Tier
  /** The games milestone, for club games. */
  step?: number | null
  /** Older callers pass the milestone as a label. */
  label?: string | number
  size?: number
  title?: string
  className?: string
  /** Drawn faint: an honour he has not reached yet. */
  locked?: boolean
}

export function Emblem({ kind, tier, step, label, size = 56, title, className, locked }: Props) {
  const uid = useId()
  const st = step ?? (label != null && label !== '' ? Number(label) : null)
  return (
    <svg className={`emblem${locked ? ' emblem-locked' : ''}${className ? ' ' + className : ''}`} width={size} height={size}
      viewBox="0 0 120 120" role="img" aria-label={title || kind}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title.replace(/[<&>]/g, '')}</title>` : '') + emblemSvg(kind, tier, uid, st) }} />
  )
}

/** Gold stars above an emblem, one per win, two to four. */
export function EmblemStars({ n }: { n: number }) {
  if (n < 2 || n > 4) return null
  return (
    <span className="emblem-stars" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20"><polygon points={pts(starPts(10, 10.5, 9.5, 4))} fill="#f0c35a" /></svg>
      ))}
    </span>
  )
}

export interface HonourEmblem {
  kind: Kind; name: string; tier: Tier; times: number; step: number | null; seven?: boolean
  items: { year: number | null; team: string; detail: string }[]
}
export interface Honours {
  emblems: HonourEmblem[]
  next: { kind: Kind; name: string; step: number; games: number; to_go: number; team: string; tier: Tier } | null
  points?: number
  hof?: number
}

/** One line under an emblem: "Club Champion" or "The Siren x3". */
export function emblemLabel(e: { kind: Kind; name: string; times: number; step: number | null }) {
  if (e.kind === 'clubgames') return e.step === 100 ? 'Life Member' : `${e.step} club games`
  return e.times > 1 ? `${e.name} x${e.times}` : e.name
}

/** What a tap or hover says: every time he won it. */
export function emblemTitle(e: HonourEmblem) {
  const head = emblemLabel(e)
  const lines = e.items.map(i => [i.year, i.detail].filter(Boolean).join(', '))
  return [head, ...lines].join('\n')
}
