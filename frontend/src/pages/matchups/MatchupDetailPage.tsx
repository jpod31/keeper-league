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
  if (!data) return <p className="text-danger">Failed to load matchup</p>

  const homeWon = data.home_score > data.away_score
  const awayWon = data.away_score > data.home_score
  const margin = Math.abs(data.home_score - data.away_score)

  return (
    <div>
      {/* Breadcrumb */}
      <div className="page-breadcrumb">
        <Link to={`/leagues/${leagueId}/fixture`}>Fixture</Link>
        <span className="mx-1">/</span>
        <Link to={`/leagues/${leagueId}/fixture/${data.round}`}>Round {data.round}</Link>
      </div>

      {/* Hero - matches detail.html mu-hero */}
      <div className="mu-hero">
        <div className="mu-hero-grid">
          <div className="mu-hero-team">
            <div className="mu-tname">
              <Link to={`/leagues/${leagueId}/team/${data.home_team.id}`} className="text-decoration-none" style={{ color: 'inherit' }}>
                {data.home_team.name}
              </Link>
            </div>
            <div className={`mu-tscore${homeWon ? ' won' : awayWon ? ' lost' : ''}`}>
              {data.home_score || 0}
            </div>
          </div>
          <div className="mu-centre">
            <div className={`mu-status${data.completed ? ' mu-final' : ' mu-sched'}`}>
              {data.completed ? 'FINAL' : 'SCHEDULED'}
            </div>
            {data.completed && margin > 0 && (
              <div className="mu-margin">
                {homeWon ? data.home_team.name : data.away_team.name} +{margin}
              </div>
            )}
          </div>
          <div className="mu-hero-team">
            <div className="mu-tname">
              <Link to={`/leagues/${leagueId}/team/${data.away_team.id}`} className="text-decoration-none" style={{ color: 'inherit' }}>
                {data.away_team.name}
              </Link>
            </div>
            <div className={`mu-tscore${awayWon ? ' won' : homeWon ? ' lost' : ''}`}>
              {data.away_score || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Player breakdown - matches pb-grid */}
      <div className="pb-grid mt-4">
        <PlayerSide name={data.home_team.name} players={data.home_players} won={homeWon} />
        <PlayerSide name={data.away_team.name} players={data.away_players} won={awayWon} />
      </div>
    </div>
  )
}

function PlayerSide({ name, players, won }: { name: string; players: PlayerScore[]; won: boolean }) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const total = sorted.reduce((s, p) => s + (p.dnp ? 0 : p.score), 0)

  return (
    <div className="pb-side">
      <div className="pb-side-hdr">{name}</div>
      {sorted.map((p, i) => (
        <div key={i} className={`pb-player${p.dnp ? ' opacity-50' : ''}`}>
          <span className="pb-player-name">
            {p.position && <span className={`pos-badge pos-${p.position.split('/')[0]}`} style={{ fontSize: '.55rem', padding: '0 4px', marginRight: 6 }}>{p.position}</span>}
            {p.name}
            {p.is_captain && <span className="badge ms-1" style={{ background: '#d29922', fontSize: '.5rem' }}>C</span>}
            {p.is_vc && <span className="badge ms-1" style={{ background: '#484f58', fontSize: '.5rem' }}>VC</span>}
          </span>
          <span className="pb-player-score">{p.dnp ? 'DNP' : p.score}</span>
        </div>
      ))}
      <div className={`pb-total${won ? ' pb-won' : ''}`}>
        <span className="pb-total-label">Total</span>
        <span className="pb-total-val">{total}</span>
      </div>
    </div>
  )
}
