import { useParams, Link, useSearchParams } from 'react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface AflGame {
  game_id: number
  home_team: string
  away_team: string
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
    const homeWin = (g.home_score ?? 0) > (g.away_score ?? 0)
    const awayWin = (g.away_score ?? 0) > (g.home_score ?? 0)
    const live = g.is_live
    return (
      <Link
        to={`/leagues/${leagueId}/gameday/afl-game/${g.game_id}`}
        className="text-decoration-none"
        style={{ color: 'inherit' }}
      >
        <div
          className="card mb-2"
          style={{
            cursor: 'pointer',
            borderColor: live ? '#f85149' : 'var(--kl-border)',
            background: live ? 'rgba(248,81,73,.04)' : undefined,
          }}
        >
          <div className="card-body p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div style={{ fontSize: '.7rem', color: 'var(--kl-text-muted)' }}>
                {g.venue || ''}
              </div>
              {live && (
                <span className="badge" style={{ background: 'rgba(248,81,73,.15)', color: '#f85149', fontSize: '.65rem' }}>
                  <i className="bi bi-broadcast me-1"></i>
                  {g.quarter ?? ''} {g.time_remaining ?? 'LIVE'}
                </span>
              )}
              {g.is_complete && (
                <span className="badge" style={{ background: '#21262d', color: '#8b949e', fontSize: '.65rem' }}>
                  Final
                </span>
              )}
              {!live && !g.is_complete && (
                <span className="badge" style={{ background: '#21262d', color: '#8b949e', fontSize: '.65rem' }}>
                  {g.scheduled_display || 'Upcoming'}
                </span>
              )}
            </div>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <div style={{ fontWeight: homeWin ? 700 : 500, color: homeWin ? 'var(--kl-text-primary)' : 'var(--kl-text-secondary)' }}>
                  {g.home_team}
                </div>
                <div style={{ fontWeight: awayWin ? 700 : 500, color: awayWin ? 'var(--kl-text-primary)' : 'var(--kl-text-secondary)', marginTop: 2 }}>
                  {g.away_team}
                </div>
              </div>
              <div className="text-end">
                {g.home_score !== null && (
                  <>
                    <div style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700 }}>
                      {g.home_score}
                      {g.home_goals !== null && (
                        <span className="text-secondary ms-2" style={{ fontSize: '.7rem', fontWeight: 400 }}>
                          ({g.home_goals}.{g.home_behinds})
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, marginTop: 2 }}>
                      {g.away_score}
                      {g.away_goals !== null && (
                        <span className="text-secondary ms-2" style={{ fontSize: '.7rem', fontWeight: 400 }}>
                          ({g.away_goals}.{g.away_behinds})
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
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

      <div className="d-flex gap-2 mb-3">
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
        <div className="mb-4">
          <h6 className="text-uppercase text-secondary fw-bold mb-2" style={{ fontSize: '.7rem', letterSpacing: '.5px' }}>Live Now</h6>
          {liveGames.map(g => <GameCard key={g.game_id} g={g} />)}
        </div>
      )}
      {upcomingGames.length > 0 && (
        <div className="mb-4">
          <h6 className="text-uppercase text-secondary fw-bold mb-2" style={{ fontSize: '.7rem', letterSpacing: '.5px' }}>Upcoming</h6>
          {upcomingGames.map(g => <GameCard key={g.game_id} g={g} />)}
        </div>
      )}
      {completedGames.length > 0 && (
        <div className="mb-4">
          <h6 className="text-uppercase text-secondary fw-bold mb-2" style={{ fontSize: '.7rem', letterSpacing: '.5px' }}>Completed</h6>
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
