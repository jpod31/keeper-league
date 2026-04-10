import { useParams, Link } from 'react-router'
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface Team { id: number; name: string; logo_url: string | null }
interface S7Fixture {
  id: number; home_team_id: number; away_team_id: number
  home_score: number; away_score: number; status: string
  home_team: Team; away_team: Team
}
interface S7Player {
  player_id: number
  name: string; afl_team: string; position: string
  score: number; is_captain: boolean
  is_live: boolean; game_started: boolean; has_played: boolean
  game_kickoff?: string; lineup_type: string
}
interface AflGame {
  game_id: number; home_team: string; away_team: string
  status: string; home_score: number | null; away_score: number | null
  scheduled_display: string | null; scheduled_start: string | null
}
interface S7ScoreEntry {
  team_name?: string; total_score?: number; captain_bonus?: number
  players_played?: number; players_total?: number; captain_id?: number | null
}
interface S7GamedayData {
  is_bye: boolean; afl_round: number; round_dates: string | null; first_bounce: string | null
  gameday_state: string; live_enabled: boolean; is_home: boolean
  fixture: S7Fixture | null; my_team: Team | null; opp_team: Team | null
  my_players: S7Player[]; opp_players: S7Player[]
  my_score: number; opp_score: number
  my_captain_bonus: number; opp_captain_bonus: number
  my_played: number; my_eligible: number; opp_played: number; opp_eligible: number
  round_fixtures: S7Fixture[]
  sevens_scores: Record<string, S7ScoreEntry>
  afl_games: AflGame[]
  locked_player_ids: number[]
  teams_playing: string[]
  team_logos: Record<string, string>
  team_abbr: Record<string, string>
}

// Per-fixture detail from /reserve7s/api/live/<round>
interface S7FixtureDetail {
  fixture_id: number
  home_team: string; away_team: string
  home_score: number; away_score: number
  home_captain_bonus: number; away_captain_bonus: number
  home_players: S7Player[]; away_players: S7Player[]
}

