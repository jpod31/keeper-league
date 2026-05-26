import { useParams, useNavigate, Link } from 'react-router'
import { useEffect, useMemo, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

// ── Types ────────────────────────────────────────────────────
interface PositionSlot { position_code: string; count: number; is_bench: boolean }
interface League {
  id: number
  name: string
  status: string
  season_year: number
  scoring_type: string
  scoring_label: string
  num_teams: number
  squad_size: number
  on_field_count: number
  draft_type: string
  pick_timer_secs: number
  trade_window_open: boolean
  trade_close_at: string | null
  commissioner_name: string
  invite_code: string | null
  position_slots: PositionSlot[]
}
interface Team {
  id: number
  name: string
  owner: string
  draft_order: number | null
  is_mine: boolean
  roster_count: number
  logo_url?: string | null
}
interface TeamSummary {
  id: number
  name: string
  owner: string
  is_mine: boolean
  logo_url: string | null
  colour: string
  score?: number
}
interface ThisMatchup {
  round: number
  status: string
  me: TeamSummary & { score: number }
  opp: TeamSummary & { score: number }
  margin: number
}
interface StandingsRow {
  rank: number
  team: TeamSummary
  wins: number; losses: number; draws: number
  pf: number; pa: number; pct: number; pts: number
}
interface Fixture {
  id: number
  status: string
  home: TeamSummary & { score: number }
  away: TeamSummary & { score: number }
}
interface TopPerformer {
  player_id: number
  name: string
  afl_team: string
  position: string
  sc_score: number
  owner_team: TeamSummary | null
}
interface ActivityItem {
  type: string
  title: string
  body: string | null
  created_at: string | null
  link: string | null
}

interface DashboardData {
  league: League
  user_team: Team | null
  teams: Team[]
  is_commissioner: boolean
  scoring_rules: Record<string, number | string>
  has_completed_onboarding: boolean
  current_round: number
  live_games_count: number
  next_lockout_at: string | null
  this_matchup: ThisMatchup | null
  my_rank: number | null
  standings: StandingsRow[]
  league_fixtures: Fixture[]
  top_performers: TopPerformer[]
  recent_activity: ActivityItem[]
  pending_incoming: number
  pending_outgoing: number
  delist_open: boolean
}

// ── Helpers ──────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (full.length !== 6) return '88,166,255'
  return `${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(full.slice(4, 6), 16)}`
}

function initials(name: string): string {
  if (!name) return '·'
  const words = name.split(/\s+/).filter(Boolean).slice(0, 2)
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function fmtCountdown(target: string | null): { value: string; tone: 'soon' | 'live' | 'normal' } | null {
  if (!target) return null
  const t = new Date(target).getTime()
  const now = Date.now()
  const ms = t - now
  if (ms <= 0) return { value: 'NOW', tone: 'live' }
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  let value = ''
  if (days > 0) value = `${days}d ${hours}h`
  else if (hours > 0) value = `${hours}h ${mins}m`
  else value = `${mins}m`
  const tone = ms < 3600_000 ? 'soon' : 'normal'
  return { value, tone }
}

function fmtRelative(iso: string | null): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  const ago = Date.now() - t
  if (ago < 60_000) return 'now'
  if (ago < 3600_000) return `${Math.floor(ago / 60_000)}m`
  if (ago < 86400_000) return `${Math.floor(ago / 3600_000)}h`
  return `${Math.floor(ago / 86400_000)}d`
}

function activityIconClass(t: string, title: string): string {
  const lt = (t || '').toLowerCase()
  const lower = (title || '').toLowerCase()
  if (lt === 'trade_accepted' || lt === 'trade_received' || lower.includes('trade')) return 'lg-feed-icon-trade'
  if (lower.includes('delisted')) return 'lg-feed-icon-delist'
  if (lower.includes('ltil')) return 'lg-feed-icon-ltil'
  if (lower.includes('draft')) return 'lg-feed-icon-draft'
  return ''
}

