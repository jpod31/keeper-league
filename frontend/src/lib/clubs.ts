import type { CSSProperties } from 'react'

/** AFL club colours, tuned to read on a black UI: `a` is the club's main
 *  colour (lifted where the real one is black or near-black navy), `b` its
 *  second colour. Anything that shows a player wears his club's colours, so
 *  a squad reads as eighteen clubs rather than one house colour. */
export const CLUBS: Record<string, { a: string; b: string }> = {
  'Adelaide':         { a: '#12357a', b: '#ffd200' },
  'Brisbane Lions':   { a: '#7a0f3d', b: '#fdb930' },
  'Carlton':          { a: '#0f2f55', b: '#ffffff' },
  'Collingwood':      { a: '#34343b', b: '#ffffff' },
  'Essendon':         { a: '#3a0d10', b: '#e2231a' },
  'Fremantle':        { a: '#3b1f8e', b: '#ffffff' },
  'Geelong':          { a: '#13346a', b: '#ffffff' },
  'Gold Coast':       { a: '#b9141b', b: '#ffe01a' },
  'GWS':              { a: '#c7600f', b: '#ffb45e' },
  'Hawthorn':         { a: '#4f2a10', b: '#fbbf15' },
  'Melbourne':        { a: '#111f4a', b: '#d21f2c' },
  'North Melbourne':  { a: '#123a9c', b: '#ffffff' },
  'Port Adelaide':    { a: '#0c3d42', b: '#1fb5b8' },
  'Richmond':         { a: '#2e2906', b: '#ffd200' },
  'St Kilda':         { a: '#400d13', b: '#ed1b2f' },
  'Sydney':           { a: '#b3131e', b: '#ffffff' },
  'West Coast':       { a: '#0b2f73', b: '#f2a900' },
  'Western Bulldogs': { a: '#14419a', b: '#d6142c' },
}

const NO_CLUB = { a: '#2a2a31', b: '#ececf6' }

export function club(team: string | null | undefined) {
  return (team && CLUBS[team]) || NO_CLUB
}

/** CSS variables for a club-coloured surface: `--ca` main, `--cb` second. */
export function clubVars(team: string | null | undefined): CSSProperties {
  const c = club(team)
  return { ['--ca' as string]: c.a, ['--cb' as string]: c.b } as CSSProperties
}

/** "r,g,b" from #rrggbb, for rgba(var(--x), a). */
export function rgbOf(hex: string | null | undefined): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '236,236,246'
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
}

/** Rating bands, best to worst, each with its own colour (class rt-*). */
export function ratingTier(r: number | null | undefined): string {
  if (r == null) return 'rt-none'
  if (r >= 88) return 'rt-elite'
  if (r >= 80) return 'rt-great'
  if (r >= 72) return 'rt-good'
  if (r >= 64) return 'rt-fair'
  return 'rt-low'
}
