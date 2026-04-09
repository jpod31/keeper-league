import { useParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface PlayerStat {
  name: string
  position: string
  games: number
  sc_avg: number
  sc_total: number
  best: number
  worst: number
  consistency: number
}

interface TeamStatsData {
  team: { id: number; name: string }
  players: PlayerStat[]
  team_avg: number
  team_total: number
}

export function TeamStatsPage() {
  const { leagueId, teamId } = useParams()
  const { data, loading } = useFetch<TeamStatsData>(`/api/leagues/${leagueId}/team/${teamId}/stats`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load stats</p>

  const sorted = [...data.players].sort((a, b) => b.sc_avg - a.sc_avg)

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-1">{data.team.name} Stats</h1>
      <p className="text-xs text-[#8b949e] mb-6">Team avg {data.team_avg.toFixed(0)} &middot; Total {data.team_total.toLocaleString()}</p>

      {/* Chart */}
      <div className="rounded-xl border border-[#21262d] bg-[#0d1117] p-4 mb-6">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sorted.slice(0, 15)} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="name" tick={{ fill: '#484f58', fontSize: 9 }} axisLine={{ stroke: '#21262d' }} tickLine={false} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fill: '#484f58', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #21262d', borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="sc_avg" radius={[4, 4, 0, 0]} maxBarSize={24}>
              {sorted.slice(0, 15).map((_, i) => <Cell key={i} fill={i < 5 ? '#3fb95088' : '#58a6ff44'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[500px]">
          <thead>
            <tr className="border-b border-[#21262d] bg-[#161b22]">
              <th className="text-left px-4 py-2.5 text-[#484f58] font-medium">Player</th>
              <th className="text-center px-3 py-2.5 text-[#484f58] font-medium">Pos</th>
              <th className="text-right px-3 py-2.5 text-[#484f58] font-medium">Games</th>
              <th className="text-right px-3 py-2.5 text-[#484f58] font-medium">Avg</th>
              <th className="text-right px-3 py-2.5 text-[#484f58] font-medium">Total</th>
              <th className="text-right px-3 py-2.5 text-[#484f58] font-medium">Best</th>
              <th className="text-right px-4 py-2.5 text-[#484f58] font-medium">Worst</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => (
              <tr key={p.name} className="border-b border-[#21262d] hover:bg-[#161b22] transition">
                <td className="px-4 py-2.5 font-bold text-[#e6edf3]">{p.name}</td>
                <td className="text-center px-3 py-2.5 text-[#8b949e]">{p.position}</td>
                <td className="text-right px-3 py-2.5 text-[#8b949e]">{p.games}</td>
                <td className="text-right px-3 py-2.5 font-black text-[#e6edf3]">{p.sc_avg.toFixed(0)}</td>
                <td className="text-right px-3 py-2.5 text-[#8b949e]">{p.sc_total.toLocaleString()}</td>
                <td className="text-right px-3 py-2.5 text-[#3fb950]">{p.best}</td>
                <td className="text-right px-4 py-2.5 text-[#ef4444]">{p.worst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
