import { useParams, Link, useSearchParams } from 'react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface Team { id: number; name: string; logo_url: string | null }
interface GDFixture { id: number; home_team_id: number; away_team_id: number; home_score: number; away_score: number; status: string; home_team: Team; away_team: Team }
interface GDPlayer {
  name: string; position: string; afl_team: string; player_id: number
  score: number; is_captain: boolean; is_vice_captain: boolean
  is_emergency: boolean; is_dnp: boolean; is_live: boolean
  lineup_type: string; game_started: boolean; subbed_on: boolean; replaces: string | null
}
interface AflGame { game_id: number; home_team: string; away_team: string; status: string; home_score: number | null; away_score: number | null; scheduled_display: string | null; scheduled_start: string | null }
interface Projections { my_projected: number; opp_projected: number; my_win_pct: number; opp_win_pct: number }
interface RoundScoreEntry {
  total_score?: number
  players_played?: number
  players_total?: number
  has_captain?: boolean
  captain_played?: boolean
  has_vc?: boolean
  vc_played?: boolean
}
interface GamedayData {
  is_bye: boolean; afl_round: number; round_dates: string | null; first_bounce: string | null
  gameday_state: string; live_enabled: boolean; is_home: boolean
  fixture: GDFixture; my_team: Team; opp_team: Team
  my_players: GDPlayer[]; opp_players: GDPlayer[]
  my_score: number; opp_score: number; my_captain_bonus: number; opp_captain_bonus: number
  my_played: number; my_eligible: number; opp_played: number; opp_eligible: number
  projections: Projections | null
  round_fixtures: GDFixture[]; round_scores: Record<string, RoundScoreEntry>
  afl_games: AflGame[]; locked_player_ids: number[]
  teams_playing: string[]; afl_matchup_info: Record<string, string>
  team_logos: Record<string, string>; team_abbr: Record<string, string>
}

