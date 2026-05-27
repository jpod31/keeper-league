import { useParams, Link } from 'react-router'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { api } from '../../lib/api'
import { RowsSkeleton } from '../../components/ui/RowsSkeleton'

interface PickHistoryEntry {
  pick_number: number
  round: number
  team_id: number
  team_name: string
  player_id: number | null
  player_name: string | null
  player_position: string | null
  player_afl_team: string | null
  is_auto_pick: boolean
  is_pass: boolean
}

interface DraftState {
  status: 'scheduled' | 'in_progress' | 'paused' | 'completed'
  current_pick: number | null
  current_round: number | null
  current_team_id: number | null
  current_team_name: string | null
  total_picks: number
  picks_made: number
  pick_history: PickHistoryEntry[]
  picked_player_ids: number[]
}

interface MockRoomData {
  league: { id: number; name: string }
  session: { id: number; status: string; current_pick: number; total_rounds: number }
  user_team: { id: number; name: string } | null
  state: DraftState
  user_weights: Record<string, number>
  has_custom_weights: boolean
}

interface AvailablePlayer {
  id: number
  name: string
  position: string | null
  afl_team: string | null
  age: number | null
  sc_avg: number | null
  rating: number | null
  potential: number | null
  draft_score: number | null
}

const WEIGHT_KEYS: { key: string; label: string }[] = [
  { key: 'sc_average', label: 'SC Avg' },
  { key: 'age_factor', label: 'Longevity' },
  { key: 'positional_scarcity', label: 'Scarcity' },
  { key: 'trajectory', label: 'Trajectory' },
  { key: 'durability', label: 'Durability' },
  { key: 'rating_potential', label: 'Growth' },
]

function posClass(position: string | null | undefined): string {
  if (!position) return 'mid'
  return position.split('/')[0].toLowerCase()
}

function ratingColor(r: number | null): string {
  if (r == null) return '#8b949e'
  if (r >= 80) return '#3fb950'
  if (r >= 70) return '#d29922'
  if (r >= 60) return '#f0883e'
  return '#f85149'
}

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)) }

