import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { useLeague } from '../../contexts/LeagueContext'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { motion } from 'framer-motion'
import {
  Trophy, Users, CalendarDays, ArrowLeftRight,
  Gamepad2, BarChart3,
} from 'lucide-react'

interface DashboardData {
  standings: { team_id: number; name: string; wins: number; losses: number; draws: number; points: number; pct: number; for: number }[]
  current_round: number
  recent_results: { fixture_id: number; home: string; away: string; home_score: number; away_score: number }[]
  recent_trades: { id: number; summary: string; status: string }[]
  user_team_summary: { name: string; record: string; rank: number; next_opponent: string } | null
}

export function DashboardPage() {
  const { league } = useLeague()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!league) return
    api<DashboardData>(`/api/leagues/${league.id}/dashboard`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [league?.id])

  if (loading || !league) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load dashboard</p>

  const lid = league.id
  const t = league.user_team

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">{league.name}</h1>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {t && <QuickAction to={`/leagues/${lid}/team/${t.id}`} icon={<Users className="w-5 h-5" />} label="My Team" color="#58a6ff" />}
        <QuickAction to={`/leagues/${lid}/gameday`} icon={<Gamepad2 className="w-5 h-5" />} label="Gameday" color="#3fb950" />
        <QuickAction to={`/leagues/${lid}/standings`} icon={<BarChart3 className="w-5 h-5" />} label="Standings" color="#fbbf24" />
        <QuickAction to={`/leagues/${lid}/trades`} icon={<ArrowLeftRight className="w-5 h-5" />} label="Trades" color="#a371f7" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ladder */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <SectionHeader icon={<Trophy className="w-4 h-4" />} title="Ladder" to={`/leagues/${lid}/standings`} />
          <div className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#21262d] bg-[#161b22]">
                  <th className="text-left px-3 py-2 text-[#484f58] font-medium">#</th>
                  <th className="text-left px-3 py-2 text-[#484f58] font-medium">Team</th>
                  <th className="text-center px-3 py-2 text-[#484f58] font-medium">W</th>
                  <th className="text-center px-3 py-2 text-[#484f58] font-medium">L</th>
                  <th className="text-right px-3 py-2 text-[#484f58] font-medium">Pts</th>
                  <th className="text-right px-3 py-2 text-[#484f58] font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {data.standings.slice(0, 8).map((s, i) => (
                  <tr key={s.team_id} className={`border-b border-[#21262d] ${t && s.team_id === t.id ? 'bg-[#58a6ff08]' : ''}`}>
                    <td className="px-3 py-2 text-[#484f58]">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-[#e6edf3]">
                      <Link to={`/leagues/${lid}/team/${s.team_id}`} className="hover:text-[#58a6ff] no-underline text-inherit">{s.name}</Link>
                    </td>
                    <td className="text-center px-3 py-2 text-[#8b949e]">{s.wins}</td>
                    <td className="text-center px-3 py-2 text-[#8b949e]">{s.losses}</td>
                    <td className="text-right px-3 py-2 font-bold text-[#e6edf3]">{s.points}</td>
                    <td className="text-right px-3 py-2 text-[#8b949e]">{s.pct.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Recent results */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <SectionHeader icon={<CalendarDays className="w-4 h-4" />} title={`Round ${data.current_round} Results`} to={`/leagues/${lid}/fixture/${data.current_round}`} />
          <div className="space-y-2">
            {data.recent_results.map(r => (
              <Link key={r.fixture_id} to={`/leagues/${lid}/matchup/${r.fixture_id}`}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#0d1117] border border-[#21262d] hover:border-[#58a6ff]/30 transition no-underline">
                <span className="text-sm font-medium text-[#e6edf3]">{r.home}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${r.home_score > r.away_score ? 'text-[#3fb950]' : 'text-[#8b949e]'}`}>{r.home_score}</span>
                  <span className="text-xs text-[#484f58]">-</span>
                  <span className={`text-sm font-bold ${r.away_score > r.home_score ? 'text-[#3fb950]' : 'text-[#8b949e]'}`}>{r.away_score}</span>
                </div>
                <span className="text-sm font-medium text-[#e6edf3] text-right">{r.away}</span>
              </Link>
            ))}
            {data.recent_results.length === 0 && <p className="text-xs text-[#484f58] py-4 text-center">No results yet</p>}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function QuickAction({ to, icon, label, color }: { to: string; icon: React.ReactNode; label: string; color: string }) {
  return (
    <Link to={to}
      className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-[#21262d] bg-[#0d1117] hover:bg-[#161b22] hover:border-[#30363d] transition no-underline">
      <span style={{ color }}>{icon}</span>
      <span className="text-xs font-semibold text-[#8b949e]">{label}</span>
    </Link>
  )
}

function SectionHeader({ icon, title, to }: { icon: React.ReactNode; title: string; to: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 text-[#8b949e]">
        {icon}
        <span className="text-sm font-bold text-[#e6edf3]">{title}</span>
      </div>
      <Link to={to} className="text-[10px] text-[#58a6ff] hover:underline no-underline">View All</Link>
    </div>
  )
}
