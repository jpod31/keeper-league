import { useParams, Link } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { post } from '../../lib/api'

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

interface CommissionerData {
  league: { id: number; name: string; status: string; season_year: number; trade_window_open: boolean; is_commissioner: boolean }
  current_phase: 'pre_season' | 'midseason' | 'regular' | 'finals' | 'offseason'
  season_cfg: {
    season_phase: string | null
    mid_season_draft_enabled: boolean
    mid_season_delist_required: number | null
    offseason_delist_min: number | null
    ssp_enabled: boolean
  }
  midseason: { trade_status: string; delist_status: string; draft_status: string; lock_status: string }
  offseason: { delist_status: string; ssp_status: string; draft_status: string; trade_status: string }
  delist: { is_open: boolean; min_delists: number; teams: TeamProgress[]; period_id: number | null; period_status: string | null }
  trade_window: { mid_open: string | null; mid_close: string | null; off_open: string | null; off_close: string | null }
  pending_ltil: LtilEntry[]
  active_ltil: LtilEntry[]
  recent_history: LtilEntry[]
  pending_trades_count: number
  teams: TeamRef[]
}

const STEP_COLOR: Record<string, { fg: string; bg: string; label: string }> = {
  active: { fg: '#3fb950', bg: 'rgba(63,185,80,.12)', label: 'Active' },
  completed: { fg: '#58a6ff', bg: 'rgba(88,166,255,.12)', label: 'Done' },
  pending: { fg: '#d29922', bg: 'rgba(210,153,34,.12)', label: 'Pending' },
  locked: { fg: '#6e7681', bg: 'rgba(110,118,129,.08)', label: 'Locked' },
}

function StepBadge({ status }: { status: string }) {
  const s = STEP_COLOR[status] ?? STEP_COLOR.locked
  return <span className="badge" style={{ background: s.bg, color: s.fg, fontSize: '.7rem' }}>{s.label}</span>
}

