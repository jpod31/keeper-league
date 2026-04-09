import { useAnalytics } from './hooks/useAnalytics'
import { Hero } from './components/Hero'
import { DynastyRace } from './components/DynastyRace'
import { KidTimeline } from './components/KidTimeline'
import { GapAnalysis } from './components/GapAnalysis'
import { SquadDepth } from './components/SquadDepth'
import { TradeMarket } from './components/TradeMarket'
import { ScoutingReport } from './components/ScoutingReport'
import { RoundPerformance } from './components/RoundPerformance'
import { Insights } from './components/Insights'
import { motion } from 'framer-motion'

declare global {
  interface Window { __ANALYTICS_API__: string; __TEAM_ID__: number }
}

export default function App() {
  const apiUrl = window.__ANALYTICS_API__ || '/leagues/3/team/4/analytics/api'
  const teamId = window.__TEAM_ID__ || 4
  const { data, loading, error } = useAnalytics(apiUrl)

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-3 border-[#21262d] border-t-[#58a6ff] rounded-full animate-spin" />
      <p className="text-sm text-[#6e7681]">Building your analytics...</p>
    </div>
  )
  if (error) return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-sm text-red-500">Failed to load. Try refreshing.</p></div>
  if (!data) return null

  const a = data.analytics
  const n = data.narrative
  const fade = (delay: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.35 } })

  return (
    <div className="max-w-[920px] mx-auto px-4 pb-24 pt-6">
      <motion.div {...fade(0)}>
        <Hero data={data} />
      </motion.div>

      {data.dynasty && Object.keys(data.dynasty).length > 0 && (
        <motion.div {...fade(0.08)}>
          <Sec label="Your Dynasty" title="5-Year Franchise Race">
            <DynastyRace dynasty={data.dynasty} teamId={teamId} />
          </Sec>
        </motion.div>
      )}

      {n?.kid_timeline?.filter(k => k.replaces).length > 0 && (
        <motion.div {...fade(0.14)}>
          <Sec label="The Next Generation" title="When your kids take over">
            <KidTimeline kids={n.kid_timeline.filter(k => k.replaces)} />
          </Sec>
        </motion.div>
      )}

      {n?.biggest_gap && (
        <motion.div {...fade(0.18)}>
          <GapAnalysis gap={n.biggest_gap} />
        </motion.div>
      )}

      {data.squad_depth && Object.keys(data.squad_depth).length > 0 && (
        <motion.div {...fade(0.22)}>
          <Sec label="Your Roster" title="Squad Depth">
            <SquadDepth depth={data.squad_depth} />
          </Sec>
        </motion.div>
      )}

      {data.trade_table && (
        <motion.div {...fade(0.26)}>
          <Sec label="The Market" title="Available Upgrades">
            <TradeMarket table={data.trade_table} />
          </Sec>
        </motion.div>
      )}

      {a?.round_data?.length > 1 && (
        <motion.div {...fade(0.3)}>
          <Sec label="Season So Far" title="Round-by-Round">
            <RoundPerformance rounds={a.round_data} />
          </Sec>
        </motion.div>
      )}

      {data.ai_sections?.length > 1 && (
        <motion.div {...fade(0.34)}>
          <Sec label="Deep Dive" title="AI Scouting Report">
            <ScoutingReport sections={data.ai_sections.slice(1)} />
          </Sec>
        </motion.div>
      )}

      {a?.insights?.length > 0 && (
        <motion.div {...fade(0.38)}>
          <Sec label="Actions" title="What To Do Next">
            <Insights insights={a.insights.slice(0, 5)} />
          </Sec>
        </motion.div>
      )}
    </div>
  )
}

function Sec({ label, title, children }: { label: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <p className="text-[10px] font-extrabold uppercase tracking-[2px] text-[#484f58] mb-1">{label}</p>
      <h2 className="text-lg font-extrabold text-[#e6edf3] mb-4">{title}</h2>
      {children}
    </div>
  )
}
