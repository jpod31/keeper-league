import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface LeagueSummary {
  id: number
  name: string
  season_year: number
  invite_code: string
  team_count: number
  user_team: { id: number; name: string } | null
  is_commissioner: boolean
}

export function LeagueListPage() {
  const navigate = useNavigate()
  const [leagues, setLeagues] = useState<LeagueSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<LeagueSummary[]>('/api/leagues').then(setLeagues).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading && leagues.length === 1) {
      navigate(`/leagues/${leagues[0].id}`, { replace: true })
    }
  }, [loading, leagues, navigate])

  if (loading) return <Spinner text="Loading..." />
  if (leagues.length === 1) return <Spinner text="Loading league..." />

  if (leagues.length === 0) {
    return (
      <div>
        <div className="empty-state" style={{ padding: '6rem 2rem' }}>
          <div className="empty-icon" style={{ width: 80, height: 80 }}>
            <i className="bi bi-trophy" style={{ fontSize: '2rem' }}></i>
          </div>
          <h4 style={{ fontSize: '1.3rem' }}>Welcome to Keeper League</h4>
          <p>Create your first league to start drafting, trading, and competing with your mates in AFL fantasy.</p>
          <div className="d-flex gap-2 justify-content-center">
            <Link to="/leagues/create" className="btn btn-primary">
              <i className="bi bi-plus-lg me-1"></i>Create League
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header">
        <div>
          <h3>Home</h3>
          <div className="section-sub">Your league activity at a glance</div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="bi bi-lightning" style={{ fontSize: '2rem', color: '#484f58' }}></i>
              <p className="mt-2 mb-0" style={{ color: '#8b949e', fontSize: '.9rem' }}>
                Select a league from the sidebar to get started.
              </p>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <h6 className="fw-bold mb-3" style={{ fontSize: '.8rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            My Leagues
          </h6>
          {leagues.map(lg => (
            <Link key={lg.id} to={`/leagues/${lg.id}`} className="text-decoration-none">
              <div className="card mb-2" style={{ transition: 'border-color .15s', cursor: 'pointer' }}>
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <div className="d-inline-flex align-items-center justify-content-center"
                        style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#238636,#1f6feb)', fontWeight: 700, color: '#fff', borderRadius: 8, fontSize: '.75rem' }}>
                        {lg.name[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="fw-bold" style={{ fontSize: '.85rem', color: '#c9d1d9' }}>{lg.name}</div>
                        <div style={{ fontSize: '.7rem', color: '#8b949e' }}>
                          {lg.season_year} &middot; {lg.team_count} teams
                        </div>
                      </div>
                    </div>
                  </div>
                  {lg.user_team ? (
                    <div style={{ fontSize: '.75rem', color: '#8b949e' }}>{lg.user_team.name}</div>
                  ) : (
                    <div style={{ fontSize: '.75rem', color: '#d29922' }}>No team yet</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
          <div className="d-flex gap-2 mt-3">
            <Link to="/leagues/create" className="btn btn-primary btn-sm flex-fill">
              <i className="bi bi-plus-lg me-1"></i>Create League
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