export function MockDraftPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<MockRoomData | null>(null)
  const [state, setState] = useState<DraftState | null>(null)
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState<AvailablePlayer[]>([])
  const [yourTeamPicks, setYourTeamPicks] = useState<PickHistoryEntry[]>([])

  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [weightsOpen, setWeightsOpen] = useState(false)
  const [hasCustomWeights, setHasCustomWeights] = useState(false)
  const [pickFilterMode, setPickFilterMode] = useState<'all' | 'mine'>('all')
  const [isProcessing, setIsProcessing] = useState(false)
  const [cpuPicking, setCpuPicking] = useState(false)
  const [animatedPicks, setAnimatedPicks] = useState<PickHistoryEntry[]>([])
  const [animatedBanner, setAnimatedBanner] = useState<{ pick: number; round: number; team: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    api<MockRoomData>(`/leagues/${leagueId}/draft/mock?format=json`)
      .then(d => {
        setData(d)
        setState(d.state)
        setWeights(d.user_weights)
        setHasCustomWeights(d.has_custom_weights)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leagueId])

  const fetchAvailable = useCallback(() => {
    const wParams = WEIGHT_KEYS.map(w => `w_${w.key}=${weights[w.key] ?? 0.2}`).join('&')
    const params = new URLSearchParams()
    params.set('q', search)
    if (posFilter) params.set('pos', posFilter)
    params.set('limit', '100')
    params.set('mock', '1')
    fetch(`/leagues/${leagueId}/draft/api/available?${params.toString()}&${wParams}`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then((players: AvailablePlayer[]) => setAvailable(players))
      .catch(() => setAvailable([]))
  }, [leagueId, search, posFilter, weights])

  const fetchYourTeamPicks = useCallback(() => {
    if (!data?.user_team) return
    fetch(`/leagues/${leagueId}/draft/api/team_picks/${data.user_team.id}?mock=1`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(setYourTeamPicks)
      .catch(() => {})
  }, [leagueId, data?.user_team])

  useEffect(() => { if (data) fetchAvailable() }, [data, fetchAvailable])
  useEffect(() => { if (data) fetchYourTeamPicks() }, [data, fetchYourTeamPicks])

  // Trigger initial auto-picks if CPU goes first
  useEffect(() => {
    if (!data || !state) return
    const run = async () => {
      if (!data.user_team || state.status !== 'in_progress') return
      if (state.current_team_id === data.user_team.id) return
      setIsProcessing(true)
      setCpuPicking(true)
      try {
        const res = await fetch(`/leagues/${leagueId}/draft/mock/auto_start`, { method: 'POST', credentials: 'same-origin' })
        const json = await res.json()
        if (json.auto_picks && json.auto_picks.length > 0) {
          await animateAutoPicks(json.auto_picks)
        }
        if (json.state) setState(json.state)
      } catch { /* noop */ }
      setCpuPicking(false)
      setIsProcessing(false)
      fetchYourTeamPicks()
      fetchAvailable()
    }
    // Only run once on initial mount when data arrives
    const t = window.setTimeout(run, 500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  async function animateAutoPicks(picks: PickHistoryEntry[]) {
    for (const pick of picks) {
      setAnimatedBanner({ pick: pick.pick_number, round: pick.round, team: pick.team_name })
      await sleep(150)
      setAnimatedPicks(prev => [pick, ...prev])
    }
    setAnimatedBanner(null)
  }

  const allPickHistory = useMemo(() => {
    if (!state) return []
    return [...animatedPicks, ...state.pick_history]
  }, [animatedPicks, state])

  const canPick = !!(
    !isProcessing &&
    state?.status === 'in_progress' &&
    data?.user_team &&
    state?.current_team_id === data.user_team.id
  )

  async function pickPlayer(playerId: number) {
    if (!canPick) return
    setIsProcessing(true)
    try {
      const res = await fetch(`/leagues/${leagueId}/draft/mock/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ player_id: playerId }),
      })
      const json = await res.json()
      if (json.error) { alert(json.error); setIsProcessing(false); return }

      // Add user's pick
      setAnimatedPicks(prev => [json.user_pick, ...prev])

      // Animate CPU picks
      if (json.auto_picks && json.auto_picks.length > 0) {
        setCpuPicking(true)
        await animateAutoPicks(json.auto_picks)
        setCpuPicking(false)
      }

      setState(json.state)
    } catch { /* noop */ }
    setIsProcessing(false)
    fetchYourTeamPicks()
    fetchAvailable()
  }

  async function resetMock() {
    if (!confirm('Reset the mock draft? All picks will be cleared.')) return
    try {
      const res = await fetch(`/leagues/${leagueId}/draft/mock/reset`, { method: 'POST', credentials: 'same-origin' })
      const json = await res.json()
      if (json.error) { alert(json.error); return }
      setState(json.state)
      setAnimatedPicks([])
      setYourTeamPicks([])
      fetchAvailable()

      // Trigger initial auto-picks if CPU goes first
      if (data?.user_team && json.state.current_team_id !== data.user_team.id && json.state.status === 'in_progress') {
        setIsProcessing(true)
        setCpuPicking(true)
        try {
          const r2 = await fetch(`/leagues/${leagueId}/draft/mock/auto_start`, { method: 'POST', credentials: 'same-origin' })
          const j2 = await r2.json()
          if (j2.auto_picks && j2.auto_picks.length > 0) {
            await animateAutoPicks(j2.auto_picks)
          }
          if (j2.state) setState(j2.state)
        } catch { /* noop */ }
        setCpuPicking(false)
        setIsProcessing(false)
      }
    } catch { /* noop */ }
  }

  function onWeightChange(key: string, value: number) {
    setWeights(w => ({ ...w, [key]: value }))
  }

  function applyWeights() { fetchAvailable() }

  async function saveWeights() {
    try {
      const res = await fetch(`/leagues/${leagueId}/draft/api/save_weights`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weights),
      })
      const json = await res.json()
      if (json.status === 'ok') {
        if (json.weights) setWeights(json.weights)
        setHasCustomWeights(true)
        fetchAvailable()
      }
    } catch { /* noop */ }
  }

  if (loading) return <RowsSkeleton rows={14} />
  if (!data || !state) return <p className="text-danger">Failed to load mock draft</p>

  const { league, user_team } = data
  const isYourPick = !!(user_team && state.current_team_id === user_team.id)
  const bannerCompleted = state.status === 'completed'

  const displayPickNum = animatedBanner?.pick ?? state.current_pick ?? '-'
  const displayRound = animatedBanner?.round ?? state.current_round ?? '-'
  const displayTeam = bannerCompleted ? 'Mock Draft Complete!' : (animatedBanner?.team ?? state.current_team_name ?? 'TBD')

  const visiblePickHistory = pickFilterMode === 'mine' && user_team
    ? allPickHistory.filter(p => p.team_name === user_team.name)
    : allPickHistory

  return (
    <div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link> /{' '}
          <Link to={`/leagues/${leagueId}/draft/setup`}>Draft Setup</Link> / Mock Draft
        </div>
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h2 className="mb-0">
              Mock Draft
              <span className="badge ms-2" style={{ background: 'rgba(240,136,62,.15)', color: '#f0883e', fontSize: '.55rem', verticalAlign: 'middle' }}>SIMULATION</span>
            </h2>
            <div className="d-flex align-items-center gap-3 mt-1">
              <span className={`status-pill status-${state.status.replace('_', '-')}`}>{state.status}</span>
              <span style={{ fontSize: '.8rem', color: '#8b949e' }}>Computer picks for other teams</span>
            </div>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-warning btn-sm" onClick={resetMock}>
              <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
            </button>
            <Link to={`/leagues/${leagueId}/draft/setup`} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-arrow-left me-1"></i>Back
            </Link>
          </div>
        </div>
      </div>

      {/* Current Pick Banner */}
      <div className={`draft-banner${isYourPick && !cpuPicking ? ' draft-banner-your-pick' : ''}${bannerCompleted ? ' draft-banner-complete' : ''}`}>
        <div className="d-flex align-items-center gap-3">
          <div className="draft-pick-badge">
            <span>{displayPickNum}</span>
          </div>
          <div>
            <div style={{ fontSize: '.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Round <span>{displayRound}</span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              <span>{displayTeam}</span>
              {!bannerCompleted && isYourPick && !cpuPicking && (
                <span className="badge ms-2" style={{ background: 'rgba(210,153,34,.2)', color: '#d29922', fontSize: '.7rem' }}>YOUR PICK</span>
              )}
              {!bannerCompleted && (!isYourPick || cpuPicking) && (
                <span className="badge ms-2" style={{ background: 'rgba(240,136,62,.15)', color: '#f0883e', fontSize: '.7rem' }}>CPU</span>
              )}
            </div>
          </div>
        </div>
        {cpuPicking && (
          <div className="d-flex align-items-center gap-2">
            <div className="spinner-border spinner-border-sm text-warning" role="status"></div>
            <span style={{ fontSize: '.8rem', color: '#f0883e' }}>Computer picking...</span>
          </div>
        )}
      </div>

      <div className="row g-3">
        {/* Available players */}
        <div className="col-lg-5">
          <div className="card" style={{ maxHeight: '75vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-people me-2" style={{ color: '#8b949e' }}></i>Available Players
                </h5>
                <button className="btn btn-outline-secondary py-0 px-2" type="button" onClick={() => setWeightsOpen(o => !o)} style={{ fontSize: '.7rem' }}>
                  <i className="bi bi-sliders me-1"></i>Values
                </button>
              </div>

              {weightsOpen && (
                <div className="mb-2" style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '.75rem' }}>
                  {WEIGHT_KEYS.map(({ key, label }) => (
                    <div key={key} className="d-flex align-items-center gap-2 mb-2">
                      <span style={{ fontSize: '.7rem', color: '#8b949e', width: 60, flexShrink: 0 }}>{label}</span>
                      <input
                        type="range"
                        className="form-range flex-grow-1"
                        min={0} max={1} step={0.01}
                        value={weights[key] ?? 0.2}
                        onChange={e => onWeightChange(key, parseFloat(e.target.value))}
                        style={{ height: 16 }}
                      />
                      <span style={{ fontSize: '.7rem', color: '#58a6ff', width: 32, textAlign: 'right' }}>
                        {Math.round((weights[key] ?? 0.2) * 100)}%
                      </span>
                    </div>
                  ))}
                  <div className="d-flex justify-content-between align-items-center mt-2 pt-2" style={{ borderTop: '1px solid #30363d' }}>
                    <span style={{ fontSize: '.7rem', color: '#8b949e' }}>
                      {hasCustomWeights ? <span style={{ color: '#3fb950' }}>Custom</span> : 'League defaults'}
                    </span>
                    <div className="d-flex gap-1">
                      <button className="btn btn-outline-secondary py-0 px-2" onClick={applyWeights} style={{ fontSize: '.7rem' }}>Apply</button>
                      <button className="btn btn-primary py-0 px-2" onClick={saveWeights} style={{ fontSize: '.7rem' }}>Save</button>
                    </div>
                  </div>
                </div>
              )}

              <div className="row g-2">
                <div className="col-7">
                  <input type="text" className="form-control form-control-sm" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="col-5">
                  <select className="form-select form-select-sm" value={posFilter} onChange={e => setPosFilter(e.target.value)}>
                    <option value="">All Positions</option>
                    <option value="DEF">DEF</option>
                    <option value="MID">MID</option>
                    <option value="FWD">FWD</option>
                    <option value="RUC">RUC</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="card-body p-0" style={{ overflowY: 'auto' }}>
              <table className="table table-hover table-sm mb-0">
                <thead className="sticky-top" style={{ background: '#161b22' }}>
                  <tr>
                    <th>Player</th>
                    <th>Pos</th>
                    <th>Team</th>
                    <th>SC</th>
                    <th>Rtg</th>
                    <th>Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {available.map(p => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.position && <span className={`pos-badge badge-${posClass(p.position)}`}>{p.position}</span>}</td>
                      <td>{p.afl_team || ''}</td>
                      <td>{p.sc_avg != null ? p.sc_avg.toFixed(1) : '-'}</td>
                      <td><span style={{ color: ratingColor(p.rating), fontWeight: 600 }}>{p.rating ?? '-'}</span></td>
                      <td><span style={{ color: '#58a6ff', fontWeight: 600 }}>{p.draft_score != null ? p.draft_score.toFixed(1) : '-'}</span></td>
                      <td>
                        <button
                          className="btn btn-outline-primary btn-sm py-0 px-2"
                          onClick={() => pickPlayer(p.id)}
                          disabled={!canPick}
                        >
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

        {/* Right column: Pick history + Your team */}
        <div className="col-lg-7">
          <div className="card mb-3" style={{ maxHeight: '40vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="card-header d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-clock-history me-2" style={{ color: '#8b949e' }}></i>Pick History
                </h5>
                {user_team && (
                  <div className="btn-group btn-group-sm" role="group">
                    <button type="button" className={`btn btn-sm btn-outline-secondary${pickFilterMode === 'all' ? ' active' : ''}`} onClick={() => setPickFilterMode('all')} style={{ fontSize: '.7rem', padding: '2px 8px' }}>All</button>
                    <button type="button" className={`btn btn-sm btn-outline-secondary${pickFilterMode === 'mine' ? ' active' : ''}`} onClick={() => setPickFilterMode('mine')} style={{ fontSize: '.7rem', padding: '2px 8px' }}>Mine</button>
                  </div>
                )}
              </div>
              <span className="badge" style={{ background: '#21262d', color: '#8b949e', fontSize: '.75rem' }}>
                {state.picks_made}/{state.total_picks}
              </span>
            </div>
            <div className="card-body p-0" style={{ overflowY: 'auto' }}>
              <table className="table table-hover table-sm mb-0">
                <thead className="sticky-top" style={{ background: '#161b22' }}>
                  <tr><th>#</th><th>Rd</th><th>Team</th><th>Player</th><th>Pos</th><th>AFL Team</th></tr>
                </thead>
                <tbody>
                  {visiblePickHistory.map(pick => (
                    <tr key={pick.pick_number}>
                      <td>{pick.pick_number}</td>
                      <td>{pick.round}</td>
                      <td>{pick.team_name}</td>
                      <td>
                        {pick.player_name}
                        {pick.is_auto_pick && <span style={{ color: '#f0883e', fontSize: '.7rem' }}> (cpu)</span>}
                      </td>
                      <td><span className={`pos-badge badge-${posClass(pick.player_position)}`}>{pick.player_position}</span></td>
                      <td>{pick.player_afl_team}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {user_team && (
            <div className="card" style={{ maxHeight: '30vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-person-badge me-2" style={{ color: '#58a6ff' }}></i>{user_team.name}
                </h5>
                <span className="badge" style={{ background: '#21262d', color: '#8b949e', fontSize: '.75rem' }}>
                  {yourTeamPicks.length} players
                </span>
              </div>
              <div className="card-body p-0" style={{ overflowY: 'auto' }}>
                <table className="table table-sm mb-0">
                  <thead className="sticky-top" style={{ background: '#161b22' }}>
                    <tr><th>#</th><th>Player</th><th>Pos</th><th>AFL Team</th></tr>
                  </thead>
                  <tbody>
                    {yourTeamPicks.map((p, i) => (
                      <tr key={p.pick_number}>
                        <td>{i + 1}</td>
                        <td>{p.player_name}</td>
                        <td><span className={`pos-badge badge-${posClass(p.player_position)}`}>{p.player_position}</span></td>
                        <td>{p.player_afl_team}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
