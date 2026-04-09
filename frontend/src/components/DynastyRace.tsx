import { useState, useEffect, useRef, useCallback } from 'react'
import type { DynastyTeam } from '../types'
import { motion, AnimatePresence } from 'framer-motion'

const TEAM_COLORS: Record<string, string> = {
  'Adelaide': '#002B5C', 'Brisbane': '#A30046', 'Carlton': '#0E1E2D',
  'Collingwood': '#000000', 'Essendon': '#CC2031', 'Fremantle': '#2A0D45',
  'Geelong': '#1C3C63', 'Gold Coast': '#D4A843', 'GWS': '#F47920',
  'Hawthorn': '#4D2004', 'Melbourne': '#0F1131', 'North Melbourne': '#013B9F',
  'Port Adelaide': '#008AAB', 'Richmond': '#FED102', 'St Kilda': '#ED0F05',
  'Sydney': '#ED171F', 'West Coast': '#062EE2', 'Western Bulldogs': '#014896',
}

function getColor(name: string) {
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return color
  }
  return '#58a6ff'
}

interface Props {
  dynasty: Record<string, DynastyTeam>
  teamId: number
}

export function DynastyRace({ dynasty, teamId }: Props) {
  const teams = Object.entries(dynasty)
  if (teams.length === 0) return null

  const years = teams[0][1].years.map(y => y.year)
  const [yearIdx, setYearIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const play = useCallback(() => {
    setPlaying(true)
    setYearIdx(0)
  }, [])

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setYearIdx(prev => {
        if (prev >= years.length - 1) {
          setPlaying(false)
          return years.length - 1
        }
        return prev + 1
      })
    }, 1200)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, years.length])

  const currentYear = years[yearIdx]

  // Sort teams by total SC for this year
  const ranked = teams
    .map(([id, team]) => {
      const yearData = team.years.find(y => y.year === currentYear)
      return { id, name: team.name, total: yearData?.total || 0, squad: yearData?.squad || [], isUser: id === String(teamId) }
    })
    .sort((a, b) => b.total - a.total)

  const maxTotal = Math.max(...ranked.map(r => r.total), 1)

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={play} disabled={playing}
          className="text-xs font-bold px-4 py-1.5 rounded-lg bg-[#58a6ff]/10 text-[#58a6ff] border border-[#58a6ff]/20 hover:bg-[#58a6ff]/20 transition disabled:opacity-40">
          {playing ? 'Playing...' : 'Play'}
        </button>
        <input type="range" min={0} max={years.length - 1} value={yearIdx}
          onChange={e => { setPlaying(false); setYearIdx(Number(e.target.value)) }}
          className="flex-1 accent-[#58a6ff] h-1" />
        <span className="text-sm font-black text-[#e6edf3] tabular-nums w-12 text-right">{currentYear}</span>
      </div>

      {/* Bars */}
      <div className="space-y-1.5">
        {ranked.map((team, i) => (
          <div key={team.id}>
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setExpanded(expanded === team.id ? null : team.id)}
            >
              <span className="text-[10px] font-bold text-[#484f58] w-5 text-right">{i + 1}</span>
              <span className={`text-xs font-bold w-28 truncate ${team.isUser ? 'text-[#58a6ff]' : 'text-[#8b949e]'}`}>
                {team.name}
              </span>
              <div className="flex-1 h-7 relative">
                <motion.div
                  className="h-full rounded-md"
                  style={{
                    background: team.isUser
                      ? 'linear-gradient(90deg, #58a6ff, #388bfd)'
                      : `linear-gradient(90deg, ${getColor(team.name)}aa, ${getColor(team.name)}55)`,
                    border: team.isUser ? '1px solid #58a6ff' : '1px solid transparent',
                  }}
                  initial={false}
                  animate={{ width: `${(team.total / maxTotal) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#e6edf3]">
                  {team.total.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Expanded squad */}
            <AnimatePresence>
              {expanded === team.id && team.squad.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden ml-[52px]"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 py-2">
                    {team.squad.slice(0, 23).map((p, j) => (
                      <div key={j} className="text-[10px] text-[#8b949e] flex justify-between px-2 py-0.5 rounded bg-[#0d1117]">
                        <span className="truncate">{p.name}</span>
                        <span className="text-[#e6edf3] font-bold ml-2">{Math.round(p.sc)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}
