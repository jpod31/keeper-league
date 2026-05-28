import { useParams, Link, useSearchParams } from 'react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface AflGame {
  game_id: number
  home_team: string
  away_team: string
  home_logo: string | null
  away_logo: string | null
  home_score: number | null
  away_score: number | null
  home_goals: number | null
  home_behinds: number | null
  away_goals: number | null
  away_behinds: number | null
  status: string
  quarter: string | null
  time_remaining: string | null
  is_live: boolean
  is_complete: boolean
  scheduled_display: string | null
  scheduled_start: string | null
  venue: string | null
}

interface AflLiveData {
  league: { id: number; name: string }
  afl_round: number
  round_dates: string | null
  games: AflGame[]
}

function TeamRow({
  name, logo, score, goals, behinds, win, lose, showScore,
}: {
  name: string
  logo: string | null
  score: number | null
  goals: number | null
  behinds: number | null
  win: boolean
  lose: boolean
  showScore: boolean
}) {
  const cls = `afl-team-row${win ? ' win' : ''}${lose ? ' lose' : ''}`
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase()
  return (
    <div className={cls}>
      {logo
        ? <img className="afl-team-logo" src={logo} alt="" loading="lazy" />
        : <span className="afl-team-logo-fallback">{initials}</span>}
      <span className="afl-team-name">{name}</span>
      {showScore && score !== null && (
        <span className="afl-team-score">
          {score}
          {goals !== null && (
            <span className="afl-team-detail">{goals}.{behinds}</span>
          )}
        </span>
      )}
    </div>
  )
}

export function AflLivePage() {
  const { leagueId } = useParams()
  const [params, setParams] = useSearchParams()
  const roundParam = params.get('round')
  const [data, setData] = useState<AflLiveData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const q = roundParam ? `&round=${roundParam}` : ''
    api<AflLiveData>(`/leagues/${leagueId}/afl-live?format=json${q}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [leagueId, roundParam])

  // Auto-refresh live games every 60s
  useEffect(() => {
    if (!data?.games.some(g => g.is_live)) return
    const id = setInterval(() => {
      const q = roundParam ? `&round=${roundParam}` : ''
      api<AflLiveData>(`/leagues/${leagueId}/afl-live?format=json${q}`).then(setData)
    }, 60000)
    return () => clearInterval(id)
  }, [data, leagueId, roundParam])

  if (loading) return <Spinner text="Loading AFL scores..." />
  if (!data) return <p className="text-danger">Failed to load AFL live</p>

  const liveGames = data.games.filter(g => g.is_live)
  const upcomingGames = data.games.filter(g => !g.is_live && !g.is_complete)
  const completedGames = data.games.filter(g => g.is_complete)

  function GameCard({ g }: { g: AflGame }) {
    const hs = g.home_score ?? 0
    const as = g.away_score ?? 0
    const homeWin = g.is_complete && hs > as
    const awayWin = g.is_complete && as > hs
    const showScore = g.is_live || g.is_complete
    return (
      <Link
        to={`/leagues/${leagueId}/gameday/afl-game/${g.game_id}`}
        className={`afl-game-card${g.is_live ? ' is-live' : ''}`}
      >
        <div className="afl-game-head">
          <span className="afl-game-venue">{g.venue || ''}</span>
          {g.is_live && (
            <span className="afl-status-pill live">
              <span className="afl-status-dot" />
              {[g.quarter, g.time_remaining].filter(Boolean).join(' ') || 'LIVE'}
            </span>
          )}
          {g.is_complete && <span className="afl-status-pill final">Final</span>}
          {!g.is_live && !g.is_complete && (
            <span className="afl-status-pill soon">{g.scheduled_display || 'Upcoming'}</span>
          )}
        </div>
        <TeamRow
          name={g.home_team} logo={g.home_logo}
          score={g.home_score} goals={g.home_goals} behinds={g.home_behinds}
          win={homeWin} lose={awayWin} showScore={showScore}
        />
        <TeamRow
          name={g.away_team} logo={g.away_logo}
          score={g.away_score} goals={g.away_goals} behinds={g.away_behinds}
          win={awayWin} lose={homeWin} showScore={showScore}
        />
      </Link>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-broadcast me-2" style={{ color: '#f85149' }}></i>AFL Live</h2>
        <div className="d-flex align-items-center gap-2 text-secondary" style={{ fontSize: '.85rem' }}>
          <span>Round {data.afl_round}</span>
          {data.round_dates && <span>· {data.round_dates}</span>}
        </div>
      </div>

      <div className="afl-round-nav">
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setParams(p => {
            const next = new URLSearchParams(p)
            next.set('round', String(data.afl_round - 1))
            return next
          })}
          disabled={data.afl_round <= 1}
        ><i className="bi bi-chevron-left"></i> Prev</button>
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => setParams(p => {
            const next = new URLSearchParams(p)
            next.set('round', String(data.afl_round + 1))
            return next
          })}
        >Next <i className="bi bi-chevron-right"></i></button>
      </div>

      {liveGames.length > 0 && (
        <div className="afl-live-section">
          <div className="afl-live-section-head"><span className="afl-live-dot" />Live Now</div>
          {liveGames.map(g => <GameCard key={g.game_id} g={g} />)}
        </div>
      )}
      {upcomingGames.length > 0 && (
        <div className="afl-live-section">
          <div className="afl-live-section-head">Upcoming</div>
          {upcomingGames.map(g => <GameCard key={g.game_id} g={g} />)}
        </div>
      )}
      {completedGames.length > 0 && (
        <div className="afl-live-section">
          <div className="afl-live-section-head">Completed</div>
          {completedGames.map(g => <GameCard key={g.game_id} g={g} />)}
        </div>
      )}
      {data.games.length === 0 && (
        <div className="text-center py-5 text-secondary">
          <i className="bi bi-calendar-x" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }}></i>
          No games scheduled for this round.
        </div>
      )}
    </div>
  )
}
