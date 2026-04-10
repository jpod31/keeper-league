/**
 * AFL Field View — React port of team/field_view.html
 * Renders the football oval with player cards positioned in zones.
 * Desktop only (d-none d-lg-block) — mobile uses mob-squad-list.
 */

interface Player {
  id: number; name: string; position: string; afl_team: string; age: number
  sc_avg: number; rating: number | null
  injury_type: string | null; injury_return: string | null; injury_severity: string | null
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

interface Actions {
  setCaptain: (pid: number) => void
  setVC: (pid: number) => void
  startSwap: (pid: number) => void
  completeSwap: (pid: number) => void
  toggleEmergency: (pid: number) => void
  toggle7s: (pid: number) => void
  set7sCaptain: (pid: number) => void
  addToLTIL: (pid: number) => void
  showPlayer: (pid: number) => void
  swapSource: number | null
}

interface Props {
  fd: FieldData
  teamLogos: Record<string, string>
  isOwner: boolean
  actions?: Actions
}

export function FieldView({ fd, teamLogos, isOwner, actions }: Props) {
  const lockedSet = new Set(fd.locked_teams)
  const selectedSet = new Set(fd.selected_player_ids)
  const emgSet = new Set(fd.emergency_ids)
  const sevensSet = new Set(fd.sevens_ids)
  const playingSet = new Set(fd.teams_playing)

  function PlayerCard({ p, posClass, isFlex, isReserve }: {
    p: Player | null; posClass: string; isFlex?: boolean; isReserve?: boolean
  }) {
    if (!p) {
      return (
        <div className={`fv-card fv-card-empty fv-card-${posClass}${isFlex ? ' fv-card-flex' : ''}`}>
          <div className="fv-empty-slot">
            {isFlex ? (
              <span style={{ fontSize: '.55rem', fontWeight: 700, color: '#30363d', letterSpacing: '1px' }}>FLEX</span>
            ) : (
              <i className="bi bi-person-dash"></i>
            )}
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

    const cardClasses = [
      'fv-card', `fv-card-${posClass}`,
      isFlex && 'fv-card-flex',
      isReserve && 'fv-card-reserve',
      isEmg && 'fv-card-emergency',
      is7s && 'fv-card-7s',
      isCap && 'fv-card-captain',
      isVC && 'fv-card-vc',
      isLocked && 'fv-card-locked',
    ].filter(Boolean).join(' ')

    const posParts = (p.position || 'MID').split('/')
    const fname = p.name.split(' ')[0]
    const sname = p.name.split(' ').slice(1).join(' ')
    const rtgClass = p.rating ? (p.rating >= 80 ? 'fv-rtg-elite' : p.rating >= 70 ? 'fv-rtg-good' : p.rating >= 60 ? 'fv-rtg-avg' : 'fv-rtg-low') : 'fv-rtg-none'

    const isSwapActive = actions?.swapSource === p.id
    const isSwapEligible = actions?.swapSource && actions.swapSource !== p.id && !isLocked

    return (
      <div className={`${cardClasses}${isSwapActive ? ' fv-swap-active' : ''}${isSwapEligible ? ' fv-swap-eligible' : ''}`}
        data-player-id={p.id} data-section={isReserve ? 'reserve' : isFlex ? 'flex' : 'field'}
        data-positions={p.position || 'MID'} data-field-pos={!isFlex && !isReserve ? posClass.toUpperCase() : ''}
        onClick={() => {
          if (actions?.swapSource) { actions.completeSwap(p.id) }
          else if (actions) { actions.showPlayer(p.id) }
        }}>
        {/* Ribbon */}
        {isCap && <div className="fv-ribbon fv-ribbon-cap"><span>C</span></div>}
        {isVC && !isCap && <div className="fv-ribbon fv-ribbon-vc"><span>VC</span></div>}
        {isEmg && !isCap && !isVC && <div className="fv-ribbon fv-ribbon-emg"><span>E</span></div>}
        {is7s && !isEmg && !isCap && !isVC && <div className="fv-ribbon fv-ribbon-7s"><span>{is7c ? '7C' : '7'}</span></div>}

        {/* Status indicator */}
        {isLocked && <div className="fv-selected fv-locked" title="Locked — game started"><i className="bi bi-lock-fill"></i></div>}
        {!isLocked && isSelected && <div className="fv-selected" title="Selected to play"><i className="bi bi-check-lg"></i></div>}
        {!isLocked && !isSelected && p.injury_severity && (
          <div className={`fv-injury fv-injury-${p.injury_severity}`} title={`${p.injury_type || 'Injured'} — ${p.injury_return || ''}`}></div>
        )}

        {/* BYE badge */}
        {hasBye && <div className={`fv-bye-badge${isSelected || p.injury_severity ? ' fv-bye-shifted' : ''}`} title="No game this round">BYE</div>}

        {/* Hover action buttons (owner only, not locked) */}
        {isOwner && !isLocked && actions && (
          <div className="fv-actions" onClick={e => e.stopPropagation()}>
            {!isReserve && (
              <>
                <button className={`fv-action-btn fv-act-cap${isCap ? ' active' : ''}`}
                  title="Set Captain" onClick={e => { e.stopPropagation(); actions.setCaptain(p.id) }}>C</button>
                <button className={`fv-action-btn fv-act-vc${isVC ? ' active' : ''}`}
                  title="Set Vice Captain" onClick={e => { e.stopPropagation(); actions.setVC(p.id) }}>VC</button>
              </>
            )}
            <button className="fv-action-btn fv-act-sub"
              title="Swap Player" onClick={e => { e.stopPropagation(); actions.startSwap(p.id) }}>
              <i className="bi bi-arrow-left-right"></i>
            </button>
            {isReserve && !is7s && (
              <button className={`fv-action-btn fv-act-emg${isEmg ? ' active' : ''}`}
                title="Toggle Emergency" onClick={e => { e.stopPropagation(); actions.toggleEmergency(p.id) }}>E</button>
            )}
            {isReserve && fd.has_7s_fixture && !isEmg && (
              <>
                <button className={`fv-action-btn fv-act-7s${is7s ? ' active' : ''}`}
                  title="Toggle 7s" onClick={e => { e.stopPropagation(); actions.toggle7s(p.id) }}>7</button>
                {is7s && fd.sevens_captain_enabled && (
                  <button className={`fv-action-btn fv-act-7c${is7c ? ' active' : ''}`}
                    title="Set 7s Captain" onClick={e => { e.stopPropagation(); actions.set7sCaptain(p.id) }}>7C</button>
                )}
              </>
            )}
            {(isFlex || isReserve) && (
              <button className="fv-action-btn fv-act-ltil"
                title="Add to LTIL" onClick={e => { e.stopPropagation(); actions.addToLTIL(p.id) }}>
                <i className="bi bi-bandaid"></i>
              </button>
            )}
          </div>
        )}

        {/* Top row: logo + position */}
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
                <span key={part}>
                  {i > 0 && <span className="fv-pip-slash">/</span>}
                  <span className={`fv-pip-${part.toLowerCase()}`}>{part}</span>
                </span>
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
              {rowPlayers.map((p, pi) => (
                <PlayerCard key={p?.id || `empty-${ri}-${pi}`} p={p} posClass={posClass} />
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  const flexFilled = fd.flex_data.filter(s => s.player).length
  const POS_LABELS: Record<string, string> = { DEF: 'Defenders', MID: 'Midfielders', RUC: 'Rucks', FWD: 'Forwards' }

  return (
    <div className="fv-outer d-none d-lg-block">
      {/* Lockout banner */}
      {fd.next_lockout_time && (
        <div className="fv-lockout-banner">
          <i className="bi bi-clock"></i>
          <span>Lockout countdown active</span>
        </div>
      )}

      <div className="fv-wrapper">
        {/* The field */}
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

          {/* LTIL sidebar */}
          {fd.ltil_entries.length > 0 && (
            <div className="fv-ltil-sidebar">
              <div className="fv-ltil-hdr">
                <i className="bi bi-bandaid me-1"></i>LTIL
                <span className="fv-zone-tally ms-2">{fd.ltil_entries.length}</span>
              </div>
              <div className="fv-ltil-sidebar-list">
                {fd.ltil_entries.map(lt => (
                  <div key={lt.player_id} className="fv-ltil-sidebar-card">
                    <div className="fv-ltil-sidebar-info">
                      <div className="fv-ltil-sidebar-name">{lt.player_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Emergencies section */}
      {fd.emergency_players.length > 0 && (
        <div className="fv-emg-section">
          <div className="fv-emg-hdr">
            <i className="bi bi-shield-exclamation me-1"></i>Emergencies
            <span className="fv-zone-tally ms-2">{fd.emergency_players.length} / 4</span>
          </div>
          <div className="fv-reserves-grid">
            {fd.emergency_players.map(p => (
              <PlayerCard key={p.id} p={p} posClass={(p.position || 'MID').split('/')[0].toLowerCase()} isReserve />
            ))}
          </div>
        </div>
      )}

      {/* 7s section */}
      {fd.has_7s_fixture && (
        <div className="fv-7s-section">
          <div className="fv-7s-hdr">
            <i className="bi bi-7-circle me-1"></i>7s Squad
            <span className="fv-zone-tally ms-2">{fd.sevens_players.length} / 7</span>
          </div>
          {fd.sevens_players.length > 0 ? (
            <div className="fv-reserves-grid">
              {fd.sevens_players.map(p => (
                <PlayerCard key={p.id} p={p} posClass={(p.position || 'MID').split('/')[0].toLowerCase()} isReserve />
              ))}
            </div>
          ) : (
            <div className="text-center py-3" style={{ color: '#484f58', fontSize: '.8rem' }}>
              Tap the <span style={{ color: '#bc8cff', fontWeight: 600 }}>7</span> button on any reserve to add them to your 7s squad
            </div>
          )}
        </div>
      )}

      {/* Injury list */}
      {fd.injury_list.length > 0 && (
        <div className="fv-injury-section">
          <div className="fv-injury-hdr">
            <i className="bi bi-bandaid me-1"></i>Injury List
            <span className="fv-zone-tally ms-2">{fd.injury_list.length}</span>
          </div>
          <div className="fv-reserves-grid">
            {fd.injury_list.map(p => (
              <PlayerCard key={p.id} p={p} posClass={(p.position || 'MID').split('/')[0].toLowerCase()} isReserve />
            ))}
          </div>
        </div>
      )}

      {/* Reserves */}
      {fd.reserves.length > 0 && (
        <div className="fv-reserves-section">
          <div className="fv-reserves-hdr">
            <i className="bi bi-people me-1"></i>Reserves
            <span className="fv-zone-tally ms-2">{fd.reserves.length} players</span>
          </div>
          <div className="fv-reserves-grid">
            {fd.reserves.map(p => (
              <PlayerCard key={p.id} p={p} posClass={(p.position || 'MID').split('/')[0].toLowerCase()} isReserve />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
