/**
 * AFL Field View — React port of team/field_view.html
 * Desktop only (d-none d-lg-block) — mobile uses mob-squad-list.
 */
import { checkSwapEligible, type SwapSourceInfo, type ActionMode } from '../../hooks/useFieldActions'
import { useEffect, useRef } from 'react'

interface Player {
  id: number; name: string; position: string; afl_team: string; age: number
  sc_avg: number; games_played: number; career_games: number; rating: number | null
  injury_type: string | null; injury_return: string | null; injury_severity: string | null
}

export interface FieldData {
  zones: Record<string, (Player | null)[]>
  flex_data: { player: Player | null }[]
  flex_count: number; cap_id: number | null; vc_id: number | null
  reserves: Player[]; reserves_by_pos: Record<string, Player[]>
  emergency_players: Player[]; emergency_ids: number[]
  sevens_players: Player[]; sevens_ids: number[]; sevens_captain_id: number | null
  sevens_captain_enabled: boolean; has_7s_fixture: boolean
  injury_list: Player[]
  ltil_entries: { player_id: number; player_name: string }[]
  ltil_full: { id: number; player_id: number; player_name: string; player_position: string; player_sc_avg: number; replacement_name: string | null }[]
  pending_ltil: { player_id: number; player_name: string }[]
  pending_ltil_count: number; ssp_slots: number; ssp_enabled: boolean
  ssp_window_active: boolean; can_remove_ltil: boolean
  locked_teams: string[]; teams_playing: string[]
  selected_player_ids: number[]; next_lockout_time: string | null
  slot_counts: Record<string, number>; zone_layouts: Record<string, number[]>
  player_form: Record<string, string>  // player_id -> 'up'|'down'|'flat'
  cap_locked: boolean; vc_locked: boolean
}

interface Actions {
  setCaptain: (pid: number) => void
  setVC: (pid: number) => void
  startSwap: (pid: number, section: string, positions: string[], fieldPos: string) => void
  handlePlayerClick: (pid: number, section: string, positions: string[], fieldPos: string, isLocked: boolean, isEmg: boolean, is7s: boolean) => boolean
  toggleEmergency: (pid: number, emgIds: number[], lockedPids: Set<number>) => void
  toggle7s: (pid: number, sevensIds: number[], playerAge: number, lockedPids: Set<number>) => void
  set7sCaptain: (pid: number) => void
  addToLTIL: (pid: number) => void
  removeFromLTIL: (pid: number) => void
  onOpenSSP: (ltilId: number) => void
  showPlayer: (pid: number) => void
  cancelAllModes: () => void
  swapSource: SwapSourceInfo | null
  actionMode: ActionMode
}

interface DelistContext {
  canDelist: boolean
  used: number
  max: number | null
  alreadyDelistedIds: Set<number>
  onDelist: (playerId: number, playerName: string) => void
}

interface Props {
  fd: FieldData
  teamLogos: Record<string, string>
  isOwner: boolean
  actions?: Actions
  delistContext?: DelistContext | null
}

