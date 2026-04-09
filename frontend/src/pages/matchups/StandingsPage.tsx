import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Standing {
  rank: number
  team_id: number
  name: string
  wins: number
  losses: number
  draws: number
  points: number
  pct: number
  for: number
  against: number
  streak: string
}

export function StandingsPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<Standing[]>(`/api/leagues/${leagueId}/standings`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load standings</p>

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">Standings</h1>

      <div className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden overflow-x-auto">
        <table className="w-full text-xs min-w-[500px]">
          <thead>
            <tr className="border-b border-[#21262d] bg-[#161b22]">
              <th className="text-left px-4 py-2.5 text-[#484f58] font-medium w-8">#</th>
              <th className="text-left px-4 py-2.5 text-[#484f58] font-medium">Team</th>
              <th className="text-center px-3 py-2.5 text-[#484f58] font-medium">W</th>
              <th className="text-center px-3 py-2.5 text-[#484f58] font-medium">L</th>
              <th className="text-center px-3 py-2.5 text-[#484f58] font-medium">D</th>
              <th className="text-center px-3 py-2.5 text-[#484f58] font-medium">Pts</th>
              <th className="text-right px-3 py-2.5 text-[#484f58] font-medium">%</th>
              <th className="text-right px-4 py-2.5 text-[#484f58] font-medium">For</th>
              <th className="text-right px-4 py-2.5 text-[#484f58] font-medium">Against</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s, i) => (
              <tr key={s.team_id} className="border-b border-[#21262d] hover:bg-[#161b22] transition">
                <td className="px-4 py-2.5 text-[#484f58] font-bold">{i + 1}</td>
                <td className="px-4 py-2.5 font-bold text-[#e6edf3]">
                  <Link to={`/leagues/${leagueId}/team/${s.team_id}`} className="hover:text-[#58a6ff] no-underline text-inherit">{s.name}</Link>
                </td>
                <td className="text-center px-3 py-2.5 text-[#3fb950] font-medium">{s.wins}</td>
                <td className="text-center px-3 py-2.5 text-[#ef4444] font-medium">{s.losses}</td>
                <td className="text-center px-3 py-2.5 text-[#8b949e]">{s.draws}</td>
                <td className="text-center px-3 py-2.5 font-black text-[#e6edf3]">{s.points}</td>
                <td className="text-right px-3 py-2.5 text-[#8b949e]">{s.pct.toFixed(1)}</td>
                <td className="text-right px-4 py-2.5 text-[#8b949e]">{s.for.toLocaleString()}</td>
                <td className="text-right px-4 py-2.5 text-[#8b949e]">{s.against.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
