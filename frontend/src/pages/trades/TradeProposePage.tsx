import { useParams, Link, useNavigate } from 'react-router'
import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface Team { id: number; name: string; owner?: string }
interface Player { id: number; name: string; position: string; sc_avg: number }
interface Pick {
  id: number
  year: number
  round_number: number
  original_team_id: number
  original_team: string
  is_own: boolean
}

interface ProposeData {
  league: { id: number; name: string }
  user_team: Team
  trade_window_open: boolean
  other_teams: Team[]
  my_players: Player[]
  my_picks: Pick[]
}

interface TeamAssets {
  players: Player[]
  picks: Pick[]
}

function posCode(pos: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}

export function TradeProposePage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<ProposeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [givePlayerIds, setGivePlayerIds] = useState<Set<number>>(new Set())
  const [givePickIds, setGivePickIds] = useState<Set<number>>(new Set())
  const [receivePlayerIds, setReceivePlayerIds] = useState<Set<number>>(new Set())
  const [receivePickIds, setReceivePickIds] = useState<Set<number>>(new Set())
  const [recipientId, setRecipientId] = useState<number | ''>('')
  const [notes, setNotes] = useState('')
  const [period, setPeriod] = useState<'midseason' | 'offseason'>('midseason')

  const [theirAssets, setTheirAssets] = useState<TeamAssets | null>(null)
  const [loadingTheir, setLoadingTheir] = useState(false)

  useEffect(() => {
    api<ProposeData>(`/leagues/${leagueId}/trades/propose?format=json`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [leagueId])

  useEffect(() => {
    if (!recipientId) { setTheirAssets(null); return }
    setLoadingTheir(true)
    setReceivePlayerIds(new Set())
    setReceivePickIds(new Set())
    Promise.all([
      api<Player[]>(`/leagues/${leagueId}/trades/api/roster/${recipientId}`),
      api<Pick[]>(`/leagues/${leagueId}/trades/api/picks/${recipientId}`),
    ])
      .then(([players, picks]) => setTheirAssets({ players, picks }))
      .catch(e => setError(e.message))
      .finally(() => setLoadingTheir(false))
  }, [recipientId, leagueId])

  if (loading) return <Spinner text="Loading..." />
  if (error) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-danger">Failed to load trade propose</p>

  const { league, user_team, trade_window_open, other_teams, my_players, my_picks } = data

  function toggle(set: Set<number>, id: number, setter: (s: Set<number>) => void) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  async function submit() {
    if (!recipientId) { setError('Select a team to trade with.'); return }
    if (!givePlayerIds.size && !receivePlayerIds.size && !givePickIds.size && !receivePickIds.size) {
      setError('Select at least one player or draft pick to trade.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('recipient_team_id', String(recipientId))
      form.set('intended_period', period)
      form.set('notes', notes)
      givePlayerIds.forEach(id => form.append('give_player_ids', String(id)))
      givePickIds.forEach(id => form.append('give_pick_ids', String(id)))
      receivePlayerIds.forEach(id => form.append('receive_player_ids', String(id)))
      receivePickIds.forEach(id => form.append('receive_pick_ids', String(id)))
      const res = await fetch(`/leagues/${leagueId}/trades/propose`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      navigate(`/leagues/${leagueId}/trades`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // Group picks by year for rendering
  function groupPicksByYear(picks: Pick[]): Record<string, Pick[]> {
    const out: Record<string, Pick[]> = {}
    picks.forEach(p => { (out[p.year] ||= []).push(p) })
    return out
  }
  const myPicksByYear = groupPicksByYear(my_picks)
  const theirPicksByYear = theirAssets ? groupPicksByYear(theirAssets.picks) : {}

  return (
    <div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link>
          {' / '}<Link to={`/leagues/${leagueId}/trades`}>Trades</Link>
          {' / '}Propose
        </div>
        <div className="d-flex align-items-center gap-3">
          <Link to={`/leagues/${leagueId}/trades`} className="btn btn-sm btn-outline-secondary" style={{ padding: '4px 10px' }}>
            <i className="bi bi-arrow-left"></i>
          </Link>
          <h2 className="mb-0">Propose a Trade</h2>
        </div>
      </div>

      {!trade_window_open && (
        <div className="alert" style={{ background: 'rgba(88,166,255,.08)', border: '1px solid rgba(88,166,255,.25)', color: '#c9d1d9', marginBottom: '1.5rem' }}>
          <i className="bi bi-info-circle me-1" style={{ color: '#58a6ff' }}></i>
          Trade window is currently closed. You can still propose trades — accepted trades will auto-execute when the window opens.
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>
      )}

      <div className="row g-4">
        {/* YOU SEND */}
        <div className="col-md-5">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <span style={{ color: '#f85149' }}><i className="bi bi-arrow-up-right me-1"></i></span>You Send
              </h5>
              <div className="text-secondary" style={{ fontSize: '.8rem' }}>{user_team.name}</div>
            </div>
            <div className="card-body scroll-body">
              <div className="mb-2" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8b949e', fontWeight: 600 }}>Players</div>
              {my_players.map(p => (
                <div key={p.id} className="form-check mb-2">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id={`give_${p.id}`}
                    checked={givePlayerIds.has(p.id)}
                    onChange={() => toggle(givePlayerIds, p.id, setGivePlayerIds)}
                  />
                  <label className="form-check-label d-flex align-items-center gap-2" htmlFor={`give_${p.id}`}>
                    <span>{p.name}</span>
                    <span className={`pos-badge pos-${posCode(p.position)}`}>{p.position}</span>
                    <span className="text-secondary" style={{ fontSize: '.75rem' }}>
                      {p.sc_avg ? Math.round(p.sc_avg) : '?'}
                    </span>
                  </label>
                </div>
              ))}
              {my_picks.length > 0 && (
                <>
                  <div className="mt-3 mb-2" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8b949e', fontWeight: 600 }}>Draft Picks</div>
                  {Object.keys(myPicksByYear).sort().map(year => (
                    <div key={year}>
                      <div className="mt-2 mb-1" style={{ fontSize: '.8rem', color: '#58a6ff', fontWeight: 600 }}>{year}</div>
                      {myPicksByYear[year].map(pk => (
                        <div key={pk.id} className="form-check mb-1">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`give_pick_${pk.id}`}
                            checked={givePickIds.has(pk.id)}
                            onChange={() => toggle(givePickIds, pk.id, setGivePickIds)}
                          />
                          <label className="form-check-label d-flex align-items-center gap-2" htmlFor={`give_pick_${pk.id}`} style={{ fontSize: '.85rem' }}>
                            <span>Round {pk.round_number}</span>
                            {pk.original_team_id !== user_team.id && (
                              <span className="text-secondary" style={{ fontSize: '.7rem' }}>(originally {pk.original_team}'s)</span>
                            )}
                          </label>
                        </div>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-2 d-flex align-items-center justify-content-center">
          <div className="text-center">
            <i className="bi bi-arrow-left-right" style={{ fontSize: '2rem', color: '#30363d' }}></i>
          </div>
        </div>

        {/* YOU RECEIVE */}
        <div className="col-md-5">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <span style={{ color: '#3fb950' }}><i className="bi bi-arrow-down-left me-1"></i></span>You Receive
              </h5>
              <div className="mt-2">
                <select
                  className="form-select form-select-sm"
                  value={recipientId}
                  onChange={e => setRecipientId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Select a team...</option>
                  {other_teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.owner})</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="card-body scroll-body">
              {!recipientId ? (
                <div className="text-center py-4">
                  <i className="bi bi-people" style={{ fontSize: '1.5rem', color: '#30363d' }}></i>
                  <p className="text-secondary mt-2 mb-0" style={{ fontSize: '.85rem' }}>Select a team to see their roster</p>
                </div>
              ) : loadingTheir || !theirAssets ? (
                <Spinner text="Loading roster..." />
              ) : (
                <>
                  <div className="mb-2" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8b949e', fontWeight: 600 }}>Players</div>
                  {theirAssets.players.map(p => (
                    <div key={p.id} className="form-check mb-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`recv_${p.id}`}
                        checked={receivePlayerIds.has(p.id)}
                        onChange={() => toggle(receivePlayerIds, p.id, setReceivePlayerIds)}
                      />
                      <label className="form-check-label d-flex align-items-center gap-2" htmlFor={`recv_${p.id}`}>
                        <span>{p.name}</span>
                        <span className={`pos-badge pos-${posCode(p.position)}`}>{p.position}</span>
                        <span className="text-secondary" style={{ fontSize: '.75rem' }}>
                          {p.sc_avg ? Math.round(p.sc_avg) : '?'}
                        </span>
                      </label>
                    </div>
                  ))}
                  {theirAssets.picks.length > 0 && (
                    <>
                      <div className="mt-3 mb-2" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8b949e', fontWeight: 600 }}>Draft Picks</div>
                      {Object.keys(theirPicksByYear).sort().map(year => (
                        <div key={year}>
                          <div className="mt-2 mb-1" style={{ fontSize: '.8rem', color: '#58a6ff', fontWeight: 600 }}>{year}</div>
                          {theirPicksByYear[year].map(pk => (
                            <div key={pk.id} className="form-check mb-1">
                              <input
                                type="checkbox"
                                className="form-check-input"
                                id={`recv_pick_${pk.id}`}
                                checked={receivePickIds.has(pk.id)}
                                onChange={() => toggle(receivePickIds, pk.id, setReceivePickIds)}
                              />
                              <label className="form-check-label d-flex align-items-center gap-2" htmlFor={`recv_pick_${pk.id}`} style={{ fontSize: '.85rem' }}>
                                <span>Round {pk.round_number}</span>
                                {!pk.is_own && (
                                  <span className="text-secondary" style={{ fontSize: '.7rem' }}>(originally {pk.original_team}'s)</span>
                                )}
                              </label>
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-body">
          <div className="mb-3">
            <label htmlFor="intended_period" className="form-label">Intended Trade Period</label>
            <select
              className="form-select form-select-sm"
              id="intended_period"
              value={period}
              onChange={e => setPeriod(e.target.value as 'midseason' | 'offseason')}
              style={{ maxWidth: 250 }}
            >
              <option value="midseason">Mid-Season</option>
              <option value="offseason">End of Season</option>
            </select>
            <div className="form-text" style={{ fontSize: '.7rem', color: '#484f58' }}>
              Which trade window should this trade execute in?
            </div>
          </div>
          <label htmlFor="notes" className="form-label">
            Message <span className="text-secondary" style={{ fontSize: '.75rem' }}>(optional)</span>
          </label>
          <textarea
            className="form-control"
            id="notes"
            rows={2}
            placeholder="Add a note for the other manager..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3">
        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
          <i className="bi bi-send me-1"></i>Send Proposal
        </button>
        <Link to={`/leagues/${leagueId}/trades`} className="btn btn-outline-secondary ms-2">Cancel</Link>
      </div>
    </div>
  )
}
