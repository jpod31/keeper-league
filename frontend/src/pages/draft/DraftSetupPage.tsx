import { useParams, Link, useNavigate } from 'react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../lib/api'
import { RowsSkeleton } from '../../components/ui/RowsSkeleton'

interface Team { id: number; name: string; owner: string; draft_order: number }
interface DraftSessionSummary {
  id: number
  status: 'scheduled' | 'in_progress' | 'paused' | 'completed'
  draft_round_type: 'initial' | 'supplemental' | string
  is_mock: boolean
  scheduled_start: string | null
  current_pick: number | null
  current_round: number | null
  total_rounds: number
}

interface SetupData {
  league: {
    id: number
    name: string
    draft_type: string
    pick_timer_secs: number
    squad_size: number
    draft_scheduled_date: string | null
    is_commissioner: boolean
  }
  teams: Team[]
  session: DraftSessionSummary | null
  initial_session: DraftSessionSummary | null
  initial_completed: boolean
  supp_session: DraftSessionSummary | null
  mock_session: DraftSessionSummary | null
  season_config: { mid_season_draft_enabled: boolean }
  can_restart: boolean
}

const DRAFT_SETUP_STYLE = `
.draft-order-list { display:flex; flex-direction:column; }
.draft-order-row { display:flex; align-items:center; gap:.75rem; padding:.65rem 1rem; border-bottom:1px solid var(--kl-border); background:var(--kl-bg-card); transition:background .12s, transform .12s, box-shadow .12s; user-select:none; }
.draft-order-row:last-child { border-bottom:none; }
.draft-order-row.draggable { cursor:grab; }
.draft-order-row.dragging { opacity:.85; background:var(--kl-bg-elevated); box-shadow:0 4px 16px rgba(0,0,0,.3); z-index:10; }
.draft-order-row.drag-over-above { box-shadow:inset 0 2px 0 var(--kl-accent-blue); }
.draft-order-row.drag-over-below { box-shadow:inset 0 -2px 0 var(--kl-accent-blue); }
.draft-order-grip { color:var(--kl-text-faint); font-size:1.1rem; width:20px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.draft-order-row.draggable:hover .draft-order-grip { color:var(--kl-text-secondary); }
.pick-badge { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; background:#21262d; font-size:.75rem; font-weight:700; border-radius:6px; color:var(--kl-text-primary); }
.draft-order-info { flex:1; min-width:0; }
.draft-order-name { font-weight:600; font-size:.85rem; color:var(--kl-text-heading); }
.draft-order-owner { font-size:.72rem; color:var(--kl-text-muted); }
.draft-order-arrows { display:flex; flex-direction:column; gap:2px; }
.arrow-btn { background:none; border:1px solid var(--kl-border); color:var(--kl-text-secondary); border-radius:4px; padding:0; width:24px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:.65rem; transition:background .12s, color .12s; }
.arrow-btn:hover:not(:disabled) { background:var(--kl-bg-elevated); color:var(--kl-text-heading); }
.arrow-btn:disabled { opacity:.25; cursor:default; }
.draft-order-save { padding:.75rem 1rem; border-top:1px solid var(--kl-border); }
.draft-order-changed .pick-badge { background:var(--kl-accent-blue); color:#fff; }
@media (max-width:768px) {
  .draft-order-row { padding:.6rem .75rem; gap:.5rem; }
  .arrow-btn { width:32px; height:28px; font-size:.75rem; }
  .draft-order-grip { font-size:1.3rem; }
}
`