// All 450 lines of inline CSS from gameday.html
const GAMEDAY_CSS = `
.gameday-round-header { margin-bottom: 10px; }
.gameday-round-title { font-size: 1.4rem; font-weight: 800; letter-spacing: 1px; color: var(--kl-text-heading); }
.gameday-round-dates { color: var(--kl-text-secondary); font-size: .8rem; }
.gameday-state-badge { display: inline-flex; align-items: center; gap: 4px; font-size: .72rem; font-weight: 700; padding: 5px 12px; border-radius: 14px; text-transform: uppercase; letter-spacing: .5px; }
.badge-upcoming { background: rgba(31,111,235,.12); color: var(--kl-accent-blue); border: 1px solid rgba(31,111,235,.25); }
.badge-live { background: rgba(35,134,54,.15); color: #3fb950; border: 1px solid rgba(35,134,54,.3); }
.badge-final { background: var(--kl-bg-elevated); color: var(--kl-text-primary); }
.badge-bye { background: var(--kl-bg-elevated); color: var(--kl-text-secondary); }
.live-pulse-dot { display: inline-block; width: 7px; height: 7px; background: #3fb950; border-radius: 50%; animation: liveDotGlow 2s ease-in-out infinite; }
@keyframes liveDotGlow { 0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(63,185,80,.4); } 50% { opacity: .4; box-shadow: 0 0 10px rgba(63,185,80,.8), 0 0 20px rgba(63,185,80,.3); } }
.gameday-afl-bar { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 12px; padding: 10px 14px; background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 10px; }
.game-status-pill { display: inline-flex; align-items: center; gap: 6px; background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 16px; padding: 4px 10px; font-size: .72rem; text-decoration: none; color: inherit; }
.game-teams { color: var(--kl-text-primary); font-weight: 600; }
.game-afl-score { color: var(--kl-text-secondary); font-size: .7rem; font-variant-numeric: tabular-nums; }
.game-badge-live { font-size: .6rem; background: #238636; color: #fff; animation: pulse 2s infinite; }
.game-badge-ft { font-size: .6rem; background: #238636; color: #fff; }
.game-badge-sched { font-size: .6rem; background: var(--kl-bg-elevated); color: var(--kl-text-secondary); }
.kl-mini-bar { display: flex; gap: 6px; margin-bottom: 8px; padding: 10px 14px; background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 10px; }
.kl-mini-pill { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 4px; background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 10px; cursor: pointer; transition: border-color .15s, background .15s; text-align: center; }
.kl-mini-pill:hover { background: var(--kl-bg-elevated); border-color: var(--kl-border-light); }
.kl-mini-yours { border-color: var(--kl-accent-blue); }
.kl-mini-teams { font-weight: 600; font-size: .72rem; color: var(--kl-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.kl-mini-score { font-size: .68rem; color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; }
.gameday-hero { background: radial-gradient(ellipse at 50% 0%, rgba(22,27,34,.95) 0%, var(--kl-bg-card) 70%); border: 1px solid var(--kl-border); border-radius: 16px; padding: 0; margin-bottom: 4px; position: relative; overflow: hidden; }
.gameday-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 2; }
.hero-live { border-color: rgba(35,134,54,.35); animation: glowPulse 4s ease-in-out infinite; }
.hero-live::before { background: linear-gradient(90deg, #238636, #3fb950, #238636); background-size: 200% 100%; animation: heroShimmer 3s linear infinite; }
.hero-completed { border-color: rgba(139,148,158,.2); }
.hero-completed::before { background: linear-gradient(90deg, rgba(139,148,158,.3), rgba(139,148,158,.6), rgba(139,148,158,.3)); }
.hero-upcoming { border-color: rgba(31,111,235,.2); }
.hero-upcoming::before { background: linear-gradient(90deg, #1f6feb, #58a6ff, #1f6feb); background-size: 200% 100%; animation: heroShimmer 4s linear infinite; }
@keyframes heroShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes glowPulse { 0%, 100% { box-shadow: 0 0 20px rgba(35,134,54,.1); } 50% { box-shadow: 0 0 30px rgba(35,134,54,.15); } }
.hero-teams-row { display: flex; align-items: center; justify-content: center; padding: 20px 20px 0; gap: 0; }
.hero-team-block { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.hero-team-right { justify-content: flex-end; }
.hero-team-detail { min-width: 0; flex: 1; }
.hero-vs { font-size: .6rem; font-weight: 800; color: var(--kl-text-faint); letter-spacing: 2px; padding: 0 14px; opacity: .5; flex-shrink: 0; }
.hero-crest { display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 14px; font-weight: 800; font-size: 1rem; letter-spacing: .5px; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
.left-initial { background: linear-gradient(145deg, #0d3618, #238636, #3fb950); color: #fff; }
.right-initial { background: linear-gradient(145deg, #2d1060, #5a2d9e, #bc8cff); color: #fff; }
.hero-crest-img { width: 50px; height: 50px; border-radius: 14px; object-fit: cover; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,.4); border: 2px solid rgba(255,255,255,.08); }
.hero-team-name { color: var(--kl-text-heading); font-weight: 700; font-size: .88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.hero-team-meta { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.hero-players-count { font-size: .64rem; color: var(--kl-text-faint); font-weight: 500; font-variant-numeric: tabular-nums; }
.hero-cap-badges { display: flex; gap: 2px; }
.hero-role-badge { font-size: .5rem; padding: 1px 4px; border-radius: 3px; font-weight: 700; background: rgba(139,148,158,.12); color: #6e7681; line-height: 1.3; }
.hero-role-badge.role-active { background: rgba(63,185,80,.18); color: #3fb950; }
.hero-scores-area { display: flex; align-items: flex-start; justify-content: center; gap: 10px; padding: 18px 20px 16px; }
.hero-score-col { display: flex; flex-direction: column; align-items: center; min-width: 70px; }
.hero-big-score { font-size: 3.4rem; font-weight: 900; line-height: 1; color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; transition: color .4s, text-shadow .4s; }
.hero-big-score.score-winning { color: #3fb950; text-shadow: 0 0 28px rgba(63,185,80,.4), 0 0 56px rgba(63,185,80,.15); }
.hero-score-dash { font-size: 2.2rem; font-weight: 300; color: var(--kl-text-faint); line-height: 1; padding-top: 8px; opacity: .4; }
.captain-bonus { color: #d29922; font-size: .65rem; font-weight: 700; margin-top: 3px; white-space: nowrap; }
.hero-footer { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 20px 16px; border-top: 1px solid rgba(139,148,158,.06); }
.hero-margin-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 16px; border-radius: 8px; font-size: .72rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--kl-text-primary); background: rgba(139,148,158,.08); }
.hero-margin-chip i { font-size: .6rem; }
.hero-proj-row { display: flex; align-items: center; gap: 10px; }
.hero-proj-item { font-size: .66rem; color: var(--kl-text-faint); font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
.hero-proj-item b { font-weight: 700; color: var(--kl-text-secondary); }
.hero-proj-sep { width: 1px; height: 12px; background: rgba(139,148,158,.2); flex-shrink: 0; }
.hero-first-bounce { text-align: center; padding: 0 20px 12px; color: var(--kl-text-secondary); font-size: .8rem; }
.hero-breakdown-wrap { text-align: center; padding: 0 20px 14px; }
.hero-breakdown-link { display: inline-flex; align-items: center; gap: 4px; font-size: .72rem; font-weight: 600; color: var(--kl-accent-blue); text-decoration: none; padding: 5px 14px; border-radius: 8px; border: 1px solid rgba(88,166,255,.2); background: rgba(88,166,255,.06); transition: background .15s; }
.hero-breakdown-link:hover { background: rgba(88,166,255,.12); }
.gameday-player-card { background: var(--kl-bg-body); border: 1px solid var(--kl-bg-elevated); border-radius: 10px; overflow: hidden; }
.card-left-team { border-left: 3px solid var(--kl-accent-green); }
.card-right-team { border-left: 3px solid var(--kl-text-muted); }
.gameday-player-card-header { background: var(--kl-bg-card); padding: 10px 14px; font-weight: 600; font-size: .85rem; color: var(--kl-text-primary); border-bottom: 1px solid var(--kl-bg-elevated); display: flex; justify-content: space-between; align-items: center; }
.gameday-card-score { font-weight: 800; font-size: .95rem; color: var(--kl-text-heading); font-variant-numeric: tabular-nums; }
.gameday-player-list { max-height: 600px; overflow-y: auto; }
.gameday-player-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 14px; border-bottom: 1px solid var(--kl-bg-card); font-size: .8rem; transition: background .15s; }
.gameday-player-row:last-child { border-bottom: none; }
.gameday-player-row:hover { background: var(--kl-bg-card); }
.gameday-player-row:hover .gameday-player-name { color: var(--kl-accent-blue); }
.player-locked { opacity: 0.7; }
.gameday-player-info { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
.gameday-player-name { color: var(--kl-text-primary); white-space: nowrap; }
.gameday-player-meta { color: var(--kl-text-faint); font-size: .7rem; white-space: nowrap; }
.gameday-player-score { font-weight: 600; white-space: nowrap; color: var(--kl-text-primary); font-variant-numeric: tabular-nums; }
.gameday-live-dot { font-size: .35rem; color: #56d364; vertical-align: middle; margin-left: 3px; animation: pulse 2s infinite; }
.gameday-player-score.text-success { color: #56d364 !important; }
.gameday-team-logo { width: 16px; height: 16px; vertical-align: middle; margin-right: 2px; }
.gameday-pos-badge { padding: 1px 5px !important; font-size: .55rem !important; border-radius: 3px !important; line-height: 1.4; }
.gameday-badge-c { display: inline-block; background: var(--kl-accent-yellow); color: #000; font-size: .55rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-vc { display: inline-block; background: var(--kl-accent-blue); color: #000; font-size: .55rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-emg { display: inline-block; background: var(--kl-accent-red); color: #fff; font-size: .55rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-dnp { display: inline-block; background: var(--kl-text-faint); color: var(--kl-text-primary); font-size: .55rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.gameday-badge-emg-active { background: rgba(59,130,246,.18); color: #60a5fa; border: 1px solid rgba(59,130,246,.3); font-size: .55rem; font-weight: 800; padding: 1px 5px; border-radius: 3px; letter-spacing: .3px; margin-right: 3px; }
.gameday-sub-note { font-size: .62rem; color: #8b949e; font-style: italic; }
.player-dnp { opacity: 0.75; }
.player-dnp .gameday-player-name { color: #8b949e; }
.score-dnp { color: #6e7681 !important; }
.player-emergency-standby { opacity: 0.6; }
.player-emergency-standby .gameday-player-name { color: #d29922; }
.score-emg-standby { color: var(--kl-border) !important; }
.player-subbed-on { background: rgba(35,134,54,.08); }
.player-reserve { opacity: 0.5; }
.player-reserve .gameday-player-name { color: var(--kl-text-faint); }
.score-reserve { color: var(--kl-border) !important; }
.player-yet-to-play .gameday-player-score { color: var(--kl-text-muted); }
.score-ytp { color: var(--kl-text-muted) !important; }
@keyframes ytpPulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
.player-yet-to-play .gameday-player-score { animation: ytpPulse 2s ease-in-out infinite; }
.gameday-section-hdr { padding: 6px 14px; font-size: .65rem; font-weight: 700; color: var(--kl-text-secondary); text-transform: uppercase; letter-spacing: .5px; background: var(--kl-bg-card); border-bottom: 1px solid var(--kl-bg-elevated); border-left: 3px solid transparent; }
.section-field { border-left-color: var(--kl-accent-green); background: rgba(63,185,80,.04); }
.section-bench { border-left-color: var(--kl-accent-blue); }
.section-emergency { border-left-color: #d29922; color: #d29922; background: rgba(210,153,34,.06); }
.section-dnp { color: #f85149; }
.gameday-all-matchups { background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 12px; overflow: hidden; }
.gameday-matchups-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; font-size: .75rem; font-weight: 700; color: var(--kl-text-secondary); text-transform: uppercase; letter-spacing: .8px; background: var(--kl-bg-card); border-bottom: 1px solid var(--kl-border); }
.matchups-header-dates { font-size: .7rem; font-weight: 500; color: var(--kl-text-faint); text-transform: none; letter-spacing: normal; }
.gameday-matchups-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; padding: 14px; }
.gameday-matchup-card { display: block; text-decoration: none; color: inherit; cursor: pointer; background: var(--kl-bg-body); border: 1px solid var(--kl-bg-elevated); border-radius: 8px; padding: 12px 14px; position: relative; transition: transform .15s, border-color .15s, box-shadow .15s; }
.gameday-matchup-card:hover { transform: translateY(-2px); border-color: var(--kl-border-light); box-shadow: 0 4px 12px rgba(0,0,0,.3); }
.matchup-yours { border-color: var(--kl-accent-blue) !important; background: rgba(31,111,235,.04); }
.matchup-your-tag { position: absolute; top: -1px; right: 10px; font-size: .55rem; font-weight: 700; text-transform: uppercase; color: var(--kl-accent-blue); background: rgba(31,111,235,.15); padding: 2px 8px; border-radius: 0 0 6px 6px; letter-spacing: .3px; }
.matchup-team-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: .8rem; }
.matchup-team-name { color: var(--kl-text-primary); font-weight: 500; }
.matchup-winner { color: var(--kl-text-heading); font-weight: 700; }
.matchup-team-score { font-weight: 700; font-size: .85rem; color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 3px; }
.matchup-mini-bar { height: 4px; background: var(--kl-accent-red); border-radius: 2px; overflow: hidden; margin-top: 8px; opacity: 0.6; }
.matchup-mini-fill { height: 100%; background: var(--kl-accent-green); border-radius: 2px; transition: width .6s ease; }
.matchup-margin { font-size: .65rem; color: var(--kl-text-muted); text-align: center; margin-top: 4px; font-variant-numeric: tabular-nums; }
.score-flash { animation: scorePopIn 1.5s ease-out; }
@keyframes scorePopIn { 0% { transform: scale(1.15); color: var(--kl-accent-blue); text-shadow: 0 0 8px rgba(88,166,255,.5); } 40% { transform: scale(.97); } 100% { transform: scale(1); color: inherit; text-shadow: none; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.gd-mob-section-hdr { padding: 6px 10px; font-size: .68rem; font-weight: 700; color: #58a6ff; text-transform: uppercase; letter-spacing: .5px; background: rgba(88,166,255,.05); border-bottom: 1px solid rgba(48,54,61,.3); }
@media (max-width: 767.98px) {
  .hero-teams-row { padding: 14px 12px 0; }
  .hero-big-score { font-size: 2.4rem; min-width: 50px; }
  .hero-score-dash { font-size: 1.6rem; padding-top: 5px; }
  .hero-scores-area { padding: 14px 12px 12px; }
  .hero-team-name { font-size: .78rem; }
  .hero-crest { width: 40px; height: 40px; font-size: .85rem; border-radius: 11px; }
  .hero-crest-img { width: 40px; height: 40px; border-radius: 11px; }
  .hero-team-block { gap: 8px; }
  .hero-vs { padding: 0 8px; font-size: .55rem; }
  .hero-footer { padding: 10px 12px 14px; gap: 6px; }
  .hero-margin-chip { font-size: .65rem; padding: 4px 12px; }
  .gameday-player-row { padding: 6px 10px; font-size: .75rem; }
  .gameday-player-meta { display: none; }
  .gameday-round-title { font-size: 1.1rem; }
  .gameday-matchups-grid { grid-template-columns: 1fr; gap: 8px; padding: 10px; }
  .gameday-pos-badge { display: none !important; }
}
`