export function FieldView({ fd: rawFd, teamLogos, isOwner, actions, delistContext }: Props) {
  // Defensive defaults for fields that may not exist in older API responses
  const fd = {
    ...rawFd,
    ltil_full: rawFd.ltil_full || [],
    pending_ltil: rawFd.pending_ltil || [],
    pending_ltil_count: rawFd.pending_ltil_count || 0,
    player_form: rawFd.player_form || {},
    reserves_by_pos: rawFd.reserves_by_pos || {},
    cap_locked: rawFd.cap_locked || false,
    vc_locked: rawFd.vc_locked || false,
    ssp_window_active: rawFd.ssp_window_active || false,
    can_remove_ltil: rawFd.can_remove_ltil || false,
    ssp_enabled: rawFd.ssp_enabled ?? false,
    ssp_slots: rawFd.ssp_slots || 1,
  }
  const lockedSet = new Set(fd.locked_teams || [])
  const selectedSet = new Set(fd.selected_player_ids || [])
  const emgSet = new Set(fd.emergency_ids || [])
  const sevensSet = new Set(fd.sevens_ids || [])
  const playingSet = new Set(fd.teams_playing || [])
  const inMode = !!(actions?.swapSource)

  // Auto-refresh every 5 minutes during lockout
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (isOwner && fd.locked_teams.length > 0) {
      // removed: auto-reload was destroying SPA state
    }
    return () => { if (refreshTimer.current) clearInterval(refreshTimer.current) }
  }, [isOwner, fd.locked_teams.length])

  // Escape key cancels modes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && actions) actions.cancelAllModes() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [actions])

  function PlayerCard({ p, posClass, isFlex, isReserve }: {
    p: Player | null; posClass: string; isFlex?: boolean; isReserve?: boolean
  }) {
    if (!p) {
      return (
        <div className={`fv-card fv-card-empty fv-card-${posClass}${isFlex ? ' fv-card-flex' : ''}`}>
          <div className="fv-empty-slot">
            {isFlex ? <span style={{ fontSize: '.55rem', fontWeight: 700, color: '#30363d', letterSpacing: '1px' }}>FLEX</span> : <i className="bi bi-person-dash"></i>}
          </div>
        </div>
      )
    }

    const isEmg = emgSet.has(p.id)
    const is7s = sevensSet.has(p.id)
    const is7c = fd.sevens_captain_id === p.id
    const isSelected = selectedSet.has(p.id)
    const isLocked = lockedSet.has(p.afl_team || '')
    const isCap = fd.cap_id === p.id
    const isVC = fd.vc_id === p.id
    const hasBye = playingSet.size > 0 && p.afl_team && !playingSet.has(p.afl_team)
    const section = isReserve ? 'reserve' : isFlex ? 'flex' : 'field'
    const fieldPosUpper = !isFlex && !isReserve ? posClass.toUpperCase() : ''
    const posParts = (p.position || 'MID').split('/')
    const fname = p.name.split(' ')[0]
    const sname = p.name.split(' ').slice(1).join(' ')
    const rtgClass = p.rating ? (p.rating >= 80 ? 'fv-rtg-elite' : p.rating >= 70 ? 'fv-rtg-good' : p.rating >= 60 ? 'fv-rtg-avg' : 'fv-rtg-low') : 'fv-rtg-none'
    const form = fd.player_form?.[String(p.id)] || 'flat'

    const isSwapActive = actions?.swapSource?.pid === p.id
    let isSwapEligible = false
    if (actions?.swapSource && actions.swapSource.pid !== p.id && !isLocked) {
      if (actions.actionMode === 'swap') isSwapEligible = checkSwapEligible(actions.swapSource, section, posParts, fieldPosUpper)
      else if (actions.actionMode === 'emg_replace') isSwapEligible = isEmg
      else if (actions.actionMode === '7s_replace') isSwapEligible = is7s
    }

    const cardClasses = [
      'fv-card', `fv-card-${posClass}`,
      isFlex && 'fv-card-flex', isReserve && 'fv-card-reserve',
      isEmg && 'fv-card-emergency', is7s && 'fv-card-7s',
      isCap && 'fv-card-captain', isVC && 'fv-card-vc',
      isLocked && 'fv-card-locked',
      isSwapActive && 'fv-swap-active', isSwapEligible && 'fv-swap-eligible',
    ].filter(Boolean).join(' ')

    const ltilHasRoom = fd.ssp_enabled && (fd.ltil_entries.length + fd.pending_ltil_count) < fd.ssp_slots

    return (
      <div className={cardClasses}
        data-player-id={p.id} data-section={section} data-positions={p.position || 'MID'}
        data-field-pos={fieldPosUpper} data-locked={isLocked ? '1' : ''}
        data-emg={isEmg ? '1' : ''} data-sevens={is7s ? '1' : ''} data-age={String(p.age || '')}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.fv-actions')) return
          if (actions?.swapSource) {
            if (actions.swapSource.pid === p.id) { actions.cancelAllModes(); return }
            actions.handlePlayerClick(p.id, section, posParts, fieldPosUpper, isLocked, isEmg, is7s)
          } else if (actions) { actions.showPlayer(p.id) }
        }}>

        {/* Ribbon */}
        {isCap && <div className="fv-ribbon fv-ribbon-cap"><span>C</span></div>}
        {isVC && !isCap && <div className="fv-ribbon fv-ribbon-vc"><span>VC</span></div>}
        {isEmg && !isCap && !isVC && <div className="fv-ribbon fv-ribbon-emg"><span>E</span></div>}
        {is7s && !isEmg && !isCap && !isVC && <div className="fv-ribbon fv-ribbon-7s"><span>{is7c ? '7C' : '7'}</span></div>}

        {/* Status */}
        {isLocked && <div className="fv-selected fv-locked" title="Locked — game started"><i className="bi bi-lock-fill"></i></div>}
        {!isLocked && isSelected && <div className="fv-selected" title="Selected to play"><i className="bi bi-check-lg"></i></div>}
        {!isLocked && !isSelected && p.injury_severity && (
          <div className={`fv-injury fv-injury-${p.injury_severity}`} title={`${p.injury_type || 'Injured'} — ${p.injury_return || ''}`}></div>
        )}
        {hasBye && <div className={`fv-bye-badge${isSelected || p.injury_severity ? ' fv-bye-shifted' : ''}`} title="No game this round">BYE</div>}

        {/* Hover action buttons */}
        {isOwner && !isLocked && actions && (
          <div className="fv-actions" onClick={e => e.stopPropagation()}>
            {!isReserve && !fd.cap_locked && (
              <button className={`fv-action-btn fv-act-cap${isCap ? ' active' : ''}`}
                title="Set Captain" onClick={e => { e.stopPropagation(); actions.setCaptain(p.id) }}>C</button>
            )}
            {!isReserve && !fd.vc_locked && (
              <button className={`fv-action-btn fv-act-vc${isVC ? ' active' : ''}`}
                title="Set Vice Captain" onClick={e => { e.stopPropagation(); actions.setVC(p.id) }}>VC</button>
            )}
            <button className="fv-action-btn fv-act-sub"
              title="Swap Player" onClick={e => { e.stopPropagation(); actions.startSwap(p.id, section, posParts, fieldPosUpper) }}>
              <i className="bi bi-arrow-left-right"></i>
            </button>
            {isReserve && !is7s && (
              <button className={`fv-action-btn fv-act-emg${isEmg ? ' active' : ''}`}
                title="Toggle Emergency" onClick={e => { e.stopPropagation(); actions.toggleEmergency(p.id, fd.emergency_ids, new Set()) }}>E</button>
            )}
            {isReserve && fd.has_7s_fixture && !isEmg && (
              <>
                <button className={`fv-action-btn fv-act-7s${is7s ? ' active' : ''}`}
                  title="Toggle 7s" onClick={e => { e.stopPropagation(); actions.toggle7s(p.id, fd.sevens_ids, p.age, new Set()) }}>7</button>
                {is7s && fd.sevens_captain_enabled && (
                  <button className={`fv-action-btn fv-act-7c${is7c ? ' active' : ''}`}
                    title="Set 7s Captain" onClick={e => { e.stopPropagation(); actions.set7sCaptain(p.id) }}>7C</button>
                )}
              </>
            )}
            {(isFlex || isReserve) && ltilHasRoom && (
              <button className="fv-action-btn fv-act-ltil"
                title="Add to LTIL" onClick={e => { e.stopPropagation(); actions.addToLTIL(p.id) }}>
                <i className="bi bi-bandaid"></i>
              </button>
            )}
            {delistContext && (() => {
              const alreadyGone = delistContext.alreadyDelistedIds.has(p.id)
              const noRoom = !delistContext.canDelist && !alreadyGone
              if (alreadyGone) {
                return (
                  <button className="fv-action-btn fv-act-delist active"
                    title="Already delisted — click to undo via commish" disabled
                    onClick={e => e.stopPropagation()}>
                    <i className="bi bi-x-octagon-fill"></i>
                  </button>
                )
              }
              return (
                <button className="fv-action-btn fv-act-delist"
                  title={noRoom
                    ? `Max delists reached (${delistContext.used}/${delistContext.max})`
                    : 'Delist player'}
                  disabled={noRoom}
                  onClick={e => { e.stopPropagation(); delistContext.onDelist(p.id, p.name) }}>
                  <i className="bi bi-x-octagon"></i>
                </button>
              )
            })()}
          </div>
        )}

        {/* Top: logo + position */}
        <div className="fv-card-top">
          <div className="fv-logo">
            {p.afl_team && teamLogos[p.afl_team] ? (
              <img src={teamLogos[p.afl_team]} alt={p.afl_team} title={p.afl_team} />
            ) : (
              <span className="fv-logo-fallback"><i className="bi bi-shield-fill"></i></span>
            )}
          </div>
          {isFlex && <span className="fv-flex-pip">FLEX</span>}
          {posParts.length > 1 ? (
            <span className="fv-pos-pip fv-pip-dual">
              {posParts.map((part, i) => (
                <span key={part}>{i > 0 && <span className="fv-pip-slash">/</span>}<span className={`fv-pip-${part.toLowerCase()}`}>{part}</span></span>
              ))}
            </span>
          ) : (
            <span className={`fv-pos-pip fv-pip-${posParts[0].toLowerCase()}`}>{posParts[0]}</span>
          )}
        </div>

        {/* Name */}
        <div className="fv-name-block">
          <div className="fv-firstname">{fname}</div>
          <div className={`fv-surname${sname.length > 9 ? ' fv-name-long' : ''}`} title={p.name}>
            <span className="fv-initial">{fname[0]}. </span>{sname}
          </div>
        </div>

        {/* Stats bar */}
        <div className="fv-stats-bar">
          <div className="fv-stat fv-stat-primary">
            <span className="fv-stat-num">{p.sc_avg ? Math.round(p.sc_avg) : '-'}</span>
            <span className="fv-stat-label">AVG</span>
          </div>
          <div className="fv-stat-sep"></div>
          <div className="fv-stat">
            <span className={`fv-stat-num ${rtgClass}`}>{p.rating || '-'}</span>
            <span className="fv-stat-label">RTG</span>
          </div>
          <div className="fv-stat-sep"></div>
          <div className="fv-stat">
            <span className="fv-stat-num">{p.age || '-'}</span>
            <span className="fv-stat-label">AGE</span>
          </div>
        </div>

        {/* Form arrow */}
        {form !== 'flat' && (
          <span className={`fv-form fv-form-${form}`}>
            <i className={`bi bi-caret-${form === 'up' ? 'up' : 'down'}-fill`}></i>
          </span>
        )}
      </div>
    )
  }

  function Zone({ posCode, posClass, wide }: { posCode: string; posClass: string; wide?: boolean }) {
    const rows = fd.zone_layouts[posCode] || []
    const playersList = fd.zones[posCode] || []
    const filled = playersList.filter(Boolean).length
    let offset = 0
    return (
      <div className={`fv-zone${wide ? ' fv-zone-wide' : ''}`}>
        <div className="fv-zone-hdr">
          <span className={`fv-zone-pill fv-zp-${posClass}`}>{posCode}</span>
          <span className="fv-zone-tally">{filled}/{fd.slot_counts[posCode] || 0}</span>
        </div>
        {rows.map((rowSize, ri) => {
          const rowPlayers = playersList.slice(offset, offset + rowSize)
          offset += rowSize
          return (
            <div key={ri} className={`fv-zone-grid fv-grid-${rowSize}`} style={ri > 0 ? { marginTop: 8 } : undefined}>
              {rowPlayers.map((p, pi) => <PlayerCard key={p?.id || `empty-${ri}-${pi}`} p={p} posClass={posClass} />)}
            </div>
          )
        })}
      </div>
    )
  }

  const flexFilled = fd.flex_data.filter(s => s.player).length
  const POS_LABELS: Record<string, string> = { DEF: 'Defenders', MID: 'Midfielders', RUC: 'Rucks', FWD: 'Forwards' }

  return (
    <div className={`fv-outer d-none d-lg-block${inMode ? ' fv-swap-mode' : ''}`} id="fvWrapper">
      <div className="fv-wrapper">
        <div className="fv-field">
          <svg className="fv-markings" viewBox="0 0 400 600" preserveAspectRatio="none">
            <ellipse cx="200" cy="300" rx="196" ry="296" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="1.5"/>
            <circle cx="200" cy="300" r="38" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1.2"/>
            <circle cx="200" cy="300" r="2.5" fill="rgba(255,255,255,.1)"/>
            <line x1="15" y1="300" x2="385" y2="300" stroke="rgba(255,255,255,.04)" strokeWidth="1"/>
            <path d="M 55,115 Q 200,175 345,115" fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="1"/>
            <path d="M 55,485 Q 200,425 345,485" fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="1"/>
            <rect x="160" y="6" width="80" height="35" rx="3" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
            <rect x="160" y="559" width="80" height="35" rx="3" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
          </svg>
          <Zone posCode="DEF" posClass="def" />
          <Zone posCode="MID" posClass="mid" wide />
          <Zone posCode="RUC" posClass="ruc" />
          <Zone posCode="FWD" posClass="fwd" />
        </div>

        {/* Sidebar */}
        <div className="fv-sidebar">
          <div className="fv-flex-section">
            <div className="fv-flex-hdr">
              <i className="bi bi-lightning-charge me-1"></i>Flex
              <span className="fv-zone-tally ms-2">{flexFilled}/{fd.flex_count}</span>
            </div>
            <div className="fv-flex-stack">
              {fd.flex_data.map((slot, i) => {
                const p = slot.player
                const flexPosClass = p ? (p.position || 'MID').split('/')[0].toLowerCase() : 'flex'
                return <PlayerCard key={p?.id || `flex-empty-${i}`} p={p} posClass={flexPosClass} isFlex />
              })}
            </div>
          </div>

          {/* LTIL sidebar — full version */}
          {fd.ssp_enabled && (
            <div className="fv-ltil-sidebar">
              <div className="fv-ltil-hdr">
                <i className="bi bi-bandaid me-1"></i>LTIL
                <span className="fv-zone-tally ms-2">{fd.ltil_entries.length}/{fd.ssp_slots}</span>
              </div>
              <div className="fv-ltil-sidebar-list">
                {fd.ltil_full.map(lt => (
                  <div key={lt.player_id} className="fv-ltil-sidebar-card">
                    <div className="fv-ltil-sidebar-info">
                      <div className="fv-ltil-sidebar-name">{lt.player_name}</div>
                      <div className="fv-ltil-sidebar-meta">{lt.player_position || '-'} &bull; {lt.player_sc_avg ? Math.round(lt.player_sc_avg) : '-'}</div>
                    </div>
                    {lt.replacement_name ? (
                      <div className="fv-ltil-sidebar-ssp">SSP: {lt.replacement_name}</div>
                    ) : isOwner && fd.ssp_window_active && actions ? (
                      <button className="fv-ltil-ssp-btn-sm" onClick={() => actions.onOpenSSP(lt.id)}>
                        <i className="bi bi-plus-circle"></i>
                      </button>
                    ) : null}
                    {isOwner && fd.can_remove_ltil && actions && (
                      <button className="fv-ltil-remove-btn-sm" onClick={() => actions.removeFromLTIL(lt.player_id)} title="Remove">
                        <i className="bi bi-x-lg"></i>
                      </button>
                    )}
                  </div>
                ))}
                {fd.pending_ltil.map(lt => (
                  <div key={lt.player_id} className="fv-ltil-sidebar-card fv-ltil-sidebar-pending">
                    <div className="fv-ltil-sidebar-info">
                      <div className="fv-ltil-sidebar-name">{lt.player_name}</div>
                      <div className="fv-ltil-sidebar-meta" style={{ color: '#d29922' }}>Pending approval</div>
                    </div>
                    <i className="bi bi-hourglass-split" style={{ fontSize: '.7rem', color: '#d29922' }}></i>
                  </div>
                ))}
                {/* Empty slot fillers */}
                {Array.from({ length: Math.max(0, fd.ssp_slots - fd.ltil_entries.length - fd.pending_ltil.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="fv-ltil-sidebar-card fv-ltil-sidebar-empty">
                    <i className="bi bi-bandaid" style={{ fontSize: '.7rem', color: '#484f58' }}></i>
                    <span style={{ fontSize: '.6rem', color: '#484f58' }}>LTIL Slot</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emergencies */}
      {fd.emergency_players.length > 0 && (
        <div className="fv-emg-section">
          <div className="fv-emg-hdr"><i className="bi bi-shield-exclamation me-1"></i>Emergencies<span className="fv-zone-tally ms-2">{fd.emergency_players.length} / 4</span></div>
          <div className="fv-reserves-grid">{fd.emergency_players.map(p => <PlayerCard key={p.id} p={p} posClass={(p.position || 'MID').split('/')[0].toLowerCase()} isReserve />)}</div>
        </div>
      )}

      {/* 7s */}
      {fd.has_7s_fixture && (
        <div className="fv-7s-section">
          <div className="fv-7s-hdr"><i className="bi bi-7-circle me-1"></i>7s Squad<span className="fv-zone-tally ms-2">{fd.sevens_players.length} / 7</span></div>
          {fd.sevens_players.length > 0 ? (
            <div className="fv-reserves-grid">{fd.sevens_players.map(p => <PlayerCard key={p.id} p={p} posClass={(p.position || 'MID').split('/')[0].toLowerCase()} isReserve />)}</div>
          ) : (
            <div className="text-center py-3" style={{ color: '#484f58', fontSize: '.8rem' }}>Tap the <span style={{ color: '#bc8cff', fontWeight: 600 }}>7</span> button on any reserve to add them to your 7s squad</div>
          )}
        </div>
      )}

      {/* Injury list */}
      {fd.injury_list.length > 0 && (
        <div className="fv-injury-section">
          <div className="fv-injury-hdr"><i className="bi bi-bandaid me-1"></i>Injury List<span className="fv-zone-tally ms-2">{fd.injury_list.length}</span></div>
          <div className="fv-reserves-grid">{fd.injury_list.map(p => <PlayerCard key={p.id} p={p} posClass={(p.position || 'MID').split('/')[0].toLowerCase()} isReserve />)}</div>
        </div>
      )}

      {/* Reserves by position */}
      {fd.reserves.length > 0 && (
        <div className="fv-reserves-section">
          <div className="fv-reserves-hdr"><i className="bi bi-people me-1"></i>Reserves<span className="fv-zone-tally ms-2">{fd.reserves.length} players</span></div>
          {['DEF', 'MID', 'RUC', 'FWD'].map(posCode => {
            const posPlayers = fd.reserves_by_pos?.[posCode] || []
            if (!posPlayers.length) return null
            return (
              <div className="fv-reserves-group" key={posCode}>
                <div className="fv-reserves-group-hdr">
                  <span className={`fv-zone-pill fv-zp-${posCode.toLowerCase()}`}>{posCode}</span>
                  <span className="fv-reserves-group-label">{POS_LABELS[posCode]}</span>
                  <span className="fv-zone-tally ms-1">{posPlayers.length}</span>
                </div>
                <div className="fv-reserves-grid">{posPlayers.map(p => <PlayerCard key={p.id} p={p} posClass={(p.position || 'MID').split('/')[0].toLowerCase()} isReserve />)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
