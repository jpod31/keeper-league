import { useParams, Link, useSearchParams } from 'react-router'
import { useState, Component, type ErrorInfo, type ReactNode } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../../components/ui/Spinner'
import { FieldView, type FieldData } from '../../components/squad/FieldView'
import { PlayerModal } from '../../components/squad/PlayerModal'
import { MobileActionSheet } from '../../components/squad/MobileActionSheet'
import { useFieldActions, checkSwapEligible } from '../../hooks/useFieldActions'
import { SSPModal } from '../../components/squad/SSPModal'

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
  delist_is_open: boolean; delist_period: { closes_at: string | null } | null
  team_delist_count: number; min_delists: number; delisted_player_ids: number[]
  pending_incoming: number; trade_is_open: boolean; trade_close_date: string | null
  has_active_draft: boolean; active_draft_round: number | null; next_delist_info: string | null
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
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view') || 'field'
  const { data, loading, error, refetch } = useFetch<SquadData>(`/leagues/${leagueId}/team/${teamId}?format=json&view=${view}`)
  const fieldActions = useFieldActions(leagueId!, teamId!, refetch)
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
      const res = await fetch(`/leagues/${leagueId}/season/delist`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      setDelistTarget(null)
      refetch()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setDelisting(false)
    }
  }

  if (loading) return <Spinner />
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
    return (
      <div className={`mob-pos-row${isLocked ? ' mob-pos-locked' : ''}${fd?.cap_id === player.id ? ' fv-card-captain' : ''}${fd?.vc_id === player.id ? ' fv-card-vc' : ''}${isSwapActive ? ' fv-swap-active' : ''}${isSwapEligible ? ' fv-swap-eligible' : ''}`}
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
              <div className="squad-hero-crumb d-none d-lg-block"><Link to={`/leagues/${leagueId}`}>{league?.name}</Link> / {data.team.name}</div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h2 className="squad-hero-title">{data.team.name}</h2>
                <span className="squad-hero-count d-none d-lg-inline">{players.length} players</span>
                {is_owner && <span className="squad-hero-owner d-none d-lg-inline">Your Team</span>}
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

      {/* ── Roster size alerts — fire when a team is over or under
              squad_size after LTIL is accounted for. Over-squad is
              red (must delist before window close); under-squad is
              amber (will be filled by mid-season draft / SSP). ── */}
      {is_owner && data.over_squad && (
        <div className="lm-alerts">
          <div
            className="lm-alert-row"
            style={{
              background: 'rgba(248,81,73,.08)',
              border: '1px solid rgba(248,81,73,.35)',
              color: '#ffb4ae',
            }}
          >
            <i className="bi bi-exclamation-octagon-fill" style={{ color: '#f85149' }}></i>
            <span>
              <strong>{data.squad_excess} player{data.squad_excess === 1 ? '' : 's'} over squad cap</strong>
              <span style={{ color: '#8b949e', marginLeft: 6, fontWeight: 400 }}>
                ({data.active_count}/{data.squad_size}
                {data.approved_ltil_count > 0 ? ` + ${data.approved_ltil_count} LTIL` : ''})
              </span>
              <span style={{ color: '#8b949e', marginLeft: 8, fontWeight: 400 }}>
                — must delist before trade window closes.
              </span>
            </span>
          </div>
        </div>
      )}
      {is_owner && data.under_squad && !data.over_squad && (
        <div className="lm-alerts">
          <div
            className="lm-alert-row"
            style={{
              background: 'rgba(210,153,34,.08)',
              border: '1px solid rgba(210,153,34,.35)',
              color: '#f0d18a',
            }}
          >
            <i className="bi bi-info-circle-fill" style={{ color: '#d29922' }}></i>
            <span>
              <strong>{data.squad_shortfall} squad spot{data.squad_shortfall === 1 ? '' : 's'} open</strong>
              <span style={{ color: '#8b949e', marginLeft: 6, fontWeight: 400 }}>
                ({data.active_count}/{data.squad_size})
              </span>
              <span style={{ color: '#8b949e', marginLeft: 8, fontWeight: 400 }}>
                — fill via mid-season draft once the trade window closes.
              </span>
            </span>
          </div>
        </div>
      )}

      {/* ── Trade / Draft Alerts ── */}
      {is_owner && (data.trade_is_open || data.has_active_draft) && (
        <div className="lm-alerts">
          {data.trade_is_open && (
            <Link to={`/leagues/${leagueId}/trades`} className="lm-alert-row text-decoration-none">
              <i className="bi bi-arrow-left-right" style={{ color: 'var(--kl-accent-orange)' }}></i>
              <span>Trade window open{data.trade_close_date ? ` — closes ${new Date(data.trade_close_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}</span>
              {data.pending_incoming > 0 && <span className="lm-alert-badge">{data.pending_incoming} incoming</span>}
              <i className="bi bi-arrow-right ms-auto" style={{ color: 'var(--kl-accent-blue)', fontSize: '.7rem' }}></i>
            </Link>
          )}
          {data.has_active_draft && (
            <Link to={`/leagues/${leagueId}/draft`} className="lm-alert-row text-decoration-none">
              <i className="bi bi-list-check" style={{ color: 'var(--kl-accent-blue)' }}></i>
              <span>Draft live{data.active_draft_round ? ` — Rd ${data.active_draft_round}` : ''}</span>
              <i className="bi bi-arrow-right ms-auto" style={{ color: 'var(--kl-accent-blue)', fontSize: '.7rem' }}></i>
            </Link>
          )}
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className={`squad-stat-cards${view === 'field' ? ' fv-stats-hide-mob' : ''}`}>
        <div className="stat-card"><div className="stat-value" style={{ color: '#3fb950' }}>{Math.round(totalSc)}</div><div className="stat-label">Total SC Value</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: '#58a6ff' }}>{scCount ? (totalSc / scCount).toFixed(1) : '-'}</div><div className="stat-label">Avg SC / Player</div></div>
        <div className="stat-card"><div className="stat-value" style={{ color: '#d29922' }}>{ageCount ? (totalAge / ageCount).toFixed(1) : '-'}</div><div className="stat-label">Avg Age</div></div>
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
                          {wp.owner ? <span className="status-chip" style={{ background: 'rgba(248,81,73,.1)', color: '#f85149', fontSize: '.65rem' }}>{wp.owner}</span>
                            : <span className="status-chip" style={{ background: 'rgba(63,185,80,.1)', color: '#3fb950', fontSize: '.65rem' }}>Available</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-body text-center py-5">
              <i className="bi bi-star" style={{ fontSize: '2rem', color: '#484f58' }}></i>
              <p className="mt-2 mb-1" style={{ color: '#8b949e', fontSize: '.88rem' }}>No players on your wishlist yet.</p>
              <Link to={`/leagues/${leagueId}/player-pool`} className="btn btn-sm btn-outline-primary mt-1"><i className="bi bi-search me-1"></i>Browse Player Pool</Link>
            </div>
          )}
        </div>
      )}


      {/* ══════ FIELD VIEW ══════ */}
      {view === 'field' && fd && (
        <>
          <FieldView fd={fd} teamLogos={data.team_logos} isOwner={is_owner} actions={{
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
          </div>
        </>
      )}


      {/* ── Toast ── */}
      {fieldActions.toastMsg && <div className={`fv-toast fv-toast-${fieldActions.toastMsg.type} fv-toast-show`}>{fieldActions.toastMsg.text}</div>}

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
          ltilSlotsAvailable={fd.ssp_enabled && (fd.ltil_entries.length + fd.pending_ltil_count) < fd.ssp_slots}
        />
      )}
    </div>
  )
}
