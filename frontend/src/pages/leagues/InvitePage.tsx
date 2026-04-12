import { useParams, useNavigate } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface InviteData {
  league: {
    id: number
    name: string
    season_year: number
    scoring_type: string
    num_teams: number
    squad_size: number
    commissioner: string
    team_count: number
  }
  code: string
  is_full: boolean
}

export function InvitePage() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { data, loading } = useFetch<InviteData>(`/leagues/invite/${code}?format=json`)
  const [teamName, setTeamName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <Spinner text="Loading league..." />
  if (!data) return (
    <div className="py-5 text-center">
      <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem', color: '#d29922' }}></i>
      <p className="mt-2">Invalid or expired invite link.</p>
    </div>
  )

  async function join(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('team_name', teamName.trim())
      const res = await fetch(`/leagues/invite/${code}`, {
        method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual',
      })
      if (res.status >= 500) {
        setError('Server error. Please try again.')
      } else if (data) {
        navigate(`/leagues/${data.league.id}`)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, paddingTop: "4rem", margin: "0 auto" }}>
      <div className="card">
        <div className="card-body p-5 text-center">
          <div
            style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'rgba(88,166,255,.1)', color: '#58a6ff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.8rem', marginBottom: 16,
            }}
          >
            <i className="bi bi-trophy-fill"></i>
          </div>
          <h3 className="fw-bold mb-1">{data.league.name}</h3>
          <div className="text-secondary mb-4" style={{ fontSize: '.85rem' }}>
            {data.league.season_year} · {data.league.scoring_type} · {data.league.team_count}/{data.league.num_teams} teams
          </div>

          <div className="row g-2 mb-4">
            <div className="col-6">
              <div className="card">
                <div className="card-body p-3">
                  <div className="text-secondary" style={{ fontSize: '.7rem', textTransform: 'uppercase' }}>Commissioner</div>
                  <div className="fw-bold">{data.league.commissioner}</div>
                </div>
              </div>
            </div>
            <div className="col-6">
              <div className="card">
                <div className="card-body p-3">
                  <div className="text-secondary" style={{ fontSize: '.7rem', textTransform: 'uppercase' }}>Squad Size</div>
                  <div className="fw-bold">{data.league.squad_size}</div>
                </div>
              </div>
            </div>
          </div>

          {data.is_full ? (
            <div className="alert alert-warning">This league is full.</div>
          ) : (
            <form onSubmit={join}>
              <div className="mb-3">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Your team name"
                  maxLength={120}
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  required
                />
              </div>
              {error && <div className="alert alert-danger">{error}</div>}
              <button type="submit" className="btn btn-primary w-100" disabled={submitting || !teamName.trim()}>
                {submitting ? 'Joining…' : 'Join League'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
