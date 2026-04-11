import { useParams } from 'react-router'
import { useEffect, useState, useCallback } from 'react'
import { api, post } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface DraftState {
  active: boolean
  completed: boolean
  current_pick: number
  current_team: { id: number; name: string } | null
  picks: { pick: number; team: string; player: string; position: string; is_auto?: boolean }[]
  round: number
  paused: boolean
}

interface AvailablePlayer {
  id: number
  name: string
  position: string
  afl_team: string
  sc_avg: number
  age: number
}

interface MockData {
  league: { id: number; name: string }
  session: { id: number; status: string; current_pick: number; total_rounds: number }
  user_team: { id: number; name: string } | null
  state: DraftState
  user_weights: Record<string, number>
  has_custom_weights: boolean
}

export function MockDraftPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<MockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState<AvailablePlayer[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const d = await api<MockData>(`/leagues/${leagueId}/draft/mock?format=json`)
    setData(d)
    setLoading(false)
  }, [leagueId])

  const fetchAvailable = useCallback(async () => {
    const q = new URLSearchParams({ search })
    const list = await api<AvailablePlayer[]>(`/leagues/${leagueId}/draft/api/available?${q}`)
    setAvailable(list)
  }, [leagueId, search])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { fetchAvailable() }, [fetchAvailable])

  if (loading) return <Spinner text="Loading mock draft..." />
  if (!data) return <p className="text-danger">Failed to load mock draft</p>

  const { state, user_team } = data
  const isMyTurn = !!user_team && state.current_team?.id === user_team.id

  async function makePick(playerId: number) {
    setBusy(true)
    try {
      await post(`/leagues/${leagueId}/draft/mock/pick`, { player_id: playerId })
      await refresh()
      await fetchAvailable()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function autoStart() {
    setBusy(true)
    try {
      await post(`/leagues/${leagueId}/draft/mock/auto_start`)
      await refresh()
    } finally { setBusy(false) }
  }

  async function reset() {
    if (!confirm('Reset the mock draft?')) return
    await post(`/leagues/${leagueId}/draft/mock/reset`)
    await refresh()
    await fetchAvailable()
  }

  async function del() {
    if (!confirm('Delete the mock draft?')) return
    const fd = new FormData()
    await fetch(`/leagues/${leagueId}/draft/mock/delete`, { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' })
    window.location.href = `/spa/leagues/${leagueId}/draft/setup`
  }

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-play-circle me-2" style={{ color: '#58a6ff' }}></i>Mock Draft</h2>
        <div className="d-flex gap-2 align-items-center">
          <span className="text-secondary" style={{ fontSize: '.85rem' }}>
            Round {state.round} · Pick {state.current_pick}/{data.session.total_rounds * (data.state.picks.length > 0 ? Math.ceil((data.state.picks.length + 1) / state.round) : 10)}
          </span>
          <button className="btn btn-sm btn-outline-secondary" onClick={autoStart} disabled={busy}>Auto-advance</button>
          <button className="btn btn-sm btn-outline-secondary" onClick={reset} disabled={busy}>Reset</button>
          <button className="btn btn-sm btn-outline-danger" onClick={del} disabled={busy}>Delete</button>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-5">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.85rem' }}>Pick History</h5>
              {isMyTurn && state.active && (
                <span className="badge bg-success">Your pick!</span>
              )}
            </div>
            <div className="card-body p-0" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <table className="table table-sm mb-0">
                <tbody>
                  {[...state.picks].reverse().map(p => (
                    <tr key={p.pick}>
                      <td style={{ width: 40, color: '#484f58' }}>{p.pick}</td>
                      <td style={{ fontSize: '.75rem' }}>{p.team}</td>
                      <td><strong style={{ fontSize: '.8rem' }}>{p.player}</strong></td>
                      <td className="text-secondary" style={{ fontSize: '.7rem' }}>{p.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card">
            <div className="card-header">
              <input type="text" className="form-control form-control-sm" placeholder="Search players…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="card-body p-0" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Pos</th>
                    <th>Team</th>
                    <th className="text-end">Age</th>
                    <th className="text-end">SC Avg</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {available.map(p => (
                    <tr key={p.id}>
                      <td><strong style={{ fontSize: '.8rem' }}>{p.name}</strong></td>
                      <td><span className="text-secondary" style={{ fontSize: '.7rem' }}>{p.position}</span></td>
                      <td><span className="text-secondary" style={{ fontSize: '.7rem' }}>{p.afl_team}</span></td>
                      <td className="text-end" style={{ fontSize: '.75rem' }}>{p.age}</td>
                      <td className="text-end"><strong>{p.sc_avg.toFixed(0)}</strong></td>
                      <td>
                        <button className="btn btn-sm btn-primary" disabled={!isMyTurn || busy} onClick={() => makePick(p.id)} style={{ fontSize: '.7rem' }}>
                          Pick
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
