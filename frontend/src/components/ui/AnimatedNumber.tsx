import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'

interface Props {
  value: number
  /** Decimal places (default 0 = integer) */
  decimals?: number
  /** Formatter override — e.g. n => n.toLocaleString() */
  format?: (n: number) => string
  /** Duration ms (default 550) */
  duration?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Smoothly animates a number from its previous value to the new one.
 * Use for live scores, ladder points, percentages — anything a user
 * might watch tick.
 */
export function AnimatedNumber({ value, decimals = 0, format, duration = 550, className, style }: Props) {
  const prev = useRef(value)
  const mv = useMotionValue(value)
  const [rendered, setRendered] = useState(value)

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: duration / 1000,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: v => setRendered(v),
    })
    prev.current = value
    return controls.stop
  }, [value, duration, mv])

  const text = format
    ? format(rendered)
    : decimals > 0 ? rendered.toFixed(decimals) : Math.round(rendered).toLocaleString()

  return (
    <motion.span className={className} style={style}>{text}</motion.span>
  )
}
