import { useParams, Link } from 'react-router'
import { useEffect, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton'
import { TeamCrest } from '../../components/draft/TeamCrest'
import { TeamBadge } from '../../components/ui/TeamBadge'

/** Days, hours, minutes and seconds to the draft, ticking. */
function DraftClock({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const left = Math.max(0, new Date(target).getTime() - now)
  if (left <= 0) return <div className="dh-clock"><div className="dh-live">The draft is on</div></div>
  const parts: [number, string][] = [
    [Math.floor(left / 86400000), 'days'],
    [Math.floor((left % 86400000) / 3600000), 'hours'],
    [Math.floor((left % 3600000) / 60000), 'mins'],
    [Math.floor((left % 60000) / 1000), 'secs'],
  ]
  return (
    <div className="dh-clock" role="timer" aria-label="Time until the draft">
      {parts.map(([n, label]) => (
        <div key={label} className="dh-unit">
          <b>{String(n).padStart(2, '0')}</b>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

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
  /** Set once the league has no round left to play: what the off-season
   *  still asks (the draft, delistings) in place of rounds and lockouts. */
  offseason?: {
    draft_at: string | null
    draft_done: boolean
    delist_open: boolean
    delist_closes_at: string | null
    list_size: number | null
    target_size: number | null
    to_cut: number | null
    squad_size?: number
    clubs?: {
      id: number; name: string; logo: string | null; accent: string
      order: number; list_size: number; to_cut: number; spots: number; picks: number
    }[]
  } | null
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
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

// ── Page ─────────────────────────────────────────────────────
// Home is one thing. Before the draft it is draft night (the dh2 block).
// In season it is this round: your game, one sentence, then the round's
// other games and the ladder. Everything else lives on its own page.
export function DashboardPage() {
  const { leagueId } = useParams()
  const { data, loading, refetch } = useFetch<DashboardData>(`/leagues/${leagueId}?format=json`)
  const [copied, setCopied] = useState(false)
  const [joinName, setJoinName] = useState('')

  if (loading) return <DashboardSkeleton />
  if (!data) return <p className="text-danger">Failed to load dashboard</p>

  const { league, user_team, teams, this_matchup, my_rank, standings, league_fixtures, current_round,
    live_games_count, next_lockout_at, pending_incoming, delist_open, offseason } = data
  const draftWhen = offseason?.draft_at ? when(offseason.draft_at) : null

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

  const m = this_matchup
  const played = m && m.status !== 'scheduled'
  const gap = m ? Math.abs(Math.round(m.margin)) : 0
  // Before anyone has played, everyone is level: a ladder position means nothing.
  const anyPlayed = standings.some(r => r.wins + r.losses + r.draws > 0)
  const rank = my_rank && anyPlayed ? ` You are ${ordinal(my_rank)} on the ladder.` : ''
  let line = ''
  if (m) {
    if (m.status === 'scheduled') line = next_lockout_at ? `Lockout is ${when(next_lockout_at)}.` : 'Set your lineup before the round starts.'
    else if (m.status === 'live') {
      line = m.margin > 0 ? `You lead ${m.opp.name} by ${gap}.` : m.margin < 0 ? `You trail ${m.opp.name} by ${gap}.` : `Level with ${m.opp.name}.`
      if (live_games_count > 0) line += ` ${live_games_count} AFL game${live_games_count === 1 ? '' : 's'} live.`
    } else line = m.margin > 0 ? `You beat ${m.opp.name} by ${gap}.` : m.margin < 0 ? `You lost to ${m.opp.name} by ${gap}.` : `You tied with ${m.opp.name}.`
    line += rank
  } else if (offseason?.draft_done) {
    line = `The draft is done. The ${league.season_year + 1} season starts when the commissioner opens it.`
  } else if (user_team) {
    line = `No game for you this round.${rank}`
  }
  const state = m ? (m.status === 'live' ? ', live' : m.status === 'scheduled' ? '' : ', final') : ''
  const leagueFull = teams.length >= league.num_teams

  return (
    <div className={`lg-page${offseason && !offseason.draft_done ? ' is-offseason' : ''}`}>

      {/* ── OFF-SEASON: the draft and the cuts, in place of rounds ── */}
      {offseason && !offseason.draft_done && (
        <section className="dh2">
          <div className="dh2-head">
            <div>
              <div className="dh2-label">Draft night</div>
              <h1 className="dh2-when">{draftWhen ?? 'Date to be set'}</h1>
            </div>
            {offseason.draft_at && <DraftClock target={offseason.draft_at} />}
          </div>
          {(() => {
            const mine = user_team ? offseason.clubs?.find(c => c.id === user_team.id) : undefined
            if (!user_team || !mine) return null
            return (
              <div className="dh2-you">
                <div className="dh2-you-text">
                  {mine.to_cut > 0
                    ? `You have ${mine.list_size} on your list. Cut ${mine.to_cut} before the draft.`
                    : `Your list is ready: ${mine.list_size} players and ${mine.picks} picks.`}
                </div>
                <div className="dh2-actions">
                  <Link className="kx-btn kx-btn-gold" to={`/leagues/${leagueId}/team/${user_team.id}`}>{mine.to_cut > 0 ? 'Make cuts' : 'My list'}</Link>
                  <Link className="kx-btn" to={`/leagues/${leagueId}/draft`}>Draft room</Link>
                </div>
              </div>
            )
          })()}
          {offseason.clubs && offseason.clubs.length > 0 && (
            <table className="kx-table dh2-table">
              <thead>
                <tr><th className="num" style={{ width: 64 }}>Pick</th><th>Club</th><th className="num">List</th><th className="num">Picks</th><th>Status</th></tr>
              </thead>
              <tbody>
                {offseason.clubs.map(c => (
                  <tr key={c.id} className={user_team && c.id === user_team.id ? 'sn-me' : undefined}>
                    <td className="num">{c.order}</td>
                    <td>
                      <Link className="dh2-club" to={`/leagues/${leagueId}/team/${c.id}`}>
                        <TeamCrest team={c} size={30} />{c.name}
                      </Link>
                    </td>
                    <td className="num">{c.list_size}</td>
                    <td className="num">{c.picks}</td>
                    <td className={c.to_cut > 0 ? 'dh2-due' : 'dh2-ok'}>{c.to_cut > 0 ? `${c.to_cut} to cut` : 'Ready'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="hm">
        <div className="hm-head">
          <div className="dh2-label">{m ? `${m.round === 0 ? 'Opening Round' : `Round ${m.round}`}${state}` : league.name}</div>
          {m ? (
            <div className="hm-game">
              <Link className="hm-side" to={`/leagues/${leagueId}/team/${m.me.id}`}>
                <TeamBadge name={m.me.id} size={44} showName={false} />
                <span className="hm-name">{m.me.name}</span>
                {played && <span className="hm-num">{Math.round(m.me.score).toLocaleString()}</span>}
              </Link>
              <span className="hm-v">v</span>
              <Link className="hm-side" to={`/leagues/${leagueId}/team/${m.opp.id}`}>
                <TeamBadge name={m.opp.id} size={44} showName={false} />
                <span className="hm-name">{m.opp.name}</span>
                {played && <span className="hm-num">{Math.round(m.opp.score).toLocaleString()}</span>}
              </Link>
            </div>
          ) : (
            <h1 className="dh2-when">{user_team ? user_team.name : `Welcome to ${league.name}`}</h1>
          )}
        </div>

        {user_team ? (
          <div className="dh2-you">
            <div className="dh2-you-text">{line}</div>
            <div className="dh2-actions">
              {m
                ? <Link className="kx-btn kx-btn-gold" to={`/leagues/${leagueId}/gameday`}>Gameday</Link>
                : offseason?.draft_done && <Link className="kx-btn kx-btn-gold" to={`/leagues/${leagueId}/draft/recap`}>Draft recap</Link>}
              <Link className="kx-btn" to={`/leagues/${leagueId}/team/${user_team.id}`}>My team</Link>
            </div>
          </div>
        ) : (
          <form className="dh2-you" onSubmit={joinLeague}>
            <input type="text" className="form-control hm-join" placeholder="Your team name" aria-label="Your team name"
              required maxLength={120} value={joinName} onChange={e => setJoinName(e.target.value)} />
            <button type="submit" className="kx-btn kx-btn-gold">Join the league</button>
          </form>
        )}

        {(pending_incoming > 0 || delist_open) && user_team && (
          <div className="hm-todo">
            {pending_incoming > 0 && (
              <Link className="sq-chip due" to={`/leagues/${leagueId}/trades`}>
                {pending_incoming} trade offer{pending_incoming === 1 ? '' : 's'} to answer
              </Link>
            )}
            {delist_open && <Link className="sq-chip" to={`/leagues/${leagueId}/team/${user_team.id}`}>Delistings are open</Link>}
          </div>
        )}

        {league_fixtures.length > 0 && (
          <>
            <h2 className="hm-h">{current_round === 0 ? 'Opening Round' : `Round ${current_round}`}</h2>
            <table className="kx-table hm-games">
              <tbody>
                {league_fixtures.map(fx => (
                  <tr key={fx.id} className={fx.home.is_mine || fx.away.is_mine ? 'sn-me' : undefined}>
                    <td><Link className="dh2-club" to={`/leagues/${leagueId}/matchup/${fx.id}`}><TeamBadge name={fx.home.id} size={30} showName={false} />{fx.home.name}</Link></td>
                    <td className="num hm-sc">{fx.status !== 'scheduled' ? Math.round(fx.home.score).toLocaleString() : ''}</td>
                    <td className="hm-vs">v</td>
                    <td className="hm-sc">{fx.status !== 'scheduled' ? Math.round(fx.away.score).toLocaleString() : ''}</td>
                    <td><Link className="dh2-club" to={`/leagues/${leagueId}/matchup/${fx.id}`}><TeamBadge name={fx.away.id} size={30} showName={false} />{fx.away.name}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {standings.length > 0 && anyPlayed && (
          <>
            <h2 className="hm-h">Ladder</h2>
            <table className="kx-table dh2-table">
              <thead>
                <tr><th className="num" style={{ width: 64 }}>Pos</th><th>Club</th><th className="num">W-L</th><th className="num">%</th><th className="num">Pts</th></tr>
              </thead>
              <tbody>
                {standings.map(r => (
                  <tr key={r.team.id} className={r.team.is_mine ? 'sn-me' : undefined}>
                    <td className="num">{r.rank}</td>
                    <td><Link className="dh2-club" to={`/leagues/${leagueId}/team/${r.team.id}`}><TeamBadge name={r.team.id} size={30} showName={false} />{r.team.name}</Link></td>
                    <td className="num">{r.wins}-{r.losses}{r.draws > 0 ? `-${r.draws}` : ''}</td>
                    <td className="num">{r.pct.toFixed(1)}</td>
                    <td className="num">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {league.invite_code && !leagueFull && (
          <div className="hm-invite">
            <span>{league.num_teams - teams.length} spot{league.num_teams - teams.length === 1 ? '' : 's'} open. Send this link to bring a coach in.</span>
            <button type="button" className="kx-btn kx-btn-sm" onClick={copyInvite}>{copied ? 'Copied' : 'Copy invite link'}</button>
          </div>
        )}
      </section>

    </div>
  )
}
