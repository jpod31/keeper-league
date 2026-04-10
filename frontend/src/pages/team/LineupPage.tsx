import { useParams, Link, useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { useLeague } from '../../contexts/LeagueContext'

interface Team { id: number; name: string; logo_url?: string | null }

interface Player {
  id: number
  name: string
  position: string
  sc_avg: number
  afl_team: string
}

interface LineupSlot {
  player_id: number | null
  player_name: string | null
  position_code: string
  is_captain: boolean
  is_vice_captain: boolean
}

interface PositionSlot {
  position_code: string
  count: number
  is_bench: boolean
}

interface LineupData {
  team: Team
  afl_round: number
  max_round: number
  is_owner: boolean
  lineup: {
    is_locked: boolean
    slots: LineupSlot[]
  }
  bye_players: { name: string; afl_team: string }[]
  all_players: Player[]
  position_slots: PositionSlot[]
  locked_player_ids: number[]
  player_lock_times: Record<string, string>
}

// Draft state — per-slot player selection, captain, vc, bench
interface SlotAssignment { player_id: number | null; position_code: string }

function fmtSc(n: number | null | undefined): string {
  if (n == null || n === 0) return '?'
  return Math.round(n).toString()
}

export function LineupPage() {
  const { leagueId, teamId, round } = useParams()
  const navigate = useNavigate()
  const { league } = useLeague()
  const [data, setData] = useState<LineupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [slots, setSlots] = useState<SlotAssignment[]>([])
  const [captainId, setCaptainId] = useState<number | null>(null)
  const [vcId, setVcId] = useState<number | null>(null)
  const [benchIds, setBenchIds] = useState<Set<number>>(new Set())

  function refetch() {
    api<LineupData>(`/leagues/${leagueId}/team/${teamId}/lineup/${round}?format=json`)
      .then(d => {
        setData(d)
        // Seed form state from backend lineup
        const fieldSlots = d.position_slots.filter(ps => !ps.is_bench)
        const newSlots: SlotAssignment[] = []
        for (const ps of fieldSlots) {
          const filled = d.lineup.slots.filter(s => s.position_code === ps.position_code)
          for (let i = 0; i < ps.count; i++) {
            newSlots.push({
              player_id: i < filled.length ? filled[i].player_id : null,
              position_code: ps.position_code,
            })
          }
        }
        setSlots(newSlots)

        const cap = d.lineup.slots.find(s => s.is_captain)
        const vc = d.lineup.slots.find(s => s.is_vice_captain)
        setCaptainId(cap?.player_id || null)
        setVcId(vc?.player_id || null)

        const bench = new Set(
          d.lineup.slots.filter(s => s.position_code === 'BENCH').map(s => s.player_id).filter((x): x is number => x != null)
        )
        setBenchIds(bench)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    refetch()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, teamId, round])

  if (loading) return <Spinner text="Loading lineup..." />
  if (error) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-danger">Failed to load lineup</p>

  const { team, afl_round, max_round, is_owner, lineup, bye_players, all_players, position_slots, locked_player_ids, player_lock_times } = data
  const lockedSet = new Set(locked_player_ids)
  const fieldSlotConfigs = position_slots.filter(ps => !ps.is_bench)

  async function save(action: 'save' | 'auto_fill' | 'lock') {
    if (action === 'lock' && !confirm('Lock this lineup? This cannot be undone.')) return
    setSaving(true)
    try {
      const form = new FormData()
      form.set('action', action)
      if (action === 'save') {
        // Field slots: each gets a (player_id, position_code) pair in the flat arrays
        slots.forEach(s => {
          if (s.player_id != null) {
            form.append('player_id', String(s.player_id))
            form.append('position_code', s.position_code)
          }
        })
        // Bench players: additional slot entries with position_code=BENCH so they
        // round-trip through set_lineup which stores LineupSlot rows per player
        benchIds.forEach(id => {
          form.append('player_id', String(id))
          form.append('position_code', 'BENCH')
        })
        if (captainId) form.set('captain_id', String(captainId))
        if (vcId) form.set('vc_id', String(vcId))
      }
      const res = await fetch(`/leagues/${leagueId}/team/${teamId}/lineup/${afl_round}`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        redirect: 'manual',
      })
      // Server returns a 302 redirect on success; treat any non-error response as OK.
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      refetch()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league?.name}</Link>
          {' / '}
          <Link to={`/leagues/${leagueId}/team/${teamId}`}>{team.name}</Link>
          {' / '}Lineup
        </div>
        <div className="d-flex justify-content-between align-items-start">
          <div className="d-flex align-items-center gap-3">
            {afl_round > 0 && (
              <button
                onClick={() => navigate(`/leagues/${leagueId}/team/${teamId}/lineup/${afl_round - 1}`)}
                className="btn btn-outline-secondary btn-sm"
                type="button"
              ><i className="bi bi-chevron-left"></i></button>
            )}
            <div>
              <h2 className="mb-0">{afl_round === 0 ? 'Pre-Season' : `Round ${afl_round}`} Lineup</h2>
              {lineup.is_locked && (
                <span className="status-pill" style={{ background: 'rgba(248,81,73,.15)', color: '#f85149', fontSize: '.7rem' }}>Locked</span>
              )}
            </div>
            {afl_round < max_round && (
              <button
                onClick={() => navigate(`/leagues/${leagueId}/team/${teamId}/lineup/${afl_round + 1}`)}
                className="btn btn-outline-secondary btn-sm"
                type="button"
              ><i className="bi bi-chevron-right"></i></button>
            )}
          </div>
          <Link to={`/leagues/${leagueId}/team/${teamId}`} className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-people me-1"></i>Squad
          </Link>
        </div>
      </div>

      {bye_players.length > 0 && (
        <div className="alert" style={{ background: 'rgba(210,153,34,.1)', border: '1px solid rgba(210,153,34,.2)', borderRadius: 10, fontSize: '.85rem' }}>
          <i className="bi bi-exclamation-triangle me-1" style={{ color: '#d29922' }}></i>
          <strong style={{ color: '#d29922' }}>Bye players:</strong>{' '}
          {bye_players.map((p, i) => (
            <span key={i}>{p.name} ({p.afl_team}){i < bye_players.length - 1 ? ', ' : ''}</span>
          ))}
        </div>
      )}

      {locked_player_ids.length > 0 && (
        <div className="alert" style={{ background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)', borderRadius: 10, fontSize: '.85rem' }}>
          <i className="bi bi-lock-fill me-1" style={{ color: '#f85149' }}></i>
          <strong style={{ color: '#f85149' }}>Rolling lockout:</strong>{' '}
          Players whose AFL game has started are locked in place.
        </div>
      )}

      {is_owner && !lineup.is_locked ? (
        <>
          <div className="row g-3">
            {fieldSlotConfigs.map(ps => {
              // Collect the indices in the flat slots array for this position
              const slotIndices = slots.map((s, i) => s.position_code === ps.position_code ? i : -1).filter(i => i >= 0)
              return (
                <div key={ps.position_code} className="col-md-6 col-lg-3">
                  <div className="card">
                    <div className="card-header" style={{ padding: '.6rem 1rem' }}>
                      <h6 className="mb-0 fw-bold" style={{ fontSize: '.8rem' }}>
                        <span className={`pos-badge pos-${ps.position_code} me-1`}>{ps.position_code}</span>
                        <span className="text-secondary fw-normal">({ps.count})</span>
                      </h6>
                    </div>
                    <div className="card-body p-2">
                      {slotIndices.map(idx => {
                        const slot = slots[idx]
                        const isLockedPlayer = slot.player_id != null && lockedSet.has(slot.player_id)
                        return (
                          <div key={idx} className="mb-1 d-flex align-items-center gap-1">
                            {isLockedPlayer && (
                              <i className="bi bi-lock-fill" style={{ color: '#f85149', fontSize: '.7rem', flexShrink: 0 }} title="Game started — locked"></i>
                            )}
                            <select
                              className="form-select form-select-sm"
                              style={{ fontSize: '.78rem' }}
                              disabled={isLockedPlayer}
                              value={slot.player_id || ''}
                              onChange={e => {
                                const newSlots = [...slots]
                                newSlots[idx] = { ...slot, player_id: e.target.value ? Number(e.target.value) : null }
                                setSlots(newSlots)
                              }}
                            >
                              <option value="">-- Empty --</option>
                              {all_players.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.position}) — {fmtSc(p.sc_avg)}
                                  {player_lock_times[String(p.id)] && ` [${player_lock_times[String(p.id)]}]`}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="row g-3 mt-2">
            <div className="col-md-6">
              <div className="card">
                <div className="card-header" style={{ padding: '.6rem 1rem' }}>
                  <h6 className="mb-0 fw-bold" style={{ fontSize: '.8rem' }}>
                    <i className="bi bi-star me-1" style={{ color: '#d29922' }}></i>Captain & Vice-Captain
                  </h6>
                </div>
                <div className="card-body">
                  <div className="mb-3">
                    <label className="form-label">
                      Captain <span className="text-secondary" style={{ fontSize: '.7rem' }}>(score doubled)</span>
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={captainId || ''}
                      onChange={e => setCaptainId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">-- None --</option>
                      {all_players.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({fmtSc(p.sc_avg)})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">
                      Vice-Captain <span className="text-secondary" style={{ fontSize: '.7rem' }}>(backup if captain DNP)</span>
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={vcId || ''}
                      onChange={e => setVcId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">-- None --</option>
                      {all_players.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({fmtSc(p.sc_avg)})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-header" style={{ padding: '.6rem 1rem' }}>
                  <h6 className="mb-0 fw-bold" style={{ fontSize: '.8rem' }}>
                    <i className="bi bi-bench me-1" style={{ color: '#8b949e' }}></i>Bench
                  </h6>
                </div>
                <div className="card-body scroll-body" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {all_players.map(p => {
                    const isLocked = lockedSet.has(p.id)
                    const checked = benchIds.has(p.id)
                    return (
                      <div key={p.id} className="form-check mb-1 d-flex align-items-center gap-1">
                        {isLocked && (
                          <i className="bi bi-lock-fill" style={{ color: '#f85149', fontSize: '.6rem' }} title="Game started — locked"></i>
                        )}
                        <input
                          type="checkbox"
                          className="form-check-input bench-check"
                          checked={checked}
                          disabled={isLocked}
                          onChange={() => {
                            const next = new Set(benchIds)
                            if (next.has(p.id)) next.delete(p.id)
                            else next.add(p.id)
                            setBenchIds(next)
                          }}
                        />
                        <label className="form-check-label" style={{ fontSize: '.8rem' }}>
                          {p.name} <span className="text-secondary">({p.position})</span>
                          {player_lock_times[String(p.id)] && (
                            <span style={{ fontSize: '.65rem', color: player_lock_times[String(p.id)] === 'Locked' ? '#f85149' : '#8b949e' }}>
                              {' '}{player_lock_times[String(p.id)]}
                            </span>
                          )}
                        </label>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 d-flex gap-2">
            <button type="button" className="btn btn-primary" onClick={() => save('save')} disabled={saving}>
              <i className="bi bi-check-lg me-1"></i>Save Lineup
            </button>
            <button type="button" className="btn btn-outline-primary" onClick={() => save('auto_fill')} disabled={saving}>
              <i className="bi bi-magic me-1"></i>Auto-Fill
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              style={{ borderColor: '#f85149', color: '#f85149' }}
              onClick={() => save('lock')}
              disabled={saving}
            >
              <i className="bi bi-lock me-1"></i>Lock
            </button>
          </div>
        </>
      ) : (
        <div className="row g-3">
          {fieldSlotConfigs.map(ps => {
            const filled = lineup.slots.filter(s => s.position_code === ps.position_code)
            return (
              <div key={ps.position_code} className="col-md-6 col-lg-3">
                <div className="card">
                  <div className="card-header" style={{ padding: '.6rem 1rem' }}>
                    <h6 className="mb-0 fw-bold" style={{ fontSize: '.8rem' }}>
                      <span className={`pos-badge pos-${ps.position_code}`}>{ps.position_code}</span>
                    </h6>
                  </div>
                  <div className="card-body p-2">
                    {filled.map((slot, i) => (
                      <div key={i} className="mb-1 d-flex align-items-center gap-2" style={{ fontSize: '.85rem' }}>
                        {slot.player_id != null && lockedSet.has(slot.player_id) && (
                          <i className="bi bi-lock-fill" style={{ color: '#f85149', fontSize: '.6rem' }}></i>
                        )}
                        <span>{slot.player_name || 'Empty'}</span>
                        {slot.is_captain && <span className="badge" style={{ background: '#d29922', fontSize: '.6rem' }}>C</span>}
                        {slot.is_vice_captain && <span className="badge" style={{ background: '#58a6ff', fontSize: '.6rem' }}>VC</span>}
                        {slot.player_id != null && player_lock_times[String(slot.player_id)] && (
                          <span style={{ fontSize: '.6rem', color: player_lock_times[String(slot.player_id)] === 'Locked' ? '#f85149' : '#8b949e' }}>
                            {player_lock_times[String(slot.player_id)]}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
