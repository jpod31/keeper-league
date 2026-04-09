import { useState } from 'react'
import type { AiSection } from '../types'
import { motion, AnimatePresence } from 'framer-motion'

const SECTION_COLORS: Record<string, string> = {
  'ENGINE ROOM': '#58a6ff',
  'RISK REGISTER': '#ef4444',
  'OUTLOOK': '#3fb950',
  'PLAYBOOK': '#a371f7',
}

function getSectionColor(title: string): string {
  const upper = title.toUpperCase()
  for (const [key, color] of Object.entries(SECTION_COLORS)) {
    if (upper.includes(key)) return color
  }
  return '#fbbf24'
}

export function ScoutingReport({ sections }: { sections: AiSection[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <div className="space-y-2">
      {sections.map((sec, i) => {
        const color = getSectionColor(sec.title)
        const isOpen = openIdx === i
        return (
          <div key={i} className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden">
            <button
              onClick={() => setOpenIdx(isOpen ? null : i)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#161b22] transition"
            >
              <div className="w-1 h-6 rounded-full" style={{ background: color }} />
              <span className="text-sm font-bold text-[#e6edf3] flex-1">{sec.title}</span>
              <span className={`text-xs text-[#484f58] transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                &#9662;
              </span>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 text-sm text-[#c9d1d9] leading-relaxed whitespace-pre-line border-t border-[#21262d] pt-3">
                    {sec.body}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
