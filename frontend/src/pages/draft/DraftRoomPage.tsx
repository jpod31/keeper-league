import { useParams, Link, useNavigate } from 'react-router'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { useSocket } from '../../hooks/useSocket'

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
  session_id: number
  league_id: number
  status: 'scheduled' | 'in_progress' | 'paused' | 'completed'
  draft_type: string
  draft_round_type: string
  is_mock: boolean
  pick_timer_secs: number
  timer_remaining: number | null
  current_pick: number | null
  current_round: number | null
  current_team_id: number | null
  current_team_name: string | null
  total_rounds: number
  total_picks: number
  picks_made: number
  teams: { id: number; name: string; owner_id: number; draft_order: number }[]
  pick_history: PickHistoryEntry[]
  picked_player_ids: number[]
}

interface DraftRoomData {
  league: { id: number; name: string; draft_type: string; pick_timer_secs: number }
  session: { id: number; status: string; draft_round_type: string; pick_timer_secs: number; scheduled_start: string | null }
  user_team: { id: number; name: string } | null
  is_commissioner: boolean
  can_restart: boolean
  user_weights: Record<string, number>
  has_custom_weights: boolean
  state: DraftState
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

interface PositionNeeds {
  drafted: Record<string, number>
  required: Record<string, number>
  needs: Record<string, number>
  blocked_positions: string[]
  north_count: number
}

interface ChatMessage {
  user_id?: number
  team_name: string
  message: string
  is_system?: boolean
  created_at?: string
}

const WEIGHT_KEYS: { key: string; label: string }[] = [
  { key: 'sc_average', label: 'SC Avg' },
  { key: 'age_factor', label: 'Longevity' },
  { key: 'positional_scarcity', label: 'Scarcity' },
  { key: 'trajectory', label: 'Trajectory' },
  { key: 'durability', label: 'Durability' },
  { key: 'rating_potential', label: 'Growth' },
]

const CHAT_COLORS = ['#58a6ff', '#3fb950', '#d29922', '#f0883e', '#bc8cff', '#f85149', '#39d353', '#79c0ff']

const DRAFT_STYLE = `
.draft-chat-card { flex-shrink:0; flex-grow:0; min-height:auto !important; }
.draft-chat-card #chat-messages { max-height:180px; }
.chat-msg { padding:.3rem .6rem; font-size:.78rem; border-bottom:1px solid rgba(48,54,61,.4); }
.chat-msg:last-child { border-bottom:none; }
.chat-msg-name { font-weight:700; font-size:.72rem; margin-right:.4rem; }
.chat-msg-text { color:var(--kl-text-primary); word-break:break-word; }
.chat-msg-system { text-align:center; font-size:.7rem; color:#484f58; font-style:italic; padding:.25rem .6rem; }
.chat-toggle-collapsed { transform:rotate(-90deg); }
.draft-right-col { display:flex; flex-direction:column; max-height:calc(100vh - 160px); gap:1rem; }
.draft-right-col > .card { flex-shrink:1; min-height:180px; overflow:hidden; display:flex; flex-direction:column; }
.draft-right-col > .card > .card-body { overflow-y:auto; flex:1; min-height:0; }
.sortable-th { cursor:pointer; user-select:none; white-space:nowrap; }
.sortable-th:hover { color:#c9d1d9 !important; }
.sortable-th .sort-icon { font-size:.55rem; opacity:.4; margin-left:1px; }
.sortable-th.active-sort .sort-icon { opacity:1; color:#58a6ff; }
.sortable-th.active-sort { color:#58a6ff !important; }
.draft-avail-tbl { font-size:.82rem; }
.draft-avail-tbl thead th { font-size:.68rem; text-transform:uppercase; letter-spacing:.4px; color:#8b949e; padding:.5rem .45rem; border-bottom:2px solid var(--kl-border); }
.draft-avail-tbl tbody td { padding:.45rem; vertical-align:middle; }
.draft-avail-tbl tbody tr:hover { background:rgba(88,166,255,.06); }
.draft-avail-tbl .player-name { font-weight:600; color:var(--kl-text-heading); white-space:nowrap; }
.draft-avail-tbl .stat-cell { font-weight:600; font-variant-numeric:tabular-nums; }
@media (max-width:991.98px) {
  .draft-banner { flex-direction:column; gap:.5rem; text-align:center; padding:.75rem; }
  .draft-banner .draft-pick-badge { width:36px; height:36px; font-size:.85rem; }
  .draft-timer-block { margin-top:.25rem; }
  .draft-timer { font-size:1.5rem !important; }
  .draft-avail-tbl th:nth-child(3), .draft-avail-tbl td:nth-child(3) { display:none; }
  .draft-avail-tbl th:nth-child(6), .draft-avail-tbl td:nth-child(6) { display:none; }
  .draft-right-col { max-height:none; padding-bottom:80px; }
  .col-lg-5 > .card, .col-lg-7 > .card { max-height:50vh !important; }
  .draft-chat-card { max-height:none !important; }
}
`

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return 'Starting soon...'
  const secs = Math.floor(diffMs / 1000)
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

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

function potentialColor(p: number | null): string {
  if (p == null) return '#8b949e'
  if (p >= 80) return '#3fb950'
  if (p >= 70) return '#58a6ff'
  if (p >= 60) return '#d29922'
  return '#8b949e'
}

export function DraftRoomPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<DraftRoomData | null>(null)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<DraftState | null>(null)
  const [available, setAvailable] = useState<AvailablePlayer[]>([])
  const [positionNeeds, setPositionNeeds] = useState<PositionNeeds | null>(null)
  const [yourTeamPicks, setYourTeamPicks] = useState<PickHistoryEntry[]>([])

  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [ageFilter, setAgeFilter] = useState('')
  const [clubFilter, setClubFilter] = useState('')
  const [sortColumn, setSortColumn] = useState<string>('draft_score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [weightsOpen, setWeightsOpen] = useState(false)
  const [hasCustomWeights, setHasCustomWeights] = useState(false)

  const [pickFilterMode, setPickFilterMode] = useState<'all' | 'mine'>('all')
  const [pendingPickId, setPendingPickId] = useState<number | null>(null)
  const [showPassModal, setShowPassModal] = useState(false)
  const [showEndDraftModal, setShowEndDraftModal] = useState(false)
  const [commOverride, setCommOverride] = useState(false)

  const [chatOpen, setChatOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 992)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatUnread, setChatUnread] = useState(0)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const chatColorMap = useRef<Record<string, string>>({})

