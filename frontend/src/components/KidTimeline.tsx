import { motion } from 'framer-motion'

interface Kid {
  year: number
  enters: string
  replaces: string
  enters_age: number
  enters_sc: number
}

export function KidTimeline({ kids }: { kids: Kid[] }) {
  if (!kids.length) return null

  const sorted = [...kids].sort((a, b) => a.year - b.year)

  return (
    <div className="relative pl-6">
      {/* Vertical line */}
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-[#3fb950] via-[#58a6ff] to-[#21262d]" />

      <div className="space-y-5">
        {sorted.map((kid, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.3 }}
            className="relative"
          >
            {/* Glowing node */}
            <div className="absolute -left-6 top-1 w-[10px] h-[10px] rounded-full bg-[#3fb950] shadow-[0_0_8px_#3fb95080]" />

            <div className="rounded-xl p-3 border border-[#21262d] bg-[#0d1117]">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-black text-[#e6edf3]">{kid.year}</span>
                <span className="text-xs text-[#3fb950] font-bold">{kid.enters}</span>
                <span className="text-[10px] text-[#484f58]">age {kid.enters_age}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8b949e]">
                <span>Replaces</span>
                <span className="text-[#ef4444] font-semibold">{kid.replaces}</span>
                <span className="text-[#484f58]">|</span>
                <span>Projected <b className="text-[#e6edf3]">{Math.round(kid.enters_sc)}</b> SC avg</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
