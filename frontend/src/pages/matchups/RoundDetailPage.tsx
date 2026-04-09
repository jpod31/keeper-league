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
  if (!data) return <p className="text-danger">Failed to load round</p>

  return (
    <div>
      <div className="page-breadcrumb mb-2">
        <Link to={`/leagues/${leagueId}/fixture`}>Fixture</Link>
        <span className="mx-1">/</span>
        <span>Round {round}</span>
      </div>

      <div className="rd-hdr mb-3">
        <div className="rd-hdr-left">
          <h4 className="fw-bold mb-0" style={{ color: 'var(--kl-text-heading)' }}>Round {round}</h4>
        </div>
      </div>

      <div className="mx-list">
        {data.map(m => {
          const homeWon = m.completed && m.home_score > m.away_score
          const awayWon = m.completed && m.away_score > m.home_score
          return (
            <Link key={m.fixture_id} to={`/leagues/${leagueId}/matchup/${m.fixture_id}`}
              className="mx-row text-decoration-none">
              <span className={`mx-team mx-team-home${homeWon ? ' won' : ''}`}>{m.home_team.name}</span>
              <div className="mx-centre">
                {m.completed ? (
                  <>
                    <span className={`mx-sc${homeWon ? ' won' : awayWon ? ' lost' : ''}`}>{m.home_score}</span>
                    <span className="mx-sep">&ndash;</span>
                    <span className={`mx-sc${awayWon ? ' won' : homeWon ? ' lost' : ''}`}>{m.away_score}</span>
                  </>
                ) : (
                  <span className="mx-vs">vs</span>
                )}
              </div>
              <span className={`mx-team mx-team-away${awayWon ? ' won' : ''}`}>{m.away_team.name}</span>
              <i className="bi bi-chevron-right mx-arrow"></i>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
