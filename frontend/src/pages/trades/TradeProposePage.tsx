import { useParams, Link, useNavigate } from 'react-router'
import { useState, useEffect, useMemo } from 'react'
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

function fmtSc(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '?'
  return String(Math.round(n))
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
  const [previewExpanded, setPreviewExpanded] = useState(true)

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

  // ── Derive selected items for the live preview ─────────────────
  const givePlayers = useMemo(
    () => (data?.my_players ?? []).filter(p => givePlayerIds.has(p.id)),
    [data, givePlayerIds]
  )
  const receivePlayers = useMemo(
    () => (theirAssets?.players ?? []).filter(p => receivePlayerIds.has(p.id)),
    [theirAssets, receivePlayerIds]
  )
  const givePicks = useMemo(
    () => (data?.my_picks ?? []).filter(p => givePickIds.has(p.id)),
    [data, givePickIds]
  )
  const receivePicks = useMemo(
    () => (theirAssets?.picks ?? []).filter(p => receivePickIds.has(p.id)),
    [theirAssets, receivePickIds]
  )
  const outCount = givePlayers.length + givePicks.length
  const inCount = receivePlayers.length + receivePicks.length
  const giveSc = givePlayers.reduce((s, p) => s + (p.sc_avg || 0), 0)
  const recvSc = receivePlayers.reduce((s, p) => s + (p.sc_avg || 0), 0)
  const scDelta = recvSc - giveSc
  const rosterDelta = receivePlayers.length - givePlayers.length
  const hasAny = outCount > 0 || inCount > 0

  if (loading) return <Spinner text="Loading..." />
  if (error && !data) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-danger">Failed to load trade propose</p>

  const { league, user_team, trade_window_open, other_teams, my_players, my_picks } = data

  function toggle(set: Set<number>, id: number, setter: (s: Set<number>) => void) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  function clearAll() {
    setGivePlayerIds(new Set())
    setGivePickIds(new Set())
    setReceivePlayerIds(new Set())
    setReceivePickIds(new Set())
  }

  async function submit() {
    if (!recipientId) { setError('Select a team to trade with.'); return }
    if (!hasAny) {
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

  const recipientTeam = other_teams.find(t => t.id === recipientId)

  return (
    <div style={{ paddingBottom: hasAny ? '180px' : '24px' }}>
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

      {trade_window_open ? (
        <div className="alert" style={{ background: 'rgba(63,185,80,.08)', border: '1px solid rgba(63,185,80,.25)', color: '#c9d1d9', marginBottom: '1.5rem' }}>
          <i className="bi bi-check-circle me-1" style={{ color: '#3fb950' }}></i>
          <strong>Trade window open.</strong> Uneven trades (e.g. 2-for-3) are allowed during the mid-season period.
        </div>
      ) : (
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
            <div className="card-header" style={{ background: 'linear-gradient(180deg, rgba(248,81,73,0.06), transparent)', borderBottom: '1px solid rgba(248,81,73,0.18)' }}>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <span style={{ color: '#f85149' }}><i className="bi bi-arrow-up-right me-1"></i></span>You Send
                </h5>
                {(givePlayerIds.size + givePickIds.size) > 0 && (
                  <span className="badge" style={{ background: 'rgba(248,81,73,.18)', color: '#ff8a82', fontSize: '.7rem', padding: '4px 8px' }}>
                    {givePlayerIds.size + givePickIds.size} selected
                  </span>
                )}
              </div>
              <div className="text-secondary" style={{ fontSize: '.8rem', marginTop: 4 }}>{user_team.name}</div>
            </div>
            <div className="card-body scroll-body">
              <div className="mb-2" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8b949e', fontWeight: 600 }}>Players</div>
              {my_players.map(p => {
                const selected = givePlayerIds.has(p.id)
                return (
                  <div
                    key={p.id}
                    className="form-check mb-2"
                    style={{
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: selected ? 'rgba(248,81,73,.10)' : 'transparent',
                      transition: 'background 80ms ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`give_${p.id}`}
                      checked={selected}
                      onChange={() => toggle(givePlayerIds, p.id, setGivePlayerIds)}
                    />
                    <label className="form-check-label d-flex align-items-center gap-2" htmlFor={`give_${p.id}`} style={{ cursor: 'pointer' }}>
                      <span>{p.name}</span>
                      <span className={`pos-badge pos-${posCode(p.position)}`}>{p.position}</span>
                      <span className="text-secondary" style={{ fontSize: '.75rem', marginLeft: 'auto' }}>
                        SC {fmtSc(p.sc_avg)}
                      </span>
                    </label>
                  </div>
                )
              })}
              {my_picks.length > 0 && (
                <>
                  <div className="mt-3 mb-2" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8b949e', fontWeight: 600 }}>Draft Picks</div>
                  {Object.keys(myPicksByYear).sort().map(year => (
                    <div key={year}>
                      <div className="mt-2 mb-1" style={{ fontSize: '.8rem', color: '#58a6ff', fontWeight: 600 }}>{year}</div>
                      {myPicksByYear[year].map(pk => {
                        const selected = givePickIds.has(pk.id)
                        return (
                          <div
                            key={pk.id}
                            className="form-check mb-1"
                            style={{
                              padding: '4px 8px',
                              borderRadius: 6,
                              background: selected ? 'rgba(248,81,73,.10)' : 'transparent',
                              transition: 'background 80ms ease',
                            }}
                          >
                            <input
                              type="checkbox"
                              className="form-check-input"
                              id={`give_pick_${pk.id}`}
                              checked={selected}
                              onChange={() => toggle(givePickIds, pk.id, setGivePickIds)}
                            />
                            <label className="form-check-label d-flex align-items-center gap-2" htmlFor={`give_pick_${pk.id}`} style={{ fontSize: '.85rem', cursor: 'pointer' }}>
                              <span>Round {pk.round_number}</span>
                              {pk.original_team_id !== user_team.id && (
                                <span className="text-secondary" style={{ fontSize: '.7rem' }}>(originally {pk.original_team}'s)</span>
                              )}
                            </label>
                          </div>
                        )
                      })}
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
            <div className="card-header" style={{ background: 'linear-gradient(180deg, rgba(63,185,80,0.06), transparent)', borderBottom: '1px solid rgba(63,185,80,0.18)' }}>
              <div className="d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <span style={{ color: '#3fb950' }}><i className="bi bi-arrow-down-left me-1"></i></span>You Receive
                </h5>
                {(receivePlayerIds.size + receivePickIds.size) > 0 && (
                  <span className="badge" style={{ background: 'rgba(63,185,80,.18)', color: '#7ee787', fontSize: '.7rem', padding: '4px 8px' }}>
                    {receivePlayerIds.size + receivePickIds.size} selected
                  </span>
                )}
              </div>
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
                  {theirAssets.players.map(p => {
                    const selected = receivePlayerIds.has(p.id)
                    return (
                      <div
                        key={p.id}
                        className="form-check mb-2"
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: selected ? 'rgba(63,185,80,.10)' : 'transparent',
                          transition: 'background 80ms ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`recv_${p.id}`}
                          checked={selected}
                          onChange={() => toggle(receivePlayerIds, p.id, setReceivePlayerIds)}
                        />
                        <label className="form-check-label d-flex align-items-center gap-2" htmlFor={`recv_${p.id}`} style={{ cursor: 'pointer' }}>
                          <span>{p.name}</span>
                          <span className={`pos-badge pos-${posCode(p.position)}`}>{p.position}</span>
                          <span className="text-secondary" style={{ fontSize: '.75rem', marginLeft: 'auto' }}>
                            SC {fmtSc(p.sc_avg)}
                          </span>
                        </label>
                      </div>
                    )
                  })}
                  {theirAssets.picks.length > 0 && (
                    <>
                      <div className="mt-3 mb-2" style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8b949e', fontWeight: 600 }}>Draft Picks</div>
                      {Object.keys(theirPicksByYear).sort().map(year => (
                        <div key={year}>
                          <div className="mt-2 mb-1" style={{ fontSize: '.8rem', color: '#58a6ff', fontWeight: 600 }}>{year}</div>
                          {theirPicksByYear[year].map(pk => {
                            const selected = receivePickIds.has(pk.id)
                            return (
                              <div
                                key={pk.id}
                                className="form-check mb-1"
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 6,
                                  background: selected ? 'rgba(63,185,80,.10)' : 'transparent',
                                  transition: 'background 80ms ease',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id={`recv_pick_${pk.id}`}
                                  checked={selected}
                                  onChange={() => toggle(receivePickIds, pk.id, setReceivePickIds)}
                                />
                                <label className="form-check-label d-flex align-items-center gap-2" htmlFor={`recv_pick_${pk.id}`} style={{ fontSize: '.85rem', cursor: 'pointer' }}>
                                  <span>Round {pk.round_number}</span>
                                  {!pk.is_own && (
                                    <span className="text-secondary" style={{ fontSize: '.7rem' }}>(originally {pk.original_team}'s)</span>
                                  )}
                                </label>
                              </div>
                            )
                          })}
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

      {/* ─────────── STICKY LIVE PREVIEW BAR ─────────── */}
      {hasAny && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(13,17,23,.97)',
            backdropFilter: 'blur(10px)',
            borderTop: '1px solid #30363d',
            boxShadow: '0 -10px 30px -8px rgba(0,0,0,.5)',
            zIndex: 100,
          }}
        >
          <div className="container-fluid" style={{ maxWidth: 1200 }}>
            <div className="d-flex align-items-center justify-content-between" style={{ padding: '10px 20px', cursor: 'pointer' }} onClick={() => setPreviewExpanded(v => !v)}>
              <div className="d-flex align-items-center gap-3">
                <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#8b949e' }}>
                  Trade preview
                </span>
                <div className="d-flex align-items-center gap-2" style={{ fontSize: '.95rem', fontWeight: 600 }}>
                  <span style={{ color: '#ff8a82' }}>{outCount} out</span>
                  <i className="bi bi-arrow-left-right" style={{ color: '#484f58' }}></i>
                  <span style={{ color: '#7ee787' }}>{inCount} in</span>
                </div>
                {recipientTeam && (
                  <span className="text-secondary d-none d-md-inline" style={{ fontSize: '.8rem' }}>
                    with <strong style={{ color: '#c9d1d9' }}>{recipientTeam.name}</strong>
                  </span>
                )}
                <div className="d-flex align-items-center gap-3 d-none d-md-flex" style={{ fontSize: '.78rem', color: '#8b949e' }}>
                  <span title="Roster size change">
                    Roster {rosterDelta > 0 ? '+' : ''}{rosterDelta}
                  </span>
                  {(givePlayers.length > 0 || receivePlayers.length > 0) && (
                    <span title="SuperCoach avg change">
                      SC {scDelta > 0 ? '+' : ''}{Math.round(scDelta)}
                    </span>
                  )}
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={(e) => { e.stopPropagation(); clearAll() }} style={{ padding: '3px 10px', fontSize: '.78rem' }}>
                  Clear
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={(e) => { e.stopPropagation(); submit() }}
                  disabled={saving || !recipientId}
                  style={{ padding: '6px 14px', fontSize: '.85rem', fontWeight: 600 }}
                >
                  {saving ? 'Sending...' : <><i className="bi bi-send me-1"></i>Send Proposal</>}
                </button>
                <i
                  className={`bi bi-chevron-${previewExpanded ? 'down' : 'up'}`}
                  style={{ color: '#8b949e', fontSize: '.9rem', marginLeft: 4 }}
                ></i>
              </div>
            </div>

            {previewExpanded && (
              <div style={{ padding: '0 20px 14px', borderTop: '1px solid rgba(48,54,61,.6)' }}>
                <div className="row g-3 mt-0">
                  {/* SEND list */}
                  <div className="col-md-6">
                    <div style={{ fontSize: '.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#ff8a82', marginBottom: 6 }}>
                      <i className="bi bi-arrow-up-right me-1"></i>Sending ({outCount})
                    </div>
                    {outCount === 0 ? (
                      <div className="text-secondary" style={{ fontSize: '.82rem' }}>—</div>
                    ) : (
                      <div className="d-flex flex-wrap gap-1">
                        {givePlayers.map(p => (
                          <span key={p.id} className="d-inline-flex align-items-center gap-1" style={{
                            background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.25)',
                            padding: '3px 8px', borderRadius: 4, fontSize: '.78rem'
                          }}>
                            {p.name}
                            <span style={{ fontSize: '.68rem', color: '#8b949e' }}>{p.position}</span>
                            <span style={{ fontSize: '.68rem', color: '#8b949e' }}>· SC {fmtSc(p.sc_avg)}</span>
                          </span>
                        ))}
                        {givePicks.map(pk => (
                          <span key={pk.id} className="d-inline-flex align-items-center gap-1" style={{
                            background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.25)',
                            padding: '3px 8px', borderRadius: 4, fontSize: '.78rem'
                          }}>
                            <i className="bi bi-ticket-perforated" style={{ fontSize: '.7rem' }}></i>
                            {pk.year} R{pk.round_number}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* RECEIVE list */}
                  <div className="col-md-6">
                    <div style={{ fontSize: '.66rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: '#7ee787', marginBottom: 6 }}>
                      <i className="bi bi-arrow-down-left me-1"></i>Receiving ({inCount})
                    </div>
                    {inCount === 0 ? (
                      <div className="text-secondary" style={{ fontSize: '.82rem' }}>—</div>
                    ) : (
                      <div className="d-flex flex-wrap gap-1">
                        {receivePlayers.map(p => (
                          <span key={p.id} className="d-inline-flex align-items-center gap-1" style={{
                            background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.25)',
                            padding: '3px 8px', borderRadius: 4, fontSize: '.78rem'
                          }}>
                            {p.name}
                            <span style={{ fontSize: '.68rem', color: '#8b949e' }}>{p.position}</span>
                            <span style={{ fontSize: '.68rem', color: '#8b949e' }}>· SC {fmtSc(p.sc_avg)}</span>
                          </span>
                        ))}
                        {receivePicks.map(pk => (
                          <span key={pk.id} className="d-inline-flex align-items-center gap-1" style={{
                            background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.25)',
                            padding: '3px 8px', borderRadius: 4, fontSize: '.78rem'
                          }}>
                            <i className="bi bi-ticket-perforated" style={{ fontSize: '.7rem' }}></i>
                            {pk.year} R{pk.round_number}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {!recipientId && (
                  <div className="mt-3" style={{ fontSize: '.78rem', color: '#d29922' }}>
                    <i className="bi bi-exclamation-triangle me-1"></i>
                    Pick a team on the right to send this trade to.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