export function CommissionerPage() {
  const { leagueId } = useParams()
  const { data, loading, refetch } = useFetch<CommissionerData>(`/leagues/${leagueId}/commissioner?format=json`)
  const [busy, setBusy] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null)
  const [teamRoster, setTeamRoster] = useState<{ id: number; name: string; position: string; afl_team: string }[]>([])
  const [moveFrom, setMoveFrom] = useState<number | null>(null)
  const [moveTo, setMoveTo] = useState<number | null>(null)
  const [movePlayer, setMovePlayer] = useState<number | null>(null)

  if (loading) return <Spinner text="Loading commissioner hub..." />
  if (!data) return <p className="text-danger">Failed to load commissioner hub</p>
  if (!data.league.is_commissioner) {
    return (
      <div className="alert alert-warning">
        <i className="bi bi-shield-exclamation me-2"></i>Commissioner access required.
      </div>
    )
  }

  async function doAction(url: string, body: object, key: string, msg: string) {
    if (!confirm(msg)) return
    setBusy(key)
    try {
      await post(url, body)
      await refetch()
    } catch (e) {
      alert((e as Error).message || 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  async function approveLtil(ltilId: number) {
    await doAction(`/leagues/${leagueId}/commissioner/ltil-approve`, { ltil_id: ltilId }, `ltil-a-${ltilId}`, 'Approve LTIL?')
  }
  async function rejectLtil(ltilId: number) {
    await doAction(`/leagues/${leagueId}/commissioner/ltil-reject`, { ltil_id: ltilId }, `ltil-r-${ltilId}`, 'Reject LTIL?')
  }
  async function removeLtil(teamId: number, playerId: number) {
    await doAction(`/leagues/${leagueId}/commissioner/ltil-remove`, { team_id: teamId, player_id: playerId }, `ltil-rm-${playerId}`, 'Remove player from LTIL?')
  }

  async function loadRoster(teamId: number) {
    setSelectedTeam(teamId)
    try {
      const r = await fetch(`/leagues/${leagueId}/commissioner/team-roster/${teamId}`, { credentials: 'same-origin' })
      setTeamRoster(await r.json())
    } catch { setTeamRoster([]) }
  }

  async function delistPlayer(teamId: number, playerId: number) {
    await doAction(`/leagues/${leagueId}/commissioner/delist`, { team_id: teamId, player_id: playerId }, `del-${playerId}`, 'Delist this player?')
    if (selectedTeam) loadRoster(selectedTeam)
  }

  async function forceMove() {
    if (!moveFrom || !moveTo || !movePlayer) return alert('Select source team, destination team, and player.')
    await doAction(`/leagues/${leagueId}/commissioner/force-move`, { from_team_id: moveFrom, to_team_id: moveTo, player_id: movePlayer }, 'move', 'Force-move this player?')
    setMovePlayer(null)
  }

  async function startStep(phase: 'midseason' | 'offseason', step: string) {
    const url = `/leagues/${leagueId}/${phase}/start-step`
    const fd = new FormData()
    fd.set('step', step)
    if (!confirm(`Start ${phase} step: ${step}?`)) return
    setBusy(`${phase}-${step}`)
    try {
      await fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' })
      await refetch()
    } finally { setBusy(null) }
  }

  async function deleteLeague() {
    if (!confirm(`PERMANENTLY delete "${data?.league.name}" and all its data? This cannot be undone.`)) return
    if (!confirm('Are you absolutely sure? Type-level confirmation skipped — proceeding.')) return
    const fd = new FormData()
    try {
      await fetch(`/leagues/${leagueId}/commissioner/delete-league`, { method: 'POST', body: fd, credentials: 'same-origin' })
      window.location.href = '/spa/leagues'
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const { midseason, offseason, delist, pending_ltil, active_ltil, recent_history, teams, current_phase, pending_trades_count } = data

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-shield-lock me-2" style={{ color: '#d29922' }}></i>Commissioner Hub</h2>
        <div className="text-secondary" style={{ fontSize: '.85rem' }}>
          Current phase: <span className="badge" style={{ background: '#21262d', color: '#c9d1d9' }}>{current_phase.replace('_', ' ')}</span>
          {' · '}Pending trades: <strong>{pending_trades_count}</strong>
        </div>
      </div>

      <div className="row g-4">
        {/* Season phases */}
        <div className="col-lg-6">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-calendar-range me-2" style={{ color: '#58a6ff' }}></i>Mid-Season Workflow
              </h5>
            </div>
            <div className="card-body">
              {[
                { key: 'trade', label: 'Trade window', status: midseason.trade_status, step: 'trade' },
                { key: 'delist', label: 'Delist period', status: midseason.delist_status, step: 'delist' },
                { key: 'draft', label: 'Supplemental draft', status: midseason.draft_status, step: 'draft' },
                { key: 'lock', label: 'Lock rosters', status: midseason.lock_status, step: 'lock' },
              ].map(s => (
                <div key={s.key} className="d-flex justify-content-between align-items-center py-2 border-bottom border-secondary-subtle">
                  <span style={{ fontSize: '.85rem' }}>{s.label}</span>
                  <div className="d-flex gap-2 align-items-center">
                    <StepBadge status={s.status} />
                    {s.status !== 'active' && s.status !== 'locked' && (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        disabled={busy === `midseason-${s.step}`}
                        onClick={() => startStep('midseason', s.step)}
                        style={{ fontSize: '.7rem', padding: '.15rem .5rem' }}
                      >Start</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-snow me-2" style={{ color: '#58a6ff' }}></i>Off-Season Workflow
              </h5>
            </div>
            <div className="card-body">
              {[
                { key: 'delist', label: 'Delist period', status: offseason.delist_status, step: 'delist' },
                { key: 'ssp', label: 'Supplemental (SSP)', status: offseason.ssp_status, step: 'ssp' },
                { key: 'trade', label: 'Trade window', status: offseason.trade_status, step: 'trade' },
                { key: 'draft', label: 'Supplemental draft', status: offseason.draft_status, step: 'draft' },
              ].map(s => (
                <div key={s.key} className="d-flex justify-content-between align-items-center py-2 border-bottom border-secondary-subtle">
                  <span style={{ fontSize: '.85rem' }}>{s.label}</span>
                  <div className="d-flex gap-2 align-items-center">
                    <StepBadge status={s.status} />
                    {s.status !== 'active' && s.status !== 'locked' && (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        disabled={busy === `offseason-${s.step}`}
                        onClick={() => startStep('offseason', s.step)}
                        style={{ fontSize: '.7rem', padding: '.15rem .5rem' }}
                      >Start</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {delist.is_open && (
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-person-dash me-2" style={{ color: '#f85149' }}></i>Delist Progress
                  <span className="text-secondary fw-normal" style={{ fontSize: '.75rem' }}> · min {delist.min_delists}</span>
                </h5>
              </div>
              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <tbody>
                    {delist.teams.map(t => (
                      <tr key={t.name}>
                        <td><strong>{t.name}</strong><div className="text-secondary" style={{ fontSize: '.7rem' }}>{t.owner}</div></td>
                        <td className="text-end">
                          <span className={`badge`} style={{ background: t.met ? 'rgba(63,185,80,.15)' : 'rgba(210,153,34,.15)', color: t.met ? '#3fb950' : '#d29922' }}>
                            {t.count}/{delist.min_delists}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* LTIL + tools */}
        <div className="col-lg-6">
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-bandaid me-2" style={{ color: '#f85149' }}></i>LTIL Queue
              </h5>
              <span className="badge" style={{ background: '#21262d', color: '#8b949e' }}>{pending_ltil.length} pending</span>
            </div>
            <div className="card-body p-0">
              {pending_ltil.length === 0 ? (
                <div className="text-center text-secondary py-3" style={{ fontSize: '.8rem' }}>No pending requests</div>
              ) : (
                <table className="table table-sm mb-0">
                  <tbody>
                    {pending_ltil.map(l => (
                      <tr key={l.id}>
                        <td>
                          <strong>{l.player_name}</strong>
                          <div className="text-secondary" style={{ fontSize: '.7rem' }}>{l.team_name} · {l.reason}</div>
                        </td>
                        <td className="text-end" style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-sm btn-success me-1" disabled={busy === `ltil-a-${l.id}`} onClick={() => approveLtil(l.id)} style={{ fontSize: '.7rem' }}>Approve</button>
                          <button className="btn btn-sm btn-outline-danger" disabled={busy === `ltil-r-${l.id}`} onClick={() => rejectLtil(l.id)} style={{ fontSize: '.7rem' }}>Reject</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {active_ltil.length > 0 && (
            <div className="card mb-4">
              <div className="card-header">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Active LTIL ({active_ltil.length})</h5>
              </div>
              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <tbody>
                    {active_ltil.map(l => (
                      <tr key={l.id}>
                        <td><strong>{l.player_name}</strong><div className="text-secondary" style={{ fontSize: '.7rem' }}>{l.team_name}</div></td>
                        <td className="text-end">
                          <button className="btn btn-sm btn-outline-danger" onClick={() => removeLtil(l.team_id, l.player_id)} style={{ fontSize: '.7rem' }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-arrow-left-right me-2" style={{ color: '#d29922' }}></i>Force-Move Player
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-2 mb-2">
                <div className="col-12">
                  <label className="form-label text-secondary" style={{ fontSize: '.75rem' }}>From team</label>
                  <select className="form-select form-select-sm" value={moveFrom ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setMoveFrom(v); if (v) loadRoster(v) }}>
                    <option value="">Select team...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label text-secondary" style={{ fontSize: '.75rem' }}>Player</label>
                  <select className="form-select form-select-sm" value={movePlayer ?? ''} onChange={e => setMovePlayer(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Select player...</option>
                    {teamRoster.map(p => <option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label text-secondary" style={{ fontSize: '.75rem' }}>To team</label>
                  <select className="form-select form-select-sm" value={moveTo ?? ''} onChange={e => setMoveTo(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Select team...</option>
                    {teams.filter(t => t.id !== moveFrom).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-sm btn-primary w-100" disabled={busy === 'move'} onClick={forceMove}>
                Move Player
              </button>
              {selectedTeam && teamRoster.length > 0 && (
                <div className="mt-3">
                  <h6 className="fw-bold text-secondary" style={{ fontSize: '.75rem' }}>Team roster (click to delist)</h6>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {teamRoster.map(p => (
                      <div key={p.id} className="d-flex justify-content-between py-1 border-bottom border-secondary-subtle" style={{ fontSize: '.8rem' }}>
                        <span>{p.name} <span className="text-secondary">({p.position})</span></span>
                        <button className="btn btn-sm btn-outline-danger" style={{ fontSize: '.65rem', padding: '.1rem .4rem' }} onClick={() => delistPlayer(selectedTeam, p.id)}>Delist</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card border-danger">
            <div className="card-header" style={{ background: 'rgba(248,81,73,.08)' }}>
              <h5 className="mb-0 fw-bold text-danger" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-exclamation-octagon me-2"></i>Danger Zone
              </h5>
            </div>
            <div className="card-body">
              <p className="text-secondary mb-2" style={{ fontSize: '.8rem' }}>Permanently delete this league and all of its data.</p>
              <button className="btn btn-sm btn-outline-danger" onClick={deleteLeague}>Delete League</button>
            </div>
          </div>
        </div>
      </div>

      {recent_history.length > 0 && (
        <div className="card mt-4">
          <div className="card-header">
            <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Recent LTIL History</h5>
          </div>
          <div className="card-body p-0">
            <table className="table table-sm mb-0">
              <thead>
                <tr>
                  <th>Player</th><th>Team</th><th>Status</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent_history.map(l => (
                  <tr key={l.id}>
                    <td>{l.player_name}</td>
                    <td>{l.team_name}</td>
                    <td><span className="badge" style={{ background: '#21262d', color: '#8b949e' }}>{l.status}</span></td>
                    <td className="text-secondary" style={{ fontSize: '.75rem' }}>
                      {(l.removed_at || l.reviewed_at || l.added_at || '').slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-center mt-4">
        <Link to={`/leagues/${leagueId}`} className="text-secondary" style={{ fontSize: '.8rem' }}>
          <i className="bi bi-arrow-left me-1"></i>Back to dashboard
        </Link>
      </div>
    </div>
  )
}