// Fixture data from the API (for matchup switching)
interface FixtureDetail {
  fixture_id: number
  home_score: number; away_score: number
  home_captain_bonus: number; away_captain_bonus: number
  home_players: GDPlayer[]; away_players: GDPlayer[]
  projections: { home_projected: number; away_projected: number; home_win_pct: number; away_win_pct: number } | null
}

export function GamedayPage() {
  const { leagueId } = useParams()
  const [searchParams] = useSearchParams()
  const urlFixtureId = searchParams.get('fixture')
  const urlRound = searchParams.get('round')
  const [data, setData] = useState<GamedayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewedFixtureId, setViewedFixtureId] = useState<number | null>(
    urlFixtureId ? Number(urlFixtureId) : null
  )
  const [cachedFixtures, setCachedFixtures] = useState<Record<number, FixtureDetail>>({})
  const [refreshing, setRefreshing] = useState(false)
  const [scoreFlash, setScoreFlash] = useState(false)
  const prevScores = useRef<{ left: number; right: number }>({ left: 0, right: 0 })

  const fetchData = useCallback(() => {
    const qs = urlRound ? `&round=${urlRound}` : ''
    api<GamedayData>(`/leagues/${leagueId}/gameday?format=json${qs}`)
      .then(d => {
        setData(d)
        // Set initial viewed fixture: URL param takes precedence, otherwise user's own
        if (!viewedFixtureId && d.fixture) setViewedFixtureId(d.fixture.id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, urlRound])

  // Fetch all fixture breakdowns (for switching between matchups)
  const fetchAllFixtures = useCallback(() => {
    if (!data) return
    api<{ fixtures: FixtureDetail[]; locked_player_ids: number[] }>(
      `/leagues/${leagueId}/gameday/api/fixtures?round=${data.afl_round}`
    ).then(d => {
      const cache: Record<number, FixtureDetail> = {}
      d.fixtures?.forEach(f => { cache[f.fixture_id] = f })
      setCachedFixtures(cache)
    }).catch(() => {})
  }, [leagueId, data?.afl_round])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Respond to URL fixture query param (e.g. user clicks a fixture row from FixturePage)
  useEffect(() => {
    if (urlFixtureId) setViewedFixtureId(Number(urlFixtureId))
  }, [urlFixtureId])

  // Auto-reload every 5min when live
  useEffect(() => {
    if (data?.gameday_state === 'live') {
      // removed: 5min auto-reload was destroying SPA state. fetchData() already runs every 60s.
      return undefined
    }
  }, [data?.gameday_state])

  // WebSocket live scoring — silent (no banner). Socket.IO handles reconnect
  // internally; we just sit quietly and keep cachedFixtures up to date.
  const socketRef = useRef<Socket | null>(null)
  const lastSeq = useRef(0)
  const shouldConnect = data?.gameday_state === 'live' && !!data?.live_enabled
  const afl_round = data?.afl_round

  useEffect(() => {
    if (!shouldConnect) return

    const socket = io('/matchups', {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_live', { league_id: Number(leagueId), afl_round })
      socket.emit('request_scores', { league_id: Number(leagueId), afl_round })
    })

    socket.on('score_update', (update: { fixtures?: FixtureDetail[]; seq?: number }) => {
      if (update.seq && update.seq <= lastSeq.current) return
      if (update.seq) lastSeq.current = update.seq

      if (update.fixtures) {
        setCachedFixtures(prev => {
          const next = { ...prev }
          update.fixtures!.forEach(f => { next[f.fixture_id] = f })
          return next
        })
      }
    })

    return () => { socket.disconnect(); socketRef.current = null }
  }, [leagueId, shouldConnect, afl_round])

  // Pre-fetch all fixture breakdowns once data is loaded
  const hasFetched = useRef(false)
  useEffect(() => {
    if (data && !hasFetched.current) {
      hasFetched.current = true
      fetchAllFixtures()
    }
  }, [data, fetchAllFixtures])

  const viewMatchup = useCallback((fixtureId: number) => {
    setViewedFixtureId(fixtureId)
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await api(`/leagues/${leagueId}/gameday/sync-scores`, { method: 'POST' }).catch(() => {})
      fetchData()
    } finally {
      setTimeout(() => setRefreshing(false), 1000)
    }
  }, [leagueId, fetchData])

  // 5min poll when upcoming — check if games went live
  useEffect(() => {
    if (data?.gameday_state !== 'upcoming') return
    const timer = setInterval(() => {
      api<{ game_statuses?: { status: string }[] }>(`/leagues/${leagueId}/gameday/api/fixtures?round=${data.afl_round}`)
        .then(_d => {
          // Live score updates handled by fetchData() interval
        }).catch(() => {})
    }, 300000)
    return () => clearInterval(timer)
  }, [data?.gameday_state, data?.afl_round, leagueId])

  if (loading) return <Spinner text="Loading gameday..." />
  if (!data) return <p className="text-danger">Failed to load gameday</p>

  // Helper: count players played/eligible from player array.
  // Mirrors the Jinja client-side _countPlayers (which counts field + bench scoring
  // types and uses game_started && (score > 0 || is_dnp) as the "played" test).
  // Only used when we have to derive counts ourselves (switched matchups with no
  // round_scores entry) — for own matchup we prefer the authoritative my_played/my_eligible.
  const teamsPlayingSet = new Set(data.teams_playing || [])
  function countPlayed(players: GDPlayer[]): { played: number; total: number } {
    const scoringTypes = new Set(['field', 'reserve'])
    const eligible = players.filter(p => scoringTypes.has(p.lineup_type) && (teamsPlayingSet.size === 0 || teamsPlayingSet.has(p.afl_team)))
    const played = eligible.filter(p => p.game_started && ((p.score || 0) > 0 || p.is_dnp)).length
    return { played, total: eligible.length }
  }

  // Helper: derive C/VC badge status from player array when no round_scores entry is available
  // (matches the Jinja client-side JS _capVcStatus: game_started && (score > 0 || is_dnp)).
  // When round_scores IS available, CapBadges prefers the authoritative played_set-derived value.
  function capVcStatus(players: GDPlayer[]): { hasCap: boolean; capPlayed: boolean; hasVc: boolean; vcPlayed: boolean } {
    let hasCap = false, capPlayed = false, hasVc = false, vcPlayed = false
    players.forEach(p => {
      const playedThisRound = p.game_started && ((p.score || 0) > 0 || p.is_dnp)
      if (p.is_captain) { hasCap = true; capPlayed = playedThisRound }
      if (p.is_vice_captain) { hasVc = true; vcPlayed = playedThisRound }
    })
    return { hasCap, capPlayed, hasVc, vcPlayed }
  }

  // CapBadges: prefer authoritative round_scores entry (from backend played_set) when supplied,
  // otherwise fall back to scanning the player array (used when viewing other matchups via cached fixture data).
  function CapBadges({ players, rs }: { players: GDPlayer[]; rs?: RoundScoreEntry }) {
    const s = rs && rs.has_captain !== undefined
      ? { hasCap: !!rs.has_captain, capPlayed: !!rs.captain_played, hasVc: !!rs.has_vc, vcPlayed: !!rs.vc_played }
      : capVcStatus(players)
    return (
      <span className="hero-cap-badges">
        {s.hasCap && <span className={`hero-role-badge${s.capPlayed ? ' role-active' : ''}`}>C</span>}
        {s.hasVc && <span className={`hero-role-badge${s.vcPlayed ? ' role-active' : ''}`}>VC</span>}
      </span>
    )
  }

  const d = data
  const gs = d.gameday_state
  const isViewingOwn = !viewedFixtureId || viewedFixtureId === d.fixture?.id

  // Determine what data to show in the hero/player cards
  let heroLeftName: string, heroRightName: string
  let heroLeftScore: number, heroRightScore: number
  let heroLeftCapBonus: number, heroRightCapBonus: number
  let heroLeftPlayers: GDPlayer[], heroRightPlayers: GDPlayer[]
  let heroLeftLogo: string | null, heroRightLogo: string | null
  let heroLeftRs: RoundScoreEntry | undefined, heroRightRs: RoundScoreEntry | undefined
  let heroLeftTeamId: number | undefined, heroRightTeamId: number | undefined
  // Projection in left/right orientation — must follow the viewed matchup, not d.projections.
  let heroProjLeft: number | null = null, heroProjRight: number | null = null
  let heroWinLeft: number | null = null, heroWinRight: number | null = null

  if (isViewingOwn || !cachedFixtures[viewedFixtureId!]) {
    // Viewing own matchup (default), or cache for the selected matchup hasn't loaded yet
    heroLeftName = d.my_team?.name || ''
    heroRightName = d.opp_team?.name || ''
    heroLeftScore = d.my_score
    heroRightScore = d.opp_score
    heroLeftCapBonus = d.my_captain_bonus
    heroRightCapBonus = d.opp_captain_bonus
    heroLeftPlayers = d.my_players || []
    heroRightPlayers = d.opp_players || []
    heroLeftLogo = d.my_team?.logo_url
    heroRightLogo = d.opp_team?.logo_url
    heroLeftTeamId = d.my_team?.id
    heroRightTeamId = d.opp_team?.id
    // Only show own projection if the user is actually viewing their own matchup.
    // If the cache for a different matchup is still loading, show no projection
    // rather than wrongly displaying the user's own numbers.
    if (isViewingOwn && d.projections) {
      heroProjLeft = d.projections.my_projected
      heroProjRight = d.projections.opp_projected
      heroWinLeft = d.projections.my_win_pct
      heroWinRight = d.projections.opp_win_pct
    }
  } else {
    // Viewing another matchup
    const fx = cachedFixtures[viewedFixtureId!]
    const meta = d.round_fixtures.find(f => f.id === viewedFixtureId)
    heroLeftName = meta?.home_team?.name || ''
    heroRightName = meta?.away_team?.name || ''
    heroLeftScore = fx.home_score || 0
    heroRightScore = fx.away_score || 0
    heroLeftCapBonus = fx.home_captain_bonus || 0
    heroRightCapBonus = fx.away_captain_bonus || 0
    heroLeftPlayers = fx.home_players || []
    heroRightPlayers = fx.away_players || []
    heroLeftLogo = meta?.home_team?.logo_url || null
    heroRightLogo = meta?.away_team?.logo_url || null
    heroLeftTeamId = meta?.home_team_id
    heroRightTeamId = meta?.away_team_id
    // fx.projections has home_/away_ semantics
    if (fx.projections) {
      heroProjLeft = fx.projections.home_projected
      heroProjRight = fx.projections.away_projected
      heroWinLeft = fx.projections.home_win_pct
      heroWinRight = fx.projections.away_win_pct
    }
  }

  // Authoritative round_scores entries (matches Jinja's round_scores.get(team.id))
  if (heroLeftTeamId != null) heroLeftRs = d.round_scores?.[String(heroLeftTeamId)]
  if (heroRightTeamId != null) heroRightRs = d.round_scores?.[String(heroRightTeamId)]

  const diff = Math.abs(Math.round(heroLeftScore - heroRightScore))

  // Score flash: detect when scores change
  if (heroLeftScore !== prevScores.current.left || heroRightScore !== prevScores.current.right) {
    if (prevScores.current.left !== 0 || prevScores.current.right !== 0) {
      // Not first render — trigger flash
      setTimeout(() => { setScoreFlash(true); setTimeout(() => setScoreFlash(false), 1500) }, 0)
    }
    prevScores.current = { left: heroLeftScore, right: heroRightScore }
  }

  function PlayerRow({ p }: { p: GDPlayer }) {
    const ytp = !p.game_started && gs === 'live'
    const isSubbedOn = p.subbed_on
    const isEmgStandby = p.is_emergency && !isSubbedOn
    const rowClass = [
      'gameday-player-row',
      p.player_id && d.locked_player_ids?.includes(p.player_id) && 'player-locked',
      p.is_dnp && 'player-dnp',
      isSubbedOn && 'player-subbed-on',
      p.lineup_type === 'reserve' && 'player-reserve',
      isEmgStandby && 'player-emergency-standby',
      ytp && 'player-yet-to-play',
    ].filter(Boolean).join(' ')

    const scoreClass = [
      'gameday-player-score',
      p.is_dnp && 'score-dnp',
      p.lineup_type === 'reserve' && 'score-reserve',
      isEmgStandby && 'score-emg-standby',
      ytp && 'score-ytp',
      p.is_live && !ytp && !isEmgStandby && 'text-success',
    ].filter(Boolean).join(' ')

    const isLocked = !!(p.player_id && d.locked_player_ids?.includes(p.player_id))
    return (
      <div className={rowClass}>
        <span className="gameday-player-info">
          {p.position && <span className={`pos-badge pos-${p.position.split('/')[0].toUpperCase()} gameday-pos-badge`}>{p.position.toUpperCase()}</span>}
          {p.is_captain && <span className="gameday-badge-c">C</span>}
          {p.is_vice_captain && <span className="gameday-badge-vc">VC</span>}
          {isSubbedOn && <span className="gameday-badge-emg-active">EMG</span>}
          {p.is_dnp && !isSubbedOn && <span className="gameday-badge-dnp">DNP</span>}
          {isEmgStandby && <span className="gameday-badge-emg">EMG</span>}
          {isLocked && <i className="bi bi-lock-fill" style={{ color: 'var(--kl-accent-red)', fontSize: '.6rem' }}></i>}
          <span className="gameday-player-name">{p.name}</span>
          <span className="gameday-player-meta">
            {p.afl_team && d.team_logos[p.afl_team]
              ? <img src={d.team_logos[p.afl_team]} alt={p.afl_team} title={p.afl_team} className="gameday-team-logo" />
              : p.afl_team}
            {d.afl_matchup_info[p.afl_team] && <span style={{ color: 'var(--kl-text-faint)', fontSize: '.65rem', marginLeft: 2 }}>{d.afl_matchup_info[p.afl_team]}</span>}
            {p.replaces && <span className="gameday-sub-note">&rarr; replacing {p.replaces}</span>}
          </span>
        </span>
        <span className={scoreClass}>
          {p.lineup_type === 'reserve' || isEmgStandby ? '–' : ytp ? <><i className="bi bi-clock" style={{ fontSize: '.65rem', marginRight: 2 }}></i>&mdash;</> : (p.score || 0)}
          {p.is_live && !ytp && !isEmgStandby && <i className="bi bi-circle-fill gameday-live-dot"></i>}
        </span>
      </div>
    )
  }

  function PlayerCard({ players, teamName, score, side }: { players: GDPlayer[]; teamName: string; score: number; side: 'left' | 'right' }) {
    // Has a game this round?
    const hasGame = (p: GDPlayer) => teamsPlayingSet.size === 0 || teamsPlayingSet.has(p.afl_team)

    // Field section: field players (not DNP) PLUS subbed-on emergencies — both must have a game
    const fieldStarters = players.filter(p => p.lineup_type === 'field' && !p.is_dnp && hasGame(p))
    const subbedOnEmgs = players.filter(p => p.lineup_type === 'emergency' && p.subbed_on && hasGame(p))
    const field = [...fieldStarters, ...subbedOnEmgs]
    // Bench: lineup_type 'reserve' (backend uses 'reserve', original Jinja used 'bench' which was a Jinja bug)
    const bench = players.filter(p => p.lineup_type === 'reserve' && hasGame(p))
    // Emergency standby: emergency players that are NOT subbed on
    const emgStandby = players.filter(p => p.lineup_type === 'emergency' && !p.subbed_on && hasGame(p))
    // DNPs
    const dnps = players.filter(p => p.is_dnp && hasGame(p))
    // No game this round (any lineup type whose AFL team has no game)
    const noGame = players.filter(p => !hasGame(p))

    return (
      <div className={`gameday-player-card card-${side}-team`}>
        <div className="gameday-player-card-header">
          <span>{teamName}</span>
          <span className="gameday-card-score">{gs !== 'upcoming' ? Math.round(score) : ''}</span>
        </div>
        <div className="gameday-player-list">
          <div className="gameday-section-hdr section-field"><i className="bi bi-people-fill me-1"></i>Field</div>
          {field.map((p, i) => <PlayerRow key={i} p={p} />)}
          {bench.length > 0 && <>
            <div className="gameday-section-hdr section-bench"><i className="bi bi-arrow-left-right me-1"></i>Bench</div>
            {bench.map((p, i) => <PlayerRow key={`b${i}`} p={p} />)}
          </>}
          {emgStandby.length > 0 && <>
            <div className="gameday-section-hdr section-emergency"><i className="bi bi-shield-exclamation me-1"></i>Emergency</div>
            {emgStandby.map((p, i) => <PlayerRow key={`e${i}`} p={p} />)}
          </>}
          {dnps.length > 0 && <>
            <div className="gameday-section-hdr section-dnp"><i className="bi bi-x-circle me-1"></i>Did Not Play</div>
            {dnps.map((p, i) => <PlayerRow key={`d${i}`} p={p} />)}
          </>}
          {noGame.length > 0 && <>
            <div className="gameday-section-hdr" style={{ color: 'var(--kl-text-secondary)' }}>
              <i className="bi bi-calendar-x me-1"></i>No Game This Round
            </div>
            {noGame.map((p, i) => <PlayerRow key={`ng${i}`} p={p} />)}
          </>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <style>{GAMEDAY_CSS}</style>

      {/* Competition toggle */}
      <div className="comp-toggle">
        <span className="comp-toggle-btn" style={{ borderColor: 'rgba(88,166,255,.3)', color: '#58a6ff', background: 'rgba(88,166,255,.08)', borderRadius: '8px 0 0 8px' }}>Main</span>
        <Link to={`/leagues/${leagueId}/reserve7s/gameday`} className="comp-toggle-btn text-decoration-none" style={{ borderColor: '#30363d', color: '#8b949e', borderRadius: '0 8px 8px 0', borderLeft: 0 }}>7s</Link>
      </div>

      {/* Round header */}
      <div className="gameday-round-header">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="gameday-round-title mb-0">{d.afl_round === 0 ? 'PRE-SEASON' : `ROUND ${d.afl_round}`}</h2>
          <div className="d-flex align-items-center gap-2">
            {gs === 'live' && <span className="gameday-state-badge badge-live"><i className="bi bi-broadcast me-1"></i><span className="live-pulse-dot"></span> LIVE</span>}
            {gs === 'completed' && <span className="gameday-state-badge badge-final"><i className="bi bi-check-circle-fill me-1"></i>FINAL</span>}
            {gs === 'upcoming' && <span className="gameday-state-badge badge-upcoming"><i className="bi bi-calendar-event me-1"></i>UPCOMING</span>}
            <button className="btn btn-sm" onClick={handleRefresh} disabled={refreshing}
              style={{ background: 'rgba(88,166,255,.1)', color: '#58a6ff', border: '1px solid rgba(88,166,255,.25)', fontSize: '.7rem', padding: '3px 10px', borderRadius: 6 }}>
              {refreshing ? <span className="spinner-border spinner-border-sm" style={{ width: 12, height: 12 }}></span> : <i className="bi bi-arrow-clockwise"></i>}
            </button>
          </div>
        </div>
        {d.round_dates && <div className="gameday-round-dates mt-1">{d.round_dates}</div>}
      </div>

      {/* AFL game pills */}
      {d.afl_games && d.afl_games.length > 0 && (
        <div className="gameday-afl-bar d-none d-lg-flex">
          {d.afl_games.map(g => (
            <Link key={g.game_id} to={`/leagues/${leagueId}/gameday/afl-game/${g.game_id}`} className="game-status-pill">
              <span className="game-teams">{d.team_abbr[g.home_team] || g.home_team.substring(0, 3).toUpperCase()} v {d.team_abbr[g.away_team] || g.away_team.substring(0, 3).toUpperCase()}</span>
              {g.status === 'live' && <span className="badge game-badge-live">LIVE</span>}
              {g.status === 'complete' && <span className="badge game-badge-ft">FT</span>}
              {g.status !== 'live' && g.status !== 'complete' && (
                <span className="badge game-badge-sched">
                  {g.scheduled_display || (g.scheduled_start ? g.scheduled_start.substring(11, 16) : 'TBC')}
                </span>
              )}
              {g.home_score != null && <span className="game-afl-score">{g.home_score}-{g.away_score}</span>}
            </Link>
          ))}
        </div>
      )}

      {/* KL mini bar */}
      {d.round_fixtures && d.round_fixtures.length > 0 && (
        <div className="kl-mini-bar">
          {d.round_fixtures.map(f => {
            // Prefer live-updated fixture detail (WebSocket score_update writes here),
            // fall back to round_scores from the initial gameday payload.
            const cached = cachedFixtures[f.id]
            const hs = cached?.home_score ?? d.round_scores[String(f.home_team_id)]?.total_score ?? 0
            const as_ = cached?.away_score ?? d.round_scores[String(f.away_team_id)]?.total_score ?? 0
            const isYours = d.my_team && (f.home_team_id === d.my_team.id || f.away_team_id === d.my_team.id)
            return (
              <div key={f.id} className={`kl-mini-pill${isYours ? ' kl-mini-yours' : ''}`}
                onClick={() => viewMatchup(f.id)}
                style={{ cursor: 'pointer', ...(viewedFixtureId === f.id ? { borderColor: 'var(--kl-accent-blue)', boxShadow: '0 0 0 1px var(--kl-accent-blue)' } : {}) }}>
                <span className="kl-mini-teams">{f.home_team?.name} v {f.away_team?.name}</span>
                {f.status !== 'scheduled' && <span className="kl-mini-score">{Math.round(hs)}-{Math.round(as_)}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* BYE */}
      {d.is_bye ? (
        <div className="gameday-hero hero-upcoming" style={{ textAlign: 'center' }}>
          <span className="gameday-state-badge badge-bye" style={{ marginBottom: 12 }}><i className="bi bi-dash-circle me-1"></i>BYE</span>
          <p style={{ color: 'var(--kl-text-primary)', fontSize: '.95rem', marginBottom: 6 }}>You have a bye this round.</p>
          <p style={{ color: 'var(--kl-text-faint)', fontSize: '.85rem', marginBottom: 0 }}>Click any matchup below to view it.</p>
        </div>
      ) : (
        <>
          {/* Hero card */}
          <div className={`gameday-hero hero-${gs}`}>
            <div className="hero-teams-row">
              <div className="hero-team-block hero-team-left">
                {heroLeftLogo ? <img src={heroLeftLogo} alt="" className="hero-crest-img" />
                  : <span className="hero-crest left-initial">{heroLeftName.substring(0, 2).toUpperCase()}</span>}
                <div className="hero-team-detail">
                  <div className="hero-team-name">{heroLeftName}</div>
                  <div className="hero-team-meta">
                    {(() => {
                      const rs = heroLeftRs
                      const total = rs?.players_total ?? countPlayed(heroLeftPlayers).total
                      const played = rs?.players_played ?? countPlayed(heroLeftPlayers).played
                      return total > 0 ? <span className="hero-players-count">{played}/{total} played</span> : null
                    })()}
                    <CapBadges players={heroLeftPlayers} rs={heroLeftRs} />
                  </div>
                </div>
              </div>
              <span className="hero-vs">VS</span>
              <div className="hero-team-block hero-team-right">
                <div className="hero-team-detail" style={{ textAlign: 'right' }}>
                  <div className="hero-team-name">{heroRightName}</div>
                  <div className="hero-team-meta" style={{ justifyContent: 'flex-end' }}>
                    <CapBadges players={heroRightPlayers} rs={heroRightRs} />
                    {(() => {
                      const rs = heroRightRs
                      const total = rs?.players_total ?? countPlayed(heroRightPlayers).total
                      const played = rs?.players_played ?? countPlayed(heroRightPlayers).played
                      return total > 0 ? <span className="hero-players-count">{played}/{total} played</span> : null
                    })()}
                  </div>
                </div>
                {heroRightLogo ? <img src={heroRightLogo} alt="" className="hero-crest-img" />
                  : <span className="hero-crest right-initial">{heroRightName.substring(0, 2).toUpperCase()}</span>}
              </div>
            </div>

            <div className="hero-scores-area">
              <div className="hero-score-col">
                <span className={`hero-big-score${heroLeftScore > heroRightScore ? ' score-winning' : ''}${scoreFlash ? ' score-flash' : ''}`}>{Math.round(heroLeftScore)}</span>
                {heroLeftCapBonus > 0 && <span className="captain-bonus">+{Math.round(heroLeftCapBonus)} C</span>}
              </div>
              <span className="hero-score-dash">&ndash;</span>
              <div className="hero-score-col">
                <span className={`hero-big-score${heroRightScore > heroLeftScore ? ' score-winning' : ''}${scoreFlash ? ' score-flash' : ''}`}>{Math.round(heroRightScore)}</span>
                {heroRightCapBonus > 0 && <span className="captain-bonus">+{Math.round(heroRightCapBonus)} C</span>}
              </div>
            </div>

            <div className="hero-footer">
              <div className="hero-margin-chip">
                {isViewingOwn && gs === 'completed' ? (
                  heroLeftScore > heroRightScore ? <><i className="bi bi-trophy-fill"></i> WON BY {diff}</> :
                  heroRightScore > heroLeftScore ? <>LOST BY {diff}</> : 'DRAW'
                ) : isViewingOwn ? (
                  heroLeftScore > heroRightScore ? <><i className="bi bi-caret-up-fill"></i> UP {diff}</> :
                  heroRightScore > heroLeftScore ? <><i className="bi bi-caret-down-fill"></i> DOWN {diff}</> : 'TIED'
                ) : (
                  heroLeftScore > heroRightScore ? <>{heroLeftName} BY {diff}</> :
                  heroRightScore > heroLeftScore ? <>{heroRightName} BY {diff}</> : 'DRAW'
                )}
              </div>
              {heroProjLeft != null && heroProjRight != null && gs !== 'completed' && (
                <div className="hero-proj-row">
                  <span className="hero-proj-item">Proj <b>{Math.round(heroProjLeft)}</b>&ndash;<b>{Math.round(heroProjRight)}</b></span>
                  <span className="hero-proj-sep"></span>
                  <span className="hero-proj-item">Win <b>{Math.round(heroWinLeft || 0)}%</b>&ndash;<b>{Math.round(heroWinRight || 0)}%</b></span>
                </div>
              )}
            </div>

            {gs === 'upcoming' && d.first_bounce && (
              <div className="hero-first-bounce"><i className="bi bi-clock me-1"></i>First bounce {d.first_bounce}</div>
            )}

            {gs === 'completed' && d.fixture && (
              <div className="hero-breakdown-wrap">
                <Link to={`/leagues/${leagueId}/matchup/${d.fixture.id}`} className="hero-breakdown-link">
                  <i className="bi bi-bar-chart-line me-1"></i>Full Breakdown
                </Link>
              </div>
            )}
          </div>

          {/* Mobile side-by-side view */}
          <div className="d-lg-none mt-3 gd-mob-vs">
            <div className="gd-mob-vs-header">
              <span className="gd-mob-vs-team">{heroLeftName}</span>
              <span className="gd-mob-vs-scores">
                <span className={`gd-mob-vs-sc${heroLeftScore > heroRightScore ? ' gd-mob-sc-win' : ''}`}>{Math.round(heroLeftScore)}</span>
                <span style={{ color: '#484f58', fontSize: '.7rem' }}>v</span>
                <span className={`gd-mob-vs-sc${heroRightScore > heroLeftScore ? ' gd-mob-sc-win' : ''}`}>{Math.round(heroRightScore)}</span>
              </span>
              <span className="gd-mob-vs-team" style={{ textAlign: 'right' }}>{heroRightName}</span>
            </div>
            <div className="gd-mob-section-hdr"><i className="bi bi-people-fill me-1"></i>Field</div>
            {(() => {
              // Field = field starters (not DNP) + subbed-on emergencies (matches Jinja lines 247-253)
              const buildField = (players: GDPlayer[]) => [
                ...players.filter(p => p.lineup_type === 'field' && !p.is_dnp),
                ...players.filter(p => p.lineup_type === 'emergency' && p.subbed_on),
              ]
              const lp = buildField(heroLeftPlayers)
              const rp = buildField(heroRightPlayers)
              const maxLen = Math.max(lp.length, rp.length)
              return Array.from({ length: maxLen }).map((_, i) => {
                const mp = lp[i]
                const op = rp[i]
                return (
                  <div key={i} className="gd-mob-vs-row">
                    <div className="gd-mob-vs-left">
                      {mp && <>
                        <span className="gd-mob-vs-name">
                          {mp.is_captain && <b className="gd-mob-c">C</b>}
                          {mp.is_vice_captain && <b className="gd-mob-vc">VC</b>}
                          {mp.subbed_on && <span className="gameday-badge-emg-active" style={{ fontSize: '.5rem', padding: '0 3px' }}>EMG</span>}
                          {mp.name}
                        </span>
                        <span className={`gd-mob-vs-pos pos-badge pos-${(mp.position || 'MID').split('/')[0].toUpperCase()}`}>{(mp.position || 'MID').split('/')[0].substring(0, 3).toUpperCase()}</span>
                      </>}
                    </div>
                    <div className="gd-mob-vs-mid">
                      <span className={`gd-mob-sc-l${mp?.is_live ? ' text-success' : ''}`}>
                        {mp ? (mp.score || 0) : '-'}
                        {mp?.is_live && <i className="bi bi-circle-fill gameday-live-dot"></i>}
                      </span>
                      <span className={`gd-mob-sc-r${op?.is_live ? ' text-success' : ''}`}>
                        {op ? (op.score || 0) : '-'}
                        {op?.is_live && <i className="bi bi-circle-fill gameday-live-dot"></i>}
                      </span>
                    </div>
                    <div className="gd-mob-vs-right">
                      {op && <>
                        <span className={`gd-mob-vs-pos pos-badge pos-${(op.position || 'MID').split('/')[0].toUpperCase()}`}>{(op.position || 'MID').split('/')[0].substring(0, 3).toUpperCase()}</span>
                        <span className="gd-mob-vs-name">
                          {op.is_captain && <b className="gd-mob-c">C</b>}
                          {op.is_vice_captain && <b className="gd-mob-vc">VC</b>}
                          {op.subbed_on && <span className="gameday-badge-emg-active" style={{ fontSize: '.5rem', padding: '0 3px' }}>EMG</span>}
                          {op.name}
                        </span>
                      </>}
                    </div>
                  </div>
                )
              })
            })()}
          </div>

          {/* Player cards - desktop */}
          <div className="row g-3 mt-2 d-none d-lg-flex">
            <div className="col-md-6">
              <PlayerCard players={heroLeftPlayers} teamName={heroLeftName} score={heroLeftScore} side="left" />
            </div>
            <div className="col-md-6">
              <PlayerCard players={heroRightPlayers} teamName={heroRightName} score={heroRightScore} side="right" />
            </div>
          </div>

          {/* Mobile player list */}
          <div className="d-lg-none mt-3">
            <PlayerCard players={heroLeftPlayers} teamName={heroLeftName} score={heroLeftScore} side="left" />
            <div className="mt-2">
              <PlayerCard players={heroRightPlayers} teamName={heroRightName} score={heroRightScore} side="right" />
            </div>
          </div>
        </>
      )}

      {/* Footer — live status + fixture link */}
      <div className="mt-3 d-flex align-items-center justify-content-between" style={{ fontSize: '.75rem', color: 'var(--kl-text-faint)' }}>
        <span>
          {gs === 'live' ? (
            <><i className="bi bi-broadcast me-1" style={{ color: 'var(--kl-accent-green)' }}></i>Live updates via WebSocket</>
          ) : gs === 'completed' ? (
            'Final results'
          ) : (
            <>&nbsp;</>
          )}
        </span>
        <Link to={`/leagues/${leagueId}/fixture`} style={{ color: 'var(--kl-text-secondary)', textDecoration: 'none', fontSize: '.7rem' }}>
          Season Fixture &rarr;
        </Link>
      </div>

      {/* All matchups grid — hidden (matching original template display:none) */}
      <div className="gameday-all-matchups mt-4" style={{ display: 'none' }}>
        <div className="gameday-matchups-header">
          <span><i className="bi bi-grid-3x2-gap me-2"></i>ROUND {d.afl_round} MATCHUPS</span>
          {d.round_dates && <span className="matchups-header-dates">{d.round_dates}</span>}
        </div>
        <div className="gameday-matchups-grid">
          {(d.round_fixtures || []).map(f => {
            const hs = d.round_scores[String(f.home_team_id)]?.total_score || f.home_score || 0
            const as_ = d.round_scores[String(f.away_team_id)]?.total_score || f.away_score || 0
            const isYours = d.my_team && (f.home_team_id === d.my_team.id || f.away_team_id === d.my_team.id)
            const homeWon = hs > as_ && f.status !== 'scheduled'
            const awayWon = as_ > hs && f.status !== 'scheduled'
            const total = hs + as_ || 1
            return (
              <div key={f.id} className={`gameday-matchup-card${isYours ? ' matchup-yours' : ''}${viewedFixtureId === f.id ? ' matchup-active' : ''}${isYours && viewedFixtureId !== f.id ? ' matchup-yours-dimmed' : ''}`}
                onClick={() => viewMatchup(f.id)} style={{ cursor: 'pointer' }}>
                {isYours && <span className="matchup-your-tag">Your Match</span>}
                <div className="matchup-team-row">
                  <span className={`matchup-team-name${homeWon ? ' matchup-winner' : ''}`}>{f.home_team?.name}</span>
                  <span className="matchup-team-score">
                    {f.status !== 'scheduled' && Math.round(hs)}
                    {homeWon && <i className="bi bi-check-lg" style={{ color: 'var(--kl-accent-green)', fontSize: '.7rem' }}></i>}
                  </span>
                </div>
                <div className="matchup-team-row">
                  <span className={`matchup-team-name${awayWon ? ' matchup-winner' : ''}`}>{f.away_team?.name}</span>
                  <span className="matchup-team-score">
                    {f.status !== 'scheduled' && Math.round(as_)}
                    {awayWon && <i className="bi bi-check-lg" style={{ color: 'var(--kl-accent-green)', fontSize: '.7rem' }}></i>}
                  </span>
                </div>
                {f.status !== 'scheduled' && (
                  <div className="matchup-mini-bar">
                    <div className="matchup-mini-fill" style={{ width: `${(hs / total) * 100}%` }}></div>
                  </div>
                )}
                {/* Player counts + C/VC badges from cached data */}
                {cachedFixtures[f.id] && (
                  <div className="d-flex justify-content-between align-items-center" style={{ marginTop: 6 }}>
                    {(() => { const hc = countPlayed(cachedFixtures[f.id].home_players || []); return hc.total > 0 ? <span className="matchup-players-count" style={{ fontSize: '.6rem', color: 'var(--kl-text-faint)' }}>{hc.played}/{hc.total}</span> : <span></span> })()}
                    <div className="d-flex gap-1">
                      <CapBadges players={cachedFixtures[f.id].home_players || []} />
                      <CapBadges players={cachedFixtures[f.id].away_players || []} />
                    </div>
                    {(() => { const ac = countPlayed(cachedFixtures[f.id].away_players || []); return ac.total > 0 ? <span className="matchup-players-count" style={{ fontSize: '.6rem', color: 'var(--kl-text-faint)' }}>{ac.played}/{ac.total}</span> : <span></span> })()}
                  </div>
                )}
                {f.status !== 'scheduled' && (hs !== as_) && (
                  <div className="matchup-margin">{homeWon ? f.home_team?.name : f.away_team?.name} +{Math.round(Math.abs(hs - as_))}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
