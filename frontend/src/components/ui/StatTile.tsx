import type { ReactNode } from 'react'
import { AnimatedNumber } from './AnimatedNumber'

/**
 * Single stat tile, used everywhere a label + number + optional sub appears.
 * Animates the value on mount when numeric. Accent sets the top stripe + value
 * tint. Optional rank chip in the top-right corner; optional sparkline drawn
 * behind the value.
 */
export type StatTileAccent =
  | 'forest' | 'sapphire' | 'ochre' | 'rust'
  | 'amethyst' | 'teal' | 'garnet' | 'cognac'
  | 'neutral'

const ACCENT_HEX: Record<StatTileAccent, string> = {
  forest: '#7dc99a',
  sapphire: '#82b3e4',
  ochre: '#f0d27a',
  rust: '#e07a6c',
  amethyst: '#b39ed4',
  teal: '#7ec0d3',
  garnet: '#d68aa3',
  cognac: '#d6a779',
  neutral: '#dde4f1',
}
const ACCENT_RGB: Record<StatTileAccent, string> = {
  forest: '61,140,99',
  sapphire: '58,125,196',
  ochre: '194,147,47',
  rust: '184,90,74',
  amethyst: '138,109,184',
  teal: '61,138,156',
  garnet: '157,88,120',
  cognac: '184,127,61',
  neutral: '110,130,180',
}

interface Props {
  label: string
  value: number | string
  sub?: ReactNode
  accent?: StatTileAccent
  rank?: number
  /** Optional sparkline drawn behind the value (last N data points). */
  sparkline?: number[]
  /** Decimals for numeric values when animating. */
  decimals?: number
  /** Skip the count-up animation. Default true. */
  animate?: boolean
}

export function StatTile({
  label, value, sub, accent = 'neutral', rank, sparkline, decimals = 0, animate = true,
}: Props) {
  const hex = ACCENT_HEX[accent]
  const rgb = ACCENT_RGB[accent]
  const isNumeric = typeof value === 'number'

  return (
    <div
      className="kl-tile"
      style={{
        ['--kl-tile-accent' as string]: hex,
        ['--kl-tile-rgb' as string]: rgb,
      } as React.CSSProperties}
    >
      {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} rgb={rgb} />}
      <div className="kl-tile-value">
        {isNumeric && animate
          ? <AnimatedNumber value={value as number} decimals={decimals} />
          : value}
      </div>
      <div className="kl-tile-label">{label}</div>
      {sub != null && sub !== '' && <div className="kl-tile-sub">{sub}</div>}
      {rank != null && <span className="kl-tile-rank">#{rank}</span>}
    </div>
  )
}

function Sparkline({ data, rgb }: { data: number[]; rgb: string }) {
  const w = 100, h = 36
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = data.length === 1 ? 0 : w / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * step
    const y = h - ((v - min) / range) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className="kl-tile-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={`rgba(${rgb},.42)`}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
