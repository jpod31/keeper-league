import { useState } from 'react'
import type { PositionDepth, DepthPlayer } from '../types'
import { motion, AnimatePresence } from 'framer-motion'

const POS_ORDER = ['DEF', 'MID', 'RUC', 'FWD']

const tagColors: Record<string, string> = {
  Elite: '#3fb950', 'Elite Veteran': '#3fb950', Premium: '#58a6ff',
  'Emerging Star': '#a371f7', Breakout: '#a371f7', Proven: '#8b949e',
  Steady: '#8b949e', Developing: '#fbbf24', Project: '#fbbf24',
  Declining: '#ef4444', Veteran: '#ef4444', Fringe: '#484f58',
}

const trajIcons: Record<string, string> = {
  rising: '\u2191', peaking: '\u2192', declining: '\u2193', stable: '\u2192',
}

export function SquadDepth({ depth }: { depth: Record<string, PositionDepth> }) {
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  const positions = POS_ORDER.filter(p => depth[p])

  return (
    <div className="space-y-5">
      {positions.map(pos => {
        const d = depth[pos]
        const diffColor = d.diff >= 0 ? '#3fb950' : '#ef4444'
        return (
          <div key={pos} className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden">
            {/* Position header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#21262d]">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-[#e6edf3]">{pos}</span>
                <span className="text-xs text-[#484f58]">{d.count} players</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#8b949e]">Avg <b className="text-[#e6edf3]">{d.avg_sc.toFixed(1)}</b></span>
                <span className="text-xs font-bold" style={{ color: diffColor }}>
                  {d.diff >= 0 ? '+' : ''}{d.diff.toFixed(1)} vs league
                </span>
              </div>
            </div>

            {/* Player cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[#21262d]">
              {d.players.map((p, i) => (
                <PlayerCard
                  key={i}
                  player={p}
                  expanded={expandedPlayer === `${pos}-${p.name}`}
                  onToggle={() => setExpandedPlayer(expandedPlayer === `${pos}-${p.name}` ? null : `${pos}-${p.name}`)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PlayerCard({ player: p, expanded, onToggle }: { player: DepthPlayer; expanded: boolean; onToggle: () => void }) {
  const tc = tagColors[p.tag] || '#8b949e'

  return (
    <div className="bg-[#0d1117]">
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[#161b22] transition"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#e6edf3] truncate">{p.name}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ color: tc, borderColor: tc + '40' }}>
              {p.tag}
            </span>
          </div>
        </div>
        <span className="text-sm font-black text-[#e6edf3] tabular-nums">{p.sc.toFixed(0)}</span>
        <span className="text-xs text-[#484f58]">{trajIcons[p.trajectory] || ''}</span>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 grid grid-cols-3 gap-3">
              <Stat label="Age" value={String(p.age)} />
              <Stat label="Phase" value={p.peak_phase} />
              <Stat label="Trajectory" value={p.trajectory} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-[#484f58]">{label}</p>
      <p className="text-xs font-bold text-[#8b949e] capitalize">{value}</p>
    </div>
  )
}
