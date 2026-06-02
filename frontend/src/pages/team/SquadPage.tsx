import { useParams, Link, useSearchParams } from 'react-router'
import { useState, useMemo, useCallback, useRef, useEffect, Component, type ErrorInfo, type ReactNode } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { StatTile } from '../../components/ui/StatTile'
import { MatchupStrip } from '../../components/ui/MatchupStrip'
import { SquadSkeleton } from '../../components/ui/SquadSkeleton'
import { ByePlanner } from '../../components/ui/ByePlanner'
import { HistoricalSquadView } from '../../components/squad/HistoricalSquadView'
import { RoundPicker } from '../../components/ui/RoundPicker'
import { FieldView, type FieldData } from '../../components/squad/FieldView'
import { PlayerModal } from '../../components/squad/PlayerModal'
import { MobileActionSheet } from '../../components/squad/MobileActionSheet'
import { useFieldActions, checkSwapEligible } from '../../hooks/useFieldActions'
import { SSPModal } from '../../components/squad/SSPModal'
import { useLeague } from '../../contexts/LeagueContext'

interface Player {
  id: number; name: string; position: string; afl_team: string; age: number
  sc_avg: number; games_played: number; career_games: number; rating: number | null
  injury_type: string | null; injury_return: string | null; injury_severity: string | null
}
interface RosterEntry {
  player_id: number; is_captain: boolean; is_vice_captain: boolean
  is_emergency: boolean; is_benched: boolean; position_code: string; acquired_via: string
}
interface WishlistPlayer {
  player: { id: number; name: string; position: string; afl_team: string; age: number }
  sc_avg: number; trend: number; games: number; owner: string | null
}
interface SquadData {
  league: { id: number; name: string }
  team: { id: number; name: string; logo_url: string | null; owner: string }
  players: Player[]; roster: RosterEntry[]; is_owner: boolean; view: string
  field_data: FieldData | null
  alltime_stats: Record<string, Record<string, number>>
  team_logos: Record<string, string>
  squad_size: number; active_count: number; approved_ltil_count: number
  over_squad: boolean; squad_excess: number
  under_squad: boolean; squad_shortfall: number
  ineligible_roster: boolean
  eligibility_shortages: { pos: string; short_by: number }[]
  delist_is_open: boolean; delist_period: { closes_at: string | null } | null
  team_delist_count: number; min_delists: number; max_delists: number | null
  delisted_player_ids: number[]
  pending_incoming: number; trade_is_open: boolean; trade_close_date: string | null
  next_window_open_at: string | null; next_window_label: string | null
  has_active_draft: boolean; active_draft_round: number | null; next_delist_info: string | null
  draft_status: string | null; draft_scheduled_at: string | null; is_commissioner: boolean
  selected_player_ids: number[]; emergency_ids_all: number[]; sevens_ids_all: number[]
  wishlist_players: WishlistPlayer[]
}

// Error boundary to catch and display crashes instead of black screen
class SquadErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Squad page crash:', error, info) }
  render() {
    if (this.state.error) return (
      <div className="card mt-4"><div className="card-body">
        <h5 style={{ color: '#f85149' }}>Something went wrong</h5>
        <pre style={{ fontSize: '.75rem', color: '#8b949e', whiteSpace: 'pre-wrap' }}>{this.state.error.message}{'\n'}{this.state.error.stack}</pre>
        <button className="btn btn-sm btn-outline-primary mt-2" onClick={() => window.location.reload()}>Reload</button>
      </div></div>
    )
    return this.props.children
  }
}