  const [scheduleInput, setScheduleInput] = useState('')
  const [countdownLabel, setCountdownLabel] = useState<string>('')
  const countdownTimer = useRef<number | null>(null)

  // Load initial data
  useEffect(() => {
    setLoading(true)
    api<DraftRoomData>(`/leagues/${leagueId}/draft?format=json`)
      .then(d => {
        setData(d)
        setState(d.state)
        setWeights(d.user_weights)
        setHasCustomWeights(d.has_custom_weights)
        if (d.session.scheduled_start) {
          setScheduleInput(d.session.scheduled_start.slice(0, 16))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leagueId])

  // Countdown
  useEffect(() => {
    if (countdownTimer.current) window.clearInterval(countdownTimer.current)
    const scheduled = data?.session.scheduled_start
    if (!scheduled || state?.status !== 'scheduled') {
      setCountdownLabel(scheduled ? '' : 'No time set')
      return
    }
    const tick = () => {
      const diff = new Date(scheduled).getTime() - Date.now()
      setCountdownLabel(formatCountdown(diff))
    }
    tick()
    countdownTimer.current = window.setInterval(tick, 1000)
    return () => { if (countdownTimer.current) window.clearInterval(countdownTimer.current) }
  }, [data?.session.scheduled_start, state?.status])

  // Fetch position needs
  const fetchPositionNeeds = useCallback(() => {
    if (!data?.user_team) return
    fetch(`/leagues/${leagueId}/draft/api/position_needs`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => { if (!d.error) setPositionNeeds(d) })
      .catch(() => {})
  }, [leagueId, data?.user_team])

  // Fetch your team picks
  const fetchYourTeamPicks = useCallback(() => {
    if (!data?.user_team) return
    fetch(`/leagues/${leagueId}/draft/api/team_picks/${data.user_team.id}`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(setYourTeamPicks)
      .catch(() => {})
  }, [leagueId, data?.user_team])

  // Fetch available players
  const fetchAvailable = useCallback(() => {
    const wParams = WEIGHT_KEYS.map(w => `w_${w.key}=${weights[w.key] ?? 0.2}`).join('&')
    const fetchLimit = clubFilter ? 800 : 200
    const params = new URLSearchParams()
    params.set('q', search)
    if (posFilter) params.set('pos', posFilter)
    params.set('limit', String(fetchLimit))
    fetch(`/leagues/${leagueId}/draft/api/available?${params.toString()}&${wParams}`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then((players: AvailablePlayer[]) => setAvailable(players))
      .catch(() => setAvailable([]))
  }, [leagueId, search, posFilter, clubFilter, weights])

  useEffect(() => { if (data) fetchAvailable() }, [data, fetchAvailable])
  useEffect(() => { if (data) { fetchPositionNeeds(); fetchYourTeamPicks() } }, [data, fetchPositionNeeds, fetchYourTeamPicks])

  // Load chat history once
  useEffect(() => {
    if (!data) return
    fetch(`/leagues/${leagueId}/draft/api/chat_history`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then((msgs: ChatMessage[]) => setChatMessages(msgs))
      .catch(() => {})
  }, [leagueId, data])

  // Scroll chat on new message
  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [chatMessages, chatOpen])

  // Socket
  const { socket, state: connState } = useSocket({
    namespace: '/draft',
    onConnect: s => s.emit('join_draft', { league_id: Number(leagueId) }),
    events: {
      draft_state: p => {
        setState(p as DraftState)
        fetchPositionNeeds()
        fetchYourTeamPicks()
        fetchAvailable()
      },
      pick_made: p => {
        const pick = p as PickHistoryEntry
        setState(prev => {
          if (!prev) return prev
          return {
            ...prev,
            pick_history: [pick, ...prev.pick_history],
            picks_made: prev.picks_made + 1,
            picked_player_ids: pick.player_id ? [...prev.picked_player_ids, pick.player_id] : prev.picked_player_ids,
          }
        })
        setChatMessages(prev => [...prev, {
          team_name: pick.team_name,
          message: pick.is_pass ? `${pick.team_name} passed` : `${pick.team_name} drafted ${pick.player_name}`,
          is_system: true,
        }])
        fetchPositionNeeds()
        fetchAvailable()
        if (pick.team_id === data?.user_team?.id) {
          fetchYourTeamPicks()
        }
      },
      timer_tick: p => {
        const { remaining } = p as { remaining: number }
        setState(prev => prev ? { ...prev, timer_remaining: remaining } : prev)
      },
      draft_completed: p => {
        const s = p as DraftState
        setState({ ...s, status: 'completed' })
      },
      draft_chat_msg: p => {
        const m = p as ChatMessage
        setChatMessages(prev => [...prev, m])
        if (!chatOpen) setChatUnread(u => u + 1)
      },
      schedule_updated: p => {
        const { scheduled_start } = p as { scheduled_start: string | null }
        setData(prev => prev ? { ...prev, session: { ...prev.session, scheduled_start } } : prev)
        if (scheduled_start) setScheduleInput(scheduled_start.slice(0, 16))
      },
      error: p => alert((p as { message: string }).message),
    },
  })

  const sortedAvailable = useMemo(() => {
    let filtered = available.filter(p => {
      if (state && p.id != null && state.picked_player_ids.includes(p.id)) return false
      return true
    })
    if (ageFilter) {
      filtered = filtered.filter(p => {
        if (p.age == null) return false
        if (ageFilter === '30+') return p.age >= 30
        if (ageFilter === '25-30') return p.age >= 25 && p.age <= 30
        return p.age < parseInt(ageFilter)
      })
    }
    if (clubFilter) {
      filtered = filtered.filter(p => p.afl_team === clubFilter)
    }
    const dir = sortDir === 'asc' ? 1 : -1
    return filtered.slice().sort((a, b) => {
      const va = (a as unknown as Record<string, number | string | null>)[sortColumn]
      const vb = (b as unknown as Record<string, number | string | null>)[sortColumn]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'string' && typeof vb === 'string') return dir * va.localeCompare(vb)
      return dir * ((va as number) - (vb as number))
    }).slice(0, 100)
  }, [available, ageFilter, clubFilter, sortColumn, sortDir, state])

  const clubOptions = useMemo(() => {
    const set = new Set<string>()
    available.forEach(p => { if (p.afl_team) set.add(p.afl_team) })
    return [...set].sort()
  }, [available])

  const toggleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortColumn(col)
      setSortDir(['name', 'position', 'afl_team'].includes(col) ? 'asc' : 'desc')
    }
  }

  const sortIcon = (col: string) => {
    if (sortColumn !== col) return 'bi-chevron-expand'
    return sortDir === 'desc' ? 'bi-chevron-down' : 'bi-chevron-up'
  }

  const isMyTurn = !!(data?.user_team && state?.current_team_id === data.user_team.id)
  const canPick = state?.status === 'in_progress' && (isMyTurn || (data?.is_commissioner && commOverride))

  function isPositionBlocked(playerPos: string | null): boolean {
    if (!positionNeeds || !positionNeeds.blocked_positions.length || !playerPos) return false
    const positions = playerPos.split('/').map(p => p.trim().toUpperCase())
    return positions.every(p => positionNeeds.blocked_positions.includes(p))
  }

  function pickPlayer(playerId: number) {
    if (!socket?.connected) { alert('Not connected — refresh the page.'); return }
    setPendingPickId(playerId)
  }

  function confirmPick() {
    if (pendingPickId == null || !socket) return
    socket.emit('make_pick', { league_id: Number(leagueId), player_id: pendingPickId })
    setPendingPickId(null)
  }

  function confirmPass() {
    socket?.emit('pass_pick', { league_id: Number(leagueId) })
    setShowPassModal(false)
  }

  function getChatColor(teamName: string): string {
    if (!chatColorMap.current[teamName]) {
      const idx = Object.keys(chatColorMap.current).length
      chatColorMap.current[teamName] = CHAT_COLORS[idx % CHAT_COLORS.length]
    }
    return chatColorMap.current[teamName]
  }

  function sendChat() {
    if (!chatInput.trim() || !socket) return
    socket.emit('draft_chat', { league_id: Number(leagueId), message: chatInput.trim() })
    setChatInput('')
  }

  function toggleChat() {
    const next = !chatOpen
    setChatOpen(next)
    if (next) setChatUnread(0)
  }

  function onWeightChange(key: string, value: number) {
    setWeights(w => ({ ...w, [key]: value }))
  }

  function applyWeights() {
    fetchAvailable()
  }

  async function saveWeights() {
    try {
      const res = await fetch(`/leagues/${leagueId}/draft/api/save_weights`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(weights),
      })
      const d = await res.json()
      if (d.status === 'ok') {
        if (d.weights) setWeights(d.weights)
        setHasCustomWeights(true)
        fetchAvailable()
      }
    } catch { /* noop */ }
  }

  function updateSchedule() {
    socket?.emit('update_schedule', { league_id: Number(leagueId), scheduled_start: scheduleInput || null })
  }

  function startDraft() { socket?.emit('start_draft', { league_id: Number(leagueId) }) }
  function pauseDraft() { if (confirm('Pause the draft? All timers will stop.')) socket?.emit('pause_draft', { league_id: Number(leagueId) }) }
  function resumeDraft() { socket?.emit('resume_draft', { league_id: Number(leagueId) }) }
  function undoPick() { if (confirm('Undo the last pick?')) socket?.emit('undo_pick', { league_id: Number(leagueId) }) }

  function confirmRestart() {
    if (!confirm('Are you sure you want to restart the draft?\n\nThis will DELETE the current draft session, remove all drafted players from rosters, and take you to settings where you can make changes before re-drafting.\n\nThis cannot be undone.')) return
    const fd = new FormData()
    fd.set('action', 'restart_draft')
    fetch(`/leagues/${leagueId}/draft/setup`, { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(() => navigate(`/leagues/${leagueId}/settings`))
  }

  async function submitEndDraft() {
    const fd = new FormData()
    try {
      await fetch(`/leagues/${leagueId}/draft/api/end`, { method: 'POST', body: fd, credentials: 'same-origin' })
      setShowEndDraftModal(false)
    } catch { /* noop */ }
  }

  if (loading) return <Spinner text="Loading draft room..." />
  if (!data || !state) return <p className="text-danger">Failed to load draft room</p>

  const { league, user_team, is_commissioner, can_restart, session } = data
  const scheduledDate = session.scheduled_start ? new Date(session.scheduled_start) : null
  const scheduledDisplay = scheduledDate
    ? scheduledDate.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + scheduledDate.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
    : ''

  const pendingPickPlayer = pendingPickId != null ? available.find(p => p.id === pendingPickId) : null
  const bannerYourPick = isMyTurn && state.status === 'in_progress'
  const bannerCompleted = state.status === 'completed'

  const visiblePickHistory = pickFilterMode === 'mine' && user_team
    ? state.pick_history.filter(p => p.team_name === user_team.name)
    : state.pick_history

  return (
    <div>
      <style>{DRAFT_STYLE}</style>

      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link> / Draft Room
        </div>
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h2 className="mb-0">Live Draft</h2>
            <div className="d-flex align-items-center gap-3 mt-1">
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: connState === 'connected' ? '#3fb950' : '#f85149' }} title={connState === 'connected' ? 'Connected' : 'Disconnected'}></span>
              <span className={`status-pill status-${state.status.replace('_', '-')}`}>{state.status}</span>
              <span style={{ fontSize: '.8rem', color: '#8b949e' }}>
                {league.draft_type.charAt(0).toUpperCase() + league.draft_type.slice(1)} · {session.pick_timer_secs}s timer
              </span>
            </div>
          </div>
          {is_commissioner && (
            <div className="d-flex gap-2 align-items-center flex-wrap">
              <button
                className={`btn btn-outline-warning btn-sm${commOverride ? ' active' : ''}`}
                onClick={() => setCommOverride(o => !o)}
                style={{ fontSize: '.7rem' }}
                title="Pick on behalf of other teams"
              >
                <i className={`bi bi-shield${commOverride ? '-fill-check' : ''} me-1`}></i>
                {commOverride ? 'Override ON' : 'Override'}
              </button>
              {state.status === 'scheduled' && (
                <button className="btn btn-primary btn-sm" onClick={startDraft}>
                  <i className="bi bi-play-fill me-1"></i>Start Draft
                </button>
              )}
              {state.status === 'in_progress' && (
                <button className="btn btn-outline-secondary btn-sm" onClick={pauseDraft}>
                  <i className="bi bi-pause-fill me-1"></i>Pause
                </button>
              )}
              {state.status === 'paused' && (
                <button className="btn btn-primary btn-sm" onClick={resumeDraft}>
                  <i className="bi bi-play-fill me-1"></i>Resume
                </button>
              )}
              {state.picks_made > 0 && (state.status === 'in_progress' || state.status === 'paused') && (
                <button className="btn btn-outline-info btn-sm" onClick={undoPick} style={{ fontSize: '.7rem' }}>
                  <i className="bi bi-arrow-counterclockwise me-1"></i>Undo
                </button>
              )}
              {(state.status === 'in_progress' || state.status === 'paused') && (
                <button className="btn btn-outline-danger btn-sm" onClick={() => setShowEndDraftModal(true)} style={{ fontSize: '.7rem' }}>
                  <i className="bi bi-stop-fill me-1"></i>End Draft
                </button>
              )}
              {can_restart && (
                <button className="btn btn-outline-danger btn-sm" onClick={confirmRestart} style={{ fontSize: '.7rem' }}>
                  <i className="bi bi-arrow-counterclockwise me-1"></i>Restart
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {state.status === 'scheduled' ? (
        <div className="draft-banner">
          <div className="d-flex align-items-center gap-3">
            <div className="draft-pick-badge" style={{ background: 'rgba(210,153,34,.15)', color: '#d29922' }}>
              <i className="bi bi-hourglass-split" style={{ fontSize: '1rem' }}></i>
            </div>
            <div>
              <div style={{ fontSize: '.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px' }}>Draft Starts In</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: countdownLabel === 'Starting soon...' ? '#3fb950' : '#d29922' }}>
                {countdownLabel}
              </div>
            </div>
          </div>
          {is_commissioner ? (
            <div className="d-flex align-items-center gap-2">
              <input
                type="datetime-local"
                className="form-control form-control-sm"
                value={scheduleInput}
                onChange={e => setScheduleInput(e.target.value)}
                style={{ fontSize: '.75rem', background: '#0d1117', borderColor: '#30363d', color: '#c9d1d9', width: 'auto' }}
              />
              <button className="btn btn-outline-warning btn-sm" onClick={updateSchedule} style={{ fontSize: '.7rem', whiteSpace: 'nowrap' }}>
                <i className="bi bi-clock me-1"></i>Set Time
              </button>
            </div>
          ) : scheduledDisplay && (
            <div style={{ fontSize: '.8rem', color: '#8b949e' }}>{scheduledDisplay}</div>
          )}
        </div>
      ) : (
        <div className={`draft-banner${bannerYourPick ? ' draft-banner-your-pick' : ''}${bannerCompleted ? ' draft-banner-complete' : ''}`}>
          <div className="d-flex align-items-center gap-3">
            <div className="draft-pick-badge">
              <span>{state.current_pick || '-'}</span>
            </div>
            <div>
              <div style={{ fontSize: '.75rem', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Round <span>{state.current_round || '-'}</span>
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                <span>{bannerCompleted ? 'Draft Complete!' : (state.current_team_name || 'TBD')}</span>
                {bannerYourPick && (
                  <span className="badge ms-2" style={{ background: 'rgba(210,153,34,.2)', color: '#d29922', fontSize: '.7rem' }}>YOUR PICK</span>
                )}
              </div>
            </div>
          </div>
          <div className="draft-timer-block">
            <span className={`draft-timer${(state.timer_remaining ?? 0) <= 10 && state.timer_remaining != null ? ' timer-urgent' : ''}`}>
              {bannerCompleted ? '-' : (state.timer_remaining ?? session.pick_timer_secs)}
            </span>
            <span className="draft-timer-label">seconds</span>
          </div>
        </div>
      )}

      <div className="row g-3">
        {/* Available players */}
        <div className="col-lg-7">
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-header">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-people me-2" style={{ color: '#8b949e' }}></i>Available Players
                </h5>
                <div className="d-flex gap-1 align-items-center">
                  {state.status === 'in_progress' && (
                    <button className="btn btn-outline-warning py-0 px-2" onClick={() => setShowPassModal(true)} style={{ fontSize: '.7rem' }} title="Pass on this pick">
                      <i className="bi bi-skip-forward me-1"></i>Pass
                    </button>
                  )}
                  <button className="btn btn-outline-secondary py-0 px-2" type="button" onClick={() => setWeightsOpen(o => !o)} style={{ fontSize: '.7rem' }} title="Adjust your draft value weights">
                    <i className="bi bi-sliders me-1"></i>Values
                  </button>
                </div>
              </div>

              {weightsOpen && (
                <div className="mb-2" style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '.75rem' }}>
                  {WEIGHT_KEYS.map(({ key, label }) => (
                    <div key={key} className="d-flex align-items-center gap-2 mb-2">
                      <span style={{ fontSize: '.7rem', color: '#8b949e', width: 60, flexShrink: 0 }}>{label}</span>
                      <input
                        type="range"
                        className="form-range flex-grow-1"
                        min={0}
                        max={1}
                        step={0.01}
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

              {positionNeeds && user_team && (
                <div className="d-flex gap-2 mb-2 flex-wrap">
                  {(['DEF', 'MID', 'FWD', 'RUC'] as const).map(pos => {
                    const drafted = positionNeeds.drafted[pos] ?? 0
                    const required = positionNeeds.required[pos] ?? 0
                    const need = positionNeeds.needs[pos] ?? 0
                    const isBlocked = positionNeeds.blocked_positions.includes(pos)
                    const color = isBlocked ? '#f85149' : need > 0 ? '#d29922' : '#3fb950'
                    const bg = isBlocked ? 'rgba(248,81,73,.12)' : need > 0 ? 'rgba(210,153,34,.12)' : 'rgba(63,185,80,.12)'
                    return (
                      <span key={pos} style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 8, background: bg, color, fontWeight: 600 }} title={isBlocked ? 'BLOCKED' : need > 0 ? `${need} more needed` : 'Requirement met'}>
                        {pos} {drafted}/{required}{isBlocked ? ' 🔒' : ''}
                      </span>
                    )
                  })}
                  <span style={{ fontSize: '.7rem', padding: '2px 8px', borderRadius: 8, background: 'rgba(0,86,168,.15)', color: '#58a6ff', fontWeight: 600 }} title="North Melbourne players drafted">
                    NM {positionNeeds.north_count ?? 0}
                  </span>
                </div>
              )}

              <div className="row g-2">
                <div className="col">
                  <input type="text" className="form-control form-control-sm" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="col-auto">
                  <select className="form-select form-select-sm" value={posFilter} onChange={e => setPosFilter(e.target.value)} style={{ width: 'auto' }}>
                    <option value="">All Pos</option>
                    <option value="DEF">DEF</option>
                    <option value="MID">MID</option>
                    <option value="FWD">FWD</option>
                    <option value="RUC">RUC</option>
                  </select>
                </div>
                <div className="col-auto">
                  <select className="form-select form-select-sm" value={ageFilter} onChange={e => setAgeFilter(e.target.value)} style={{ width: 'auto' }}>
                    <option value="">All Ages</option>
                    <option value="21">U21</option>
                    <option value="23">U23</option>
                    <option value="25">U25</option>
                    <option value="25-30">25-30</option>
                    <option value="30+">30+</option>
                  </select>
                </div>
                <div className="col-auto">
                  <select className="form-select form-select-sm" value={clubFilter} onChange={e => setClubFilter(e.target.value)} style={{ width: 'auto' }}>
                    <option value="">All Clubs</option>
                    {clubOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="card-body p-0" style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: '70vh' }}>
              <table className="table table-hover table-sm mb-0 draft-avail-tbl">
                <thead className="sticky-top" style={{ background: '#161b22' }}>
                  <tr>
                    {([
                      ['name', 'Player'],
                      ['position', 'Pos'],
                      ['afl_team', 'Team'],
                      ['age', 'Age'],
                      ['sc_avg', 'SC'],
                      ['rating', 'Rtg'],
                      ['potential', 'Pot'],
                      ['draft_score', 'Value'],
                    ] as const).map(([col, label]) => (
                      <th key={col} className={`sortable-th${sortColumn === col ? ' active-sort' : ''}`} onClick={() => toggleSort(col)}>
                        {label} <i className={`bi sort-icon ${sortIcon(col)}`}></i>
                      </th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAvailable.map(p => {
                    const blocked = isPositionBlocked(p.position)
                    return (
                      <tr key={p.id} style={blocked ? { opacity: 0.45 } : undefined}>
                        <td className="player-name">{p.name}</td>
                        <td>{p.position && <span className={`pos-badge badge-${posClass(p.position)}`}>{p.position}</span>}</td>
                        <td>{p.afl_team || ''}</td>
                        <td style={{ color: '#8b949e' }}>{p.age ?? '-'}</td>
                        <td className="stat-cell">{p.sc_avg != null ? p.sc_avg.toFixed(1) : '-'}</td>
                        <td className="stat-cell"><span style={{ color: ratingColor(p.rating) }}>{p.rating ?? '-'}</span></td>
                        <td className="stat-cell"><span style={{ color: potentialColor(p.potential) }}>{p.potential ?? '-'}</span></td>
                        <td className="stat-cell"><span style={{ color: '#58a6ff' }}>{p.draft_score != null ? p.draft_score.toFixed(1) : '-'}</span></td>
                        <td>
                          <button
                            className="btn btn-outline-primary btn-sm py-0 px-2"
                            onClick={() => canPick && pickPlayer(p.id)}
                            disabled={!canPick}
                            title={blocked ? 'Position blocked — draft other positions first' : ''}
                          >
                            {blocked ? <i className="bi bi-lock-fill"></i> : 'Pick'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="col-lg-5">
          <div className="draft-right-col">
            {/* Pick history */}
            <div className="card" style={{ flex: 3 }}>
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
                        {pick.is_pass ? (
                          <><td><span style={{ color: '#d29922', fontWeight: 600 }}>PASS</span></td><td></td><td></td></>
                        ) : (
                          <>
                            <td>{pick.player_name}{pick.is_auto_pick && <span style={{ color: '#8b949e', fontSize: '.7rem' }}> (auto)</span>}</td>
                            <td><span className={`pos-badge badge-${posClass(pick.player_position)}`}>{pick.player_position}</span></td>
                            <td>{pick.player_afl_team}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Your team */}
            {user_team && (
              <div className="card" style={{ flex: 2 }}>
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

            {/* Chat */}
            <div className="card draft-chat-card">
              <div className="card-header d-flex justify-content-between align-items-center" style={{ cursor: 'pointer' }} onClick={toggleChat}>
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-chat-dots me-2" style={{ color: '#d29922' }}></i>Draft Chat
                </h5>
                <div className="d-flex align-items-center gap-2">
                  {chatUnread > 0 && <span className="badge" style={{ background: '#f85149', fontSize: '.6rem', borderRadius: 8 }}>{chatUnread}</span>}
                  <i className={`bi bi-chevron-down${chatOpen ? '' : ' chat-toggle-collapsed'}`} style={{ color: '#8b949e', fontSize: '.75rem', transition: 'transform .2s' }}></i>
                </div>
              </div>
              {chatOpen && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div ref={chatScrollRef} id="chat-messages" className="card-body p-0" style={{ overflowY: 'auto', padding: '.5rem !important', maxHeight: 180 }}>
                    {chatMessages.length === 0 ? (
                      <div className="text-center py-3" style={{ color: '#484f58', fontSize: '.75rem' }}>
                        <i className="bi bi-chat-dots" style={{ fontSize: '1.2rem' }}></i>
                      </div>
                    ) : (
                      chatMessages.map((m, i) => m.is_system ? (
                        <div key={i} className="chat-msg-system">{m.message}</div>
                      ) : (
                        <div key={i} className="chat-msg">
                          <span className="chat-msg-name" style={{ color: getChatColor(m.team_name) }}>{m.team_name}</span>
                          <span className="chat-msg-text">{m.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ borderTop: '1px solid var(--kl-border)', padding: '.5rem .65rem', display: 'flex', gap: '.4rem' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Say something..."
                      maxLength={500}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendChat() } }}
                      style={{ fontSize: '.8rem', background: '#0d1117', borderColor: '#30363d', color: '#c9d1d9' }}
                    />
                    <button className="btn btn-sm btn-primary" onClick={sendChat} style={{ padding: '4px 12px', whiteSpace: 'nowrap' }}>
                      <i className="bi bi-send"></i>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pick confirmation modal */}
      {pendingPickId != null && pendingPickPlayer && (
        <>
          <div onClick={() => setPendingPickId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1055 }} />
          <div role="dialog" aria-modal="true" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1060, width: '90%', maxWidth: 360, background: '#161b22', border: '1px solid #30363d', borderRadius: 12 }}>
            <div style={{ borderBottom: '1px solid #30363d', padding: '.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h6 className="fw-bold mb-0" style={{ fontSize: '.9rem' }}>Confirm Pick</h6>
              <button type="button" className="btn-close btn-close-white" onClick={() => setPendingPickId(null)}></button>
            </div>
            <div className="text-center" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c9d1d9' }}>{pendingPickPlayer.name}</div>
              <div className="d-flex justify-content-center gap-2 mt-1">
                <span className={`pos-badge badge-${posClass(pendingPickPlayer.position)}`}>{pendingPickPlayer.position}</span>
                <span style={{ fontSize: '.8rem', color: '#8b949e' }}>{pendingPickPlayer.afl_team}</span>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #30363d', padding: '.75rem 1rem', display: 'flex', gap: '.5rem' }}>
              <button type="button" className="btn btn-outline-secondary btn-sm flex-fill" onClick={() => setPendingPickId(null)}>Cancel</button>
              <button type="button" className="btn btn-primary btn-sm flex-fill" onClick={confirmPick}>Confirm</button>
            </div>
          </div>
        </>
      )}

      {/* Pass modal */}
      {showPassModal && (
        <>
          <div onClick={() => setShowPassModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1055 }} />
          <div role="dialog" aria-modal="true" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1060, width: '90%', maxWidth: 360, background: '#161b22', border: '1px solid #30363d', borderRadius: 12 }}>
            <div style={{ borderBottom: '1px solid #30363d', padding: '.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h6 className="fw-bold mb-0" style={{ fontSize: '.9rem' }}>Pass Pick?</h6>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowPassModal(false)}></button>
            </div>
            <div className="text-center" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '.85rem', color: '#8b949e' }}>Are you sure you want to pass on this pick? You won't draft a player this round.</div>
            </div>
            <div style={{ borderTop: '1px solid #30363d', padding: '.75rem 1rem', display: 'flex', gap: '.5rem' }}>
              <button type="button" className="btn btn-outline-secondary btn-sm flex-fill" onClick={() => setShowPassModal(false)}>Cancel</button>
              <button type="button" className="btn btn-warning btn-sm flex-fill" onClick={confirmPass}>Pass</button>
            </div>
          </div>
        </>
      )}

      {/* End draft modal */}
      {showEndDraftModal && (
        <>
          <div onClick={() => setShowEndDraftModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1055 }} />
          <div role="dialog" aria-modal="true" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1060, width: '90%', maxWidth: 360, background: '#161b22', border: '1px solid #30363d', borderRadius: 12 }}>
            <div style={{ borderBottom: '1px solid #30363d', padding: '.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h6 className="fw-bold mb-0" style={{ fontSize: '.9rem', color: '#f85149' }}>End Draft Early?</h6>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowEndDraftModal(false)}></button>
            </div>
            <div className="text-center" style={{ padding: '1rem' }}>
              <div style={{ fontSize: '.85rem', color: '#8b949e' }}>
                All remaining picks will be marked as <strong style={{ color: '#d29922' }}>PASS</strong> and the draft will be completed immediately.
              </div>
            </div>
            <div style={{ borderTop: '1px solid #30363d', padding: '.75rem 1rem', display: 'flex', gap: '.5rem' }}>
              <button type="button" className="btn btn-outline-secondary btn-sm flex-fill" onClick={() => setShowEndDraftModal(false)}>Cancel</button>
              <button type="button" className="btn btn-danger btn-sm flex-fill" onClick={submitEndDraft}>End Draft</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
