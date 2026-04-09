import { useParams } from 'react-router'
import { Spinner } from '../../components/ui/Spinner'
import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Link } from 'react-router'

interface GamedayFixture {
  fixture_id: number
  home_team: { id: number; name: string }
  away_team: { id: number; name: string }
  home_score: number
  away_score: number
  home_projected: number
  away_projected: number
  status: string
}

interface GamedayData {
  round: number
  fixtures: GamedayFixture[]
  live: boolean
}

export function GamedayPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<GamedayData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    api<GamedayData>(`/api/leagues/${leagueId}/gameday`)
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000) // poll every 60s
    return () => clearInterval(interval)
  }, [leagueId])

  if (loading) return <Spinner text="Loading gameday..." />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load gameday</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-[#e6edf3]">Gameday</h1>
          <p className="text-xs text-[#8b949e]">Round {data.round}</p>
        </div>
        {data.live && (
          <span className="text-xs font-bold text-[#3fb950] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3fb950] animate-pulse" /> LIVE
          </span>
        )}
      </div>

      <div className="space-y-3">
        {data.fixtures.map(f => (
          <Link key={f.fixture_id} to={`/leagues/${leagueId}/matchup/${f.fixture_id}`}
            className="block rounded-2xl border border-[#21262d] bg-[#0d1117] hover:border-[#58a6ff]/30 hover:bg-[#161b22] transition no-underline overflow-hidden">
            <div className="flex items-center px-5 py-4">
              {/* Home */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#e6edf3] truncate">{f.home_team.name}</p>
                {f.home_projected > 0 && (
                  <p className="text-[10px] text-[#484f58] mt-0.5">Proj: {f.home_projected}</p>
                )}
              </div>

              {/* Score */}
              <div className="flex items-center gap-3 mx-4">
                <span className={`text-xl font-black tabular-nums ${f.home_score > f.away_score ? 'text-[#3fb950]' : 'text-[#e6edf3]'}`}>
                  {f.home_score}
                </span>
                <span className="text-xs text-[#484f58]">vs</span>
                <span className={`text-xl font-black tabular-nums ${f.away_score > f.home_score ? 'text-[#3fb950]' : 'text-[#e6edf3]'}`}>
                  {f.away_score}
                </span>
              </div>

              {/* Away */}
              <div className="flex-1 min-w-0 text-right">
                <p className="text-sm font-bold text-[#e6edf3] truncate">{f.away_team.name}</p>
                {f.away_projected > 0 && (
                  <p className="text-[10px] text-[#484f58] mt-0.5">Proj: {f.away_projected}</p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {f.status === 'live' && (
              <div className="h-0.5 bg-[#21262d]">
                <div className="h-full bg-[#3fb950] animate-pulse" style={{ width: '60%' }} />
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