function formatDiff(diffMs: number): string {
  if (diffMs <= 0) return ''
  const d = Math.floor(diffMs / 86400000)
  const h = Math.floor((diffMs % 86400000) / 3600000)
  const m = Math.floor((diffMs % 3600000) / 60000)
  const s = Math.floor((diffMs % 60000) / 1000)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}d`)
  parts.push(`${h}h`)
  parts.push(`${m}m`)
  parts.push(`${s}s`)
  return parts.join(' ')
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
    ' at ' + d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function Countdown({ target }: { target: string }) {
  const [label, setLabel] = useState('')
  useEffect(() => {
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now()
      if (diff <= 0) { setLabel('Draft time has arrived!'); return }
      setLabel(formatDiff(diff))
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [target])
  return <span>{label}</span>
}

export function DraftSetupPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<SetupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const [orderTeams, setOrderTeams] = useState<Team[]>([])
  const [originalOrder, setOriginalOrder] = useState<number[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below' | null>(null)

  const [scheduledStart, setScheduledStart] = useState('')
  const [updateSched, setUpdateSched] = useState('')
  const [suppRounds, setSuppRounds] = useState(5)
  const [suppSchedStart, setSuppSchedStart] = useState('')
  const [mockRoundsInput, setMockRoundsInput] = useState(0)
  const submittingRef = useRef(false)

  const refresh = useCallback(async () => {
    const d = await api<SetupData>(`/leagues/${leagueId}/draft/setup?format=json`)
    setData(d)
    setOrderTeams([...d.teams].sort((a, b) => a.draft_order - b.draft_order))
    setOriginalOrder([...d.teams].sort((a, b) => a.draft_order - b.draft_order).map(t => t.id))
    setScheduledStart(toLocalInput(d.league.draft_scheduled_date))
    setUpdateSched(toLocalInput(d.session?.scheduled_start ?? null))
    setMockRoundsInput(d.league.squad_size)
  }, [leagueId])

  useEffect(() => {
    refresh().catch(() => {}).finally(() => setLoading(false))
  }, [refresh])

  async function postAction(fields: Record<string, string>, successMsg: string, errorMsg?: string) {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      const fd = new FormData()
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v))
      const res = await fetch(`/leagues/${leagueId}/draft/setup`, { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      setMsg({ kind: 'success', text: successMsg })
      await refresh()
    } catch (e) {
      setMsg({ kind: 'error', text: errorMsg ?? (e as Error).message })
    } finally {
      submittingRef.current = false
    }
  }

  const orderChanged = JSON.stringify(orderTeams.map(t => t.id)) !== JSON.stringify(originalOrder)

  function moveRow(idx: number, dir: -1 | 1) {
    const ni = idx + dir
    if (ni < 0 || ni >= orderTeams.length) return
    const next = orderTeams.slice()
    const tmp = next[idx]; next[idx] = next[ni]; next[ni] = tmp
    setOrderTeams(next)
  }

  function onDragStart(idx: number) { setDragIndex(idx) }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIndex == null || dragIndex === idx) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    setDragOverIndex(idx)
    setDragOverPos(e.clientY < mid ? 'above' : 'below')
  }
  function onDragEnd() { setDragIndex(null); setDragOverIndex(null); setDragOverPos(null) }
  function onDrop(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIndex == null || dragIndex === idx) { onDragEnd(); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mid = rect.top + rect.height / 2
    const insertAfter = e.clientY >= mid
    const next = orderTeams.slice()
    const [moved] = next.splice(dragIndex, 1)
    let target = idx
    if (dragIndex < idx) target -= 1
    next.splice(insertAfter ? target + 1 : target, 0, moved)
    setOrderTeams(next)
    onDragEnd()
  }

  async function saveOrder() {
    const order = orderTeams.map(t => t.id).join(',')
    await postAction({ action: 'save_order', order }, 'Draft order saved')
  }

  async function randomize() {
    await postAction({ action: 'randomize' }, 'Draft order randomized')
  }

  async function createSession() {
    const fields: Record<string, string> = { action: 'create_session' }
    if (scheduledStart) fields.scheduled_start = scheduledStart
    await postAction(fields, 'Draft session created')
  }

  async function startDraft() {
    await postAction({ action: 'start' }, 'Draft started')
    navigate(`/leagues/${leagueId}/draft`)
  }

  async function setSchedule() {
    await postAction({ action: 'set_schedule', scheduled_start: updateSched }, 'Draft time updated')
  }

  async function createSupplemental() {
    const fields: Record<string, string> = { action: 'create_supplemental', supp_rounds: String(suppRounds) }
    if (suppSchedStart) fields.supp_scheduled_start = suppSchedStart
    await postAction(fields, 'Supplemental draft session created')
  }

  async function restartDraft() {
    if (!confirm('Are you sure you want to restart the draft?\n\nThis will DELETE the current draft session, remove all drafted players from rosters, and take you to settings where you can make changes before re-drafting.\n\nThis cannot be undone.')) return
    await postAction({ action: 'restart_draft' }, 'Draft reset')
    navigate(`/leagues/${leagueId}/settings`)
  }

  async function createMock() {
    await postAction({ action: 'create_mock', mock_rounds: String(mockRoundsInput) }, 'Mock draft created')
    navigate(`/leagues/${leagueId}/draft/mock`)
  }

  async function deleteMock() {
    if (!confirm('Delete the mock draft?')) return
    try {
      await fetch(`/leagues/${leagueId}/draft/mock/delete`, { method: 'POST', credentials: 'same-origin' })
      await refresh()
    } catch { /* noop */ }
  }

  if (loading) return <RowsSkeleton rows={8} />
  if (!data) return <p className="text-danger">Failed to load draft setup</p>

  const { league, teams, session, initial_session, initial_completed, supp_session, mock_session, season_config, can_restart } = data
  const canEditOrder = !session || session.status === 'scheduled'
  const totalPicks = league.squad_size * teams.length

  const showSuppScheduled = supp_session && supp_session.status === 'scheduled' && session?.id === supp_session.id
  const showCreateSupp = initial_completed && season_config.mid_season_draft_enabled && (!supp_session || supp_session.status === 'completed')

  return (
    <div>
      <style>{DRAFT_SETUP_STYLE}</style>
      <div className="row justify-content-center">
        <div className="col-md-7">
          <div className="page-header">
            <div className="page-breadcrumb">
              <Link to={`/leagues/${leagueId}`}>{league.name}</Link> / <Link to={`/leagues/${leagueId}/commissioner`}>Commissioner</Link> / Draft Setup
            </div>
            <div className="d-flex align-items-center gap-3">
              <Link to={`/leagues/${leagueId}/commissioner`} className="btn btn-sm btn-outline-secondary" style={{ padding: '4px 10px' }}>
                <i className="bi bi-arrow-left"></i>
              </Link>
              <h2 className="mb-0">Draft Setup</h2>
            </div>
          </div>

          {msg && (
            <div className={`alert alert-${msg.kind === 'success' ? 'success' : 'danger'}`} style={{ fontSize: '.85rem' }}>{msg.text}</div>
          )}

          {/* Draft Order */}
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-sort-numeric-down me-2" style={{ color: '#8b949e' }}></i>Draft Order
              </h5>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={randomize} disabled={!canEditOrder}>
                <i className="bi bi-shuffle me-1"></i>Randomize
              </button>
            </div>
            <div className="card-body p-0">
              <div className={`draft-order-list${orderChanged ? ' draft-order-changed' : ''}`}>
                {orderTeams.map((t, i) => {
                  const isDragOver = dragOverIndex === i && dragIndex !== null && dragIndex !== i
                  const dragClass = isDragOver ? (dragOverPos === 'above' ? ' drag-over-above' : ' drag-over-below') : ''
                  const draggingClass = dragIndex === i ? ' dragging' : ''
                  return (
                    <div
                      key={t.id}
                      className={`draft-order-row${canEditOrder ? ' draggable' : ''}${dragClass}${draggingClass}`}
                      draggable={canEditOrder}
                      onDragStart={() => onDragStart(i)}
                      onDragOver={e => onDragOver(e, i)}
                      onDrop={e => onDrop(e, i)}
                      onDragEnd={onDragEnd}
                    >
                      <div className="draft-order-grip">{canEditOrder && <i className="bi bi-grip-vertical"></i>}</div>
                      <div className="draft-order-pick"><span className="pick-badge">{i + 1}</span></div>
                      <div className="draft-order-info">
                        <div className="draft-order-name">{t.name}</div>
                        <div className="draft-order-owner">{t.owner}</div>
                      </div>
                      {canEditOrder && (
                        <div className="draft-order-arrows">
                          <button type="button" className="arrow-btn" onClick={() => moveRow(i, -1)} disabled={i === 0}><i className="bi bi-chevron-up"></i></button>
                          <button type="button" className="arrow-btn" onClick={() => moveRow(i, 1)} disabled={i === orderTeams.length - 1}><i className="bi bi-chevron-down"></i></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {canEditOrder && orderChanged && (
                <div className="draft-order-save">
                  <button type="button" className="btn btn-primary btn-sm w-100" onClick={saveOrder}>
                    <i className="bi bi-check-lg me-1"></i>Save Order
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Configuration */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-gear me-2" style={{ color: '#8b949e' }}></i>Configuration
                <span className="text-secondary" style={{ fontSize: '.7rem', fontWeight: 400 }}> (set at league creation)</span>
              </h5>
            </div>
            <div className="card-body">
              <div className="info-row"><span className="info-label">Draft Type</span><span className="info-value text-capitalize">{league.draft_type}</span></div>
              <div className="info-row"><span className="info-label">Rounds</span><span className="info-value">{league.squad_size}</span></div>
              <div className="info-row"><span className="info-label">Total Picks</span><span className="info-value">{totalPicks}</span></div>
              <div className="info-row"><span className="info-label">Pick Timer</span><span className="info-value">{league.pick_timer_secs}s</span></div>
              <div className="info-row"><span className="info-label">Teams</span><span className="info-value">{teams.length}</span></div>
              {league.draft_scheduled_date && (
                <div className="info-row">
                  <span className="info-label">Pre-set Date</span>
                  <span className="info-value">{new Date(league.draft_scheduled_date).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Session state */}
          <div className="card">
            <div className="card-body p-4">
              {!session && !initial_session && (
                <div>
                  <p className="text-secondary mb-3" style={{ fontSize: '.85rem' }}>
                    Create a draft session to generate all pick slots. Set the draft order above first.
                  </p>
                  <div className="mb-3">
                    <label className="form-label">
                      Draft Start Date &amp; Time <span className="text-secondary" style={{ fontSize: '.75rem' }}>(optional)</span>
                    </label>
                    <input type="datetime-local" className="form-control form-control-sm" value={scheduledStart} onChange={e => setScheduledStart(e.target.value)} style={{ maxWidth: 280 }} />
                    <div className="form-text" style={{ fontSize: '.7rem' }}>
                      {league.draft_scheduled_date && 'Pre-filled from league creation. '}Leave blank to start manually.
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={createSession}>
                    <i className="bi bi-plus-lg me-1"></i>Create Draft Session
                  </button>
                </div>
              )}

              {session && session.status === 'scheduled' && (
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-3">
                      <span className="status-pill status-setup">Ready</span>
                      <span className="text-secondary" style={{ fontSize: '.85rem' }}>
                        {session.draft_round_type === 'supplemental' ? 'Supplemental draft' : 'Session'} created
                      </span>
                    </div>
                    <div className="d-flex gap-2">
                      <Link to={`/leagues/${leagueId}/draft`} className="btn btn-outline-primary">
                        <i className="bi bi-door-open me-1"></i>Enter Lobby
                      </Link>
                      <button type="button" className="btn btn-primary" onClick={startDraft}>
                        <i className="bi bi-play-fill me-1"></i>Start Draft Now
                      </button>
                    </div>
                  </div>

                  {session.scheduled_start ? (
                    <div className="mt-2 p-3" style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8 }}>
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <i className="bi bi-calendar-event" style={{ color: '#d29922' }}></i>
                        <span style={{ fontSize: '.85rem', fontWeight: 600 }}>Scheduled Start</span>
                      </div>
                      <div style={{ fontSize: '.9rem', color: '#c9d1d9' }}>{formatDateTime(session.scheduled_start)}</div>
                      <div className="mt-2" style={{ fontSize: '1.5rem', fontWeight: 700, color: '#58a6ff' }}>
                        <Countdown target={session.scheduled_start} />
                      </div>
                    </div>
                  ) : (
                    <p className="text-secondary mt-2 mb-0" style={{ fontSize: '.8rem' }}>
                      <i className="bi bi-info-circle me-1"></i>No scheduled time set — start manually when ready.
                    </p>
                  )}

                  <div className="mt-3 d-flex align-items-end gap-2">
                    <div>
                      <label className="form-label" style={{ fontSize: '.75rem' }}>Update Draft Time</label>
                      <input type="datetime-local" className="form-control form-control-sm" value={updateSched} onChange={e => setUpdateSched(e.target.value)} style={{ maxWidth: 250 }} />
                    </div>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={setSchedule}>
                      <i className="bi bi-clock me-1"></i>Set
                    </button>
                  </div>
                </div>
              )}

              {session && session.status === 'in_progress' && (
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-3">
                    <span className="status-pill status-active">In Progress</span>
                    {session.draft_round_type === 'supplemental' && (
                      <span className="badge" style={{ background: 'rgba(45,212,191,.15)', color: '#2dd4bf', fontSize: '.7rem' }}>Supplemental</span>
                    )}
                  </div>
                  <Link to={`/leagues/${leagueId}/draft`} className="btn btn-primary">
                    <i className="bi bi-door-open me-1"></i>Enter Draft Room
                  </Link>
                </div>
              )}

              {session && session.status === 'paused' && (
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-3">
                    <span className="status-pill status-pending">Paused</span>
                    {session.draft_round_type === 'supplemental' && (
                      <span className="badge" style={{ background: 'rgba(45,212,191,.15)', color: '#2dd4bf', fontSize: '.7rem' }}>Supplemental</span>
                    )}
                  </div>
                  <Link to={`/leagues/${leagueId}/draft`} className="btn btn-primary">
                    <i className="bi bi-door-open me-1"></i>Enter Draft Room
                  </Link>
                </div>
              )}

              {!session && initial_completed && (
                <div className="text-center mb-3">
                  <span className="status-pill status-completed" style={{ fontSize: '.85rem' }}>Initial Draft Complete</span>
                </div>
              )}

              {can_restart && (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #21262d' }}>
                  <button type="button" className="btn btn-outline-danger btn-sm" onClick={restartDraft}>
                    <i className="bi bi-arrow-counterclockwise me-1"></i>Restart Draft
                  </button>
                  <span className="text-secondary ms-2" style={{ fontSize: '.75rem' }}>Deletes draft, clears rosters, unlocks settings</span>
                </div>
              )}
            </div>
          </div>

          {/* Supplemental scheduled */}
          {showSuppScheduled && supp_session && (
            <div className="card mt-4" style={{ borderColor: '#2dd4bf' }}>
              <div className="card-header" style={{ background: 'rgba(45,212,191,.08)', borderBottom: '1px solid rgba(45,212,191,.2)' }}>
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-calendar-event me-2" style={{ color: '#2dd4bf' }}></i>Supplemental Draft Scheduled
                </h5>
              </div>
              <div className="card-body">
                {supp_session.scheduled_start ? (
                  <div className="p-3 mb-3" style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8 }}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <i className="bi bi-clock-history" style={{ color: '#d29922', fontSize: '1.1rem' }}></i>
                      <span style={{ fontSize: '.9rem', fontWeight: 600, color: '#c9d1d9' }}>{formatDateTime(supp_session.scheduled_start)}</span>
                    </div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#2dd4bf' }}>
                      <Countdown target={supp_session.scheduled_start} />
                    </div>
                    <div className="text-secondary mt-1" style={{ fontSize: '.75rem' }}>
                      {supp_session.total_rounds} rounds · {teams.length} teams
                    </div>
                  </div>
                ) : (
                  <p className="text-secondary mb-2" style={{ fontSize: '.85rem' }}>
                    <i className="bi bi-info-circle me-1"></i>No scheduled time — start manually when ready.
                  </p>
                )}
                <div className="d-flex gap-2 mt-3">
                  <button type="button" className="btn btn-primary" onClick={startDraft}>
                    <i className="bi bi-play-fill me-1"></i>Start Supplemental Draft Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Create supplemental form */}
          {showCreateSupp && (
            <div className="card mt-4">
              <div className="card-header">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-plus-circle me-2" style={{ color: '#2dd4bf' }}></i>Schedule Supplemental Draft
                </h5>
              </div>
              <div className="card-body">
                <p className="text-secondary mb-3" style={{ fontSize: '.85rem' }}>
                  Pick from the open player pool — undrafted players and any newly added draftees.
                </p>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Rounds</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={20} value={suppRounds} onChange={e => setSuppRounds(Number(e.target.value))} />
                    <div className="form-text" style={{ fontSize: '.7rem' }}>Number of rounds in the supplemental draft</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">
                      Draft Date &amp; Time <span className="text-secondary" style={{ fontSize: '.75rem' }}>(optional)</span>
                    </label>
                    <input type="datetime-local" className="form-control form-control-sm" value={suppSchedStart} onChange={e => setSuppSchedStart(e.target.value)} />
                    <div className="form-text" style={{ fontSize: '.7rem' }}>Avoid times during live AFL rounds</div>
                  </div>
                </div>
                <button type="button" className="btn btn-primary" onClick={createSupplemental}>
                  <i className="bi bi-plus-lg me-1"></i>Create Supplemental Draft
                </button>
              </div>
            </div>
          )}

          {showCreateSupp && supp_session && supp_session.status === 'completed' && (
            <div className="card mt-3">
              <div className="card-body text-center py-3">
                <span className="status-pill status-completed" style={{ fontSize: '.8rem' }}>Previous Supplemental Draft Complete</span>
                <span className="text-secondary ms-2" style={{ fontSize: '.8rem' }}>{supp_session.total_rounds} rounds</span>
              </div>
            </div>
          )}

          {/* Mock Draft section */}
          <div className="card mt-4">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-robot me-2" style={{ color: '#f0883e' }}></i>Mock Draft
                <span className="badge ms-2" style={{ background: 'rgba(240,136,62,.15)', color: '#f0883e', fontSize: '.6rem', verticalAlign: 'middle' }}>SIMULATION</span>
              </h5>
            </div>
            <div className="card-body">
              {mock_session && (mock_session.status === 'in_progress' || mock_session.status === 'paused') && (
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="status-pill status-active">In Progress</span>
                    <span className="text-secondary" style={{ fontSize: '.8rem' }}>
                      Round {mock_session.current_round ?? '-'} · Pick {mock_session.current_pick ?? '-'}
                    </span>
                  </div>
                  <div className="d-flex gap-2">
                    <Link to={`/leagues/${leagueId}/draft/mock`} className="btn btn-primary btn-sm">
                      <i className="bi bi-door-open me-1"></i>Enter Mock Draft
                    </Link>
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={deleteMock}>
                      <i className="bi bi-trash me-1"></i>Delete
                    </button>
                  </div>
                </div>
              )}

              {mock_session && mock_session.status === 'completed' && (
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="status-pill status-completed">Completed</span>
                    <span className="text-secondary" style={{ fontSize: '.8rem' }}>{mock_session.total_rounds} rounds</span>
                  </div>
                  <div className="d-flex gap-2">
                    <Link to={`/leagues/${leagueId}/draft/mock`} className="btn btn-outline-secondary btn-sm">
                      <i className="bi bi-eye me-1"></i>View Results
                    </Link>
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={deleteMock}>
                      <i className="bi bi-trash me-1"></i>Delete
                    </button>
                  </div>
                </div>
              )}

              <p className="text-secondary mb-3" style={{ fontSize: '.85rem' }}>
                Simulate a draft where the computer picks for all other teams. Your roster won't be affected — this is just practice.
              </p>
              <div className="row g-3 mb-3">
                <div className="col-md-6">
                  <label className="form-label">Rounds</label>
                  <input type="number" className="form-control form-control-sm" min={1} max={league.squad_size} value={mockRoundsInput} onChange={e => setMockRoundsInput(Number(e.target.value))} />
                  <div className="form-text" style={{ fontSize: '.7rem' }}>Number of rounds to simulate</div>
                </div>
              </div>
              <button type="button" className="btn btn-warning" onClick={createMock}>
                <i className="bi bi-robot me-1"></i>{mock_session ? 'Restart Mock Draft' : 'Start Mock Draft'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
