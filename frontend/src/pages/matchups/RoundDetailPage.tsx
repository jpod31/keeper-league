import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface RoundMatch {
  fixture_id: number
  home_team: { id: number; name: string }
  away_team: { id: number; name: string }
  home_score: number
  away_score: number
  completed: boolean
}

export function RoundDetailPage() {
  const { leagueId, round } = useParams()
  const { data, loading } = useFetch<RoundMatch[]>(`/api/leagues/${leagueId}/fixture/${round}`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load round</p>

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">Round {round}</h1>
      <div className="space-y-3">
        {data.map(m => (
          <Link key={m.fixture_id} to={`/leagues/${leagueId}/matchup/${m.fixture_id}`}
            className="flex items-center justify-between px-5 py-4 rounded-2xl bg-[#0d1117] border border-[#21262d] hover:border-[#58a6ff]/30 transition no-underline">
            <span className="text-sm font-bold text-[#e6edf3] flex-1">{m.home_team.name}</span>
            <div className="flex items-center gap-3 mx-4">
              {m.completed ? (
                <>
                  <span className={`text-lg font-black ${m.home_score > m.away_score ? 'text-[#3fb950]' : 'text-[#8b949e]'}`}>{m.home_score}</span>
                  <span className="text-xs text-[#484f58]">-</span>
                  <span className={`text-lg font-black ${m.away_score > m.home_score ? 'text-[#3fb950]' : 'text-[#8b949e]'}`}>{m.away_score}</span>
                </>
              ) : (
                <span className="text-xs text-[#484f58]">vs</span>
              )}
            </div>
            <span className="text-sm font-bold text-[#e6edf3] flex-1 text-right">{m.away_team.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
