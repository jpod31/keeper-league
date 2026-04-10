import { useParams, Link, useSearchParams } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../../components/ui/Spinner'
import { FieldView } from '../../components/squad/FieldView'
import { PlayerModal } from '../../components/squad/PlayerModal'
import { MobileActionSheet } from '../../components/squad/MobileActionSheet'
import { LockoutBanner } from '../../components/squad/LockoutBanner'
import { useFieldActions } from '../../hooks/useFieldActions'

interface Player {
  id: number; name: string; position: string; afl_team: string; age: number
  sc_avg: number; games_played: number; career_games: number; rating: number | null
  injury_type: string | null; injury_return: string | null; injury_severity: string | null
}
interface RosterEntry {
  player_id: number; is_captain: boolean; is_vice_captain: boolean
  is_emergency: boolean; is_benched: boolean; position_code: string
  acquired_via: string
}
interface FieldData {
  zones: Record<string, (Player | null)[]>
  flex_data: { player: Player | null }[]
  flex_count: number; cap_id: number | null; vc_id: number | null
  reserves: Player[]; emergency_players: Player[]; emergency_ids: number[]
  sevens_players: Player[]; sevens_ids: number[]; sevens_captain_id: number | null
  sevens_captain_enabled: boolean; has_7s_fixture: boolean
  injury_list: Player[]; ltil_entries: { player_id: number; player_name: string }[]
  locked_teams: string[]; teams_playing: string[]
  selected_player_ids: number[]; next_lockout_time: string | null
  slot_counts: Record<string, number>; zone_layouts: Record<string, number[]>
}
interface SquadData {
  league: { id: number; name: string }
  team: { id: number; name: string; logo_url: string | null; owner: string }
  players: Player[]; roster: RosterEntry[]; is_owner: boolean; view: string
  field_data: FieldData | null
  alltime_stats: Record<string, Record<string, number>>
  team_logos: Record<string, string>
  delist_is_open: boolean; delist_period: { closes_at: string | null } | null
  team_delist_count: number; min_delists: number; delisted_player_ids: number[]
  pending_incoming: number; trade_is_open: boolean; trade_close_date: string | null
  has_active_draft: boolean; active_draft_round: number | null
  next_delist_info: string | null
  selected_player_ids: number[]; emergency_ids_all: number[]; sevens_ids_all: number[]
}

const POS_COLORS: Record<string, { bg: string; border: string; text: string; row: string }> = {
  DEF: { bg: 'rgba(26,63,102,.35)', border: 'rgba(121,192,255,.3)', text: '#79c0ff', row: 'rgba(26,63,102,.08)' },
  MID: { bg: 'rgba(53,29,74,.35)', border: 'rgba(210,168,255,.3)', text: '#d2a8ff', row: 'rgba(53,29,74,.08)' },
  RUC: { bg: 'rgba(29,61,46,.35)', border: 'rgba(126,231,135,.3)', text: '#7ee787', row: 'rgba(29,61,46,.08)' },
  FWD: { bg: 'rgba(70,41,10,.35)', border: 'rgba(255,180,113,.3)', text: '#ffb471', row: 'rgba(70,41,10,.08)' },
}

