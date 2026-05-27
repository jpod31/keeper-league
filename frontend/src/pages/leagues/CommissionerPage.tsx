import { useParams, Link, useNavigate } from 'react-router'
import { useState, useEffect } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { post } from '../../lib/api'
import { AdminSubnav } from '../../components/nav/AdminSubnav'
import { LeagueBreadcrumb } from '../../components/ui/LeagueBreadcrumb'

interface LtilEntry {
  id: number
  team_id: number
  team_name: string
  player_id: number
  player_name: string
  player_position: string
  reason: string
  status: string
  added_at: string | null
  reviewed_at: string | null
  removed_at: string | null
}

interface TeamProgress { name: string; owner: string; count: number; met: boolean }
interface TeamRef { id: number; name: string; owner: string }
interface RosterPlayer { id: number; name: string; position: string; afl_team: string }

type PhaseKey = 'pre_season' | 'midseason' | 'regular' | 'finals' | 'offseason'

interface CommissionerData {
  league: { id: number; name: string; status: string; season_year: number; trade_window_open: boolean; is_commissioner: boolean }
  current_phase: PhaseKey
  season_cfg: {
    season_phase: string | null
    mid_season_draft_enabled: boolean
    mid_season_delist_required: number | null
    offseason_delist_min: number | null
    ssp_enabled: boolean
    mid_season_trade_enabled?: boolean
  }
  midseason: { trade_status: string; delist_status: string; draft_status: string; lock_status: string }
  offseason: { delist_status: string; ssp_status: string; draft_status: string; trade_status: string }
  delist: { is_open: boolean; min_delists: number; teams: TeamProgress[]; period_id: number | null; period_status: string | null; closes_at: string | null }
  trade_window: { mid_open: string | null; mid_close: string | null; off_open: string | null; off_close: string | null }
  pending_ltil: LtilEntry[]
  active_ltil: LtilEntry[]
  recent_history: LtilEntry[]
  pending_trades_count: number
  teams: TeamRef[]
}

const PHASE_BADGE: Record<PhaseKey, { bg: string; label: string }> = {
  midseason: { bg: '#d29922', label: 'Midseason' },
  offseason: { bg: '#8b949e', label: 'Offseason' },
  regular: { bg: '#3fb950', label: 'Regular' },
  finals: { bg: '#f85149', label: 'Finals' },
  pre_season: { bg: '#58a6ff', label: 'Pre Season' },
}

const SUMMARY_CSS = `
.comm-summary-card { background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 10px; padding: 14px; text-align: center; }
.comm-summary-pending { border-color: rgba(210,153,34,.35); background: rgba(210,153,34,.05); }
.comm-summary-active  { border-color: rgba(63,185,80,.3); background: rgba(63,185,80,.04); }
.comm-summary-trades  { border-color: rgba(88,166,255,.3); background: rgba(88,166,255,.04); }
.comm-summary-num { font-size: 1.5rem; font-weight: 800; color: #e6edf3; line-height: 1; }
.comm-summary-label { font-size: .7rem; color: #8b949e; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
.comm-ltil-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #21262d; }
.comm-ltil-row:last-child { border-bottom: none; }
.comm-ltil-info { flex: 1; min-width: 0; }
.comm-ltil-player { font-size: .85rem; font-weight: 600; color: #e6edf3; }
.comm-ltil-meta { font-size: .72rem; color: #8b949e; margin-top: 2px; }
.comm-ltil-actions { display: flex; gap: 6px; flex-shrink: 0; }
`

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}