// All inline CSS from templates/reserve7s/gameday.html — mirrors the Jinja <style> block exactly.
const S7_CSS = `
.s7gd-round-header { margin-bottom: 10px; }
.s7gd-round-title { font-size: 1.2rem; font-weight: 800; letter-spacing: 1px; color: #e6edf3; }
.s7gd-round-dates { color: #8b949e; font-size: .8rem; }
.s7gd-state-badge { display: inline-flex; align-items: center; gap: 4px; font-size: .72rem; font-weight: 700; padding: 5px 12px; border-radius: 14px; text-transform: uppercase; letter-spacing: .5px; }
.s7gd-badge-upcoming { background: rgba(188,140,255,.12); color: #a855f7; border: 1px solid rgba(188,140,255,.25); }
.s7gd-badge-live { background: rgba(188,140,255,.15); color: #a855f7; border: 1px solid rgba(188,140,255,.3); }
.s7gd-badge-final { background: #161b22; color: #e6edf3; }
.s7gd-badge-bye { background: #161b22; color: #8b949e; }
.s7gd-pulse-dot { display: inline-block; width: 7px; height: 7px; background: #a855f7; border-radius: 50%; animation: s7gdPulse 2s ease-in-out infinite; }
@keyframes s7gdPulse { 0%,100% { opacity: 1; box-shadow: 0 0 4px rgba(188,140,255,.4); } 50% { opacity: .4; box-shadow: 0 0 10px rgba(188,140,255,.8), 0 0 20px rgba(188,140,255,.3); } }
.s7gd-afl-bar { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-bottom: 12px; padding: 10px 14px; background: #0d1117; border: 1px solid #21262d; border-radius: 10px; }
.s7gd-game-pill { display: inline-flex; align-items: center; gap: 6px; background: #161b22; border: 1px solid #21262d; border-radius: 16px; padding: 4px 10px; font-size: .72rem; text-decoration: none; color: inherit; }
.s7gd-game-teams { color: #e6edf3; font-weight: 600; }
.s7gd-game-score { color: #8b949e; font-size: .7rem; font-variant-numeric: tabular-nums; }
.s7gd-gbadge-live { font-size: .6rem; background: #a78bfa; color: #fff; animation: s7gdPulse 2s infinite; }
.s7gd-gbadge-ft { font-size: .6rem; background: #238636; color: #fff; }
.s7gd-gbadge-sched { font-size: .6rem; background: #161b22; color: #8b949e; }
.s7-mini-bar { display: flex; gap: 6px; margin-bottom: 8px; padding: 10px 14px; background: #161b22; border: 1px solid #21262d; border-radius: 10px; }
.s7-mini-pill { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 4px; background: #0d1117; border: 1px solid #21262d; border-radius: 10px; cursor: pointer; transition: border-color .15s, background .15s; text-align: center; }
.s7-mini-pill:hover { background: #161b22; border-color: #30363d; }
.s7-mini-yours { border-color: #a855f7; }
.s7-mini-teams { font-weight: 600; font-size: .72rem; color: #c9d1d9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.s7-mini-score { font-size: .68rem; color: #8b949e; font-variant-numeric: tabular-nums; }
.s7gd-hero { background: radial-gradient(ellipse at 50% 0%, rgba(22,27,34,.95) 0%, var(--kl-bg-card, #161b22) 70%); border: 1px solid var(--kl-border, #21262d); border-radius: 16px; padding: 0; margin-bottom: 4px; position: relative; overflow: hidden; }
.s7gd-hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; z-index: 2; }
.s7gd-hero-live { border-color: rgba(35,134,54,.35); animation: s7gdGlow 4s ease-in-out infinite; }
.s7gd-hero-live::before { background: linear-gradient(90deg, #238636, #3fb950, #238636); background-size: 200% 100%; animation: s7Shimmer 3s linear infinite; }
.s7gd-hero-completed { border-color: rgba(139,148,158,.2); }
.s7gd-hero-completed::before { background: linear-gradient(90deg, rgba(139,148,158,.3), rgba(139,148,158,.6), rgba(139,148,158,.3)); }
.s7gd-hero-upcoming { border-color: rgba(110,64,201,.3); }
.s7gd-hero-upcoming::before { background: linear-gradient(90deg, #6e40c9, #a855f7, #6e40c9); background-size: 200% 100%; animation: s7Shimmer 4s linear infinite; }
@keyframes s7Shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes s7gdGlow { 0%,100% { box-shadow: 0 0 20px rgba(110,64,201,.1), 0 0 40px rgba(110,64,201,.05); } 50% { box-shadow: 0 0 30px rgba(110,64,201,.15), 0 0 60px rgba(110,64,201,.08); } }
.s7-teams-row { display: flex; align-items: center; justify-content: center; padding: 20px 20px 0; gap: 0; }
.s7-team-block { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.s7-team-right { justify-content: flex-end; }
.s7-team-detail { min-width: 0; flex: 1; }
.s7-vs { font-size: .6rem; font-weight: 800; color: var(--kl-text-faint, #484f58); letter-spacing: 2px; padding: 0 14px; opacity: .5; flex-shrink: 0; }
.s7-crest { display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 14px; font-weight: 800; font-size: 1rem; letter-spacing: .5px; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,.4); }
.s7-crest-left { background: linear-gradient(145deg, #0d3618, #238636, #3fb950); color: #fff; }
.s7-crest-right { background: linear-gradient(145deg, #2d1060, #6e40c9, #a855f7); color: #fff; }
.s7-crest-img { width: 50px; height: 50px; border-radius: 14px; object-fit: cover; flex-shrink: 0; box-shadow: 0 6px 20px rgba(0,0,0,.4); border: 2px solid rgba(255,255,255,.08); }
.s7-team-name { color: var(--kl-text-heading, #e6edf3); font-weight: 700; font-size: .88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
.s7-team-meta { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.s7-players-count { font-size: .64rem; color: var(--kl-text-faint, #484f58); font-weight: 500; font-variant-numeric: tabular-nums; }
.s7-role-badge { font-size: .5rem; padding: 1px 4px; border-radius: 3px; font-weight: 700; background: rgba(139,148,158,.12); color: #6e7681; line-height: 1.3; }
.s7-role-badge.s7-role-active { background: rgba(188,140,255,.2); color: #a855f7; }
.s7-scores-area { display: flex; align-items: flex-start; justify-content: center; gap: 10px; padding: 18px 20px 16px; }
.s7-score-col { display: flex; flex-direction: column; align-items: center; min-width: 70px; }
.s7-big-score { font-size: 3.4rem; font-weight: 900; line-height: 1; color: var(--kl-text-secondary, #8b949e); font-variant-numeric: tabular-nums; transition: color .4s, text-shadow .4s; }
.s7-big-score.s7-score-winning { color: #a855f7; text-shadow: 0 0 28px rgba(188,140,255,.4), 0 0 56px rgba(188,140,255,.15); }
.s7-score-dash { font-size: 2.2rem; font-weight: 300; color: var(--kl-text-faint, #484f58); line-height: 1; padding-top: 8px; opacity: .4; }
.s7-cap-bonus { color: #a855f7; font-size: .65rem; font-weight: 700; margin-top: 3px; white-space: nowrap; }
.s7-footer { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 12px 20px 16px; border-top: 1px solid rgba(139,148,158,.06); }
.s7-margin-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 16px; border-radius: 8px; font-size: .72rem; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: var(--kl-text-primary, #e6edf3); background: rgba(139,148,158,.08); }
.s7-margin-chip i { font-size: .6rem; }
.s7-first-bounce { text-align: center; padding: 0 20px 12px; color: var(--kl-text-secondary, #8b949e); font-size: .8rem; }
.s7gd-player-card { background: #0d1117; border: 1px solid #161b22; border-radius: 10px; overflow: hidden; }
.s7gd-card-left { border-left: 3px solid #3fb950; }
.s7gd-card-right { border-left: 3px solid #a855f7; }
.s7gd-card-header { background: #161b22; padding: 10px 14px; font-weight: 600; font-size: .85rem; color: #e6edf3; border-bottom: 1px solid #161b22; display: flex; justify-content: space-between; align-items: center; }
.s7gd-card-score { font-weight: 800; font-size: .95rem; color: #e6edf3; font-variant-numeric: tabular-nums; }
.s7gd-player-list { max-height: 600px; overflow-y: auto; }
.s7gd-player-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 14px; border-bottom: 1px solid #161b22; font-size: .8rem; transition: background .15s; }
.s7gd-player-row:last-child { border-bottom: none; }
.s7gd-player-row:hover { background: #161b22; }
.s7gd-player-row:hover .s7gd-player-name { color: #a855f7; }
.s7gd-player-row.p-locked { opacity: 0.7; }
.s7gd-player-row.p-ytp .s7gd-player-score { color: #6e7681; animation: s7gdYtp 2s ease-in-out infinite; }
@keyframes s7gdYtp { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
.s7gd-player-info { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; min-width: 0; }
.s7gd-player-name { color: #c9d1d9; white-space: nowrap; }
.s7gd-player-meta { color: #484f58; font-size: .7rem; white-space: nowrap; }
.s7gd-player-score { font-weight: 600; white-space: nowrap; color: #c9d1d9; font-variant-numeric: tabular-nums; }
.s7gd-live-dot { font-size: .35rem; color: #a855f7; vertical-align: middle; margin-left: 3px; animation: s7gdPulse 2s infinite; }
.s7gd-player-score.text-success { color: #a855f7 !important; }
.s7gd-team-logo { width: 16px; height: 16px; vertical-align: middle; margin-right: 2px; }
.s7gd-pos-badge { padding: 1px 5px !important; font-size: .55rem !important; border-radius: 3px !important; line-height: 1.4; }
.s7gd-badge-c { display: inline-block; background: #a855f7; color: #000; font-size: .55rem; font-weight: 700; padding: 1px 4px; border-radius: 3px; line-height: 1.3; }
.s7gd-section-hdr { padding: 6px 14px; font-size: .65rem; font-weight: 700; color: #8b949e; text-transform: uppercase; letter-spacing: .5px; background: #161b22; border-bottom: 1px solid #161b22; }
.score-ytp { color: #6e7681 !important; }
.s7-score-flash { animation: s7gdFlash 1.5s ease-out; }
@keyframes s7gdFlash { 0% { transform: scale(1.15); color: #a855f7; text-shadow: 0 0 8px rgba(188,140,255,.5); } 40% { transform: scale(.97); } 100% { transform: scale(1); color: inherit; text-shadow: none; } }
.s7gd-all-matchups { background: #0d1117; border: 1px solid #21262d; border-radius: 12px; overflow: hidden; }
.s7gd-matchups-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; font-size: .75rem; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: .8px; background: #0d1117; border-bottom: 1px solid #21262d; }
.s7gd-matchups-dates { font-size: .7rem; font-weight: 500; color: #484f58; text-transform: none; letter-spacing: normal; }
.s7gd-matchups-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; padding: 14px; }
.s7gd-matchup-card { display: block; text-decoration: none; color: inherit; cursor: pointer; background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 12px 14px; position: relative; transition: transform .15s, border-color .15s, box-shadow .15s; }
.s7gd-matchup-card:hover { transform: translateY(-2px); border-color: #30363d; box-shadow: 0 4px 12px rgba(0,0,0,.3); }
.s7gd-matchup-yours { border-color: #a855f7 !important; background: rgba(188,140,255,.04); }
.s7gd-matchup-active { box-shadow: 0 0 0 2px #a855f7, 0 4px 12px rgba(0,0,0,.2) !important; border-color: #a855f7 !important; background: rgba(188,140,255,.08); }
.s7gd-matchup-active:hover { box-shadow: 0 0 0 2px #a855f7, 0 4px 12px rgba(0,0,0,.3) !important; }
.s7gd-your-tag { position: absolute; top: -1px; right: 10px; font-size: .55rem; font-weight: 700; text-transform: uppercase; color: #a855f7; background: rgba(188,140,255,.15); padding: 2px 8px; border-radius: 0 0 6px 6px; letter-spacing: .3px; }
.s7gd-mx-team-row { display: flex; justify-content: space-between; align-items: center; padding: 3px 0; font-size: .8rem; }
.s7gd-mx-name { color: #c9d1d9; font-weight: 500; }
.s7gd-mx-winner { color: #e6edf3; font-weight: 700; }
.s7gd-mx-score { font-weight: 700; font-size: .85rem; color: #8b949e; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 3px; }
.s7gd-mini-bar { height: 4px; background: #f85149; border-radius: 2px; overflow: hidden; margin-top: 8px; opacity: 0.6; }
.s7gd-mini-fill { height: 100%; background: #3fb950; border-radius: 2px; transition: width .6s ease; }
.s7gd-mx-margin { font-size: .65rem; color: #6e7681; text-align: center; margin-top: 4px; font-variant-numeric: tabular-nums; }
.s7gd-mx-status { font-size: .65rem; color: #484f58; text-align: center; margin-top: 8px; }
.comp-toggle { display: flex; gap: 0; margin-bottom: 10px; }
.comp-toggle-btn { flex: 1; padding: 6px 12px; text-align: center; font-size: .75rem; font-weight: 700; border: 1px solid; letter-spacing: .5px; text-transform: uppercase; text-decoration: none; transition: all .15s; cursor: pointer; background: transparent; }
@media (max-width: 767.98px) {
  .s7-teams-row { padding: 14px 12px 0; }
  .s7-big-score { font-size: 2.4rem; min-width: 50px; }
  .s7-score-dash { font-size: 1.6rem; padding-top: 5px; }
  .s7-scores-area { padding: 14px 12px 12px; }
  .s7-team-name { font-size: .78rem; }
  .s7-crest { width: 40px; height: 40px; font-size: .85rem; border-radius: 11px; }
  .s7-crest-img { width: 40px; height: 40px; border-radius: 11px; }
  .s7-team-block { gap: 8px; }
  .s7-vs { padding: 0 8px; font-size: .55rem; }
  .s7-footer { padding: 10px 12px 14px; gap: 6px; }
  .s7-margin-chip { font-size: .65rem; padding: 4px 12px; }
  .s7gd-player-row { padding: 6px 10px; font-size: .75rem; }
  .s7gd-player-meta { display: none; }
  .s7gd-round-title { font-size: .95rem; }
  .s7gd-afl-bar { gap: 4px; padding: 8px 10px; }
  .s7gd-game-pill { font-size: .65rem; padding: 3px 8px; }
  .s7gd-matchups-grid { grid-template-columns: 1fr; gap: 8px; padding: 10px; }
  .s7gd-pos-badge { display: none !important; }
}
`

