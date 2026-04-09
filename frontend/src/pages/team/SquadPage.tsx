import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../../components/ui/Spinner'
import { motion } from 'framer-motion'
import { ArrowLeftRight, LineChart } from 'lucide-react'

interface Player {
  id: number
  name: string
  position: string
  afl_team: string
  age: number
  sc_avg: number
  games: number
  is_captain: boolean
  is_vc: boolean
  tag: string
  tag_css: string
  injury: string | null
}

interface SquadData {
  team: { id: number; name: string; owner: string }
  players: Player[]
  salary_cap: number
  roster_size: number
}

const POS_ORDER = ['DEF', 'MID', 'RUC', 'FWD']
const tagColors: Record<string, string> = {
  Elite: '#3fb950', 'Elite Veteran': '#3fb950', Premium: '#58a6ff',
  'Emerging Star': '#a371f7', Breakout: '#a371f7', Proven: '#8b949e',
  Steady: '#8b949e', Developing: '#fbbf24', Project: '#fbbf24',
  Declining: '#ef4444', Veteran: '#ef4444', Fringe: '#484f58',
}

export function SquadPage() {
  const { leagueId, teamId } = useParams()
  const { league } = useLeague()
  const { data, loading } = useFetch<SquadData>(`/api/leagues/${leagueId}/team/${teamId}/squad`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load squad</p>

  const isOwnTeam = league?.user_team?.id === Number(teamId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-[#e6edf3]">{data.team.name}</h1>
          <p className="text-xs text-[#8b949e]">{data.team.owner} &middot; {data.players.length} players</p>
        </div>
        {isOwnTeam && (
          <div className="flex gap-2">
            <Link to={`/leagues/${leagueId}/team/${teamId}/analytics`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#58a6ff] border border-[#58a6ff]/20 bg-[#58a6ff]/10 hover:bg-[#58a6ff]/20 transition no-underline">
              <LineChart className="w-3.5 h-3.5" /> Analytics
            </Link>
            <Link to={`/leagues/${leagueId}/trades`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-[#a371f7] border border-[#a371f7]/20 bg-[#a371f7]/10 hover:bg-[#a371f7]/20 transition no-underline">
              <ArrowLeftRight className="w-3.5 h-3.5" /> Trade
            </Link>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
        <StatChip label="Players" value={String(data.players.length)} />
        <StatChip label="Avg SC" value={data.players.length ? (data.players.reduce((s, p) => s + p.sc_avg, 0) / data.players.length).toFixed(1) : '0'} />
        <StatChip label="Avg Age" value={data.players.length ? (data.players.reduce((s, p) => s + p.age, 0) / data.players.length).toFixed(1) : '0'} />
      </div>

      {/* Position groups */}
      {POS_ORDER.map(pos => {
        const players = data.players.filter(p => p.position === pos).sort((a, b) => b.sc_avg - a.sc_avg)
        if (!players.length) return null
        return (
          <div key={pos} className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-black text-[#e6edf3]">{pos}</span>
              <span className="text-[10px] text-[#484f58]">{players.length}</span>
            </div>
            <div className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden">
              {players.map((p, i) => (
                <motion.div key={p.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? 'border-t border-[#21262d]' : ''} hover:bg-[#161b22] transition`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#e6edf3]">{p.name}</span>
                      {p.is_captain && <span className="text-[10px] font-bold text-[#fbbf24]">C</span>}
                      {p.is_vc && <span className="text-[10px] font-bold text-[#8b949e]">VC</span>}
                      {p.tag && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                          style={{ color: tagColors[p.tag] || '#8b949e', borderColor: (tagColors[p.tag] || '#8b949e') + '40' }}>
                          {p.tag}
                        </span>
                      )}
                      {p.injury && <span className="text-[10px] text-[#ef4444]">{p.injury}</span>}
                    </div>
                    <div className="text-[10px] text-[#484f58] mt-0.5">
                      {p.afl_team} &middot; Age {p.age} &middot; {p.games} games
                    </div>
                  </div>
                  <span className="text-sm font-black text-[#e6edf3] tabular-nums">{p.sc_avg.toFixed(0)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-[#0d1117] border border-[#21262d] shrink-0">
      <p className="text-[10px] text-[#484f58]">{label}</p>
      <p className="text-sm font-black text-[#e6edf3]">{value}</p>
    </div>
  )
}
