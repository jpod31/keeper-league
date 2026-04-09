import { useParams, Link } from 'react-router'
import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

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
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [leagueId])

  if (loading) return <Spinner text="Loading gameday..." />
  if (!data) return <p className="text-danger">Failed to load gameday</p>

  const isLive = data.live
  const isCompleted = data.fixtures.every(f => f.status === 'completed')

  return (
    <div>
      {/* Round header - matches gameday.html */}
      <div className="gameday-round-header">
        <h2 className="gameday-round-title">ROUND {data.round}</h2>
        <div>
          {isLive && (
            <span className="gameday-state-badge badge-live">
              <i className="bi bi-broadcast"></i>
              <span className="live-pulse-dot"></span>
              LIVE
            </span>
          )}
          {isCompleted && !isLive && (
            <span className="gameday-state-badge badge-final">
              <i className="bi bi-check-circle-fill"></i> FINAL
            </span>
          )}
          {!isLive && !isCompleted && (
            <span className="gameday-state-badge badge-upcoming">
              <i className="bi bi-calendar-event"></i> UPCOMING
            </span>
          )}
          <button className="btn btn-sm ms-2" onClick={fetchData} style={{ color: 'var(--kl-text-secondary)' }}>
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {/* Matchup cards - matches gameday-matchups-grid */}
      <div className="gameday-all-matchups mt-3">
        <div className="gameday-matchups-grid">
          {data.fixtures.map(f => {
            const homeWon = f.home_score > f.away_score
            const awayWon = f.away_score > f.home_score
            const completed = f.status === 'completed'
            const total = (f.home_score || 0) + (f.away_score || 0)
            const homePct = total > 0 ? (f.home_score / total) * 100 : 50

            return (
              <Link key={f.fixture_id} to={`/leagues/${leagueId}/matchup/${f.fixture_id}`}
                className="gameday-matchup-card text-decoration-none">
                <div className="matchup-team-row">
                  <span className={`matchup-team-name${homeWon && completed ? ' matchup-winner' : ''}`}>{f.home_team.name}</span>
                  <span className="matchup-team-score">
                    {f.home_score || 0}
                    {homeWon && completed && <i className="bi bi-check-lg ms-1"></i>}
                  </span>
                </div>
                <div className="matchup-team-row">
                  <span className={`matchup-team-name${awayWon && completed ? ' matchup-winner' : ''}`}>{f.away_team.name}</span>
                  <span className="matchup-team-score">
                    {f.away_score || 0}
                    {awayWon && completed && <i className="bi bi-check-lg ms-1"></i>}
                  </span>
                </div>
                {completed && (
                  <div className="matchup-mini-bar">
                    <div className="matchup-mini-fill" style={{ width: `${homePct}%` }}></div>
                  </div>
                )}
                {completed && (
                  <div className="matchup-margin">
                    {homeWon ? f.home_team.name : f.away_team.name} +{Math.abs(f.home_score - f.away_score)}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {data.fixtures.length === 0 && (
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="bi bi-calendar-x" style={{ fontSize: '2rem', color: '#484f58' }}></i>
            <p className="mt-2 mb-0" style={{ color: '#8b949e', fontSize: '.9rem' }}>No fixtures this round</p>
          </div>
        </div>
      )}
    </div>
  )
}
