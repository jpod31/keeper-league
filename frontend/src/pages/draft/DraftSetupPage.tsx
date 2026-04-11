import { useParams, useNavigate, Link } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Team { id: number; name: string; owner: string; draft_order: number | null }
interface DraftSession {
  id: number
  status: string
  draft_round_type: string
  is_mock: boolean
  scheduled_start: string | null
  current_pick: number
  total_rounds: number
}

interface DraftSetupData {
  league: {
    id: number; name: string; draft_type: string; pick_timer_secs: number
    squad_size: number; draft_scheduled_date: string | null
    is_commissioner: boolean
  }
  teams: Team[]
  session: DraftSession | null
  initial_session: DraftSession | null
  initial_completed: boolean
  supp_session: DraftSession | null
  mock_session: DraftSession | null
  can_restart: boolean
}

export function DraftSetupPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const { data, loading, refetch } = useFetch<DraftSetupData>(`/leagues/${leagueId}/draft/setup?format=json`)
  const [scheduled, setScheduled] = useState('')
  const [suppRounds, setSuppRounds] = useState(5)
  const [suppScheduled, setSuppScheduled] = useState('')
  const [mockRounds, setMockRounds] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)

  if (loading) return <Spinner text="Loading draft setup..." />
  if (!data) return <p className="text-danger">Failed to load draft setup</p>
  if (!data.league.is_commissioner) {
    return (
      <div className="alert alert-warning">
        <i className="bi bi-shield-exclamation me-2"></i>Only the commissioner can set up the draft.
      </div>
    )
  }

  async function post(action: string, extra: Record<string, string> = {}) {
    setBusy(action)
    try {
      const fd = new FormData()
      fd.set('action', action)
      for (const [k, v] of Object.entries(extra)) fd.set(k, v)
      const res = await fetch(`/leagues/${leagueId}/draft/setup`, { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' })
      if (res.status >= 500) {
        alert('Server error')
      }
      await refetch()
    } finally {
      setBusy(null)
    }
  }

  const { teams, initial_session, initial_completed, mock_session, can_restart } = data

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-gear me-2" style={{ color: '#58a6ff' }}></i>Draft Setup</h2>
        <div className="text-secondary" style={{ fontSize: '.85rem' }}>
          {data.league.draft_type} draft · {data.league.pick_timer_secs}s pick timer
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-shuffle me-2"></i>Draft Order
              </h5>
              <button className="btn btn-sm btn-outline-primary" disabled={busy === 'randomize'} onClick={() => post('randomize')}>
                Randomize
              </button>
            </div>
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Team</th><th>Owner</th></tr></thead>
                <tbody>
                  {teams.sort((a, b) => (a.draft_order ?? 999) - (b.draft_order ?? 999)).map((t, i) => (
                    <tr key={t.id}>
                      <td><strong>{t.draft_order ?? i + 1}</strong></td>
                      <td>{t.name}</td>
                      <td className="text-secondary">{t.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card mb-4">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Initial Draft Session</h5></div>
            <div className="card-body">
              {!initial_session && (
                <>
                  <p className="text-secondary" style={{ fontSize: '.8rem' }}>No initial draft session yet. Create one to unlock the draft room.</p>
                  <div className="mb-3">
                    <label className="form-label" style={{ fontSize: '.8rem' }}>Scheduled start (optional)</label>
                    <input type="datetime-local" className="form-control form-control-sm" value={scheduled} onChange={e => setScheduled(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" disabled={busy === 'create_session'} onClick={() => post('create_session', scheduled ? { scheduled_start: scheduled } : {})}>
                    Create Session
                  </button>
                </>
              )}
              {initial_session && (
                <>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-secondary" style={{ fontSize: '.8rem' }}>Status</span>
                    <span className="badge bg-secondary">{initial_session.status}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-secondary" style={{ fontSize: '.8rem' }}>Scheduled</span>
                    <span style={{ fontSize: '.8rem' }}>{initial_session.scheduled_start ? new Date(initial_session.scheduled_start).toLocaleString() : 'Not scheduled'}</span>
                  </div>
                  {!initial_completed && initial_session.status !== 'in_progress' && (
                    <div className="d-flex gap-2 mt-3">
                      <input type="datetime-local" className="form-control form-control-sm flex-grow-1" value={scheduled} onChange={e => setScheduled(e.target.value)} />
                      <button className="btn btn-sm btn-outline-secondary" disabled={busy === 'set_schedule'} onClick={() => post('set_schedule', { scheduled_start: scheduled })}>
                        Update
                      </button>
                    </div>
                  )}
                  <div className="mt-3 d-flex gap-2">
                    {initial_session.status !== 'completed' && initial_session.status !== 'in_progress' && (
                      <button className="btn btn-success" disabled={busy === 'start'} onClick={() => post('start')}>
                        <i className="bi bi-play-fill me-1"></i>Start Draft
                      </button>
                    )}
                    {initial_session.status === 'in_progress' && (
                      <button className="btn btn-primary" onClick={() => navigate(`/leagues/${leagueId}/draft`)}>
                        <i className="bi bi-box-arrow-in-right me-1"></i>Enter Draft Room
                      </button>
                    )}
                    {can_restart && (
                      <button className="btn btn-outline-danger btn-sm" disabled={busy === 'restart_draft'} onClick={() => { if (confirm('Restart the draft? This clears all picks.')) post('restart_draft') }}>
                        Restart
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Supplemental Draft</h5></div>
            <div className="card-body">
              {!data.supp_session && (
                <>
                  <div className="mb-2">
                    <label className="form-label" style={{ fontSize: '.8rem' }}>Rounds</label>
                    <input type="number" min={1} className="form-control form-control-sm" value={suppRounds} onChange={e => setSuppRounds(Number(e.target.value))} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label" style={{ fontSize: '.8rem' }}>Scheduled start (optional)</label>
                    <input type="datetime-local" className="form-control form-control-sm" value={suppScheduled} onChange={e => setSuppScheduled(e.target.value)} />
                  </div>
                  <button className="btn btn-outline-primary" disabled={busy === 'create_supplemental'}
                    onClick={() => post('create_supplemental', { supp_rounds: String(suppRounds), supp_scheduled_start: suppScheduled })}>
                    Create Supplemental
                  </button>
                </>
              )}
              {data.supp_session && (
                <div style={{ fontSize: '.85rem' }}>
                  Status: <strong>{data.supp_session.status}</strong> ·
                  Rounds: <strong>{data.supp_session.total_rounds}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Mock Draft</h5></div>
            <div className="card-body">
              {!mock_session && (
                <>
                  <p className="text-secondary" style={{ fontSize: '.8rem' }}>Practice your draft strategy against computer opponents.</p>
                  <div className="mb-2">
                    <label className="form-label" style={{ fontSize: '.8rem' }}>Rounds (default: squad size)</label>
                    <input type="number" className="form-control form-control-sm" placeholder={String(data.league.squad_size)} value={mockRounds || ''} onChange={e => setMockRounds(Number(e.target.value))} />
                  </div>
                  <button className="btn btn-outline-primary" disabled={busy === 'create_mock'}
                    onClick={() => post('create_mock', mockRounds ? { mock_rounds: String(mockRounds) } : {})}>
                    Start Mock
                  </button>
                </>
              )}
              {mock_session && (
                <>
                  <p style={{ fontSize: '.85rem' }}>Mock in progress: <strong>{mock_session.status}</strong></p>
                  <div className="d-flex gap-2">
                    <Link to={`/leagues/${leagueId}/draft/mock`} className="btn btn-primary btn-sm">Enter Mock</Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {(initial_session?.status === 'completed') && (
        <div className="mt-3 text-center">
          <Link to={`/leagues/${leagueId}/draft/recap`} className="btn btn-outline-primary">
            <i className="bi bi-list-check me-1"></i>View Draft Recap
          </Link>
        </div>
      )}
    </div>
  )
}
