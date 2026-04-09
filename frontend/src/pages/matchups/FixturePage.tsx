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
  if (!data) return <p className="text-danger">Failed to load fixture</p>

  return (
    <div>
      {data.map(round => (
        <div key={round.round} className="mb-4">
          <div className="round-hdr">
            <div className="round-hdr-left">
              <Link to={`/leagues/${leagueId}/fixture/${round.round}`} className="text-decoration-none" style={{ color: 'var(--kl-text-heading)' }}>
                <strong>Round {round.round}</strong>
              </Link>
              {round.matches.every(m => m.completed) && (
                <span className="rh-badge rh-complete ms-2">Complete</span>
              )}
            </div>
          </div>
          <div className="mx-list">
            {round.matches.map(m => {
              const homeWon = m.completed && m.home_score > m.away_score
              const awayWon = m.completed && m.away_score > m.home_score
              return (
                <Link key={m.fixture_id} to={`/leagues/${leagueId}/matchup/${m.fixture_id}`}
                  className="mx-row text-decoration-none">
                  <span className={`mx-team mx-team-home${homeWon ? ' won' : ''}`}>{m.home}</span>
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
                  <span className={`mx-team mx-team-away${awayWon ? ' won' : ''}`}>{m.away}</span>
                  <i className="bi bi-chevron-right mx-arrow"></i>
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      {data.length === 0 && (
        <div className="season-empty">
          <i className="bi bi-calendar-x" style={{ fontSize: '2rem', color: '#484f58' }}></i>
          <p style={{ color: '#8b949e' }}>No fixtures generated yet</p>
        </div>
      )}
    </div>
  )
}
