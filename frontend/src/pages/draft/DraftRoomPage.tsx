import { useParams, Link, useNavigate } from 'react-router'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { api } from '../../lib/api'
import { DraftSkeleton } from '../../components/ui/DraftSkeleton'
import { useSocket } from '../../hooks/useSocket'
import { useWishlist } from '../../hooks/useWishlist'

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

interface DraftEmptyState {
  empty_state: true
  league: { id: number; name: string; draft_type: string; pick_timer_secs: number }
  is_commissioner: boolean
}

type DraftRoomResponse = DraftRoomData | DraftEmptyState

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

// Jewel-tone chat author palette — replaces the legacy GitHub-themed
// list so chat messages match the rest of the app.
const CHAT_COLORS = ['#82b3e4', '#7dc99a', '#c2932f', '#e07a6c', '#b39ed4', '#7ec0d3', '#d68a7e', '#f0d27a']

const DRAFT_STYLE = `
/* === Draft room · Stadium ====================================== */

/* Banner — current pick + timer. Overrides the legacy GitHub-toned
   rules in global style.css. */
.draft-banner {
  background: rgba(15,22,36,.7) !important;
  border: 1px solid rgba(110,130,180,.18) !important;
  border-radius: 14px !important;
  padding: 16px 22px !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin-bottom: 14px !important;
  transition: border-color .2s, background .2s, box-shadow .2s;
}
.draft-banner-your-pick {
  border-color: rgba(58,125,196,.55) !important;
  background: linear-gradient(135deg, rgba(58,125,196,.14), rgba(58,125,196,.02)) !important;
  box-shadow: 0 0 32px -10px rgba(58,125,196,.4);
}
.draft-banner-complete {
  border-color: rgba(61,140,99,.5) !important;
  background: linear-gradient(135deg, rgba(61,140,99,.1), transparent) !important;
}
.draft-pick-badge {
  width: 52px !important;
  height: 52px !important;
  border-radius: 12px !important;
  background: rgba(20,28,45,.85) !important;
  border: 1px solid rgba(110,130,180,.3) !important;
  color: #f0f4fc !important;
  font-size: 1.2rem !important;
  font-weight: 800 !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.02em;
}
.draft-banner-your-pick .draft-pick-badge {
  background: rgba(58,125,196,.18) !important;
  border-color: rgba(58,125,196,.5) !important;
  color: #a8c8ed !important;
}
.draft-pick-badge.scheduled { background: rgba(58,125,196,.12) !important; border-color: rgba(58,125,196,.32) !important; color: #82b3e4 !important; }
.draft-timer {
  font-size: 2.4rem !important;
  font-weight: 900 !important;
  font-family: inherit !important;
  color: #f5f8ff !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.03em;
  line-height: 1;
  transition: color .15s, text-shadow .15s;
}
.draft-timer.timer-urgent {
  color: #e07a6c !important;
  text-shadow: 0 0 20px rgba(184,90,74,.5);
  animation: draftPulse 1s ease-in-out infinite;
}
@keyframes draftPulse { 0%, 100% { opacity: 1; } 50% { opacity: .65; } }
.draft-timer-label {
  font-size: .58rem !important;
  letter-spacing: .16em !important;
  text-transform: uppercase;
  color: #6c7892 !important;
  font-weight: 700 !important;
  margin-top: 4px !important;
}
.draft-banner-round { font-size: .56rem; color: #6c7892; letter-spacing: .16em; text-transform: uppercase; font-weight: 800; }
.draft-banner-team { font-size: 1.15rem; font-weight: 800; color: #f0f4fc; letter-spacing: -.005em; }
.draft-your-pick-pill {
  display: inline-flex;
  align-items: center;
  font-size: .56rem;
  font-weight: 800;
  letter-spacing: .18em;
  padding: 3px 9px;
  border-radius: 4px;
  background: rgba(58,125,196,.2);
  color: #a8c8ed;
  border: 1px solid rgba(58,125,196,.5);
  text-transform: uppercase;
  margin-left: 10px;
}

/* Pre-draft event card */
.draft-event {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  padding: 18px 22px;
  border-radius: 14px;
  background: rgba(15,22,36,.7);
  border: 1px solid rgba(110,130,180,.18);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  margin-bottom: 14px;
  position: relative;
  overflow: hidden;
}
.draft-event::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, rgba(58,125,196,.6) 0%, rgba(138,109,184,.6) 50%, rgba(184,127,61,.6) 100%);
}
.draft-event-countdown {
  font-size: 1.6rem;
  font-weight: 800;
  color: #f0f4fc;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
  letter-spacing: -.01em;
  line-height: 1.1;
  margin-top: 4px;
}
.draft-event-countdown.soon { color: #7dc99a; }
.draft-event-time { font-size: .82rem; color: #97a3ba; }

/* Status pill on page header */
.conn-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6db38a;
  box-shadow: 0 0 6px rgba(109,179,138,.5);
}
.conn-dot.off { background: #e07a6c; box-shadow: 0 0 6px rgba(224,122,108,.5); }
.draft-header-info { font-size: .78rem; color: #97a3ba; letter-spacing: .02em; }

/* Available players card */
.draft-avail-tbl { width: 100%; font-size: .82rem; }
.draft-avail-tbl thead th {
  font-size: .58rem !important;
  font-weight: 800 !important;
  letter-spacing: .14em !important;
  color: #6c7892 !important;
  background: rgba(11,16,28,.7) !important;
  padding: 10px 12px !important;
  border-bottom: 1px solid rgba(110,130,180,.18) !important;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  z-index: 2;
}
.draft-avail-tbl tbody td {
  padding: 8px 12px;
  font-size: .82rem;
  border-bottom: 1px solid rgba(110,130,180,.06);
  color: #dde4f1;
  vertical-align: middle;
}
.draft-avail-tbl tbody tr { transition: background .14s; }
.draft-avail-tbl tbody tr:hover { background: rgba(58,125,196,.06); }
.draft-avail-tbl tbody tr:hover .player-name { color: #a8c8ed; }
.draft-avail-tbl .player-name { font-weight: 600; color: #f0f4fc; white-space: nowrap; }
.draft-avail-tbl .stat-cell { font-weight: 700; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; text-align: right; }
.draft-avail-tbl tbody tr.blocked { opacity: .45; }

/* Sortable headers */
.sortable-th { cursor: pointer; user-select: none; white-space: nowrap; transition: color .14s; }
.sortable-th:hover { color: #b6c0d3 !important; }
.sortable-th .sort-icon { display: inline-block; margin-left: 4px; font-size: .55rem; opacity: .25; transition: opacity .14s, color .14s; }
.sortable-th.active-sort { color: #dde4f1 !important; }
.sortable-th.active-sort .sort-icon { opacity: 1; color: #82b3e4; }

/* Position chips — match Gameday DEF/MID/RUC/FWD palette */
.draft-pos-chip {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 22px; border-radius: 5px;
  font-size: .56rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase;
  background: rgba(110,130,180,.1); border: 1px solid rgba(110,130,180,.18); color: #b6c0d3;
}
.draft-pos-chip.def { background: rgba(61,138,156,.14); color: #7ec0d3; border-color: rgba(61,138,156,.3); }
.draft-pos-chip.mid { background: rgba(58,125,196,.14); color: #82b3e4; border-color: rgba(58,125,196,.3); }
.draft-pos-chip.ruc { background: rgba(138,109,184,.14); color: #b39ed4; border-color: rgba(138,109,184,.3); }
.draft-pos-chip.fwd { background: rgba(184,90,74,.14); color: #e07a6c; border-color: rgba(184,90,74,.3); }

/* Rating / potential / draft-score numeric chips */
.draft-stat-chip {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 34px; height: 22px; padding: 0 7px; border-radius: 5px;
  font-size: .74rem; font-weight: 800; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0;
  background: rgba(110,130,180,.1); border: 1px solid rgba(110,130,180,.18); color: #b6c0d3;
}
.draft-stat-chip.tier-elite { background: rgba(194,147,47,.2); color: #f0d27a; border-color: rgba(194,147,47,.45); box-shadow: 0 0 10px -2px rgba(194,147,47,.3); }
.draft-stat-chip.tier-good { background: rgba(58,125,196,.16); color: #82b3e4; border-color: rgba(58,125,196,.35); }
.draft-stat-chip.tier-ok { background: rgba(138,109,184,.12); color: #b39ed4; border-color: rgba(138,109,184,.3); }
.draft-stat-chip.tier-low { background: rgba(184,90,74,.1); color: #d68a7e; border-color: rgba(184,90,74,.25); }
.draft-stat-chip.tier-empty { color: #5a677e; background: transparent; border-color: transparent; }
.draft-stat-chip.draft-score { background: rgba(58,125,196,.18); color: #a8c8ed; border-color: rgba(58,125,196,.4); }

/* Position-need chips (sit above filter row) */
.draft-need-chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: .66rem; padding: 3px 9px; border-radius: 6px;
  font-weight: 700; letter-spacing: .04em;
  background: rgba(110,130,180,.1); border: 1px solid rgba(110,130,180,.18); color: #b6c0d3;
  font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0;
}
.draft-need-chip.met { background: rgba(61,140,99,.12); color: #7dc99a; border-color: rgba(61,140,99,.3); }
.draft-need-chip.short { background: rgba(194,147,47,.12); color: #f0d27a; border-color: rgba(194,147,47,.3); }
.draft-need-chip.blocked { background: rgba(184,90,74,.14); color: #e07a6c; border-color: rgba(184,90,74,.36); }
.draft-need-chip.north { background: rgba(58,125,196,.12); color: #82b3e4; border-color: rgba(58,125,196,.32); }

/* Filter row */
.draft-filter-input, .draft-filter-select {
  background: rgba(15,22,36,.55) !important;
  border: 1px solid rgba(110,130,180,.2) !important;
  color: #dde4f1 !important;
  border-radius: 8px !important;
  padding: 7px 12px !important;
  font-size: .78rem !important;
  height: auto !important;
}
.draft-filter-input:focus, .draft-filter-select:focus { border-color: rgba(58,125,196,.55) !important; outline: 0 !important; box-shadow: 0 0 0 2px rgba(58,125,196,.15) !important; }
.draft-filter-input::placeholder { color: #6c7892; }

/* Values panel (weight sliders) */
.draft-values-panel {
  background: rgba(11,16,28,.6);
  border: 1px solid rgba(110,130,180,.16);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.draft-values-row { display: flex; align-items: center; gap: 12px; margin-bottom: 9px; }
.draft-values-row:last-of-type { margin-bottom: 4px; }
.draft-values-label { font-size: .68rem; color: #97a3ba; font-weight: 700; letter-spacing: .04em; width: 68px; flex-shrink: 0; }
.draft-values-value { font-size: .72rem; color: #82b3e4; font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1, "zero" 0; min-width: 36px; text-align: right; font-weight: 700; }
.draft-values-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(110,130,180,.12); }
.draft-values-foot-meta { font-size: .68rem; color: #6c7892; }
.draft-values-foot-meta .custom { color: #7dc99a; font-weight: 700; }

input[type="range"].draft-slider {
  appearance: none;
  -webkit-appearance: none;
  flex: 1;
  height: 4px;
  background: rgba(110,130,180,.2);
  border-radius: 2px;
  outline: none;
}
input[type="range"].draft-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #3a7dc4;
  border: 2px solid #f0f4fc;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,.4);
}
input[type="range"].draft-slider::-moz-range-thumb {
  width: 16px; height: 16px;
  border-radius: 50%;
  background: #3a7dc4;
  border: 2px solid #f0f4fc;
  cursor: pointer;
}

/* Right column — pick history / your team / chat cards */
.draft-right-col { display: flex; flex-direction: column; max-height: calc(100vh - 160px); gap: 14px; }
.draft-right-col > .card {
  flex-shrink: 1;
  min-height: 180px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: rgba(15,22,36,.7) !important;
  border: 1px solid rgba(110,130,180,.18) !important;
  border-radius: 12px !important;
}
.draft-right-col > .card > .card-body { overflow-y: auto; flex: 1; min-height: 0; }
.draft-right-col .card-header {
  background: rgba(20,28,45,.55) !important;
  border-bottom: 1px solid rgba(110,130,180,.12) !important;
  padding: 11px 14px !important;
  color: #dde4f1;
}
.draft-right-col .card-header h5 { color: #f0f4fc; font-size: .88rem; font-weight: 800; letter-spacing: -.005em; }
.draft-right-col .card-header .badge {
  background: rgba(110,130,180,.16) !important;
  color: #b6c0d3 !important;
  font-size: .66rem !important;
  font-weight: 700 !important;
  padding: 3px 8px !important;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 0;
}

/* Tables inside right-col cards */
.draft-right-col table { color: #dde4f1; margin: 0; }
.draft-right-col table thead th {
  font-size: .56rem !important;
  font-weight: 800 !important;
  letter-spacing: .14em !important;
  color: #6c7892 !important;
  background: rgba(11,16,28,.75) !important;
  padding: 8px 10px !important;
  border-bottom: 1px solid rgba(110,130,180,.18) !important;
  text-transform: uppercase;
}
.draft-right-col table tbody td {
  padding: 6px 10px !important;
  border-bottom: 1px solid rgba(110,130,180,.06) !important;
  font-size: .76rem;
  color: #dde4f1;
  vertical-align: middle;
}
.draft-right-col table tbody tr { transition: background .14s; }
.draft-right-col table tbody tr:hover { background: rgba(58,125,196,.05); }
.draft-pick-row-mine td { background: rgba(58,125,196,.08); color: #a8c8ed !important; }
.draft-pick-row-mine .player-name { color: #a8c8ed !important; }
.draft-auto-tag { color: #6c7892; font-size: .62rem; letter-spacing: .02em; }
.draft-pass-tag { color: #f0d27a; font-weight: 800; font-size: .68rem; letter-spacing: .12em; }

/* Your-team grouping section */
.draft-yt-section {
  font-size: .56rem;
  font-weight: 800;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: #6c7892;
  background: rgba(11,16,28,.6);
  padding: 6px 12px;
  border-left: 2px solid rgba(110,130,180,.3);
}
.draft-yt-section.def { color: #7ec0d3; border-left-color: rgba(61,138,156,.5); }
.draft-yt-section.mid { color: #82b3e4; border-left-color: rgba(58,125,196,.45); }
.draft-yt-section.ruc { color: #b39ed4; border-left-color: rgba(138,109,184,.5); }
.draft-yt-section.fwd { color: #e07a6c; border-left-color: rgba(184,90,74,.45); }

/* Chat — wider re-skin */
.draft-chat-card { flex-shrink: 0; flex-grow: 0; min-height: auto !important; }
.draft-chat-card #chat-messages { max-height: 180px; }
.chat-msg { padding: 5px 12px; font-size: .76rem; border-bottom: 1px solid rgba(110,130,180,.06); }
.chat-msg:last-child { border-bottom: none; }
.chat-msg-name { font-weight: 800; font-size: .68rem; margin-right: 6px; letter-spacing: .02em; }
.chat-msg-text { color: #dde4f1; word-break: break-word; }
.chat-msg-system { text-align: center; font-size: .66rem; color: #6c7892; font-style: italic; padding: 4px 12px; }
.chat-toggle-collapsed { transform: rotate(-90deg); }

/* Mobile */
@media (max-width: 991.98px) {
  .draft-banner { flex-direction: column; gap: 10px; text-align: center; padding: 14px !important; }
  .draft-banner .draft-pick-badge { width: 40px !important; height: 40px !important; font-size: .9rem !important; }
  .draft-timer { font-size: 1.7rem !important; }
  .draft-event { flex-direction: column; align-items: stretch; text-align: center; }
  .draft-avail-tbl th:nth-child(3), .draft-avail-tbl td:nth-child(3) { display: none; }
  .draft-avail-tbl th:nth-child(6), .draft-avail-tbl td:nth-child(6) { display: none; }
  .draft-right-col { max-height: none; padding-bottom: 80px; }
  .col-lg-5 > .card, .col-lg-7 > .card { max-height: 50vh !important; }
  .draft-chat-card { max-height: none !important; }
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

function ratingTier(r: number | null): string {
  if (r == null) return 'tier-empty'
  if (r >= 80) return 'tier-elite'
  if (r >= 70) return 'tier-good'
  if (r >= 60) return 'tier-ok'
  return 'tier-low'
}

function potentialTier(p: number | null): string {
  if (p == null) return 'tier-empty'
  if (p >= 80) return 'tier-elite'
  if (p >= 70) return 'tier-good'
  if (p >= 60) return 'tier-ok'
  return 'tier-low'
}

export function DraftRoomPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<DraftRoomData | null>(null)
  const [emptyState, setEmptyState] = useState<DraftEmptyState | null>(null)
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

  // Pre-draft queue (preselected picks) + wishlist board
  const [queue, setQueue] = useState<{ player_id: number; player_name: string | null; priority: number }[]>([])
  const [boardTab, setBoardTab] = useState<'queue' | 'wishlist'>('queue')
  const wishlist = useWishlist(leagueId)
  const queuedIds = useMemo(() => new Set(queue.map(q => q.player_id)), [queue])

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
    api<DraftRoomResponse>(`/leagues/${leagueId}/draft?format=json`)
      .then(d => {
        if ('empty_state' in d) {
          // Per #35: no upcoming draft. Surface a stub state via setEmptyState
          // and skip the data wiring — the render path will branch.
          setEmptyState(d)
          return
        }
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

  // Pre-draft queue
  const fetchQueue = useCallback(() => {
    if (!data?.user_team) return
    fetch(`/leagues/${leagueId}/draft/api/queue`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(q => setQueue(Array.isArray(q) ? q : []))
      .catch(() => {})
  }, [leagueId, data?.user_team])

  const addToQueue = useCallback((playerId: number) => {
    fetch(`/leagues/${leagueId}/draft/api/queue`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }), credentials: 'same-origin',
    }).then(() => fetchQueue()).catch(() => {})
  }, [leagueId, fetchQueue])

  const removeFromQueue = useCallback((playerId: number) => {
    fetch(`/leagues/${leagueId}/draft/api/queue`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }), credentials: 'same-origin',
    }).then(() => fetchQueue()).catch(() => {})
  }, [leagueId, fetchQueue])

  useEffect(() => { if (data) fetchAvailable() }, [data, fetchAvailable])
  useEffect(() => { if (data) { fetchPositionNeeds(); fetchYourTeamPicks(); fetchQueue() } }, [data, fetchPositionNeeds, fetchYourTeamPicks, fetchQueue])

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
        fetchQueue()
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

  if (loading) return <DraftSkeleton />
  if (emptyState) {
    // Per #35: render a prep-friendly empty state instead of redirecting
    // away when no draft is scheduled. Browsing the pool + setting up
    // the draft are both accessible from here.
    return (
      <div>
        <div className="empty-state">
          <div className="empty-icon"><i className="bi bi-list-check"></i></div>
          <h4>No draft scheduled yet</h4>
          <p>
            {emptyState.is_commissioner
              ? "Set up a draft session to get everyone in the room. While you wait, you can plan your picks in the player pool."
              : "Your commissioner hasn't scheduled the next draft. You can still browse the player pool and plan your picks."}
          </p>
          <div className="d-flex justify-content-center gap-2 flex-wrap">
            <Link to={`/leagues/${leagueId}/player-pool`} className="btn btn-primary btn-sm">
              <i className="bi bi-search me-1"></i>Browse player pool
            </Link>
            {emptyState.is_commissioner && (
              <Link to={`/leagues/${leagueId}/draft/setup`} className="btn btn-outline-primary btn-sm">
                <i className="bi bi-calendar-plus me-1"></i>Set up draft
              </Link>
            )}
            <Link to={`/leagues/${leagueId}/player-ratings`} className="btn btn-outline-secondary btn-sm">
              <i className="bi bi-star me-1"></i>Player ratings
            </Link>
          </div>
        </div>
      </div>
    )
  }
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
              <span className={`conn-dot${connState === 'connected' ? '' : ' off'}`} title={connState === 'connected' ? 'Connected' : 'Disconnected'}></span>
              <span className={`status-pill status-${state.status.replace('_', '-')}`}>{state.status}</span>
              <span className="draft-header-info">
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
        <div className="draft-event">
          <div className="d-flex align-items-center gap-3">
            <div className="draft-pick-badge scheduled">
              <i className="bi bi-hourglass-split"></i>
            </div>
            <div>
              <div className="draft-banner-round">Draft Starts In</div>
              <div className={`draft-event-countdown${countdownLabel === 'Starting soon...' ? ' soon' : ''}`}>
                {countdownLabel}
              </div>
              {scheduledDisplay && <div className="draft-event-time">{scheduledDisplay}</div>}
            </div>
          </div>
          {is_commissioner && (
            <div className="d-flex align-items-center gap-2">
              <input
                type="datetime-local"
                className="draft-filter-input"
                value={scheduleInput}
                onChange={e => setScheduleInput(e.target.value)}
                style={{ width: 'auto' }}
              />
              <button className="btn btn-outline-warning btn-sm" onClick={updateSchedule} style={{ fontSize: '.7rem', whiteSpace: 'nowrap' }}>
                <i className="bi bi-clock me-1"></i>Set Time
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`draft-banner${bannerYourPick ? ' draft-banner-your-pick' : ''}${bannerCompleted ? ' draft-banner-complete' : ''}`}>
          <div className="d-flex align-items-center gap-3">
            <div className="draft-pick-badge">
              <span>{state.current_pick || '-'}</span>
            </div>
            <div>
              <div className="draft-banner-round">
                Round {state.current_round || '-'}
              </div>
              <div className="draft-banner-team">
                {bannerCompleted ? 'Draft Complete' : (state.current_team_name || 'TBD')}
                {bannerYourPick && <span className="draft-your-pick-pill">Your Pick</span>}
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
                    <button className="btn btn-outline-warning py-0 px-2" onClick={() => setShowPassModal(true)} disabled={!canPick} style={{ fontSize: '.7rem' }} title={canPick ? 'Pass on this pick' : 'You can pass when it’s your turn'}>
                      <i className="bi bi-skip-forward me-1"></i>Pass
                    </button>
                  )}
                  <button className="btn btn-outline-secondary py-0 px-2" type="button" onClick={() => setWeightsOpen(o => !o)} style={{ fontSize: '.7rem' }} title="Adjust your draft value weights">
                    <i className="bi bi-sliders me-1"></i>Values
                  </button>
                </div>
              </div>

              {weightsOpen && (
                <div className="draft-values-panel">
                  {WEIGHT_KEYS.map(({ key, label }) => (
                    <div key={key} className="draft-values-row">
                      <span className="draft-values-label">{label}</span>
                      <input
                        type="range"
                        className="draft-slider"
                        min={0}
                        max={1}
                        step={0.01}
                        value={weights[key] ?? 0.2}
                        onChange={e => onWeightChange(key, parseFloat(e.target.value))}
                      />
                      <span className="draft-values-value">{Math.round((weights[key] ?? 0.2) * 100)}%</span>
                    </div>
                  ))}
                  <div className="draft-values-foot">
                    <span className="draft-values-foot-meta">
                      {hasCustomWeights ? <span className="custom">Custom</span> : 'League defaults'}
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
                    const cls = isBlocked ? 'blocked' : need > 0 ? 'short' : 'met'
                    return (
                      <span key={pos} className={`draft-need-chip ${cls}`} title={isBlocked ? 'BLOCKED' : need > 0 ? `${need} more needed` : 'Requirement met'}>
                        {pos} {drafted}/{required}{isBlocked && <i className="bi bi-lock-fill" style={{ fontSize: '.6rem' }}></i>}
                      </span>
                    )
                  })}
                  <span className="draft-need-chip north" title="North Melbourne players drafted">
                    NM {positionNeeds.north_count ?? 0}
                  </span>
                </div>
              )}

              <div className="row g-2">
                <div className="col">
                  <input type="text" className="draft-filter-input w-100" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="col-auto">
                  <select className="draft-filter-select" value={posFilter} onChange={e => setPosFilter(e.target.value)} style={{ width: 'auto' }}>
                    <option value="">All Pos</option>
                    <option value="DEF">DEF</option>
                    <option value="MID">MID</option>
                    <option value="FWD">FWD</option>
                    <option value="RUC">RUC</option>
                  </select>
                </div>
                <div className="col-auto">
                  <select className="draft-filter-select" value={ageFilter} onChange={e => setAgeFilter(e.target.value)} style={{ width: 'auto' }}>
                    <option value="">All Ages</option>
                    <option value="21">U21</option>
                    <option value="23">U23</option>
                    <option value="25">U25</option>
                    <option value="25-30">25-30</option>
                    <option value="30+">30+</option>
                  </select>
                </div>
                <div className="col-auto">
                  <select className="draft-filter-select" value={clubFilter} onChange={e => setClubFilter(e.target.value)} style={{ width: 'auto' }}>
                    <option value="">All Clubs</option>
                    {clubOptions.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="card-body p-0" style={{ overflowY: 'auto', overflowX: 'auto', maxHeight: '70vh' }}>
              <table className="table table-sm mb-0 draft-avail-tbl">
                <thead>
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
                      <tr key={p.id} className={blocked ? 'blocked' : undefined}>
                        <td className="player-name">{p.name}</td>
                        <td>{p.position && <span className={`draft-pos-chip ${posClass(p.position)}`}>{p.position.split('/')[0]}</span>}</td>
                        <td style={{ color: '#97a3ba' }}>{p.afl_team || ''}</td>
                        <td style={{ color: '#6c7892' }}>{p.age ?? '-'}</td>
                        <td className="stat-cell" style={{ color: '#b6c0d3' }}>{p.sc_avg != null ? p.sc_avg.toFixed(1) : '-'}</td>
                        <td className="stat-cell"><span className={`draft-stat-chip ${ratingTier(p.rating)}`}>{p.rating ?? '–'}</span></td>
                        <td className="stat-cell"><span className={`draft-stat-chip ${potentialTier(p.potential)}`}>{p.potential ?? '–'}</span></td>
                        <td className="stat-cell"><span className="draft-stat-chip draft-score">{p.draft_score != null ? p.draft_score.toFixed(1) : '–'}</span></td>
                        <td>
                          <div className="d-flex gap-1 justify-content-end align-items-center">
                            <button
                              className={`btn btn-sm py-0 px-2 ${queuedIds.has(p.id) ? 'btn-warning' : 'btn-outline-secondary'}`}
                              onClick={() => queuedIds.has(p.id) ? removeFromQueue(p.id) : addToQueue(p.id)}
                              title={queuedIds.has(p.id) ? 'Remove from your queue' : 'Add to your pre-draft queue'}
                              style={{ fontSize: '.7rem' }}
                            >
                              <i className={`bi ${queuedIds.has(p.id) ? 'bi-bookmark-check-fill' : 'bi-bookmark-plus'}`}></i>
                            </button>
                            <button
                              className="btn btn-outline-primary btn-sm py-0 px-2"
                              onClick={() => canPick && pickPlayer(p.id)}
                              disabled={!canPick}
                              title={blocked ? 'Position blocked — draft other positions first' : ''}
                              style={{ fontSize: '.7rem' }}
                            >
                              {blocked ? <i className="bi bi-lock-fill"></i> : 'Pick'}
                            </button>
                          </div>
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
            {/* Draft board — your pre-draft queue + wishlist */}
            {user_team && (() => {
              const wishlistAvail = available.filter(p => wishlist.ids.has(p.id))
              return (
                <div className="card" style={{ flexShrink: 0 }}>
                  <div className="card-header d-flex justify-content-between align-items-center">
                    <div className="btn-group btn-group-sm" role="group">
                      <button type="button" className={`btn btn-sm btn-outline-secondary${boardTab === 'queue' ? ' active' : ''}`} onClick={() => setBoardTab('queue')} style={{ fontSize: '.72rem', padding: '2px 10px' }}>
                        <i className="bi bi-bookmark-star me-1"></i>Queue{queue.length > 0 ? ` (${queue.length})` : ''}
                      </button>
                      <button type="button" className={`btn btn-sm btn-outline-secondary${boardTab === 'wishlist' ? ' active' : ''}`} onClick={() => setBoardTab('wishlist')} style={{ fontSize: '.72rem', padding: '2px 10px' }}>
                        <i className="bi bi-star me-1"></i>Wishlist{wishlistAvail.length > 0 ? ` (${wishlistAvail.length})` : ''}
                      </button>
                    </div>
                    {boardTab === 'queue' && queue.length > 0 && (
                      <span className="badge" style={{ background: '#21262d', color: '#8b949e', fontSize: '.68rem' }}>auto-pick order</span>
                    )}
                  </div>
                  <div className="card-body p-0" style={{ overflowY: 'auto', maxHeight: 240 }}>
                    {boardTab === 'queue' ? (
                      queue.length === 0 ? (
                        <div className="text-center" style={{ color: '#6c7892', fontSize: '.76rem', padding: '14px 16px', lineHeight: 1.5 }}>
                          Tap <i className="bi bi-bookmark-plus"></i> on players to line up your picks. When it's your turn just hit <strong>Pick</strong> here — and if your timer runs out, the top available player in this list is auto-drafted.
                        </div>
                      ) : (
                        <table className="table table-sm mb-0">
                          <tbody>
                            {queue.map((q, i) => (
                              <tr key={q.player_id}>
                                <td style={{ color: '#6c7892', width: 22 }}>{i + 1}</td>
                                <td className="player-name">{q.player_name}</td>
                                <td className="text-end" style={{ width: 96, whiteSpace: 'nowrap' }}>
                                  <button className="btn btn-outline-primary btn-sm py-0 px-2" disabled={!canPick} onClick={() => canPick && pickPlayer(q.player_id)} style={{ fontSize: '.68rem' }}>Pick</button>
                                  <button className="btn btn-link p-0 ms-2" onClick={() => removeFromQueue(q.player_id)} title="Remove" style={{ color: '#f85149', fontSize: '.8rem' }}><i className="bi bi-x-lg"></i></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    ) : (
                      wishlistAvail.length === 0 ? (
                        <div className="text-center" style={{ color: '#6c7892', fontSize: '.76rem', padding: '14px 16px', lineHeight: 1.5 }}>
                          Star players (★) anywhere in the app to build your wishlist — the available ones show here, ready to queue or draft.
                        </div>
                      ) : (
                        <table className="table table-sm mb-0">
                          <tbody>
                            {wishlistAvail.map(p => (
                              <tr key={p.id}>
                                <td className="player-name">{p.name}</td>
                                <td style={{ width: 48 }}>{p.position && <span className={`draft-pos-chip ${posClass(p.position)}`}>{p.position.split('/')[0]}</span>}</td>
                                <td className="text-end" style={{ width: 110, whiteSpace: 'nowrap' }}>
                                  <button className={`btn btn-sm py-0 px-2 ${queuedIds.has(p.id) ? 'btn-warning' : 'btn-outline-secondary'}`} onClick={() => queuedIds.has(p.id) ? removeFromQueue(p.id) : addToQueue(p.id)} title={queuedIds.has(p.id) ? 'Queued' : 'Add to queue'} style={{ fontSize: '.68rem' }}>
                                    <i className={`bi ${queuedIds.has(p.id) ? 'bi-bookmark-check-fill' : 'bi-bookmark-plus'}`}></i>
                                  </button>
                                  <button className="btn btn-outline-primary btn-sm py-0 px-2 ms-1" disabled={!canPick} onClick={() => canPick && pickPlayer(p.id)} style={{ fontSize: '.68rem' }}>Pick</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    )}
                  </div>
                </div>
              )
            })()}

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
                <table className="table table-sm mb-0">
                  <thead className="sticky-top">
                    <tr><th>#</th><th>Rd</th><th>Team</th><th>Player</th><th>Pos</th><th>AFL</th></tr>
                  </thead>
                  <tbody>
                    {visiblePickHistory.map(pick => {
                      const isMine = !!(user_team && pick.team_id === user_team.id)
                      return (
                        <tr key={pick.pick_number} className={isMine ? 'draft-pick-row-mine' : undefined}>
                          <td style={{ color: '#6c7892' }}>{pick.pick_number}</td>
                          <td style={{ color: '#6c7892' }}>{pick.round}</td>
                          <td>{pick.team_name}</td>
                          {pick.is_pass ? (
                            <><td><span className="draft-pass-tag">PASS</span></td><td></td><td></td></>
                          ) : (
                            <>
                              <td className="player-name">{pick.player_name}{pick.is_auto_pick && <span className="draft-auto-tag"> (auto)</span>}</td>
                              <td>{pick.player_position && <span className={`draft-pos-chip ${posClass(pick.player_position)}`}>{pick.player_position.split('/')[0]}</span>}</td>
                              <td style={{ color: '#97a3ba' }}>{pick.player_afl_team}</td>
                            </>
                          )}
                        </tr>
                      )
                    })}
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
                  {(() => {
                    const groups: Record<'DEF'|'MID'|'RUC'|'FWD'|'OTHER', PickHistoryEntry[]> = { DEF: [], MID: [], RUC: [], FWD: [], OTHER: [] }
                    yourTeamPicks.forEach(p => {
                      const k = (p.player_position || '').split('/')[0].toUpperCase()
                      if (k === 'DEF' || k === 'MID' || k === 'RUC' || k === 'FWD') groups[k].push(p)
                      else groups.OTHER.push(p)
                    })
                    return (['DEF','MID','RUC','FWD','OTHER'] as const).map(k => {
                      if (groups[k].length === 0) return null
                      const cls = k === 'OTHER' ? '' : k.toLowerCase()
                      return (
                        <div key={k}>
                          <div className={`draft-yt-section ${cls}`}>{k} · {groups[k].length}</div>
                          <table className="table table-sm mb-0">
                            <tbody>
                              {groups[k].map(p => (
                                <tr key={p.pick_number}>
                                  <td style={{ color: '#6c7892', width: 30 }}>{p.pick_number}</td>
                                  <td className="player-name">{p.player_name}</td>
                                  <td style={{ width: 50 }}>{p.player_position && <span className={`draft-pos-chip ${posClass(p.player_position)}`}>{p.player_position.split('/')[0]}</span>}</td>
                                  <td style={{ color: '#97a3ba', width: 60 }}>{p.player_afl_team}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })
                  })()}
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
                  <div style={{ borderTop: '1px solid rgba(110,130,180,.12)', padding: '8px 12px', display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      className="draft-filter-input flex-grow-1"
                      placeholder="Say something..."
                      maxLength={500}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendChat() } }}
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