function activityIcon(t: string, title: string): string {
  const lt = (t || '').toLowerCase()
  const lower = (title || '').toLowerCase()
  if (lt === 'trade_accepted' || lt === 'trade_received' || lower.includes('trade')) return 'bi-arrow-left-right'
  if (lower.includes('delisted')) return 'bi-x-octagon'
  if (lower.includes('ltil')) return 'bi-bandaid'
  if (lower.includes('draft')) return 'bi-trophy'
  return 'bi-info-circle'
}

// ── Page ─────────────────────────────────────────────────────
export function DashboardPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const { data, loading, refetch } = useFetch<DashboardData>(`/leagues/${leagueId}?format=json`)
  const [copied, setCopied] = useState(false)
  const [joinName, setJoinName] = useState('')

  // Tick every 30s to refresh countdowns
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // CSS variable map for team colours
  const styleVars = useMemo(() => {
    const m: Record<string, string> = {}
    if (data?.this_matchup) {
      m['--lg-me'] = data.this_matchup.me.colour
      m['--lg-me-rgb'] = hexToRgb(data.this_matchup.me.colour)
      m['--lg-opp'] = data.this_matchup.opp.colour
      m['--lg-opp-rgb'] = hexToRgb(data.this_matchup.opp.colour)
    } else if (data?.user_team) {
      const myStanding = data.standings.find(s => s.team.is_mine)
      const myColour = myStanding?.team.colour || '#58a6ff'
      m['--lg-me'] = myColour
      m['--lg-me-rgb'] = hexToRgb(myColour)
    }
    return m
  }, [data])

  if (loading) return <Spinner text="Loading dashboard..." />
  if (!data) return <p className="text-danger">Failed to load dashboard</p>

  const { league, user_team, teams, scoring_rules, this_matchup, my_rank, standings,
    league_fixtures, top_performers, recent_activity, current_round, live_games_count,
    next_lockout_at, pending_incoming, pending_outgoing, delist_open } = data

  const inviteUrl = league.invite_code ? `${window.location.origin}/leagues/invite/${league.invite_code}` : ''
  function copyInvite() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }
  async function joinLeague(e: React.FormEvent) {
    e.preventDefault()
    const form = new FormData()
    form.set('team_name', joinName)
    const res = await fetch(`/leagues/${leagueId}/join`, { method: 'POST', body: form, credentials: 'include', redirect: 'manual' })
    if (res.status < 500) refetch()
  }

  const lockout = fmtCountdown(next_lockout_at)
  const tradeCountdown = league.trade_window_open ? fmtCountdown(league.trade_close_at) : null

  return (
    <div className="lg-page" style={styleVars as React.CSSProperties}>

      {/* ── LIVE PULSE BAR ── */}
      <div className="lg-pulse">
        <span className="lg-pulse-item">
          <span className={`lg-pulse-dot ${live_games_count > 0 ? 'lg-pulse-dot-live' : ''}`}></span>
          {live_games_count > 0 ? (
            <><b>R{current_round}</b> · <b>{live_games_count}</b> live</>
          ) : current_round ? (
            <>Round <b>{current_round}</b></>
          ) : (
            <>{league.season_year} season</>
          )}
        </span>
        {lockout && (
          <span className="lg-pulse-item">
            <i className="bi bi-clock" style={{ color: '#d29922', fontSize: '.78rem' }}></i>
            Next lockout
            <span className="lg-pulse-countdown">{lockout.value}</span>
          </span>
        )}
        {league.trade_window_open && (
          <span className="lg-pulse-item">
            <span className="lg-pulse-dot lg-pulse-dot-open"></span>
            Trades open
            {tradeCountdown && <span className="lg-pulse-countdown">· closes {tradeCountdown.value}</span>}
          </span>
        )}
        {!league.trade_window_open && (
          <span className="lg-pulse-item" style={{ color: 'var(--pp-text-muted)' }}>
            <span className="lg-pulse-dot"></span>Trade window closed
          </span>
        )}
        {delist_open && (
          <span className="lg-pulse-item" style={{ color: '#ff8a82' }}>
            <i className="bi bi-x-octagon" style={{ fontSize: '.78rem' }}></i>Delist period open
          </span>
        )}
        <span className="lg-pulse-item" style={{ marginLeft: 'auto', color: 'var(--pp-text-muted)' }}>
          <span className={`status-pill status-${league.status}`} style={{ fontSize: '.6rem' }}>{league.status}</span>
          <span style={{ marginLeft: 8 }}>{league.scoring_label} · {league.num_teams} teams</span>
        </span>
      </div>

      {/* ── MATCHUP HERO ── */}
      {this_matchup && user_team ? (
        <section className="lg-hero">
          <div className="lg-hero-grid">
            {/* MY side */}
            <div className="lg-hero-side lg-hero-side-me">
              <div className="lg-hero-team-row">
                <div className="lg-hero-team-logo">
                  {this_matchup.me.logo_url
                    ? <img src={this_matchup.me.logo_url} alt="" />
                    : <span className="lg-hero-team-logo-fallback" style={{ color: this_matchup.me.colour }}>{initials(this_matchup.me.name)}</span>}
                </div>
                <div className="lg-hero-team-meta">
                  <span className="lg-hero-team-name">
                    {this_matchup.me.name}
                    <span className="lg-hero-mine-pill">YOU</span>
                  </span>
                  <span className="lg-hero-team-owner">{this_matchup.me.owner}</span>
                </div>
              </div>
              <div>
                <div className="lg-hero-score-label">Your score</div>
                <div className="lg-hero-score">{Math.round(this_matchup.me.score)}</div>
              </div>
            </div>

            {/* VS centre */}
            <div className="lg-hero-vs">
              <div className="lg-hero-round">Round {this_matchup.round}</div>
              <div className="lg-hero-vs-token">VS</div>
              <div className={`lg-hero-status-pill lg-hero-status-${this_matchup.status}`}>{this_matchup.status}</div>
            </div>

            {/* OPP side */}
            <div className="lg-hero-side lg-hero-side-opp">
              <div className="lg-hero-team-row">
                <div className="lg-hero-team-logo">
                  {this_matchup.opp.logo_url
                    ? <img src={this_matchup.opp.logo_url} alt="" />
                    : <span className="lg-hero-team-logo-fallback" style={{ color: this_matchup.opp.colour }}>{initials(this_matchup.opp.name)}</span>}
                </div>
                <div className="lg-hero-team-meta">
                  <span className="lg-hero-team-name">{this_matchup.opp.name}</span>
                  <span className="lg-hero-team-owner">{this_matchup.opp.owner}</span>
                </div>
              </div>
              <div>
                <div className="lg-hero-score-label">Their score</div>
                <div className="lg-hero-score">{Math.round(this_matchup.opp.score)}</div>
              </div>
            </div>
          </div>

          <div className="lg-hero-storyline">
            {this_matchup.status === 'scheduled' ? (
              <>This week's matchup tips off when the round begins. Set your lineup before lockout.</>
            ) : this_matchup.status === 'live' ? (
              this_matchup.margin > 0
                ? <>You're <b>up {Math.abs(this_matchup.margin).toFixed(1)}</b> against <b>{this_matchup.opp.name}</b>.</>
                : this_matchup.margin < 0
                  ? <>You're <b>down {Math.abs(this_matchup.margin).toFixed(1)}</b> to <b>{this_matchup.opp.name}</b>. Players still to play.</>
                  : <>Dead level with <b>{this_matchup.opp.name}</b>.</>
            ) : (
              this_matchup.margin > 0
                ? <>You beat <b>{this_matchup.opp.name}</b> by <b>{Math.abs(this_matchup.margin).toFixed(1)}</b>.</>
                : this_matchup.margin < 0
                  ? <>You lost to <b>{this_matchup.opp.name}</b> by <b>{Math.abs(this_matchup.margin).toFixed(1)}</b>.</>
                  : <>Tied with <b>{this_matchup.opp.name}</b>.</>
            )}
          </div>
        </section>
      ) : !user_team && (
        <section className="lg-hero" style={{ padding: 24 }}>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--pp-text-strong)', marginBottom: 8 }}>
              Welcome to {league.name}
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--pp-text-muted)' }}>
              Join the league below to get your team into the action.
            </div>
          </div>
        </section>
      )}

      {/* ── QUICK ACTIONS ── */}
      {user_team && (
        <div className="lg-actions">
          <Link to={`/leagues/${leagueId}/team/${user_team.id}`} className="lg-action lg-action-myteam">
            <span className="lg-action-icon"><i className="bi bi-person-bounding-box"></i></span>
            <span className="lg-action-label">My Team</span>
            <span className="lg-action-sub">{user_team.name}</span>
          </Link>
          <Link to={`/leagues/${leagueId}/player-pool`} className="lg-action lg-action-pool">
            <span className="lg-action-icon"><i className="bi bi-grid-3x3"></i></span>
            <span className="lg-action-label">Player Pool</span>
            <span className="lg-action-sub">Browse + claim</span>
          </Link>
          <Link to={`/leagues/${leagueId}/trades`} className="lg-action lg-action-trades">
            <span className="lg-action-icon"><i className="bi bi-arrow-left-right"></i></span>
            <span className="lg-action-label">Trades</span>
            <span className="lg-action-sub">{league.trade_window_open ? 'Window open' : 'Window closed'}</span>
            {pending_incoming > 0 && <span className="lg-action-badge">{pending_incoming}</span>}
          </Link>
          <Link to={`/leagues/${leagueId}/gameday`} className="lg-action lg-action-gameday">
            <span className="lg-action-icon"><i className="bi bi-broadcast"></i></span>
            <span className="lg-action-label">Gameday</span>
            <span className="lg-action-sub">{live_games_count > 0 ? `${live_games_count} live` : 'Round overview'}</span>
          </Link>
          <Link to={`/leagues/${leagueId}/standings`} className="lg-action lg-action-ladder">
            <span className="lg-action-icon"><i className="bi bi-trophy"></i></span>
            <span className="lg-action-label">Standings</span>
            <span className="lg-action-sub">{my_rank ? `You're ${ordinal(my_rank)}` : 'Ladder + form'}</span>
          </Link>
          <Link to={`/leagues/${leagueId}/analytics`} className="lg-action lg-action-analytics">
            <span className="lg-action-icon"><i className="bi bi-bar-chart-line"></i></span>
            <span className="lg-action-label">Analytics</span>
            <span className="lg-action-sub">Power + projections</span>
          </Link>
        </div>
      )}

      {/* ── BODY GRID ── */}
      <div className="row g-4">
        <div className="col-lg-7 lg-stagger">

          {/* Standings ladder mini */}
          {standings.length > 0 && (
            <div className="lg-card">
              <div className="lg-card-header">
                <span className="lg-card-title"><i className="bi bi-trophy" style={{ color: '#d29922' }}></i>Ladder</span>
                <Link to={`/leagues/${leagueId}/standings`} className="lg-card-action">View all →</Link>
              </div>
              <div className="lg-ladder">
                {standings.slice(0, 6).map(s => {
                  const rgb = hexToRgb(s.team.colour)
                  return (
                    <Link key={s.team.id}
                      to={`/leagues/${leagueId}/team/${s.team.id}`}
                      className={`lg-ladder-row ${s.team.is_mine ? 'lg-ladder-row-mine' : ''}`}
                      style={{ '--lg-row-color': s.team.colour, '--lg-row-rgb': rgb } as React.CSSProperties}>
                      <span className={`lg-ladder-rank ${s.rank <= 3 ? `lg-ladder-rank-${s.rank}` : ''}`}>{s.rank}</span>
                      <span className="lg-ladder-name">
                        <span className="lg-ladder-dot" style={{ background: s.team.colour }}></span>
                        <span className="lg-ladder-team-name">
                          {s.team.name}
                          {s.team.is_mine && <span className="lg-hero-mine-pill" style={{ marginLeft: 6, fontSize: '.5rem' }}>YOU</span>}
                        </span>
                      </span>
                      <span className="lg-ladder-record">{s.wins}–{s.losses}{s.draws > 0 ? `–${s.draws}` : ''}</span>
                      <span className="lg-ladder-pts">{s.pts}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Top performers */}
          {top_performers.length > 0 && (
            <div className="lg-card">
              <div className="lg-card-header">
                <span className="lg-card-title"><i className="bi bi-fire" style={{ color: '#ff8a82' }}></i>Top performers · R{current_round}</span>
              </div>
              <div className="lg-perf">
                {top_performers.slice(0, 6).map((p, i) => {
                  const colour = p.owner_team?.colour || '#58a6ff'
                  const rgb = hexToRgb(colour)
                  return (
                    <Link key={p.player_id}
                      to={`/player/${encodeURIComponent(p.name)}`}
                      className="lg-perf-card"
                      style={{ '--lg-perf-color': colour, '--lg-perf-color-rgb': rgb } as React.CSSProperties}>
                      <div className="lg-perf-rank">#{i + 1}</div>
                      <div className="lg-perf-score">{p.sc_score}</div>
                      <div className="lg-perf-name">{p.name}</div>
                      <div className="lg-perf-meta">{p.position} · {p.afl_team}</div>
                      {p.owner_team && <span className="lg-perf-owner">{p.owner_team.name}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* League pulse / activity feed */}
          {recent_activity.length > 0 && (
            <div className="lg-card">
              <div className="lg-card-header">
                <span className="lg-card-title"><i className="bi bi-activity" style={{ color: '#79c0ff' }}></i>League pulse</span>
                <Link to={`/leagues/${leagueId}/list-changes`} className="lg-card-action">All changes →</Link>
              </div>
              <div className="lg-feed">
                {recent_activity.slice(0, 8).map((a, i) => {
                  const Wrap = ({ children }: { children: React.ReactNode }) => (
                    a.link
                      ? <Link to={a.link} className="lg-feed-item">{children}</Link>
                      : <div className="lg-feed-item">{children}</div>
                  )
                  return (
                    <Wrap key={i}>
                      <span className={`lg-feed-icon ${activityIconClass(a.type, a.title)}`}>
                        <i className={`bi ${activityIcon(a.type, a.title)}`}></i>
                      </span>
                      <span className="lg-feed-body">
                        <span className="lg-feed-title">{a.title}</span>
                        {a.body && <span className="lg-feed-sub">{a.body}</span>}
                      </span>
                      <span className="lg-feed-time">{fmtRelative(a.created_at)}</span>
                    </Wrap>
                  )
                })}
              </div>
            </div>
          )}

        </div>

        <div className="col-lg-5 lg-stagger">

          {/* Round fixtures */}
          {league_fixtures.length > 0 && (
            <div className="lg-card">
              <div className="lg-card-header">
                <span className="lg-card-title"><i className="bi bi-grid" style={{ color: '#79c0ff' }}></i>Round {current_round} fixtures</span>
              </div>
              <div>
                {league_fixtures.map(fx => {
                  const mineHome = fx.home.is_mine
                  const mineAway = fx.away.is_mine
                  return (
                    <div key={fx.id} className="lg-fix">
                      <div className={`lg-fix-side ${mineHome ? 'lg-fix-side-mine' : ''}`}>
                        <div className="lg-fix-logo" style={{ borderColor: fx.home.colour + '88' }}>
                          {fx.home.logo_url ? <img src={fx.home.logo_url} alt="" /> : <span style={{ color: fx.home.colour }}>{initials(fx.home.name)}</span>}
                        </div>
                        <div className="lg-fix-team">
                          <span className="lg-fix-team-name">{fx.home.name}</span>
                          {fx.status !== 'scheduled' && <span className="lg-fix-score">{Math.round(fx.home.score)}</span>}
                        </div>
                        {mineHome && <span className="lg-fix-mine-indicator" title="Your team"></span>}
                      </div>
                      <span className="lg-fix-vs">VS</span>
                      <div className={`lg-fix-side lg-fix-side-away ${mineAway ? 'lg-fix-side-mine' : ''}`}>
                        <div className="lg-fix-logo" style={{ borderColor: fx.away.colour + '88' }}>
                          {fx.away.logo_url ? <img src={fx.away.logo_url} alt="" /> : <span style={{ color: fx.away.colour }}>{initials(fx.away.name)}</span>}
                        </div>
                        <div className="lg-fix-team">
                          <span className="lg-fix-team-name">{fx.away.name}</span>
                          {fx.status !== 'scheduled' && <span className="lg-fix-score">{Math.round(fx.away.score)}</span>}
                        </div>
                        {mineAway && <span className="lg-fix-mine-indicator" title="Your team"></span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Trade activity quick card */}
          {user_team && (pending_incoming > 0 || pending_outgoing > 0 || league.trade_window_open) && (
            <div className="lg-card">
              <div className="lg-card-header">
                <span className="lg-card-title"><i className="bi bi-arrow-left-right" style={{ color: '#ffb471' }}></i>Trade activity</span>
                <Link to={`/leagues/${leagueId}/trades`} className="lg-card-action">Trade center →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pending_incoming > 0 && (
                  <Link to={`/leagues/${leagueId}/trades?tab=incoming`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                             background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.35)',
                             textDecoration: 'none', color: '#ffb4ae' }}>
                    <i className="bi bi-inbox-fill"></i>
                    <span style={{ flex: 1, fontWeight: 700 }}>{pending_incoming} pending proposal{pending_incoming > 1 ? 's' : ''}</span>
                    <i className="bi bi-arrow-right" style={{ fontSize: '.8rem' }}></i>
                  </Link>
                )}
                {pending_outgoing > 0 && (
                  <Link to={`/leagues/${leagueId}/trades?tab=outgoing`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8,
                             background: 'rgba(210,153,34,.08)', border: '1px solid rgba(210,153,34,.3)',
                             textDecoration: 'none', color: '#f0d18a' }}>
                    <i className="bi bi-send"></i>
                    <span style={{ flex: 1, fontWeight: 700 }}>{pending_outgoing} awaiting response</span>
                    <i className="bi bi-arrow-right" style={{ fontSize: '.8rem' }}></i>
                  </Link>
                )}
                {league.trade_window_open && (
                  <Link to={`/leagues/${leagueId}/trades/propose`}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 12px', borderRadius: 8,
                             background: 'linear-gradient(135deg, #1f6feb, #388bfd)', color: '#fff',
                             textDecoration: 'none', fontWeight: 700 }}>
                    <i className="bi bi-plus-lg"></i>Propose a trade
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Join form for non-team users */}
          {!user_team && (
            <div className="lg-card">
              <div className="lg-card-header">
                <span className="lg-card-title"><i className="bi bi-box-arrow-in-right" style={{ color: '#3fb950' }}></i>Join the league</span>
              </div>
              <form onSubmit={joinLeague}>
                <div className="mb-3">
                  <input type="text" className="form-control" placeholder="Your team name"
                    required maxLength={120} value={joinName} onChange={e => setJoinName(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary w-100">Join League</button>
              </form>
            </div>
          )}

          {/* Invite */}
          {league.invite_code && (
            <div className="lg-card">
              <div className="lg-card-header">
                <span className="lg-card-title"><i className="bi bi-share" style={{ color: '#d29922' }}></i>Invite players</span>
              </div>
              <div className="input-group input-group-sm">
                <input type="text" className="form-control" readOnly value={inviteUrl}
                  style={{ fontSize: '.75rem', background: 'var(--pp-surface-0)', color: 'var(--pp-text)', borderColor: 'var(--pp-surface-edge)' }} />
                <button className={`btn ${copied ? 'btn-outline-success' : 'btn-outline-secondary'}`} onClick={copyInvite}>
                  <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'}`}></i>
                </button>
              </div>
              <div className="mt-2" style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '.7rem', letterSpacing: 1, color: 'var(--pp-text-muted)', fontFamily: 'ui-monospace, monospace' }}>
                  {league.invite_code}
                </span>
              </div>
            </div>
          )}

          {/* League details (collapsed-feeling, compact) */}
          <div className="lg-card">
            <div className="lg-card-header">
              <span className="lg-card-title"><i className="bi bi-info-circle"></i>League info</span>
            </div>
            <div className="lg-info-row"><span className="lg-info-label">Commissioner</span><span className="lg-info-value">{league.commissioner_name}</span></div>
            <div className="lg-info-row"><span className="lg-info-label">Squad size</span><span className="lg-info-value">{league.squad_size}</span></div>
            <div className="lg-info-row"><span className="lg-info-label">On-field</span><span className="lg-info-value">{league.on_field_count}</span></div>
            <div className="lg-info-row"><span className="lg-info-label">Draft type</span><span className="lg-info-value" style={{ textTransform: 'capitalize' }}>{league.draft_type}</span></div>
            <div className="lg-info-row"><span className="lg-info-label">Pick timer</span><span className="lg-info-value">{league.pick_timer_secs}s</span></div>
            <div className="lg-info-row">
              <span className="lg-info-label">Trade window</span>
              <span className="lg-info-value" style={{ color: league.trade_window_open ? '#7ee787' : '#ff8a82' }}>
                <i className="bi bi-circle-fill me-1" style={{ fontSize: '.5rem' }}></i>{league.trade_window_open ? 'Open' : 'Closed'}
              </span>
            </div>
            <div className="lg-info-row" style={{ borderBottom: 0, marginTop: 8 }}>
              <span className="lg-info-label">Positions</span>
              <span style={{ display: 'flex', gap: 6 }}>
                {league.position_slots.filter(p => !p.is_bench).map((slot, i) => (
                  <span key={i} className={`pos-badge pos-${slot.position_code}`} style={{ fontSize: '.65rem' }}>
                    {slot.position_code} <b>{slot.count}</b>
                  </span>
                ))}
              </span>
            </div>
          </div>

          {/* Scoring rules (only if custom/uf) */}
          {league.scoring_type === 'custom' && Object.keys(scoring_rules).length > 0 && (
            <div className="lg-card">
              <div className="lg-card-header"><span className="lg-card-title"><i className="bi bi-calculator"></i>Scoring</span></div>
              {Object.entries(scoring_rules).map(([stat, pts]) => (
                <div key={stat} className="lg-info-row">
                  <span className="lg-info-label" style={{ textTransform: 'capitalize' }}>{stat.replace(/_/g, ' ')}</span>
                  <span className="lg-info-value">{pts} pts</span>
                </div>
              ))}
            </div>
          )}

          {/* Teams full list (under everything else; clickable) */}
          <div className="lg-card">
            <div className="lg-card-header">
              <span className="lg-card-title"><i className="bi bi-people"></i>All teams</span>
              <span style={{ fontSize: '.7rem', color: 'var(--pp-text-muted)' }}>{teams.length}/{league.num_teams}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {teams.map(t => (
                <div key={t.id} onClick={() => navigate(`/leagues/${leagueId}/team/${t.id}`)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                           padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                           background: t.is_mine ? 'rgba(var(--lg-me-rgb), .08)' : 'transparent' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--pp-text-strong)' }}>{t.name}</span>
                    {t.is_mine && <span className="lg-hero-mine-pill" style={{ fontSize: '.5rem' }}>YOU</span>}
                  </span>
                  <span style={{ fontSize: '.7rem', color: 'var(--pp-text-muted)' }}>{t.owner}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