// Single "Optimise lineup" dropdown (matches the SPA's custom-dropdown pattern,
// not Bootstrap JS). Picks the metric, then defers to the parent's optimise().
function OptimiseMenu({ optimising, onPick }: {
  optimising: 'rating' | 'sc_avg' | null
  onPick: (m: 'rating' | 'sc_avg') => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  const itemStyle: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
    border: 'none', color: '#c9d1d9', padding: '7px 12px', borderRadius: 6,
    fontSize: '.85rem', cursor: 'pointer', whiteSpace: 'nowrap',
  }
  function pick(m: 'rating' | 'sc_avg') { setOpen(false); onPick(m) }
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" className="btn btn-sm btn-primary" disabled={optimising !== null}
        onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="true">
        {optimising !== null
          ? <><span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Optimising…</>
          : <><i className="bi bi-magic me-1"></i>Optimise lineup<i className="bi bi-chevron-down ms-1"></i></>}
      </button>
      {open && (
        <div role="menu" style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 30,
          background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
          padding: 4, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          <button type="button" role="menuitem" style={itemStyle} onClick={() => pick('rating')}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(177,186,196,.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <i className="bi bi-star me-2"></i>By Rating
          </button>
          <button type="button" role="menuitem" style={itemStyle} onClick={() => pick('sc_avg')}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(177,186,196,.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <i className="bi bi-graph-up me-2"></i>By SC Average
          </button>
        </div>
      )}
    </span>
  )
}

export function SquadPageWrapper() {
  return <SquadErrorBoundary><SquadPageInner /></SquadErrorBoundary>
}

const POS_COLORS: Record<string, { bg: string; text: string; row: string }> = {
  DEF: { bg: 'rgba(26,63,102,.35)', text: '#79c0ff', row: 'rgba(26,63,102,.08)' },
  MID: { bg: 'rgba(53,29,74,.35)', text: '#d2a8ff', row: 'rgba(53,29,74,.08)' },
  RUC: { bg: 'rgba(29,61,46,.35)', text: '#7ee787', row: 'rgba(29,61,46,.08)' },
  FWD: { bg: 'rgba(70,41,10,.35)', text: '#ffb471', row: 'rgba(70,41,10,.08)' },
}

export { SquadPageWrapper as SquadPage }

function SquadPageInner() {
  const { leagueId, teamId } = useParams()
  const { league } = useLeague()
  // Past-round browsing (#21). null = current (live FieldView), number = snapshot.
  const [archiveRound, setArchiveRound] = useState<number | null>(null)
  // Bye preview (#14). When set, the field greys out players on bye that round.
  const [byePreviewRound, setByePreviewRound] = useState<number | null>(null)
  // playerId set for the previewed bye round, populated by ByePlanner via callback.
  const [byePreviewIds, setByePreviewIds] = useState<Set<number>>(new Set())
  // Owner name → team_id lookup for trade-from-row deep links inside
  // the wishlist view (wp.owner is the team name string).
  const ownerNameToId = useMemo(() => {
    const m = new Map<string, number>()
    league?.teams.forEach(t => m.set(t.name, t.id))
    return m
  }, [league])
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view') || 'field'
  const { data, loading, error, refetch } = useFetch<SquadData>(`/leagues/${leagueId}/team/${teamId}?format=json&view=${view}`)
  const fieldActions = useFieldActions(leagueId!, teamId!, refetch)
  const [optimising, setOptimising] = useState<'rating' | 'sc_avg' | null>(null)

  async function optimise(metric: 'rating' | 'sc_avg') {
    const label = metric === 'rating' ? 'rating' : 'SC average'
    if (!window.confirm(
      `Optimise your team by ${label}?\n\nThis rebuilds your on-field lineup and emergencies with the best available players, ` +
      `excluding bye players, injuries (short/long), 7s and LTIL. Captain & Vice-Captain are kept, and any locked players are left in place.`
    )) return
    setOptimising(metric)
    try {
      const res = await fetch(`/leagues/${leagueId}/team/${teamId}/api/optimise`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metric }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { window.alert(j.error || 'Could not optimise team'); return }
      refetch()
    } catch {
      window.alert('Could not optimise team')
    } finally {
      setOptimising(null)
    }
  }
  const [mobileActionPlayer, setMobileActionPlayer] = useState<Player | null>(null)
  const [sspLtilId, setSspLtilId] = useState<number | null>(null)
  const [delistTarget, setDelistTarget] = useState<{ id: number; name: string } | null>(null)
  const [delisting, setDelisting] = useState(false)

  async function removeFromWishlist(playerId: number) {
    try {
      await fetch(`/leagues/${leagueId}/wishlist/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
        credentials: 'include',
      })
      refetch()
    } catch (err) {
      console.error('Failed to remove from wishlist:', err)
    }
  }

  async function confirmDelist() {
    if (!delistTarget) return
    setDelisting(true)
    try {
      const form = new FormData()
      form.set('player_id', String(delistTarget.id))
      // format=json makes the server reply with a real JSON envelope
      // instead of a 302 redirect that fetch() with redirect:'manual'
      // silently treats as success — the previous version of this
      // function quietly closed the modal even when the server rejected.
      const res = await fetch(`/leagues/${leagueId}/season/delist?format=json`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
      let body: { success?: boolean; error?: string } = {}
      try { body = await res.json() } catch { /* non-JSON body */ }
      if (!res.ok || body.success === false) {
        throw new Error(body.error || `Server error: ${res.status}`)
      }
      setDelistTarget(null)
      refetch()
    } catch (err) {
      alert(`Delist failed: ${(err as Error).message}`)
    } finally {
      setDelisting(false)
    }
  }

  // ── Hooks MUST be unconditional — declare these before any early
  // returns. delistContext memoises the per-render-fresh Set + closure
  // that was forcing FieldView (and every PlayerCard) to re-render
  // each time SquadPage updated.
  const onDelist = useCallback((pid: number, name: string) => {
    setDelistTarget({ id: pid, name })
  }, [])
  const delistContext = useMemo(() => {
    if (!data || !data.delist_is_open) return null
    return {
      canDelist: (data.max_delists == null) || (data.team_delist_count < data.max_delists),
      used: data.team_delist_count,
      max: data.max_delists,
      alreadyDelistedIds: new Set(data.delisted_player_ids),
      onDelist,
    }
  }, [data, onDelist])

  if (loading) return <SquadSkeleton />
  if (!data) {
    // Hook already retried once silently. Surface the real reason and
    // give a retry button instead of a dead-end message.
    return (
      <div className="card mt-4"><div className="card-body text-center" style={{ padding: '32px 20px' }}>
        <div style={{ fontSize: '2rem', color: '#484f58', marginBottom: 8 }}>
          <i className="bi bi-cloud-slash"></i>
        </div>
        <h5 style={{ color: '#c9d1d9' }}>Couldn't load your squad</h5>
        <p style={{ fontSize: '.85rem', color: '#8b949e', maxWidth: 420, margin: '8px auto 16px' }}>
          {error
            ? `Server said: ${error.length > 200 ? error.slice(0, 200) + '...' : error}`
            : 'Network seems quiet. The app server may be restarting after a deploy.'}
        </p>
        <div className="d-flex gap-2 justify-content-center">
          <button className="btn btn-sm btn-primary" onClick={() => refetch()}>
            <i className="bi bi-arrow-clockwise me-1"></i>Try again
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => window.location.reload()}>
            Full reload
          </button>
        </div>
      </div></div>
    )
  }

  const { players, roster, is_owner, field_data: fd, alltime_stats: _alltime_stats, team_logos,
    selected_player_ids, emergency_ids_all, sevens_ids_all } = data
  const rosterMap: Record<number, RosterEntry> = {}
  roster.forEach(r => { rosterMap[r.player_id] = r })
  const selectedSet = new Set(selected_player_ids)

  // Summary stats
  let totalSc = 0, scCount = 0, totalAge = 0, ageCount = 0
  const posCounts: Record<string, number> = { DEF: 0, MID: 0, FWD: 0, RUC: 0 }
  players.forEach(p => {
    if (p.sc_avg) { totalSc += p.sc_avg; scCount++ }
    if (p.age) { totalAge += p.age; ageCount++ }
    const primary = (p.position || 'MID').split('/')[0]
    if (primary in posCounts) posCounts[primary]++
  })

  function StatusDot({ player }: { player: Player }) {
    const teamsPlaying = fd ? new Set(fd.teams_playing) : new Set<string>()
    if (teamsPlaying.size > 0 && player.afl_team && !teamsPlaying.has(player.afl_team)) return <span className="status-dot status-dot-bye"></span>
    if (selectedSet.has(player.id)) return <span className="status-dot status-dot-taken"></span>
    if (player.injury_severity) return <span className="status-dot status-dot-injured"></span>
    return <span className="status-dot status-dot-available"></span>
  }

  function MobPlayerRow({ player, section, posCode, showEmg, show7s, style }: {
    player: Player; section: string; posCode?: string; showEmg?: boolean; show7s?: boolean; style?: React.CSSProperties
  }) {
    const lockedTeams = fd ? new Set(fd.locked_teams) : new Set<string>()
    const isLocked = lockedTeams.has(player.afl_team || '')
    const swapSrc = fieldActions.swapSource
    const isSwapActive = swapSrc?.pid === player.id
    const isEmgP = fd ? fd.emergency_ids.includes(player.id) : false
    const is7sP = fd ? fd.sevens_ids.includes(player.id) : false
    let isSwapEligible = false
    if (swapSrc && swapSrc.pid !== player.id && !isLocked) {
      const posParts = (player.position || 'MID').split('/')
      if (fieldActions.actionMode === 'swap') {
        isSwapEligible = checkSwapEligible(swapSrc, section, posParts, (posCode || '').toUpperCase())
      } else if (fieldActions.actionMode === 'emg_replace') {
        isSwapEligible = isEmgP
      } else if (fieldActions.actionMode === '7s_replace') {
        isSwapEligible = is7sP
      }
    }
    const isByePreviewed = byePreviewRound != null && byePreviewIds.has(player.id)
    return (
      <div className={`mob-pos-row${isLocked ? ' mob-pos-locked' : ''}${fd?.cap_id === player.id ? ' fv-card-captain' : ''}${fd?.vc_id === player.id ? ' fv-card-vc' : ''}${isSwapActive ? ' fv-swap-active' : ''}${isSwapEligible ? ' fv-swap-eligible' : ''}${isByePreviewed ? ' fv-card-bye' : ''}`}
        data-player-id={player.id} data-section={section} data-positions={player.position || 'MID'} data-field-pos={posCode || ''}
        data-locked={isLocked ? '1' : ''} data-emg={showEmg ? '1' : ''} data-sevens={show7s ? '1' : ''} data-age={String(player.age || '')}
        onClick={() => {
          if (fieldActions.swapSource) {
            fieldActions.handlePlayerClick(player.id, section, (player.position || 'MID').split('/'), posCode || '', isLocked, isEmgP, is7sP)
          } else if (is_owner) { setMobileActionPlayer(player) }
          else { fieldActions.showPlayer(player.id) }
        }}
        style={{ cursor: 'pointer', ...style }}>
        <StatusDot player={player} />
        {player.afl_team && team_logos[player.afl_team] ? (
          <img src={team_logos[player.afl_team]} alt="" className="mob-pos-logo" />
        ) : <div className="mob-pos-logo" style={{ width: 26, height: 26 }}></div>}
        <div className="mob-pos-info">
          <div className="mob-pos-name">
            {player.name}
            {isLocked && <i className="bi bi-lock-fill mob-lock-icon"></i>}
            {!isLocked && selectedSet.has(player.id) && <i className="bi bi-check-circle-fill" style={{ fontSize: '.6rem', color: '#3fb950', marginLeft: 4, verticalAlign: 'middle' }}></i>}
            {fd?.cap_id === player.id && <span className="mob-pos-badge mob-badge-cap">C</span>}
            {fd?.vc_id === player.id && <span className="mob-pos-badge mob-badge-vc">VC</span>}
            {showEmg && <span className="mob-pos-badge mob-badge-emg">E</span>}
            {show7s && <span className="mob-pos-badge mob-badge-7s">7</span>}
          </div>
          <div className="mob-pos-meta">
            {(player.position || 'MID').split('/').map(ps => (
              <span key={ps} className={`pos-badge pos-${ps}`} style={{ fontSize: '.62rem', padding: '1px 5px' }}>{ps}</span>
            ))}
            <span>{player.afl_team || ''}</span>
            {player.injury_severity && <span className="squad-mob-injury"><i className="bi bi-bandaid-fill"></i> {player.injury_type || 'Injured'}</span>}
          </div>
        </div>
        <div className="mob-pos-sc">
          {player.sc_avg ? <span style={{ color: '#e6edf3', fontWeight: 700 }}>{player.sc_avg.toFixed(1)}</span> : <span style={{ color: '#484f58' }}>-</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Hero Header ── */}
      <div className="squad-hero">
        <div className="squad-hero-inner">
          <div className="d-flex align-items-center gap-3">
            <div className="squad-logo-wrap">
              {data.team.logo_url ? <img src={data.team.logo_url} alt="" className="squad-logo-img" width={48} height={48} />
                : <div className="squad-logo-placeholder">{data.team.name.substring(0, 2).toUpperCase()}</div>}
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h2 className="squad-hero-title">{data.team.name}</h2>
                <span className="squad-hero-count d-none d-lg-inline">{players.length} players</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Team tab bar (desktop + mobile) — matches league/players subnav design ── */}
      <div className="league-subnav d-none d-lg-flex">
        <Link to={`/leagues/${leagueId}/team/${teamId}`} className={`league-subtab${view === 'field' ? ' active' : ''}`}>
          <i className="bi bi-diagram-3"></i>Field
        </Link>
        <Link to={`/leagues/${leagueId}/team/${teamId}/stats`} className="league-subtab">
          <i className="bi bi-graph-up"></i>Stats
        </Link>
        <Link to={`/leagues/${leagueId}/team/${teamId}/analytics`} className="league-subtab">
          <i className="bi bi-bar-chart-line"></i>Analytics
        </Link>
        <Link to={`/leagues/${leagueId}/trades`} className="league-subtab">
          <i className="bi bi-arrow-left-right"></i>Trades
        </Link>
        {is_owner && (
          <Link to={`/leagues/${leagueId}/team/${teamId}?view=wishlist`} className={`league-subtab${view === 'wishlist' ? ' active' : ''}`} style={view === 'wishlist' ? { color: '#d29922', borderBottomColor: '#d29922' } : undefined}>
            <i className="bi bi-star"></i>Wishlist
          </Link>
        )}
      </div>
      <div className="mob-subnav d-lg-none">
        <Link to={`/leagues/${leagueId}/team/${teamId}`} className={`mob-subnav-item text-decoration-none${view === 'field' ? ' active' : ''}`}><i className="bi bi-diagram-3"></i><span>Field</span></Link>
        <Link to={`/leagues/${leagueId}/team/${teamId}/stats`} className="mob-subnav-item text-decoration-none"><i className="bi bi-graph-up"></i><span>Stats</span></Link>
        <Link to={`/leagues/${leagueId}/team/${teamId}/analytics`} className="mob-subnav-item text-decoration-none"><i className="bi bi-bar-chart-line"></i><span>Analytics</span></Link>
        <Link to={`/leagues/${leagueId}/trades`} className="mob-subnav-item text-decoration-none"><i className="bi bi-arrow-left-right"></i><span>Trades</span></Link>
        {is_owner && (
          <Link to={`/leagues/${leagueId}/team/${teamId}?view=wishlist`} className={`mob-subnav-item text-decoration-none${view === 'wishlist' ? ' active' : ''}`} style={{ color: '#d29922' }}><i className="bi bi-star"></i><span>Wishlist</span></Link>
        )}
      </div>

      {/* ── Non-owner notice ── */}
      {!is_owner && (
        <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2" style={{ background: 'rgba(139,148,158,.08)', border: '1px solid #30363d', borderRadius: 8, fontSize: '.85rem', color: '#8b949e' }}>
          <i className="bi bi-eye"></i><span>Viewing <strong style={{ color: '#c9d1d9' }}>{data.team.name}</strong>'s squad (read-only)</span>
        </div>
      )}

      {/* ── Squad tools ──
              Matchup + bye planner + round picker. Grouped as a distinct
              "tools" panel, visually separate from the trade-period
              centre below — these are persistent squad context, not the
              temporary trade-window alerts. */}
      {is_owner && (
        <div className="squad-tools">
          {league?.current_matchup && (
            <MatchupStrip
              round={league.current_round}
              matchup={league.current_matchup}
              lockoutTime={league.next_lockout_at}
              leagueId={leagueId!}
            />
          )}
          <ByePlanner
            leagueId={leagueId!}
            teamId={teamId!}
            previewRound={byePreviewRound}
            onPreviewRound={(round, ids) => {
              setByePreviewRound(round)
              setByePreviewIds(new Set(ids))
            }}
          />
          {league?.current_round && league.current_round > 1 && (
            <RoundPicker
              currentRound={league.current_round}
              selected={archiveRound}
              onSelect={setArchiveRound}
            />
          )}
          {view === 'field' && (
            <div className="d-flex align-items-center gap-2 flex-wrap" style={{ marginTop: 4 }}>
              <OptimiseMenu optimising={optimising} onPick={optimise} />
            </div>
          )}
        </div>
      )}

      {/* ── Trade-period centre ──
              Only shown while a trade/delist window is actually OPEN: cap
              status, delists left, incoming offers, window countdown + a jump
              to the Trade Center. When closed it collapses to the compact
              "next window opens" badge below. */}
      {is_owner && (data.trade_is_open || data.delist_is_open) && (
        <div className="kl-status-pills kl-trade-centre">
          <span className="kl-trade-centre-label"><i className="bi bi-arrow-left-right"></i> Trade period</span>
          {data.over_squad && (
            <div className="kl-status-pill kl-status-pill-danger" title={`${data.active_count}/${data.squad_size}${data.approved_ltil_count > 0 ? ` + ${data.approved_ltil_count} LTIL` : ''}`}>
              <span className="kl-status-pill-icon"><i className="bi bi-exclamation-octagon-fill"></i></span>
              <span className="kl-status-pill-text">
                <span className="kl-status-pill-title">{data.squad_excess} over cap</span>
                <span className="kl-status-pill-sub">{data.active_count}/{data.squad_size}{data.approved_ltil_count > 0 ? ` + ${data.approved_ltil_count} LTIL` : ''}</span>
              </span>
            </div>
          )}
          {data.under_squad && !data.over_squad && (
            <div className="kl-status-pill kl-status-pill-warn" title={`${data.active_count}/${data.squad_size}`}>
              <span className="kl-status-pill-icon"><i className="bi bi-dash-circle"></i></span>
              <span className="kl-status-pill-text">
                <span className="kl-status-pill-title">{data.squad_shortfall} open spot{data.squad_shortfall === 1 ? '' : 's'}</span>
                <span className="kl-status-pill-sub">{data.active_count}/{data.squad_size}</span>
              </span>
            </div>
          )}
          {data.ineligible_roster && data.trade_is_open && (
            <div className="kl-status-pill kl-status-pill-danger"
              title="Roster can't field a valid round-start lineup">
              <span className="kl-status-pill-icon"><i className="bi bi-shield-fill-exclamation"></i></span>
              <span className="kl-status-pill-text">
                <span className="kl-status-pill-title">Ineligible</span>
                <span className="kl-status-pill-sub">short {data.eligibility_shortages.map(s => `${s.short_by} ${s.pos}`).join(', ')}</span>
              </span>
            </div>
          )}
          {/* Per Lucas: show how many delists are LEFT, not how many
              have been done. Frame from the "what can I still do?"
              perspective. Tone downgrades to neutral once exhausted. */}
          {data.delist_is_open && data.max_delists != null && (() => {
            const remaining = Math.max(0, data.max_delists - data.team_delist_count)
            const exhausted = remaining === 0
            return (
              <div className={`kl-status-pill ${exhausted ? '' : 'kl-status-pill-warn'}`} title={`Used ${data.team_delist_count} of ${data.max_delists} this delist period`}>
                <span className="kl-status-pill-icon"><i className="bi bi-x-octagon"></i></span>
                <span className="kl-status-pill-text">
                  <span className="kl-status-pill-title">
                    {exhausted ? 'No delists left' : `${remaining} delist${remaining === 1 ? '' : 's'} left`}
                  </span>
                  <span className="kl-status-pill-sub">{exhausted ? 'period is exhausted' : 'hover player → ⊗'}</span>
                </span>
              </div>
            )
          })()}
          {data.delist_is_open && data.max_delists == null && (
            <div className="kl-status-pill kl-status-pill-warn" title="Delist period open (no per-team cap)">
              <span className="kl-status-pill-icon"><i className="bi bi-x-octagon"></i></span>
              <span className="kl-status-pill-text">
                <span className="kl-status-pill-title">Delists open</span>
                <span className="kl-status-pill-sub">hover player → ⊗</span>
              </span>
            </div>
          )}
          {data.pending_incoming > 0 && (
            <Link to={`/leagues/${leagueId}/trades`} className="kl-status-pill kl-status-pill-info kl-status-pill-link">
              <span className="kl-status-pill-icon"><i className="bi bi-inbox-fill"></i></span>
              <span className="kl-status-pill-text">
                <span className="kl-status-pill-title">{data.pending_incoming} incoming</span>
                <span className="kl-status-pill-sub">trade proposal{data.pending_incoming === 1 ? '' : 's'}</span>
              </span>
            </Link>
          )}
          {data.trade_is_open && data.trade_close_date && (
            <div className="kl-status-pill kl-status-pill-warn kl-status-pill-deadline"
              title={new Date(data.trade_close_date).toLocaleString()}>
              <span className="kl-status-pill-icon"><i className="bi bi-clock"></i></span>
              <span className="kl-status-pill-text">
                <span className="kl-status-pill-title">{new Date(data.trade_close_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</span>
                <span className="kl-status-pill-sub">window closes</span>
              </span>
            </div>
          )}
          {data.trade_is_open && (
            <Link to={`/leagues/${leagueId}/trades`} className="kl-status-pill-cta">
              Trade Center
              <i className="bi bi-arrow-right"></i>
            </Link>
          )}
        </div>
      )}

      {/* ── Closed-window badge ──
              When no trade/delist window is open, the trade-period centre is
              gone — replaced by this tiny pill. It names the reopen date when a
              future window is scheduled, otherwise just shows trades are closed
              so the collapsed state is always visible (never blank). */}
      {is_owner && !data.trade_is_open && !data.delist_is_open && (
        <div
          className="kl-window-badge"
          title={data.next_window_open_at
            ? `${data.next_window_label ?? 'Trade'} window opens ${new Date(data.next_window_open_at).toLocaleString()}`
            : 'Trades and delistings are currently closed'}
        >
          <span className="kl-window-badge-dot"><i className="bi bi-calendar-event"></i></span>
          <span className="kl-window-badge-text">
            {data.next_window_open_at ? (
              <>{data.next_window_label ?? 'Trade'} window opens{' '}
              <strong>{new Date(data.next_window_open_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</strong></>
            ) : (
              <>Trades closed</>
            )}
          </span>
        </div>
      )}

      {/* ── Draft strip ──
          Prominent, mobile-visible entry to the draft room so owners can
          set their pre-draft order before a scheduled draft, or jump in
          when it's live. Falls back to a setup CTA for the commissioner
          when no draft exists yet. */}
      {is_owner && data.has_active_draft && (() => {
        const live = data.draft_status === 'in_progress' || data.draft_status === 'paused'
        const sched = data.draft_status === 'scheduled'
        const when = data.draft_scheduled_at
          ? new Date(data.draft_scheduled_at).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
          : null
        return (
          <Link to={`/leagues/${leagueId}/draft`} className={`kl-draft-strip${live ? ' live' : ''}`}>
            <span className="kl-draft-strip-icon"><i className="bi bi-list-check"></i></span>
            <span className="kl-draft-strip-body">
              <span className="kl-draft-strip-title">
                {sched ? 'Draft Room' : `Draft live${data.active_draft_round ? ` — Round ${data.active_draft_round}` : ''}`}
                {sched && <span className="kl-draft-pill-tag">Scheduled</span>}
                {live && <span className="kl-draft-pill-tag">Live</span>}
              </span>
              <span className="kl-draft-strip-sub">
                {sched
                  ? (when ? `Starts ${when} · set your pre-draft order now` : 'Set your pre-draft order before it starts')
                  : 'Make your picks now'}
              </span>
            </span>
            <span className="kl-draft-strip-cta"><i className="bi bi-box-arrow-in-right"></i><span>Enter</span></span>
          </Link>
        )
      })()}
      {/* The persistent "Set up a draft" commissioner CTA was removed from My
          Team — it belongs in the Commissioner hub (admin action), not on every
          owner's team page. The active/scheduled draft strip above still shows
          when a draft is actually happening. */}

      {/* ── Stat Cards ── */}
      <div className={`squad-stat-cards${view === 'field' ? ' fv-stats-hide-mob' : ''}`}>
        <StatTile label="Total SC Value" value={Math.round(totalSc)} accent="forest" />
        <StatTile label="Avg SC / Player" value={scCount ? totalSc / scCount : 0} accent="sapphire" decimals={1} />
        <StatTile label="Avg Age" value={ageCount ? totalAge / ageCount : 0} accent="ochre" decimals={1} />
        <div className="stat-card"><div className="squad-pos-summary">
          {posCounts.DEF > 0 && <span className="squad-pos-chip squad-chip-def">DEF {posCounts.DEF}</span>}
          {posCounts.MID > 0 && <span className="squad-pos-chip squad-chip-mid">MID {posCounts.MID}</span>}
          {posCounts.FWD > 0 && <span className="squad-pos-chip squad-chip-fwd">FWD {posCounts.FWD}</span>}
          {posCounts.RUC > 0 && <span className="squad-pos-chip squad-chip-ruc">RUC {posCounts.RUC}</span>}
        </div><div className="stat-label">Roster Makeup</div></div>
      </div>

      {/* ══════ WISHLIST VIEW ══════ */}
      {view === 'wishlist' && is_owner && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span className="fw-bold" style={{ fontSize: '.9rem' }}><i className="bi bi-star me-1" style={{ color: '#d29922' }}></i>My Wishlist</span>
            <span style={{ fontSize: '.75rem', color: '#8b949e' }}>{data.wishlist_players.length} player{data.wishlist_players.length !== 1 ? 's' : ''}</span>
          </div>
          {data.wishlist_players.length > 0 ? (
            <div className="card-body p-0" style={{ overflowX: 'auto' }}>
              <table className="table table-hover mb-0" style={{ fontSize: '.82rem' }}>
                <thead><tr><th style={{ width: 30 }}></th><th>Player</th><th>Pos</th><th>AFL Team</th><th className="text-center">Age</th><th className="text-end">SC Avg</th><th className="text-center">Trend</th><th className="text-center">Games</th><th className="text-center">Status</th></tr></thead>
                <tbody>
                  {data.wishlist_players.map(wp => {
                    const p = wp.player
                    return (
                      <tr key={p.id}>
                        <td className="text-center" style={{ padding: 0, verticalAlign: 'middle' }}>
                          <i
                            className="bi bi-star-fill"
                            style={{ cursor: 'pointer', fontSize: '.85rem', color: '#d29922' }}
                            title="Remove from wishlist"
                            onClick={() => removeFromWishlist(p.id)}
                          ></i>
                        </td>
                        <td>
                          <span className="fw-bold" style={{color:"#c9d1d9"}}>
                            {p.name}
                          </span>
                        </td>
                        <td>{(p.position || 'MID').split('/').map(pos => <span key={pos} className={`pos-badge pos-${pos}`} style={{ fontSize: '.65rem', padding: '1px 5px' }}>{pos}</span>)}</td>
                        <td style={{ color: '#8b949e', fontSize: '.78rem' }}>{p.afl_team || '-'}</td>
                        <td className="text-center" style={{ color: '#8b949e' }}>{p.age || '-'}</td>
                        <td className="text-end">{wp.sc_avg ? <span style={{ fontWeight: 600 }}>{wp.sc_avg}</span> : <span style={{ color: '#484f58' }}>-</span>}</td>
                        <td className="text-center">
                          {wp.trend > 5 ? <span className="trend-pill trend-up"><i className="bi bi-caret-up-fill"></i>+{Math.round(wp.trend)}</span>
                            : wp.trend < -5 ? <span className="trend-pill trend-down"><i className="bi bi-caret-down-fill"></i>{Math.round(wp.trend)}</span>
                            : <span className="trend-flat" style={{ fontSize: '.7rem' }}>{wp.trend ? `${wp.trend > 0 ? '+' : ''}${Math.round(wp.trend)}` : '-'}</span>}
                        </td>
                        <td className="text-center" style={{ color: '#8b949e' }}>{wp.games || '-'}</td>
                        <td className="text-center">
                          {wp.owner ? (
                            <span className="d-inline-flex align-items-center gap-1">
                              <span className="status-chip" style={{ background: 'rgba(248,81,73,.1)', color: '#f85149', fontSize: '.65rem' }}>{wp.owner}</span>
                              {wp.owner !== league?.user_team?.name && ownerNameToId.has(wp.owner) && (
                                <Link
                                  to={`/leagues/${leagueId}/trades/propose?with=${p.id}&from=${ownerNameToId.get(wp.owner)}`}
                                  className="trade-from-row"
                                  title={`Propose trade for ${p.name} with ${wp.owner}`}
                                  aria-label={`Propose trade for ${p.name}`}
                                >
                                  <i className="bi bi-arrow-left-right"></i>
                                </Link>
                              )}
                            </span>
                          ) : (
                            <span className="status-chip" style={{ background: 'rgba(63,185,80,.1)', color: '#3fb950', fontSize: '.65rem' }}>Available</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-body p-0">
              <div className="empty-state attention">
                <div className="empty-icon"><i className="bi bi-star"></i></div>
                <h4>Your wishlist is empty</h4>
                <p>Pin players you're watching — trade targets, draft-day shortlists, that breakout you keep circling.</p>
                <Link to={`/leagues/${leagueId}/player-pool`} className="btn btn-primary btn-sm">
                  <i className="bi bi-search me-1"></i>Browse the player pool
                </Link>
              </div>
            </div>
          )}
        </div>
      )}


      {/* ══════ FIELD VIEW ══════ */}
      {view === 'field' && fd && (
        <>
          {archiveRound != null && (
            <HistoricalSquadView leagueId={leagueId!} teamId={teamId!} round={archiveRound} />
          )}
          {archiveRound == null && (<>
          {is_owner && (() => {
            const empty = ['DEF', 'MID', 'RUC', 'FWD'].reduce((n, pos) =>
              n + Math.max(0, (fd.slot_counts[pos] || 0) - (fd.zones[pos] || []).filter(Boolean).length), 0)
              + Math.max(0, (fd.flex_count || 0) - fd.flex_data.filter(s => s.player).length)
            return (
              <div className={`kl-lineup-status ${empty > 0 ? 'warn' : 'ok'}`}>
                <span className="kl-lineup-status-dot"><i className={`bi ${empty > 0 ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill'}`}></i></span>
                <span className="kl-lineup-status-text">
                  {empty > 0
                    ? <><strong>{empty} {empty === 1 ? 'spot' : 'spots'} to fill</strong> on the field</>
                    : <><strong>Lineup set</strong> — every field position filled</>}
                </span>
              </div>
            )
          })()}
          <FieldView fd={fd} teamLogos={data.team_logos} isOwner={is_owner}
            delistContext={delistContext}
            byeIds={byePreviewRound != null ? byePreviewIds : undefined}
            byeRound={byePreviewRound}
            actions={{
              setCaptain: fieldActions.setCaptain, setVC: fieldActions.setVC,
              startSwap: fieldActions.startSwap, handlePlayerClick: fieldActions.handlePlayerClick,
              toggleEmergency: fieldActions.toggleEmergency, toggle7s: fieldActions.toggle7s,
              set7sCaptain: fieldActions.set7sCaptain, addToLTIL: fieldActions.addToLTIL,
              removeFromLTIL: fieldActions.removeFromLTIL, onOpenSSP: (ltilId: number) => setSspLtilId(ltilId),
              showPlayer: fieldActions.showPlayer, cancelAllModes: fieldActions.cancelAllModes,
              swapSource: fieldActions.swapSource, actionMode: fieldActions.actionMode,
            }} />

          {/* Mobile swap/replace-mode banner — fixed to the top of the
              viewport (not sticky) so it's visible no matter where the
              user is scrolled when they tap Swap. Pinned with a Cancel
              button so swap mode is never invisible state. */}
          {fieldActions.swapSource && (() => {
            const srcPlayer = data.players.find(p => p.id === fieldActions.swapSource!.pid)
            const mode = fieldActions.actionMode
            const heading =
              mode === 'emg_replace' ? 'REPLACE EMERGENCY'
              : mode === '7s_replace' ? 'REPLACE 7s PLAYER'
              : 'SWAP MODE'
            const label =
              mode === 'emg_replace'
                ? 'Tap an emergency to remove'
                : mode === '7s_replace'
                  ? 'Tap a 7s player to remove'
                  : srcPlayer
                    ? `Tap any green-highlighted player to swap with ${srcPlayer.name}`
                    : 'Tap a target player'
            return (
              <div className="d-lg-none" style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1080,
                background: 'linear-gradient(135deg, #1f6feb, #8957e5)',
                borderBottom: '2px solid rgba(255,255,255,0.18)',
                padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 6px 24px -4px rgba(0,0,0,0.55)',
              }}>
                <i className="bi bi-arrow-left-right" style={{ color: '#fff', fontSize: '1.1rem' }}></i>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
                  <div style={{ color: '#fff', fontSize: '.68rem', fontWeight: 700, letterSpacing: '.08em', opacity: .85 }}>
                    {heading}
                  </div>
                  <div style={{ color: '#fff', fontSize: '.82rem', fontWeight: 600, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fieldActions.cancelAllModes()}
                  style={{
                    background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.3)',
                    color: '#fff', padding: '6px 14px', borderRadius: 999,
                    fontSize: '.78rem', fontWeight: 700,
                  }}
                >
                  Cancel
                </button>
              </div>
            )
          })()}

          {/* Mobile position-grouped list */}
          <div className={`d-lg-none mob-squad-list${fieldActions.swapSource ? ' fv-swap-mode' : ''}`}>
            {fd && ['DEF', 'MID', 'RUC', 'FWD'].map(pos => {
              const zonePlayers = (fd.zones[pos] || []).filter(Boolean) as Player[]
              if (!zonePlayers.length) return null
              const colors = POS_COLORS[pos] || POS_COLORS.MID
              return (
                <div className="mob-pos-group" key={pos}>
                  <div className="mob-pos-header" style={{ background: colors.bg, borderLeft: `3px solid ${colors.text}` }}>
                    <span className="mob-pos-label" style={{ color: colors.text }}>{pos}</span>
                    <span className="mob-pos-count">{zonePlayers.length}/{fd.zones[pos]?.length || 0}</span>
                  </div>
                  {zonePlayers.map(p => <MobPlayerRow key={p.id} player={p} section="field" posCode={pos} style={{ background: colors.row }} />)}
                </div>
              )
            })}
            {fd && fd.flex_data.some(s => s.player) && (
              <div className="mob-pos-group">
                <div className="mob-pos-header" style={{ background: 'rgba(139,148,158,.15)', borderLeft: '3px solid #8b949e' }}>
                  <span className="mob-pos-label" style={{ color: '#8b949e' }}>FLEX</span>
                  <span className="mob-pos-count">{fd.flex_data.filter(s => s.player).length}/{fd.flex_count}</span>
                </div>
                {fd.flex_data.filter(s => s.player).map(s => {
                  const p = s.player!; const colors = POS_COLORS[(p.position || 'MID').split('/')[0]] || POS_COLORS.MID
                  return <MobPlayerRow key={p.id} player={p} section="flex" style={{ background: colors.row }} />
                })}
              </div>
            )}
            {fd && fd.emergency_players.length > 0 && (
              <div className="mob-pos-group">
                <div className="mob-pos-header" style={{ background: 'rgba(56,166,215,.1)', borderLeft: '3px solid #38a6d7' }}>
                  <span className="mob-pos-label" style={{ color: '#38a6d7' }}><i className="bi bi-shield-exclamation me-1"></i>EMERGENCIES</span>
                  <span className="mob-pos-count">{fd.emergency_players.length} / 4</span>
                </div>
                {fd.emergency_players.map(p => <MobPlayerRow key={p.id} player={p} section="reserve" showEmg style={{ borderLeft: '3px solid rgba(56,166,215,.3)' }} />)}
              </div>
            )}
            {fd && fd.has_7s_fixture && (
              <div className="mob-pos-group">
                <div className="mob-pos-header" style={{ background: 'rgba(188,140,255,.1)', borderLeft: '3px solid #bc8cff' }}>
                  <span className="mob-pos-label" style={{ color: '#bc8cff' }}><i className="bi bi-7-circle me-1"></i>7s SQUAD</span>
                  <span className="mob-pos-count">{fd.sevens_players.length} / 7</span>
                </div>
                {fd.sevens_players.length > 0 ? fd.sevens_players.map(p => <MobPlayerRow key={p.id} player={p} section="reserve" show7s style={{ borderLeft: '3px solid rgba(188,140,255,.3)' }} />) : (
                  <div className="mob-pos-row" style={{ justifyContent: 'center', color: '#484f58', fontSize: '.8rem', padding: 12 }}>Tap the <span style={{ color: '#bc8cff', fontWeight: 600 }}>7</span> button on any reserve to add them</div>
                )}
              </div>
            )}
            {fd && fd.injury_list.length > 0 && (
              <div className="mob-pos-group">
                <div className="mob-pos-header" style={{ background: 'rgba(218,54,51,.1)', borderLeft: '3px solid #da3633' }}>
                  <span className="mob-pos-label" style={{ color: '#da3633' }}><i className="bi bi-bandaid me-1"></i>INJURY LIST</span>
                  <span className="mob-pos-count">{fd.injury_list.length}</span>
                </div>
                {fd.injury_list.map(p => <MobPlayerRow key={p.id} player={p} section="reserve" style={{ borderLeft: '3px solid rgba(218,54,51,.3)' }} />)}
              </div>
            )}
            {fd && fd.reserves.length > 0 && (
              <div className="mob-pos-group mob-reserves-group">
                <div className="mob-pos-header" style={{ background: 'rgba(48,54,61,.4)', borderLeft: '3px solid #484f58' }}>
                  <span className="mob-pos-label" style={{ color: '#6e7681' }}>BENCH</span>
                  <span className="mob-pos-count">{fd.reserves.length}</span>
                </div>
                {fd.reserves.map(p => {
                  const colors = POS_COLORS[(p.position || 'MID').split('/')[0]] || POS_COLORS.MID
                  const isEmg = emergency_ids_all.includes(p.id); const is7s = sevens_ids_all.includes(p.id)
                  return <MobPlayerRow key={p.id} player={p} section="reserve" showEmg={isEmg} show7s={is7s} style={{ borderLeft: `3px solid ${colors.text}22` }} />
                })}
              </div>
            )}
            {fd && (fd.rookies?.length ?? 0) > 0 && (
              <div className="mob-pos-group">
                <div className="mob-pos-header" style={{ background: 'rgba(45,212,191,.12)', borderLeft: '3px solid #2dd4bf' }}>
                  <span className="mob-pos-label" style={{ color: '#2dd4bf' }}><i className="bi bi-stars me-1"></i>ROOKIES</span>
                  <span className="mob-pos-count">{fd.rookies!.length}</span>
                </div>
                {fd.rookies!.map(p => (
                  <MobPlayerRow key={p.id} player={p} section="reserve" style={{ borderLeft: '3px solid rgba(45,212,191,.35)' }} />
                ))}
              </div>
            )}
          </div>
          </>)}
        </>
      )}


      {/* Toasts now route through the global ToastProvider (.kl-toast) —
          old fv-toast pill render deleted */}

      {/* ── Player modal ── */}
      {fieldActions.playerModal && <PlayerModal player={fieldActions.playerModal} teamLogos={data.team_logos} onClose={fieldActions.closePlayerModal} leagueId={leagueId} />}

      {/* ── SSP Modal ── */}
      {sspLtilId && <SSPModal leagueId={leagueId!} teamId={teamId!} ltilId={sspLtilId} onClose={() => setSspLtilId(null)} onSuccess={() => { setSspLtilId(null); refetch() }} />}

      {/* ── Delist confirmation modal ── */}
      {delistTarget && (
        <div
          className="modal show d-block"
          style={{ background: 'rgba(0,0,0,.7)', zIndex: 1055 }}
          onClick={() => !delisting && setDelistTarget(null)}
        >
          <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
            <div className="modal-content" style={{ background: '#161b22', border: '1px solid #30363d' }}>
              <div className="modal-header" style={{ borderBottom: '1px solid #30363d' }}>
                <h5 className="modal-title" style={{ color: '#e6edf3', fontSize: '1rem' }}>
                  <i className="bi bi-x-circle me-2" style={{ color: '#f85149' }}></i>
                  Delist Player
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => !delisting && setDelistTarget(null)}
                  disabled={delisting}
                ></button>
              </div>
              <div className="modal-body">
                <p style={{ color: '#c9d1d9', fontSize: '.9rem' }}>
                  Are you sure you want to delist <strong>{delistTarget.name}</strong>?
                </p>
                <p style={{ color: '#8b949e', fontSize: '.8rem' }}>
                  Once delisted, this player will be removed from your roster at the end of the delist period.
                </p>
              </div>
              <div className="modal-footer" style={{ borderTop: '1px solid #30363d' }}>
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setDelistTarget(null)}
                  disabled={delisting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={confirmDelist}
                  disabled={delisting}
                >
                  <i className="bi bi-x-circle me-1"></i>
                  {delisting ? 'Delisting...' : 'Delist Player'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile action sheet ── */}
      {mobileActionPlayer && is_owner && fd && (
        <MobileActionSheet
          player={mobileActionPlayer} teamLogos={data.team_logos}
          isCaptain={fd.cap_id === mobileActionPlayer.id} isVC={fd.vc_id === mobileActionPlayer.id}
          isEmergency={fd.emergency_ids.includes(mobileActionPlayer.id)}
          is7s={fd.sevens_ids.includes(mobileActionPlayer.id)} is7sCaptain={fd.sevens_captain_id === mobileActionPlayer.id}
          isReserve={!Object.values(fd.zones).flat().some(p => p?.id === mobileActionPlayer.id) && !fd.flex_data.some(s => s.player?.id === mobileActionPlayer.id)}
          has7sFixture={fd.has_7s_fixture} sevens_captain_enabled={fd.sevens_captain_enabled}
          onClose={() => setMobileActionPlayer(null)}
          onSetCaptain={() => fieldActions.setCaptain(mobileActionPlayer.id)}
          onSetVC={() => fieldActions.setVC(mobileActionPlayer.id)}
          onSwap={() => {
            const isFlex = fd.flex_data.some(s => s.player?.id === mobileActionPlayer.id)
            // Find which zone (DEF/MID/RUC/FWD) the player occupies — needed
            // so checkSwapEligible can validate that a reserve target can fill
            // the source's field slot. Without this, reserves never highlight.
            let zone = ''
            for (const pos of ['DEF', 'MID', 'RUC', 'FWD']) {
              if ((fd.zones[pos] || []).some(p => p?.id === mobileActionPlayer.id)) { zone = pos; break }
            }
            const isField = !!zone
            const section = isField ? 'field' : isFlex ? 'flex' : 'reserve'
            fieldActions.startSwap(mobileActionPlayer.id, section, (mobileActionPlayer.position || 'MID').split('/'), zone)
          }}
          onToggleEmg={() => fieldActions.toggleEmergency(mobileActionPlayer.id, fd.emergency_ids, new Set())}
          onToggle7s={() => fieldActions.toggle7s(mobileActionPlayer.id, fd.sevens_ids, mobileActionPlayer.age, new Set())}
          onSet7sCaptain={() => fieldActions.set7sCaptain(mobileActionPlayer.id)}
          onAddLTIL={() => fieldActions.addToLTIL(mobileActionPlayer.id)}
          onViewPlayer={() => fieldActions.showPlayer(mobileActionPlayer.id)}
          onDelist={data.delist_is_open && is_owner
            ? () => setDelistTarget({ id: mobileActionPlayer.id, name: mobileActionPlayer.name })
            : undefined}
          canDelist={data.delist_is_open ? ((data.max_delists == null) || (data.team_delist_count < data.max_delists)) : false}
          alreadyDelisted={data.delisted_player_ids.includes(mobileActionPlayer.id)}
          ltilSlotsAvailable={fd.ssp_enabled && (fd.ltil_entries.length + fd.pending_ltil_count) < fd.ssp_slots}
        />
      )}
    </div>
  )
}