export function Reserve7sGamedayPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<S7GamedayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewedFixtureId, setViewedFixtureId] = useState<number | null>(null)
  const [cachedFixtures, setCachedFixtures] = useState<Record<number, S7FixtureDetail>>({})
  const [scoreFlash, setScoreFlash] = useState(false)
  const prevScores = useRef<{ left: number; right: number }>({ left: 0, right: 0 })
  const initialLoad = useRef(true)

  const fetchData = useCallback(() => {
    api<S7GamedayData>(`/leagues/${leagueId}/reserve7s/gameday?format=json`)
      .then(d => {
        setData(d)
        if (initialLoad.current && d.fixture) {
          setViewedFixtureId(d.fixture.id)
          initialLoad.current = false
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leagueId])

  // Fetch per-fixture live details for matchup switching
  const fetchAllFixtures = useCallback((round: number) => {
    api<{ fixtures: S7FixtureDetail[]; locked_player_ids: number[]; game_statuses: AflGame[] }>(
      `/leagues/${leagueId}/reserve7s/api/live/${round}`
    ).then(r => {
      const cache: Record<number, S7FixtureDetail> = {}
      r.fixtures?.forEach(f => { cache[f.fixture_id] = f })
      setCachedFixtures(cache)
    }).catch(() => {})
  }, [leagueId])

  useEffect(() => { fetchData() }, [fetchData])

  // Pre-fetch all fixture breakdowns once data loaded
  const hasPrefetched = useRef(false)
  useEffect(() => {
    if (data && !hasPrefetched.current) {
      hasPrefetched.current = true
      fetchAllFixtures(data.afl_round)
    }
  }, [data, fetchAllFixtures])

  // Live polling (30s) — matches Jinja inline script behavior
  useEffect(() => {
    if (data?.gameday_state !== 'live') return
    const t = setInterval(() => {
      fetchData()
      fetchAllFixtures(data.afl_round)
    }, 30000)
    return () => clearInterval(t)
  }, [data?.gameday_state, data?.afl_round, fetchData, fetchAllFixtures])

  // Upcoming → reload if game goes live (5 min poll)
  useEffect(() => {
    if (data?.gameday_state !== 'upcoming') return
    const t = setInterval(() => {
      api<{ game_statuses?: { status: string }[] }>(`/leagues/${leagueId}/reserve7s/api/live/${data.afl_round}`)
        .then(r => {
          if (r.game_statuses?.some(g => g.status === 'live')) window.location.reload()
        }).catch(() => {})
    }, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [data?.gameday_state, data?.afl_round, leagueId])

  if (loading) return <Spinner text="Loading 7s gameday..." />
  if (!data) return <p className="text-danger">Failed to load 7s gameday</p>

  const d = data
  const gs = d.gameday_state
  const isViewingOwn = !viewedFixtureId || (d.fixture != null && viewedFixtureId === d.fixture.id)
  const teamsPlayingSet = new Set(d.teams_playing || [])

  // Count played 7s-style: has_played && game_started
  function countPlayed(players: S7Player[]): { played: number; total: number } {
    const eligible = players.filter(p => teamsPlayingSet.has(p.afl_team))
    const played = eligible.filter(p => p.game_started && p.has_played).length
    return { played, total: eligible.length }
  }

  // Determine which data to show in hero/cards
  let heroLeftName: string, heroRightName: string
  let heroLeftScore: number, heroRightScore: number
  let heroLeftCap: number, heroRightCap: number
  let heroLeftPlayers: S7Player[], heroRightPlayers: S7Player[]
  let heroLeftLogo: string | null, heroRightLogo: string | null
  let heroLeftTeamId: number | undefined, heroRightTeamId: number | undefined

  if (isViewingOwn || !cachedFixtures[viewedFixtureId!]) {
    heroLeftName = d.my_team?.name || ''
    heroRightName = d.opp_team?.name || ''
    heroLeftScore = d.my_score
    heroRightScore = d.opp_score
    heroLeftCap = d.my_captain_bonus
    heroRightCap = d.opp_captain_bonus
    heroLeftPlayers = d.my_players || []
    heroRightPlayers = d.opp_players || []
    heroLeftLogo = d.my_team?.logo_url ?? null
    heroRightLogo = d.opp_team?.logo_url ?? null
    heroLeftTeamId = d.my_team?.id
    heroRightTeamId = d.opp_team?.id
  } else {
    const fx = cachedFixtures[viewedFixtureId!]
    const meta = d.round_fixtures.find(f => f.id === viewedFixtureId)
    heroLeftName = meta?.home_team?.name || ''
    heroRightName = meta?.away_team?.name || ''
    heroLeftScore = fx.home_score || 0
    heroRightScore = fx.away_score || 0
    heroLeftCap = fx.home_captain_bonus || 0
    heroRightCap = fx.away_captain_bonus || 0
    heroLeftPlayers = fx.home_players || []
    heroRightPlayers = fx.away_players || []
    heroLeftLogo = meta?.home_team?.logo_url || null
    heroRightLogo = meta?.away_team?.logo_url || null
    heroLeftTeamId = meta?.home_team_id
    heroRightTeamId = meta?.away_team_id
  }

  // sevens_scores entries (captain_id, players_played/total from backend)
  const heroLeftRs = heroLeftTeamId != null ? d.sevens_scores?.[String(heroLeftTeamId)] : undefined
  const heroRightRs = heroRightTeamId != null ? d.sevens_scores?.[String(heroRightTeamId)] : undefined

  const diff = Math.abs(Math.round(heroLeftScore - heroRightScore))

  // Score flash detection
  if (heroLeftScore !== prevScores.current.left || heroRightScore !== prevScores.current.right) {
    if (prevScores.current.left !== 0 || prevScores.current.right !== 0) {
      setTimeout(() => { setScoreFlash(true); setTimeout(() => setScoreFlash(false), 1500) }, 0)
    }
    prevScores.current = { left: heroLeftScore, right: heroRightScore }
  }

  // Sort players the same way the Jinja JS does: by kickoff → team → name
  function sortPlayers(players: S7Player[]): S7Player[] {
    return [...players].sort((a, b) => {
      const ak = a.game_kickoff || 'zzzz'
      const bk = b.game_kickoff || 'zzzz'
      if (ak !== bk) return ak < bk ? -1 : 1
      const at = a.afl_team || ''
      const bt = b.afl_team || ''
      if (at !== bt) return at.localeCompare(bt)
      return (a.name || '').localeCompare(b.name || '')
    })
  }

  function PlayerRow({ p }: { p: S7Player }) {
    const ytp = !p.game_started && gs === 'live'
    const isLocked = p.player_id && d.locked_player_ids?.includes(p.player_id)
    const rowClass = ['s7gd-player-row', isLocked && 'p-locked', ytp && 'p-ytp'].filter(Boolean).join(' ')
    const scoreClass = ['s7gd-player-score', ytp && 'score-ytp', p.is_live && !ytp && 'text-success'].filter(Boolean).join(' ')
    const posCode = (p.position || '').substring(0, 3).toUpperCase()
    return (
      <div className={rowClass}>
        <span className="s7gd-player-info">
          {p.position && <span className={`pos-badge pos-${posCode} s7gd-pos-badge`}>{posCode}</span>}
          {p.is_captain && <span className="s7gd-badge-c">C</span>}
          {isLocked && <i className="bi bi-lock-fill" style={{ color: '#f85149', fontSize: '.6rem' }}></i>}
          <span className="s7gd-player-name">{p.name}</span>
          <span className="s7gd-player-meta">
            {p.afl_team && d.team_logos[p.afl_team]
              ? <img src={d.team_logos[p.afl_team]} alt={p.afl_team} title={p.afl_team} className="s7gd-team-logo" />
              : p.afl_team}
          </span>
        </span>
        <span className={scoreClass}>
          {ytp ? <><i className="bi bi-clock" style={{ fontSize: '.65rem', marginRight: 2 }}></i>&mdash;</>
            : p.has_played ? <>{Math.round(p.score || 0)}{p.is_captain && <span style={{ fontSize: '.6rem', color: '#a855f7' }}> x2</span>}</>
            : <>&ndash;</>}
          {p.is_live && !ytp && <i className="bi bi-circle-fill s7gd-live-dot"></i>}
        </span>
      </div>
    )
  }

  function PlayerCard({ players, teamName, score, side }: { players: S7Player[]; teamName: string; score: number; side: 'left' | 'right' }) {
    const playing = sortPlayers(players.filter(p => teamsPlayingSet.has(p.afl_team)))
    const noGame = players.filter(p => !teamsPlayingSet.has(p.afl_team))
    return (
      <div className={`s7gd-player-card s7gd-card-${side}`}>
        <div className="s7gd-card-header">
          <span>{teamName}</span>
          <span className="s7gd-card-score">{gs !== 'upcoming' ? Math.round(score) : ''}</span>
        </div>
        <div className="s7gd-player-list">
          {playing.map((p, i) => <PlayerRow key={i} p={p} />)}
          {noGame.length > 0 && <>
            <div className="s7gd-section-hdr"><i className="bi bi-calendar-x me-1"></i>No Game This Round</div>
            {noGame.map((p, i) => <PlayerRow key={`ng${i}`} p={p} />)}
          </>}
          {players.length === 0 && (
            <div className="text-center py-3" style={{ color: '#484f58', fontSize: '.8rem' }}>No lineup submitted</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <style>{S7_CSS}</style>

      {/* Competition toggle — matches main gameday (active side uses blue accent) */}
      <div className="comp-toggle">
        <Link to={`/leagues/${leagueId}/gameday`} className="comp-toggle-btn text-decoration-none"
          style={{ borderColor: '#30363d', color: '#8b949e', borderRadius: '8px 0 0 8px' }}>Main</Link>
        <span className="comp-toggle-btn"
          style={{ borderColor: 'rgba(88,166,255,.3)', color: '#58a6ff', background: 'rgba(88,166,255,.08)', borderRadius: '0 8px 8px 0', borderLeft: 0 }}>7s</span>
      </div>

      {/* Round header */}
      <div className="s7gd-round-header">
        <div className="d-flex justify-content-between align-items-center">
          <h2 className="s7gd-round-title mb-0">
            <i className="bi bi-7-circle me-1" style={{ color: '#a855f7' }}></i>
            RESERVE 7s — {d.afl_round === 0 ? 'PRE-SEASON' : `ROUND ${d.afl_round}`}
          </h2>
          {gs === 'live' && <span className="s7gd-state-badge s7gd-badge-live"><i className="bi bi-broadcast me-1"></i><span className="s7gd-pulse-dot"></span> LIVE</span>}
          {gs === 'completed' && <span className="s7gd-state-badge s7gd-badge-final"><i className="bi bi-check-circle-fill me-1"></i>FINAL</span>}
          {gs === 'upcoming' && <span className="s7gd-state-badge s7gd-badge-upcoming"><i className="bi bi-calendar-event me-1"></i>UPCOMING</span>}
        </div>
        {d.round_dates && <div className="s7gd-round-dates mt-1">{d.round_dates}</div>}
      </div>

      {/* AFL game pills */}
      {d.afl_games && d.afl_games.length > 0 && (
        <div className="s7gd-afl-bar">
          {d.afl_games.map(g => (
            <Link key={g.game_id} to={`/leagues/${leagueId}/gameday/afl-game/${g.game_id}`} className="s7gd-game-pill">
              <span className="s7gd-game-teams">{d.team_abbr[g.home_team] || g.home_team.substring(0, 3).toUpperCase()} v {d.team_abbr[g.away_team] || g.away_team.substring(0, 3).toUpperCase()}</span>
              {g.status === 'live' && <span className="badge s7gd-gbadge-live">LIVE</span>}
              {g.status === 'complete' && <span className="badge s7gd-gbadge-ft">FT</span>}
              {g.status !== 'live' && g.status !== 'complete' && (
                <span className="badge s7gd-gbadge-sched">
                  {g.scheduled_display || (g.scheduled_start ? g.scheduled_start.substring(11, 16) : 'TBC')}
                </span>
              )}
              {g.home_score != null && <span className="s7gd-game-score">{g.home_score}-{g.away_score}</span>}
            </Link>
          ))}
        </div>
      )}

      {/* Mini bar — horizontal matchup switcher at top (matches main gameday layout) */}
      {d.round_fixtures && d.round_fixtures.length > 0 && (
        <div className="s7-mini-bar">
          {d.round_fixtures.map(f => {
            const hs = d.sevens_scores[String(f.home_team_id)]?.total_score || 0
            const as_ = d.sevens_scores[String(f.away_team_id)]?.total_score || 0
            const isYours = !d.is_bye && d.my_team && (f.home_team_id === d.my_team.id || f.away_team_id === d.my_team.id)
            const isActive = viewedFixtureId === f.id
            return (
              <div key={f.id}
                className={`s7-mini-pill${isYours ? ' s7-mini-yours' : ''}`}
                onClick={() => setViewedFixtureId(f.id)}
                style={isActive ? { borderColor: '#a855f7', boxShadow: '0 0 0 1px #a855f7' } : undefined}>
                <span className="s7-mini-teams">{f.home_team?.name} v {f.away_team?.name}</span>
                {f.status !== 'scheduled' && <span className="s7-mini-score">{Math.round(hs)}-{Math.round(as_)}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* BYE */}
      {d.is_bye ? (
        <div className="s7gd-hero s7gd-hero-upcoming" style={{ textAlign: 'center', padding: '24px 20px' }}>
          <span className="s7gd-state-badge s7gd-badge-bye" style={{ marginBottom: 12 }}><i className="bi bi-dash-circle me-1"></i>BYE</span>
          <p style={{ color: '#e6edf3', fontSize: '.95rem', marginBottom: 6 }}>You have a bye this round in Reserve 7s.</p>
          <p style={{ color: '#484f58', fontSize: '.85rem', marginBottom: 0 }}>Click any matchup below to view it.</p>
        </div>
      ) : (
        <>
          {/* Hero card */}
          <div className={`s7gd-hero s7gd-hero-${gs}`}>
            <div className="s7-teams-row">
              <div className="s7-team-block s7-team-left">
                {heroLeftLogo
                  ? <img src={heroLeftLogo} alt="" className="s7-crest-img" />
                  : <span className="s7-crest s7-crest-left">{heroLeftName.substring(0, 2).toUpperCase()}</span>}
                <div className="s7-team-detail">
                  <div className="s7-team-name">{heroLeftName}</div>
                  <div className="s7-team-meta">
                    {(() => {
                      const total = heroLeftRs?.players_total ?? countPlayed(heroLeftPlayers).total
                      const played = heroLeftRs?.players_played ?? countPlayed(heroLeftPlayers).played
                      return total > 0 ? <span className="s7-players-count">{played}/{total} played</span> : null
                    })()}
                    {heroLeftRs?.captain_id != null && <span className="s7-role-badge s7-role-active">C</span>}
                  </div>
                </div>
              </div>
              <span className="s7-vs">VS</span>
              <div className="s7-team-block s7-team-right">
                <div className="s7-team-detail" style={{ textAlign: 'right' }}>
                  <div className="s7-team-name">{heroRightName}</div>
                  <div className="s7-team-meta" style={{ justifyContent: 'flex-end' }}>
                    {heroRightRs?.captain_id != null && <span className="s7-role-badge s7-role-active">C</span>}
                    {(() => {
                      const total = heroRightRs?.players_total ?? countPlayed(heroRightPlayers).total
                      const played = heroRightRs?.players_played ?? countPlayed(heroRightPlayers).played
                      return total > 0 ? <span className="s7-players-count">{played}/{total} played</span> : null
                    })()}
                  </div>
                </div>
                {heroRightLogo
                  ? <img src={heroRightLogo} alt="" className="s7-crest-img" />
                  : <span className="s7-crest s7-crest-right">{heroRightName.substring(0, 2).toUpperCase()}</span>}
              </div>
            </div>

            <div className="s7-scores-area">
              <div className="s7-score-col">
                <span className={`s7-big-score${heroLeftScore > heroRightScore ? ' s7-score-winning' : ''}${scoreFlash ? ' s7-score-flash' : ''}`}>{Math.round(heroLeftScore)}</span>
                {heroLeftCap > 0 && <span className="s7-cap-bonus">+{Math.round(heroLeftCap)} (C)</span>}
              </div>
              <span className="s7-score-dash">&ndash;</span>
              <div className="s7-score-col">
                <span className={`s7-big-score${heroRightScore > heroLeftScore ? ' s7-score-winning' : ''}${scoreFlash ? ' s7-score-flash' : ''}`}>{Math.round(heroRightScore)}</span>
                {heroRightCap > 0 && <span className="s7-cap-bonus">+{Math.round(heroRightCap)} (C)</span>}
              </div>
            </div>

            <div className="s7-footer">
              <div className="s7-margin-chip">
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
            </div>

            {gs === 'upcoming' && d.first_bounce && (
              <div className="s7-first-bounce"><i className="bi bi-clock me-1"></i>First bounce {d.first_bounce}</div>
            )}
          </div>

          {/* Mobile side-by-side view */}
          <div className="d-lg-none mt-3 gd-mob-vs s7-mob-vs">
            <div className="gd-mob-vs-header">
              <span className="gd-mob-vs-team">{heroLeftName}</span>
              <span className="gd-mob-vs-scores">
                <span className={`gd-mob-vs-sc${heroLeftScore > heroRightScore ? ' gd-mob-sc-win' : ''}`}>{Math.round(heroLeftScore)}</span>
                <span style={{ color: '#484f58', fontSize: '.7rem' }}>v</span>
                <span className={`gd-mob-vs-sc${heroRightScore > heroLeftScore ? ' gd-mob-sc-win' : ''}`}>{Math.round(heroRightScore)}</span>
              </span>
              <span className="gd-mob-vs-team" style={{ textAlign: 'right' }}>{heroRightName}</span>
            </div>
            {(() => {
              const lp = sortPlayers(heroLeftPlayers.filter(p => teamsPlayingSet.has(p.afl_team)))
              const rp = sortPlayers(heroRightPlayers.filter(p => teamsPlayingSet.has(p.afl_team)))
              const maxLen = Math.max(lp.length, rp.length)
              return Array.from({ length: maxLen }).map((_, i) => {
                const mp = lp[i]
                const op = rp[i]
                return (
                  <div key={i} className="gd-mob-vs-row">
                    <div className="gd-mob-vs-left">
                      {mp && <>
                        <span className="gd-mob-vs-name">
                          {mp.is_captain && <b className="gd-mob-c" style={{ color: '#a855f7' }}>C</b>}
                          {mp.name}
                        </span>
                        <span className={`gd-mob-vs-pos pos-badge pos-${(mp.position || '').substring(0, 3).toUpperCase()}`}>{(mp.position || '').substring(0, 3)}</span>
                      </>}
                    </div>
                    <div className="gd-mob-vs-mid">
                      <span className={`gd-mob-sc-l${mp?.is_live ? ' text-success' : ''}`}>
                        {mp ? (mp.has_played
                          ? <>{Math.round(mp.score || 0)}{mp.is_captain && <small style={{ color: '#a855f7' }}>x2</small>}</>
                          : <>&ndash;</>) : '-'}
                        {mp?.is_live && <i className="bi bi-circle-fill s7gd-live-dot"></i>}
                      </span>
                      <span className={`gd-mob-sc-r${op?.is_live ? ' text-success' : ''}`}>
                        {op ? (op.has_played
                          ? <>{Math.round(op.score || 0)}{op.is_captain && <small style={{ color: '#a855f7' }}>x2</small>}</>
                          : <>&ndash;</>) : '-'}
                        {op?.is_live && <i className="bi bi-circle-fill s7gd-live-dot"></i>}
                      </span>
                    </div>
                    <div className="gd-mob-vs-right">
                      {op && <>
                        <span className={`gd-mob-vs-pos pos-badge pos-${(op.position || '').substring(0, 3).toUpperCase()}`}>{(op.position || '').substring(0, 3)}</span>
                        <span className="gd-mob-vs-name">
                          {op.is_captain && <b className="gd-mob-c" style={{ color: '#a855f7' }}>C</b>}
                          {op.name}
                        </span>
                      </>}
                    </div>
                  </div>
                )
              })
            })()}
            {/* No Game section — mobile */}
            {(() => {
              const lno = heroLeftPlayers.filter(p => !teamsPlayingSet.has(p.afl_team))
              const rno = heroRightPlayers.filter(p => !teamsPlayingSet.has(p.afl_team))
              const maxLen = Math.max(lno.length, rno.length)
              if (maxLen === 0) return null
              return <>
                <div className="gd-mob-section-hdr" style={{ color: '#6e7681' }}>
                  <i className="bi bi-calendar-x me-1"></i>No Game
                </div>
                {Array.from({ length: maxLen }).map((_, i) => {
                  const mp = lno[i]
                  const op = rno[i]
                  return (
                    <div key={`ng${i}`} className="gd-mob-vs-row" style={{ opacity: .5 }}>
                      <div className="gd-mob-vs-left">{mp && <span className="gd-mob-vs-name">{mp.name}</span>}</div>
                      <div className="gd-mob-vs-mid"><span className="gd-mob-sc-l">&ndash;</span><span className="gd-mob-sc-r">&ndash;</span></div>
                      <div className="gd-mob-vs-right">{op && <span className="gd-mob-vs-name">{op.name}</span>}</div>
                    </div>
                  )
                })}
              </>
            })()}
          </div>

          {/* Desktop player cards */}
          <div className="row g-3 mt-2 d-none d-lg-flex">
            <div className="col-md-6">
              <PlayerCard players={heroLeftPlayers} teamName={heroLeftName} score={heroLeftScore} side="left" />
            </div>
            <div className="col-md-6">
              <PlayerCard players={heroRightPlayers} teamName={heroRightName} score={heroRightScore} side="right" />
            </div>
          </div>

          {/* Mobile player cards */}
          <div className="d-lg-none mt-3">
            <PlayerCard players={heroLeftPlayers} teamName={heroLeftName} score={heroLeftScore} side="left" />
            <div className="mt-2">
              <PlayerCard players={heroRightPlayers} teamName={heroRightName} score={heroRightScore} side="right" />
            </div>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="mt-3 d-flex align-items-center justify-content-between" style={{ fontSize: '.75rem', color: '#484f58' }}>
        <span>
          {gs === 'live' ? <><i className="bi bi-broadcast me-1" style={{ color: '#3fb950' }}></i>Live updates active</>
            : gs === 'completed' ? 'Final results' : <>&nbsp;</>}
        </span>
        <Link to={`/leagues/${leagueId}/reserve7s/fixture`} style={{ color: '#8b949e', textDecoration: 'none', fontSize: '.7rem' }}>
          7s Season Fixture &rarr;
        </Link>
      </div>
    </div>
  )
}