export function CommissionerPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const { data, loading, refetch } = useFetch<CommissionerData>(`/leagues/${leagueId}/commissioner?format=json`)
  const [busy, setBusy] = useState<string | null>(null)
  const [flashMsg, setFlashMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // Delist / Force-Move tool state
  const [delistTeamId, setDelistTeamId] = useState<number | null>(null)
  const [delistRoster, setDelistRoster] = useState<RosterPlayer[]>([])
  const [delistPlayerId, setDelistPlayerId] = useState<number | null>(null)
  const [moveFrom, setMoveFrom] = useState<number | null>(null)
  const [moveRoster, setMoveRoster] = useState<RosterPlayer[]>([])
  const [movePlayer, setMovePlayer] = useState<number | null>(null)
  const [moveTo, setMoveTo] = useState<number | null>(null)

  useEffect(() => {
    if (flashMsg) {
      const t = setTimeout(() => setFlashMsg(null), 5000)
      return () => clearTimeout(t)
    }
  }, [flashMsg])

  async function fetchRoster(teamId: number): Promise<RosterPlayer[]> {
    const r = await fetch(`/leagues/${leagueId}/commissioner/team-roster/${teamId}`, { credentials: 'same-origin' })
    const j = await r.json()
    return (j as RosterPlayer[]).sort((a, b) => a.name.localeCompare(b.name))
  }

  async function onDelistTeamChange(id: number | null) {
    setDelistTeamId(id)
    setDelistPlayerId(null)
    if (id) {
      try { setDelistRoster(await fetchRoster(id)) } catch { setDelistRoster([]) }
    } else {
      setDelistRoster([])
    }
  }

  async function onMoveFromChange(id: number | null) {
    setMoveFrom(id)
    setMovePlayer(null)
    setMoveTo(null)
    if (id) {
      try { setMoveRoster(await fetchRoster(id)) } catch { setMoveRoster([]) }
    } else {
      setMoveRoster([])
    }
  }

  async function doPost(url: string, body: object, key: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return false
    setBusy(key)
    try {
      await post(url, body)
      setFlashMsg({ kind: 'success', text: 'Done.' })
      await refetch()
      return true
    } catch (e) {
      setFlashMsg({ kind: 'error', text: (e as Error).message || 'Action failed' })
      return false
    } finally {
      setBusy(null)
    }
  }

  async function startStep(phase: 'midseason' | 'offseason', step: string, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return
    setBusy(`${phase}-${step}`)
    try {
      const fd = new FormData()
      fd.set('step', step)
      const res = await fetch(`/leagues/${leagueId}/${phase}/start-step`, {
        method: 'POST', body: fd, credentials: 'same-origin',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      setFlashMsg({ kind: 'success', text: 'Phase step updated.' })
      await refetch()
    } catch (e) {
      setFlashMsg({ kind: 'error', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  async function approveLtil(id: number) {
    await doPost(`/leagues/${leagueId}/commissioner/ltil-approve`, { ltil_id: id }, `ltil-a-${id}`, 'Approve this LTIL request? The player will be benched.')
  }
  async function rejectLtil(id: number) {
    await doPost(`/leagues/${leagueId}/commissioner/ltil-reject`, { ltil_id: id }, `ltil-r-${id}`, 'Reject this LTIL request? The player will stay in their position.')
  }
  async function removeLtil(teamId: number, playerId: number) {
    await doPost(`/leagues/${leagueId}/commissioner/ltil-remove`, { team_id: teamId, player_id: playerId }, `ltil-rm-${playerId}`, 'Remove this player from LTIL? If they have an SSP replacement, the replacement will be dropped.')
  }

  async function commissionerDelist() {
    if (!delistTeamId || !delistPlayerId) return
    const player = delistRoster.find(p => p.id === delistPlayerId)
    const ok = await doPost(
      `/leagues/${leagueId}/commissioner/delist`,
      { team_id: delistTeamId, player_id: delistPlayerId },
      'delist',
      `Delist ${player?.name ?? 'this player'}? This opens up a roster spot on their team.`
    )
    if (ok) {
      setDelistPlayerId(null)
      onDelistTeamChange(delistTeamId)
    }
  }

  async function commissionerMove() {
    if (!moveFrom || !moveTo || !movePlayer) return
    if (moveFrom === moveTo) { alert('Source and destination teams must be different.'); return }
    const player = moveRoster.find(p => p.id === movePlayer)
    const toTeam = data?.teams.find(t => t.id === moveTo)
    const ok = await doPost(
      `/leagues/${leagueId}/commissioner/force-move`,
      { from_team_id: moveFrom, to_team_id: moveTo, player_id: movePlayer },
      'move',
      `Move ${player?.name ?? 'this player'} to ${toTeam?.name ?? 'selected team'}? No trade history will be created.`
    )
    if (ok) {
      setMovePlayer(null)
      onMoveFromChange(moveFrom)
    }
  }

  async function deleteLeague() {
    const input = prompt('Type "DELETE" to permanently delete this league and all its data:')
    if (input !== 'DELETE') {
      if (input !== null) alert('You must type DELETE exactly to confirm.')
      return
    }
    const fd = new FormData()
    try {
      await fetch(`/leagues/${leagueId}/commissioner/delete-league`, { method: 'POST', body: fd, credentials: 'same-origin' })
      navigate('/leagues')
    } catch (e) {
      alert((e as Error).message)
    }
  }

  if (loading) return <Spinner text="Loading commissioner hub..." />
  if (!data) return <p className="text-danger">Failed to load commissioner hub</p>
  if (!data.league.is_commissioner) {
    return (
      <div className="alert alert-warning">
        <i className="bi bi-shield-exclamation me-2"></i>Commissioner access required.
      </div>
    )
  }

  const { current_phase, midseason, offseason, delist, pending_ltil, active_ltil, recent_history, teams, pending_trades_count, season_cfg } = data
  const phaseBadge = PHASE_BADGE[current_phase] ?? PHASE_BADGE.pre_season

  // Phase action button logic mirrors commissioner_hub.html
  const midTradeStatus = midseason.trade_status
  const midDelistStatus = midseason.delist_status
  const midDraftStatus = midseason.draft_status
  const midLockStatus = midseason.lock_status
  const offDelistStatus = offseason.delist_status
  const offTradeStatus = offseason.trade_status
  const offDraftStatus = offseason.draft_status

  return (
    <div>
      <style>{SUMMARY_CSS}</style>
      <div className="d-none d-lg-block"><AdminSubnav active="commissioner" leagueId={leagueId!} /></div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <LeagueBreadcrumb leagueId={leagueId!} fallbackName={data.league.name} /> / Admin / Commissioner
        </div>
        <div className="d-flex align-items-center mb-0">
          <i className="bi bi-shield-lock me-2" style={{ fontSize: '1.4rem', color: '#d29922' }}></i>
          <h4 className="mb-0 fw-bold" style={{ fontSize: '1.15rem' }}>Commissioner Hub</h4>
        </div>
      </div>

      {flashMsg && (
        <div className={`alert alert-${flashMsg.kind === 'success' ? 'success' : 'danger'}`} style={{ fontSize: '.85rem' }}>
          {flashMsg.text}
        </div>
      )}

      {/* Season Controls */}
      <div className="card mb-4" style={{ borderColor: 'rgba(210,153,34,.35)' }}>
        <div className="card-header d-flex justify-content-between align-items-center" style={{ background: 'rgba(210,153,34,.08)', borderBottom: '1px solid rgba(210,153,34,.2)' }}>
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>
            <i className="bi bi-calendar-range me-2" style={{ color: '#d29922' }}></i>Season Controls
          </h5>
          <span className="badge" style={{ background: phaseBadge.bg, fontSize: '.7rem' }}>{phaseBadge.label}</span>
        </div>
        <div className="card-body">
          {delist.is_open && (
            <div className="mb-3 p-3" style={{ background: 'rgba(248,81,73,.05)', border: '1px solid rgba(248,81,73,.15)', borderRadius: 8 }}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="bi bi-exclamation-triangle-fill" style={{ color: '#f85149' }}></i>
                <span style={{ fontSize: '.85rem', fontWeight: 600, color: '#f85149' }}>Delist Period Open</span>
                {delist.closes_at && (
                  <span className="ms-auto" style={{ fontSize: '.75rem', color: '#8b949e' }}>
                    Closes {formatDate(delist.closes_at)}
                  </span>
                )}
              </div>
              {delist.teams.length > 0 && (
                <div className="row g-1">
                  {delist.teams.map(tp => (
                    <div key={tp.name} className="col-6 col-md-4">
                      <div
                        className="d-flex justify-content-between align-items-center px-2 py-1"
                        style={{
                          background: tp.met ? 'rgba(63,185,80,.08)' : 'rgba(139,148,158,.05)',
                          border: `1px solid ${tp.met ? 'rgba(63,185,80,.2)' : 'rgba(139,148,158,.1)'}`,
                          borderRadius: 6,
                          fontSize: '.75rem',
                        }}
                      >
                        <span style={{ color: '#c9d1d9' }}>{tp.name}</span>
                        <span style={{ color: tp.met ? '#3fb950' : '#f85149', fontWeight: 600 }}>
                          {tp.count}/{delist.min_delists}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="d-flex flex-wrap gap-2">
            {current_phase === 'midseason' && (
              <>
                {midTradeStatus === 'locked' && season_cfg?.mid_season_trade_enabled && (
                  <button type="button" className="btn btn-sm btn-outline-success" disabled={busy === 'midseason-trade_window'} onClick={() => startStep('midseason', 'trade_window')}>
                    <i className="bi bi-play-fill me-1"></i>Open Trade Window
                  </button>
                )}
                {midTradeStatus === 'active' && (
                  <button type="button" className="btn btn-sm btn-outline-warning" disabled={busy === 'midseason-close_trades'} onClick={() => startStep('midseason', 'close_trades')}>
                    <i className="bi bi-stop-fill me-1"></i>Close Trade Window
                  </button>
                )}
                {(midDelistStatus === 'pending' || midDelistStatus === 'locked') && (
                  <button type="button" className="btn btn-sm btn-outline-success" disabled={busy === 'midseason-open_delists'} onClick={() => startStep('midseason', 'open_delists')}>
                    <i className="bi bi-play-fill me-1"></i>Open Delist Period
                  </button>
                )}
                {midDelistStatus === 'active' && (
                  <button type="button" className="btn btn-sm btn-outline-warning" disabled={busy === 'midseason-close_delists'} onClick={() => startStep('midseason', 'close_delists', 'Close delist period?')}>
                    <i className="bi bi-stop-fill me-1"></i>Close Delist Period
                  </button>
                )}
                {midDraftStatus === 'completed' && midLockStatus !== 'completed' && (
                  <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy === 'midseason-roster_lock'} onClick={() => startStep('midseason', 'roster_lock')}>
                    <i className="bi bi-lock me-1"></i>Lock Rosters
                  </button>
                )}
              </>
            )}

            {current_phase === 'offseason' && (
              <>
                {!delist.is_open && offDelistStatus === 'pending' && (
                  <button type="button" className="btn btn-sm btn-outline-success" disabled={busy === 'offseason-open_delists'} onClick={() => startStep('offseason', 'open_delists')}>
                    <i className="bi bi-play-fill me-1"></i>Open Delist Period
                  </button>
                )}
                {delist.is_open && (
                  <button type="button" className="btn btn-sm btn-outline-warning" disabled={busy === 'offseason-close_delists'} onClick={() => startStep('offseason', 'close_delists', 'Close delist period?')}>
                    <i className="bi bi-stop-fill me-1"></i>Close Delist Period
                  </button>
                )}
                {offTradeStatus === 'pending' && (
                  <button type="button" className="btn btn-sm btn-outline-success" disabled={busy === 'offseason-open_trades'} onClick={() => startStep('offseason', 'open_trades')}>
                    <i className="bi bi-play-fill me-1"></i>Open Trade Window
                  </button>
                )}
                {offTradeStatus === 'active' && (
                  <button type="button" className="btn btn-sm btn-outline-warning" disabled={busy === 'offseason-close_trades'} onClick={() => startStep('offseason', 'close_trades')}>
                    <i className="bi bi-stop-fill me-1"></i>Close Trade Window
                  </button>
                )}
                {(offTradeStatus === 'completed' || offTradeStatus === 'pending') && offDraftStatus === 'completed' && (
                  <button type="button" className="btn btn-sm btn-success" disabled={busy === 'offseason-finish_offseason'} onClick={() => startStep('offseason', 'finish_offseason', 'End the off-season?')}>
                    <i className="bi bi-check-circle me-1"></i>Finish Off-Season
                  </button>
                )}
              </>
            )}

            {current_phase === 'pre_season' && (
              <span style={{ fontSize: '.8rem', color: '#8b949e' }}>Pre-season — set up your draft to get started.</span>
            )}
            {current_phase === 'regular' && (
              <span style={{ fontSize: '.8rem', color: '#8b949e' }}>Regular season in progress. Use settings to trigger midseason or offseason.</span>
            )}
          </div>

          <div className="d-flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #21262d' }}>
            <Link to={`/leagues/${leagueId}/draft/setup`} className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-list-check me-1"></i>Draft Setup
            </Link>
            <Link to={`/leagues/${leagueId}/settings`} className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-gear me-1"></i>League Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="row g-2 mb-4">
        <div className="col-4">
          <div className="comm-summary-card comm-summary-pending">
            <div className="comm-summary-num">{pending_ltil.length}</div>
            <div className="comm-summary-label">Pending LTIL</div>
          </div>
        </div>
        <div className="col-4">
          <div className="comm-summary-card comm-summary-active">
            <div className="comm-summary-num">{active_ltil.length}</div>
            <div className="comm-summary-label">Active LTIL</div>
          </div>
        </div>
        <div className="col-4">
          <div className="comm-summary-card comm-summary-trades">
            <div className="comm-summary-num">{pending_trades_count}</div>
            <div className="comm-summary-label">Pending Trades</div>
          </div>
        </div>
      </div>

      {/* Pending LTIL */}
      <div className="card mb-4" style={{ borderColor: 'rgba(210,153,34,.35)' }}>
        <div className="card-header" style={{ background: 'rgba(210,153,34,.08)', borderBottom: '1px solid rgba(210,153,34,.2)' }}>
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>
            <i className="bi bi-hourglass-split me-2" style={{ color: '#d29922' }}></i>Pending LTIL Requests
          </h5>
        </div>
        <div className="card-body p-0">
          {pending_ltil.length === 0 ? (
            <div className="text-center py-3" style={{ fontSize: '.8rem', color: '#8b949e' }}>No pending LTIL requests</div>
          ) : (
            pending_ltil.map(lt => (
              <div key={lt.id} className="comm-ltil-row">
                <div className="comm-ltil-info">
                  <div className="comm-ltil-player">{lt.player_name}</div>
                  <div className="comm-ltil-meta">
                    {lt.team_name} &bull; {lt.player_position || '-'} &bull; {lt.added_at ? formatDate(lt.added_at) : '-'}
                  </div>
                </div>
                <div className="comm-ltil-actions">
                  <button className="btn btn-sm btn-outline-success" disabled={busy === `ltil-a-${lt.id}`} onClick={() => approveLtil(lt.id)}>
                    <i className="bi bi-check-lg"></i> Approve
                  </button>
                  <button className="btn btn-sm btn-outline-danger" disabled={busy === `ltil-r-${lt.id}`} onClick={() => rejectLtil(lt.id)}>
                    <i className="bi bi-x-lg"></i> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active LTIL */}
      <div className="card mb-4" style={{ borderColor: 'rgba(63,185,80,.2)' }}>
        <div className="card-header" style={{ background: 'rgba(63,185,80,.06)', borderBottom: '1px solid rgba(63,185,80,.15)' }}>
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>
            <i className="bi bi-bandaid me-2" style={{ color: '#3fb950' }}></i>Active LTIL Entries
          </h5>
        </div>
        <div className="card-body p-0">
          {active_ltil.length === 0 ? (
            <div className="text-center py-3" style={{ fontSize: '.8rem', color: '#8b949e' }}>No active LTIL entries</div>
          ) : (
            active_ltil.map(lt => (
              <div key={lt.id} className="comm-ltil-row">
                <div className="comm-ltil-info">
                  <div className="comm-ltil-player">{lt.player_name}</div>
                  <div className="comm-ltil-meta">
                    {lt.team_name} &bull; {lt.added_at ? formatDate(lt.added_at) : '-'}
                  </div>
                </div>
                <div className="comm-ltil-actions">
                  <button className="btn btn-sm btn-outline-danger" disabled={busy === `ltil-rm-${lt.player_id}`} onClick={() => removeLtil(lt.team_id, lt.player_id)}>
                    <i className="bi bi-x-circle"></i> Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Commissioner Tools */}
      <div className="card mb-4" style={{ borderColor: 'rgba(210,153,34,.3)' }}>
        <div className="card-header" style={{ background: 'rgba(210,153,34,.08)', borderBottom: '1px solid rgba(210,153,34,.2)' }}>
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>
            <i className="bi bi-tools me-2" style={{ color: '#d29922' }}></i>Commissioner Tools
          </h5>
        </div>
        <div className="card-body">
          {/* Delist a player */}
          <div className="mb-4 pb-3" style={{ borderBottom: '1px solid #21262d' }}>
            <h6 className="fw-bold mb-2" style={{ fontSize: '.85rem', color: '#f85149' }}>
              <i className="bi bi-person-dash me-2"></i>Delist Player
            </h6>
            <p style={{ fontSize: '.75rem', color: '#8b949e', marginBottom: 10 }}>
              Remove a player from a team's roster (e.g. incorrect draft pick). Opens up a roster spot.
            </p>
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label" style={{ fontSize: '.75rem' }}>Team</label>
                <select className="form-select form-select-sm" value={delistTeamId ?? ''} onChange={e => onDelistTeamChange(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Select team...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-md-5">
                <label className="form-label" style={{ fontSize: '.75rem' }}>Player</label>
                <select className="form-select form-select-sm" value={delistPlayerId ?? ''} disabled={!delistTeamId} onChange={e => setDelistPlayerId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">{delistTeamId ? 'Select player...' : 'Select team first...'}</option>
                  {delistRoster.map(p => <option key={p.id} value={p.id}>{p.name} ({p.position} - {p.afl_team})</option>)}
                </select>
              </div>
              <div className="col-md-2">
                <button type="button" className="btn btn-outline-danger btn-sm w-100" disabled={!delistPlayerId || busy === 'delist'} onClick={commissionerDelist}>
                  {busy === 'delist' ? 'Delisting...' : 'Delist'}
                </button>
              </div>
            </div>
          </div>

          {/* Force move */}
          <div>
            <h6 className="fw-bold mb-2" style={{ fontSize: '.85rem', color: '#58a6ff' }}>
              <i className="bi bi-arrow-left-right me-2"></i>Force Move Player
            </h6>
            <p style={{ fontSize: '.75rem', color: '#8b949e', marginBottom: 10 }}>
              Move a player between teams (e.g. correcting a misplaced draft pick). No trade history created.
            </p>
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label" style={{ fontSize: '.75rem' }}>From Team</label>
                <select className="form-select form-select-sm" value={moveFrom ?? ''} onChange={e => onMoveFromChange(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Select team...</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" style={{ fontSize: '.75rem' }}>Player</label>
                <select className="form-select form-select-sm" value={movePlayer ?? ''} disabled={!moveFrom} onChange={e => setMovePlayer(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">{moveFrom ? 'Select player...' : 'Select team first...'}</option>
                  {moveRoster.map(p => <option key={p.id} value={p.id}>{p.name} ({p.position} - {p.afl_team})</option>)}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" style={{ fontSize: '.75rem' }}>To Team</label>
                <select className="form-select form-select-sm" value={moveTo ?? ''} disabled={!movePlayer} onChange={e => setMoveTo(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Select team...</option>
                  {teams.filter(t => t.id !== moveFrom).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2">
              <button type="button" className="btn btn-outline-primary btn-sm" disabled={!moveTo || busy === 'move'} onClick={commissionerMove}>
                {busy === 'move' ? <><span className="spinner-border spinner-border-sm me-1"></span>Moving...</> : <><i className="bi bi-arrow-left-right me-1"></i>Move Player</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent LTIL History */}
      {recent_history.length > 0 && (
        <div className="card mb-4">
          <div className="card-header" style={{ background: 'var(--kl-bg-elevated)', borderBottom: '1px solid var(--kl-border)' }}>
            <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>
              <i className="bi bi-clock-history me-2" style={{ color: '#8b949e' }}></i>Recent LTIL History
            </h5>
          </div>
          <div className="card-body p-0">
            {recent_history.map(lt => {
              const dateStr = lt.reviewed_at || lt.removed_at
              return (
                <div key={lt.id} className="comm-ltil-row">
                  <div className="comm-ltil-info">
                    <div className="comm-ltil-player">{lt.player_name}</div>
                    <div className="comm-ltil-meta">
                      {lt.team_name} &bull;{' '}
                      {lt.status === 'rejected' ? (
                        <span style={{ color: '#f85149' }}>Rejected</span>
                      ) : lt.removed_at ? (
                        <span style={{ color: '#8b949e' }}>Removed</span>
                      ) : null}
                      {' '}&bull; {dateStr ? formatDate(dateStr) : '-'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Danger zone */}
      <div style={{ marginTop: 32, padding: 16, border: '1px solid rgba(248,81,73,.3)', borderRadius: 12, background: 'rgba(248,81,73,.04)' }}>
        <h6 style={{ color: '#f85149', fontWeight: 700, fontSize: '.85rem', marginBottom: 8 }}>
          <i className="bi bi-exclamation-triangle-fill me-1"></i>Danger Zone
        </h6>
        <p style={{ color: 'var(--kl-text-faint)', fontSize: '.75rem', marginBottom: 12 }}>
          Permanently delete <strong style={{ color: 'var(--kl-text-primary)' }}>{data.league.name}</strong> and all associated data — teams, rosters, fixtures, trades, draft history, standings. This cannot be undone.
        </p>
        <button
          type="button"
          className="btn btn-sm"
          onClick={deleteLeague}
          style={{ background: 'rgba(248,81,73,.12)', color: '#f85149', border: '1px solid rgba(248,81,73,.3)', fontSize: '.75rem', padding: '5px 16px', borderRadius: 6, fontWeight: 600 }}
        >
          <i className="bi bi-trash3 me-1"></i>Delete League
        </button>
      </div>
    </div>
  )
}
