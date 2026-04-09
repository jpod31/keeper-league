import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, post } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { Trophy, Plus, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'

interface LeagueSummary {
  id: number
  name: string
  season_year: number
  invite_code: string
  team_count: number
  user_team: { id: number; name: string } | null
  is_commissioner: boolean
}

export function LeagueListPage() {
  const [leagues, setLeagues] = useState<LeagueSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    api<LeagueSummary[]>('/api/leagues').then(setLeagues).finally(() => setLoading(false))
  }, [])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) return
    try {
      const res = await post<{ league_id: number }>('/api/leagues/join', { code: joinCode.trim() })
      navigate(`/leagues/${res.league_id}`)
    } catch {
      toast('Invalid invite code', 'error')
    }
  }

  if (loading) return <Spinner text="Loading leagues..." />

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-extrabold text-[#e6edf3]">My Leagues</h1>
        <Link to="/leagues/create"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#58a6ff]/10 text-[#58a6ff] text-xs font-bold border border-[#58a6ff]/20 hover:bg-[#58a6ff]/20 transition no-underline">
          <Plus className="w-4 h-4" /> Create
        </Link>
      </div>

      {leagues.length === 0 ? (
        <div className="text-center py-16">
          <Trophy className="w-12 h-12 text-[#21262d] mx-auto mb-4" />
          <p className="text-[#8b949e] mb-4">No leagues yet. Create one or join with an invite code.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leagues.map((lg, i) => (
            <motion.div key={lg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link to={`/leagues/${lg.id}`}
                className="flex items-center gap-4 p-4 rounded-2xl bg-[#0d1117] border border-[#21262d] hover:border-[#58a6ff]/30 hover:bg-[#161b22] transition no-underline group">
                <div className="w-10 h-10 rounded-xl bg-[#21262d] flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-[#58a6ff]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#e6edf3]">{lg.name}</span>
                    <span className="text-[10px] text-[#484f58]">{lg.season_year}</span>
                    {lg.is_commissioner && <span className="text-[10px] font-bold text-[#d29922]">COMMISSIONER</span>}
                  </div>
                  <div className="text-xs text-[#8b949e] mt-0.5">
                    {lg.user_team ? lg.user_team.name : 'No team'} &middot; {lg.team_count} teams
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#484f58] group-hover:text-[#58a6ff] transition" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Join by code */}
      <form onSubmit={handleJoin} className="mt-8 flex gap-2">
        <input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Enter invite code"
          className="flex-1 px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition" />
        <button type="submit"
          className="px-4 py-2.5 rounded-xl bg-[#21262d] text-sm font-bold text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#30363d] transition">
          Join
        </button>
      </form>
    </div>
  )
}
