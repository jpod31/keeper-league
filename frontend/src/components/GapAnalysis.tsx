import { motion } from 'framer-motion'

interface Gap {
  position: string
  gap: number
  your_avg: number
  league_avg: number
  weakest: string
  weakest_sc: number
  best_fill_name: string
  best_fill_sc: number
}

export function GapAnalysis({ gap }: { gap: Gap }) {
  const pct = Math.min((gap.your_avg / gap.league_avg) * 100, 100)
  const severity = gap.gap > 15 ? 'Critical' : gap.gap > 8 ? 'Moderate' : 'Minor'
  const sevColor = gap.gap > 15 ? '#ef4444' : gap.gap > 8 ? '#fbbf24' : '#3fb950'

  return (
    <div className="mb-10">
      <p className="text-[10px] font-extrabold uppercase tracking-[2px] text-[#484f58] mb-1">Weakness</p>
      <h2 className="text-lg font-extrabold text-[#e6edf3] mb-4">Biggest Gap: {gap.position}</h2>

      <div className="rounded-2xl p-5 border border-[#21262d] bg-[#0d1117]">
        {/* Severity badge */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold px-2 py-0.5 rounded-md border" style={{ color: sevColor, borderColor: sevColor + '40' }}>
            {severity}
          </span>
          <span className="text-xs text-[#8b949e]">{gap.gap.toFixed(1)} pts below league average</span>
        </div>

        {/* Comparison bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-[#484f58] mb-1">
            <span>Your {gap.position} avg</span>
            <span>League avg</span>
          </div>
          <div className="h-3 rounded-full bg-[#21262d] relative overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${sevColor}cc, ${sevColor}66)` }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
            <div className="absolute right-0 top-0 h-full w-px bg-[#e6edf3]" />
          </div>
          <div className="flex justify-between text-xs font-bold mt-1">
            <span className="text-[#e6edf3]">{gap.your_avg.toFixed(1)}</span>
            <span className="text-[#8b949e]">{gap.league_avg.toFixed(1)}</span>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3 bg-[#161b22] border border-[#21262d]">
            <p className="text-[10px] text-[#484f58] mb-1">Weakest Player</p>
            <p className="text-sm font-bold text-[#ef4444]">{gap.weakest}</p>
            <p className="text-xs text-[#8b949e]">{gap.weakest_sc.toFixed(1)} avg</p>
          </div>
          {gap.best_fill_name && (
            <div className="rounded-xl p-3 bg-[#161b22] border border-[#21262d]">
              <p className="text-[10px] text-[#484f58] mb-1">Best Available Fill</p>
              <p className="text-sm font-bold text-[#3fb950]">{gap.best_fill_name}</p>
              <p className="text-xs text-[#8b949e]">{gap.best_fill_sc.toFixed(1)} avg</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