export function SquadPage() {
  const { leagueId, teamId } = useParams()
  const { league } = useLeague()
  const [searchParams] = useSearchParams()
  const view = searchParams.get('view') || 'field'
  // Use the existing Flask route with ?format=json to get identical data
  const { data, loading, refetch } = useFetch<SquadData>(`/leagues/${leagueId}/team/${teamId}?format=json&view=${view}`)
  const fieldActions = useFieldActions(leagueId!, teamId!, refetch)
  const [mobileActionPlayer, setMobileActionPlayer] = useState<Player | null>(null)

  if (loading) return <Spinner />
  if (!data) return <p className="text-danger">Failed to load squad</p>

  const { players, roster, is_owner, field_data: fd, alltime_stats, team_logos,
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
    if (teamsPlaying.size > 0 && player.afl_team && !teamsPlaying.has(player.afl_team))
      return <span className="status-dot status-dot-bye"></span>
    if (selectedSet.has(player.id))
      return <span className="status-dot status-dot-taken"></span>
    if (player.injury_severity)
      return <span className="status-dot status-dot-injured"></span>
    return <span className="status-dot status-dot-available"></span>
  }

  function TeamLogo({ team }: { team: string }) {
    const url = team_logos[team]
    if (url) return <img src={url} alt="" className="mob-pos-logo" />
    return <div className="mob-pos-logo" style={{ width: 26, height: 26 }}></div>
  }

  function MobPlayerRow({ player, section, posCode, showEmg, show7s, style }: {
    player: Player; section: string; posCode?: string; showEmg?: boolean; show7s?: boolean; style?: React.CSSProperties
  }) {
    const r = rosterMap[player.id]
    const lockedTeams = fd ? new Set(fd.locked_teams) : new Set<string>()
    const isLocked = lockedTeams.has(player.afl_team || '')
    return (
      <div className={`mob-pos-row${isLocked ? ' mob-pos-locked' : ''}${fd?.cap_id === player.id ? ' fv-card-captain' : ''}${fd?.vc_id === player.id ? ' fv-card-vc' : ''}`}
        data-player-id={player.id} data-section={section} data-positions={player.position || 'MID'} data-field-pos={posCode || ''}
        data-locked={isLocked ? '1' : ''} data-emg={showEmg ? '1' : ''} data-sevens={show7s ? '1' : ''} data-age={String(player.age || '')}
        onClick={() => {
          if (fieldActions.swapSource) {
            const lockedTeams = fd ? new Set(fd.locked_teams) : new Set<string>()
            const isLkd = lockedTeams.has(player.afl_team || '')
            const isEmgP = fd ? fd.emergency_ids.includes(player.id) : false
            const is7sP = fd ? fd.sevens_ids.includes(player.id) : false
            fieldActions.handlePlayerClick(player.id, section, (player.position || 'MID').split('/'), posCode || '', isLkd, isEmgP, is7sP)
          } else if (is_owner) { setMobileActionPlayer(player) }
          else { fieldActions.showPlayer(player.id) }
        }}
        style={{ cursor: 'pointer', ...style }}>
        <StatusDot player={player} />
        <TeamLogo team={player.afl_team} />
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
              {data.team.logo_url ? (
                <img src={data.team.logo_url} alt="" className="squad-logo-img" width={48} height={48} />
              ) : (
                <div className="squad-logo-placeholder">{data.team.name.substring(0, 2).toUpperCase()}</div>
              )}
            </div>
            <div>
              <div className="squad-hero-crumb d-none d-lg-block">
                <Link to={`/leagues/${leagueId}`}>{league?.name}</Link> / {data.team.name}
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h2 className="squad-hero-title">{data.team.name}</h2>
                <span className="squad-hero-count d-none d-lg-inline">{players.length} players</span>
                {is_owner && <span className="squad-hero-owner d-none d-lg-inline">Your Team</span>}
              </div>
            </div>
          </div>
          <div className="squad-hero-actions d-none d-lg-flex">
            <Link to={`/leagues/${leagueId}/trades`} className="squad-pill squad-pill-manage text-decoration-none"><i className="bi bi-arrow-left-right"></i>Trades</Link>
            <Link to={`/leagues/${leagueId}/team/${teamId}/stats`} className="squad-pill squad-pill-stats text-decoration-none"><i className="bi bi-graph-up"></i>Stats</Link>
            <Link to={`/leagues/${leagueId}/team/${teamId}/analytics`} className="squad-pill squad-pill-manage text-decoration-none"><i className="bi bi-bar-chart-line"></i>Analytics</Link>
            {is_owner && <Link to={`/leagues/${leagueId}/reserve7s/team`} className="squad-pill squad-pill-manage text-decoration-none" style={{ color: '#bc8cff', borderColor: 'rgba(188,140,255,.3)' }}><i className="bi bi-7-circle"></i>7s</Link>}
            <Link to={`/leagues/${leagueId}/team/${teamId}`} className={`squad-pill squad-pill-field text-decoration-none${view === 'field' ? ' active' : ''}`}><i className="bi bi-diagram-3"></i>Field</Link>
            <Link to={`/leagues/${leagueId}/team/${teamId}?view=table`} className={`squad-pill squad-pill-list text-decoration-none${view === 'table' ? ' active' : ''}`}><i className="bi bi-table"></i>List</Link>
          </div>
        </div>
      </div>

      {/* ── Mobile subnav ── */}
      <div className="mob-subnav d-lg-none">
        <Link to={`/leagues/${leagueId}/team/${teamId}`} className={`mob-subnav-item text-decoration-none${view === 'field' ? ' active' : ''}`}><i className="bi bi-diagram-3"></i><span>Field</span></Link>
        <Link to={`/leagues/${leagueId}/team/${teamId}?view=table`} className={`mob-subnav-item text-decoration-none${view === 'table' ? ' active' : ''}`}><i className="bi bi-table"></i><span>List</span></Link>
        <Link to={`/leagues/${leagueId}/team/${teamId}/stats`} className="mob-subnav-item text-decoration-none"><i className="bi bi-graph-up"></i><span>Stats</span></Link>
        <Link to={`/leagues/${leagueId}/team/${teamId}/analytics`} className="mob-subnav-item text-decoration-none"><i className="bi bi-bar-chart-line"></i><span>Analytics</span></Link>
        {is_owner && <Link to={`/leagues/${leagueId}/reserve7s/team`} className="mob-subnav-item text-decoration-none" style={{ color: '#bc8cff' }}><i className="bi bi-7-circle"></i><span>7s</span></Link>}
        <Link to={`/leagues/${leagueId}/trades`} className="mob-subnav-item text-decoration-none"><i className="bi bi-arrow-left-right"></i><span>Trades</span></Link>
      </div>

      {/* ── Non-owner notice ── */}
      {!is_owner && (
        <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2" style={{ background: 'rgba(139,148,158,.08)', border: '1px solid #30363d', borderRadius: 8, fontSize: '.85rem', color: '#8b949e' }}>
          <i className="bi bi-eye"></i>
          <span>Viewing <strong style={{ color: '#c9d1d9' }}>{data.team.name}</strong>'s squad (read-only)</span>
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

      {/* ── Summary Stat Cards ── */}
      <div className="squad-stat-cards">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#3fb950' }}>{Math.round(totalSc)}</div>
          <div className="stat-label">Total SC Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#58a6ff' }}>{scCount ? (totalSc / scCount).toFixed(1) : '-'}</div>
          <div className="stat-label">Avg SC / Player</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#d29922' }}>{ageCount ? (totalAge / ageCount).toFixed(1) : '-'}</div>
          <div className="stat-label">Avg Age</div>
        </div>
        <div className="stat-card">
          <div className="squad-pos-summary">
            {posCounts.DEF > 0 && <span className="squad-pos-chip squad-chip-def">DEF {posCounts.DEF}</span>}
            {posCounts.MID > 0 && <span className="squad-pos-chip squad-chip-mid">MID {posCounts.MID}</span>}
            {posCounts.FWD > 0 && <span className="squad-pos-chip squad-chip-fwd">FWD {posCounts.FWD}</span>}
            {posCounts.RUC > 0 && <span className="squad-pos-chip squad-chip-ruc">RUC {posCounts.RUC}</span>}
          </div>
          <div className="stat-label">Roster Makeup</div>
        </div>
      </div>

      {/* ── Mobile: Position-grouped list (field view) ── */}
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
              {zonePlayers.map(p => (
                <MobPlayerRow key={p.id} player={p} section="field" posCode={pos} style={{ background: colors.row }} />
              ))}
            </div>
          )
        })}

        {/* FLEX */}
        {fd && fd.flex_data.some(s => s.player) && (
          <div className="mob-pos-group">
            <div className="mob-pos-header" style={{ background: 'rgba(139,148,158,.15)', borderLeft: '3px solid #8b949e' }}>
              <span className="mob-pos-label" style={{ color: '#8b949e' }}>FLEX</span>
              <span className="mob-pos-count">{fd.flex_data.filter(s => s.player).length}/{fd.flex_count}</span>
            </div>
            {fd.flex_data.filter(s => s.player).map(s => {
              const p = s.player!
              const primary = (p.position || 'MID').split('/')[0]
              const colors = POS_COLORS[primary] || POS_COLORS.MID
              return <MobPlayerRow key={p.id} player={p} section="flex" style={{ background: colors.row }} />
            })}
          </div>
        )}

        {/* Emergencies */}
        {fd && fd.emergency_players.length > 0 && (
          <div className="mob-pos-group">
            <div className="mob-pos-header" style={{ background: 'rgba(56,166,215,.1)', borderLeft: '3px solid #38a6d7' }}>
              <span className="mob-pos-label" style={{ color: '#38a6d7' }}><i className="bi bi-shield-exclamation me-1"></i>EMERGENCIES</span>
              <span className="mob-pos-count">{fd.emergency_players.length} / 4</span>
            </div>
            {fd.emergency_players.map(p => (
              <MobPlayerRow key={p.id} player={p} section="reserve" showEmg style={{ borderLeft: '3px solid rgba(56,166,215,.3)' }} />
            ))}
          </div>
        )}

        {/* 7s Squad */}
        {fd && fd.has_7s_fixture && (
          <div className="mob-pos-group">
            <div className="mob-pos-header" style={{ background: 'rgba(188,140,255,.1)', borderLeft: '3px solid #bc8cff' }}>
              <span className="mob-pos-label" style={{ color: '#bc8cff' }}><i className="bi bi-7-circle me-1"></i>7s SQUAD</span>
              <span className="mob-pos-count">{fd.sevens_players.length} / 7</span>
            </div>
            {fd.sevens_players.length > 0 ? fd.sevens_players.map(p => (
              <MobPlayerRow key={p.id} player={p} section="reserve" show7s style={{ borderLeft: '3px solid rgba(188,140,255,.3)' }} />
            )) : (
              <div className="mob-pos-row" style={{ justifyContent: 'center', color: '#484f58', fontSize: '.8rem', padding: 12 }}>
                Tap the <span style={{ color: '#bc8cff', fontWeight: 600 }}>7</span> button on any reserve to add them
              </div>
            )}
          </div>
        )}

        {/* Injury List */}
        {fd && fd.injury_list.length > 0 && (
          <div className="mob-pos-group">
            <div className="mob-pos-header" style={{ background: 'rgba(218,54,51,.1)', borderLeft: '3px solid #da3633' }}>
              <span className="mob-pos-label" style={{ color: '#da3633' }}><i className="bi bi-bandaid me-1"></i>INJURY LIST</span>
              <span className="mob-pos-count">{fd.injury_list.length}</span>
            </div>
            {fd.injury_list.map(p => (
              <MobPlayerRow key={p.id} player={p} section="reserve" style={{ borderLeft: '3px solid rgba(218,54,51,.3)' }} />
            ))}
          </div>
        )}

        {/* Bench */}
        {fd && fd.reserves.length > 0 && (
          <div className="mob-pos-group mob-reserves-group">
            <div className="mob-pos-header" style={{ background: 'rgba(48,54,61,.4)', borderLeft: '3px solid #484f58' }}>
              <span className="mob-pos-label" style={{ color: '#6e7681' }}>BENCH</span>
              <span className="mob-pos-count">{fd.reserves.length}</span>
            </div>
            {fd.reserves.map(p => {
              const primary = (p.position || 'MID').split('/')[0]
              const colors = POS_COLORS[primary] || POS_COLORS.MID
              const isEmg = emergency_ids_all.includes(p.id)
              const is7s = sevens_ids_all.includes(p.id)
              return <MobPlayerRow key={p.id} player={p} section="reserve" showEmg={isEmg} show7s={is7s}
                style={{ borderLeft: `3px solid ${colors.text}22` }} />
            })}
          </div>
        )}
      </div>

      {/* ── Desktop Field View ── */}
      {view === 'field' && fd && (
        <FieldView fd={fd} teamLogos={data.team_logos} isOwner={is_owner} actions={{
          setCaptain: fieldActions.setCaptain,
          setVC: fieldActions.setVC,
          startSwap: fieldActions.startSwap,
          handlePlayerClick: fieldActions.handlePlayerClick,
          toggleEmergency: fieldActions.toggleEmergency,
          toggle7s: fieldActions.toggle7s,
          set7sCaptain: fieldActions.set7sCaptain,
          addToLTIL: fieldActions.addToLTIL,
          showPlayer: fieldActions.showPlayer,
          swapSource: fieldActions.swapSource,
          actionMode: fieldActions.actionMode,
        }} />
      )}

      {/* ── Desktop List View Table ── */}
      {view === 'table' && <div className="card d-none d-lg-block">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span className="fw-bold" style={{ fontSize: '.9rem' }}>Squad Roster</span>
        </div>
        <div className="card-body p-0" style={{ overflowX: 'auto' }}>
          <table className="table table-hover mb-0" id="rosterTable">
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th style={{ width: 40 }}>#</th>
                <th>Player</th>
                <th>Pos</th>
                <th>AFL Team</th>
                <th className="text-center">Games</th>
                <th className="text-center squad-hide-mobile">Goals</th>
                <th className="text-center">Disp</th>
                <th className="text-center squad-hide-mobile">Marks</th>
                <th className="text-center squad-hide-mobile">Tackles</th>
                <th className="text-end">SC Avg</th>
                <th>Acquired</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                const r = rosterMap[p.id]
                const st = alltime_stats[String(p.id)] || {}
                const scVal = (st.sc_avg as number) || p.sc_avg || 0
                const scClass = scVal >= 100 ? 'squad-sc-elite' : scVal >= 80 ? 'squad-sc-good' : scVal >= 60 ? 'squad-sc-avg' : 'squad-sc-low'
                const acq = r?.acquired_via || 'draft'
                return (
                  <tr key={p.id}>
                    <td className="text-center"><StatusDot player={p} /></td>
                    <td style={{ color: '#484f58' }}>{i + 1}</td>
                    <td>
                      <span className="fw-bold" style={{ color: '#c9d1d9' }}>{p.name}</span>
                      {r?.is_captain && <span className="squad-badge squad-badge-cap">C</span>}
                      {r?.is_vice_captain && <span className="squad-badge squad-badge-vc">VC</span>}
                    </td>
                    <td>
                      {(p.position || 'MID').split('/').map(pos => (
                        <span key={pos} className={`pos-badge pos-${pos}`}>{pos}</span>
                      ))}
                    </td>
                    <td>
                      {p.afl_team && team_logos[p.afl_team] && <img src={team_logos[p.afl_team]} alt="" height={18} className="me-1" />}
                      <span style={{ fontSize: '.8rem' }}>{p.afl_team || ''}</span>
                    </td>
                    <td className="text-center">{st.games ?? '-'}</td>
                    <td className="text-center squad-hide-mobile">{st.goals ?? '-'}</td>
                    <td className="text-center">{st.disposals ?? '-'}</td>
                    <td className="text-center squad-hide-mobile">{st.marks ?? '-'}</td>
                    <td className="text-center squad-hide-mobile">{st.tackles ?? '-'}</td>
                    <td className="text-end">
                      {scVal > 0 ? <span className={`squad-sc ${scClass}`}>{Math.round(scVal)}</span> : '-'}
                    </td>
                    <td>
                      <span className={`squad-acq squad-acq-${acq}`}>{acq.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>}

      {/* Toast notification */}
      {fieldActions.toastMsg && (
        <div className={`fv-toast fv-toast-${fieldActions.toastMsg.type} fv-toast-show`}>
          {fieldActions.toastMsg.text}
        </div>
      )}

      {/* Player scouting report modal */}
      {fieldActions.playerModal && (
        <PlayerModal
          player={fieldActions.playerModal}
          teamLogos={data.team_logos}
          onClose={fieldActions.closePlayerModal}
        />
      )}

      {/* Mobile action sheet */}
      {mobileActionPlayer && is_owner && fd && (
        <MobileActionSheet
          player={mobileActionPlayer}
          teamLogos={data.team_logos}
          isCaptain={fd.cap_id === mobileActionPlayer.id}
          isVC={fd.vc_id === mobileActionPlayer.id}
          isEmergency={fd.emergency_ids.includes(mobileActionPlayer.id)}
          is7s={fd.sevens_ids.includes(mobileActionPlayer.id)}
          is7sCaptain={fd.sevens_captain_id === mobileActionPlayer.id}
          isReserve={!Object.values(fd.zones).flat().some(p => p?.id === mobileActionPlayer.id) && !fd.flex_data.some(s => s.player?.id === mobileActionPlayer.id)}
          has7sFixture={fd.has_7s_fixture}
          sevens_captain_enabled={fd.sevens_captain_enabled}
          onClose={() => setMobileActionPlayer(null)}
          onSetCaptain={() => fieldActions.setCaptain(mobileActionPlayer.id)}
          onSetVC={() => fieldActions.setVC(mobileActionPlayer.id)}
          onSwap={() => {
            const isRes = !Object.values(fd!.zones).flat().some(p => p?.id === mobileActionPlayer.id) && !fd!.flex_data.some(s => s.player?.id === mobileActionPlayer.id)
            const sec = isRes ? 'reserve' : fd!.flex_data.some(s => s.player?.id === mobileActionPlayer.id) ? 'flex' : 'field'
            fieldActions.startSwap(mobileActionPlayer.id, sec, (mobileActionPlayer.position || 'MID').split('/'), '')
          }}
          onToggleEmg={() => fieldActions.toggleEmergency(mobileActionPlayer.id, fd!.emergency_ids, new Set())}
          onToggle7s={() => fieldActions.toggle7s(mobileActionPlayer.id, fd!.sevens_ids, mobileActionPlayer.age, new Set())}
          onSet7sCaptain={() => fieldActions.set7sCaptain(mobileActionPlayer.id)}
          onAddLTIL={() => fieldActions.addToLTIL(mobileActionPlayer.id)}
          onViewPlayer={() => fieldActions.showPlayer(mobileActionPlayer.id)}
        />
      )}
    </div>
  )
}
