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
  forest: '#dcd4ab',
  sapphire: '#deb565',
  ochre: '#f0a97a',
  rust: '#e07a6c',
  amethyst: '#c9b284',
  teal: '#caa965',
  garnet: '#d68aa3',
  cognac: '#d69e79',
  neutral: '#eae7e4',
}
const ACCENT_RGB: Record<StatTileAccent, string> = {
  forest: '135,110,59',
  sapphire: '153,114,45',
  ochre: '194,106,47',
  rust: '184,90,74',
  amethyst: '174,146,89',
  teal: '143,111,56',
  garnet: '157,88,120',
  cognac: '184,115,61',
  neutral: '170,144,91',
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
