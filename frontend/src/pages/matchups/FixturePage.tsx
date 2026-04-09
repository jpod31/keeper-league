import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface FixtureRound {
  round: number
  matches: { fixture_id: number; home: string; away: string; home_score: number; away_score: number; completed: boolean }[]
}

export function FixturePage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<FixtureRound[]>(`/api/leagues/${leagueId}/fixture`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load fixture</p>

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">Fixture</h1>

      <div className="space-y-6">
        {data.map(round => (
          <div key={round.round}>
            <Link to={`/leagues/${leagueId}/fixture/${round.round}`}
              className="text-sm font-bold text-[#e6edf3] mb-2 block hover:text-[#58a6ff] no-underline">
              Round {round.round}
            </Link>
            <div className="space-y-1.5">
              {round.matches.map(m => (
                <Link key={m.fixture_id} to={`/leagues/${leagueId}/matchup/${m.fixture_id}`}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] hover:bg-[#161b22] transition no-underline text-xs">
                  <span className="font-medium text-[#e6edf3] flex-1">{m.home}</span>
                  <div className="flex items-center gap-2 mx-4">
                    {m.completed ? (
                      <>
                        <span className={`font-black ${m.home_score > m.away_score ? 'text-[#3fb950]' : 'text-[#8b949e]'}`}>{m.home_score}</span>
                        <span className="text-[#484f58]">-</span>
                        <span className={`font-black ${m.away_score > m.home_score ? 'text-[#3fb950]' : 'text-[#8b949e]'}`}>{m.away_score}</span>
                      </>
                    ) : (
                      <span className="text-[#484f58]">vs</span>
                    )}
                  </div>
                  <span className="font-medium text-[#e6edf3] flex-1 text-right">{m.away}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
