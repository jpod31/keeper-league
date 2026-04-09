import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface PlayerScore {
  name: string
  position: string
  score: number
  is_captain: boolean
  is_vc: boolean
  is_emergency: boolean
  dnp: boolean
}

interface MatchupData {
  fixture_id: number
  round: number
  home_team: { id: number; name: string }
  away_team: { id: number; name: string }
  home_score: number
  away_score: number
  home_players: PlayerScore[]
  away_players: PlayerScore[]
  completed: boolean
}

export function MatchupDetailPage() {
  const { leagueId, fixtureId } = useParams()
  const { data, loading } = useFetch<MatchupData>(`/api/leagues/${leagueId}/matchup/${fixtureId}`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load matchup</p>

  return (
    <div>
      <p className="text-[10px] font-extrabold uppercase tracking-[2px] text-[#484f58] mb-1">Round {data.round}</p>

      {/* Scoreboard */}
      <div className="flex items-center justify-center gap-6 py-6 mb-6 rounded-2xl bg-[#0d1117] border border-[#21262d]">
        <div className="text-center">
          <Link to={`/leagues/${leagueId}/team/${data.home_team.id}`}
            className="text-sm font-bold text-[#e6edf3] hover:text-[#58a6ff] no-underline">{data.home_team.name}</Link>
          <p className={`text-3xl font-black mt-1 ${data.home_score > data.away_score ? 'text-[#3fb950]' : 'text-[#e6edf3]'}`}>
            {data.home_score}
          </p>
        </div>
        <span className="text-lg text-[#484f58] font-bold">vs</span>
        <div className="text-center">
          <Link to={`/leagues/${leagueId}/team/${data.away_team.id}`}
            className="text-sm font-bold text-[#e6edf3] hover:text-[#58a6ff] no-underline">{data.away_team.name}</Link>
          <p className={`text-3xl font-black mt-1 ${data.away_score > data.home_score ? 'text-[#3fb950]' : 'text-[#e6edf3]'}`}>
            {data.away_score}
          </p>
        </div>
      </div>

      {/* Player breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TeamBreakdown name={data.home_team.name} players={data.home_players} />
        <TeamBreakdown name={data.away_team.name} players={data.away_players} />
      </div>
    </div>
  )
}

function TeamBreakdown({ name, players }: { name: string; players: PlayerScore[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  return (
    <div>
      <h3 className="text-sm font-bold text-[#e6edf3] mb-3">{name}</h3>
      <div className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden">
        {sorted.map((p, i) => (
          <div key={i} className={`flex items-center px-4 py-2 text-xs ${i > 0 ? 'border-t border-[#21262d]' : ''} ${p.dnp ? 'opacity-40' : ''}`}>
            <span className="text-[10px] text-[#484f58] w-8">{p.position}</span>
            <span className="flex-1 font-medium text-[#e6edf3]">
              {p.name}
              {p.is_captain && <span className="ml-1 text-[#fbbf24] font-bold">C</span>}
              {p.is_vc && <span className="ml-1 text-[#8b949e] font-bold">VC</span>}
              {p.is_emergency && <span className="ml-1 text-[#a371f7] text-[10px]">EMG</span>}
            </span>
            <span className={`font-black tabular-nums ${p.dnp ? 'text-[#484f58]' : 'text-[#e6edf3]'}`}>
              {p.dnp ? 'DNP' : p.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
