import type { Insight } from '../types'
import { motion } from 'framer-motion'

const typeConfig: Record<string, { color: string; icon: string; bg: string }> = {
  warning:     { color: '#ef4444', icon: '\u26A0', bg: '#ef444410' },
  opportunity: { color: '#3fb950', icon: '\u2197', bg: '#3fb95010' },
  strength:    { color: '#58a6ff', icon: '\u2713', bg: '#58a6ff10' },
}

export function Insights({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null

  return (
    <div className="space-y-2">
      {insights.map((ins, i) => {
        const cfg = typeConfig[ins.type] || typeConfig.strength
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            className="flex gap-3 px-4 py-3 rounded-xl border border-[#21262d]"
            style={{ background: cfg.bg }}
          >
            <span className="text-base mt-0.5" style={{ color: cfg.color }}>{cfg.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#e6edf3] mb-0.5">{ins.title}</p>
              <p className="text-xs text-[#8b949e] leading-relaxed">{ins.detail}</p>
            </div>
            {ins.impact > 0 && (
              <span className="text-xs font-bold self-center px-2 py-0.5 rounded-md border" style={{ color: cfg.color, borderColor: cfg.color + '30' }}>
                {ins.impact > 0 ? '+' : ''}{ins.impact}
              </span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
