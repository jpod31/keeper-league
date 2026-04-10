interface Player {
  id: number; name: string; position: string; afl_team: string
  sc_avg: number; age: number
}

interface Props {
  player: Player
  teamLogos: Record<string, string>
  isCaptain: boolean
  isVC: boolean
  isEmergency: boolean
  is7s: boolean
  is7sCaptain: boolean
  isReserve: boolean
  has7sFixture: boolean
  sevens_captain_enabled: boolean
  onClose: () => void
  onSetCaptain: () => void
  onSetVC: () => void
  onSwap: () => void
  onToggleEmg: () => void
  onToggle7s: () => void
  onSet7sCaptain: () => void
  onAddLTIL: () => void
  onViewPlayer: () => void
}

export function MobileActionSheet({
  player: p, teamLogos, isCaptain, isVC, isEmergency, is7s, is7sCaptain,
  isReserve, has7sFixture, sevens_captain_enabled,
  onClose, onSetCaptain, onSetVC, onSwap, onToggleEmg, onToggle7s,
  onSet7sCaptain, onAddLTIL, onViewPlayer,
}: Props) {
  const logoUrl = p.afl_team ? teamLogos[p.afl_team] : null

  return (
    <>
      <div className="fv-action-sheet-backdrop open" onClick={onClose}></div>
      <div className="fv-action-sheet open">
        <div className="fv-action-sheet-handle"></div>
        <div className="fv-action-sheet-header">
          {logoUrl ? (
            <img src={logoUrl} alt={p.afl_team} />
          ) : (
            <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58' }}>
              <i className="bi bi-shield-fill"></i>
            </div>
          )}
          <div>
            <div className="fv-as-name">{p.name}</div>
            <div className="fv-as-meta">{p.position} &bull; {p.afl_team} &bull; Age {p.age} &bull; SC {p.sc_avg ? Math.round(p.sc_avg) : '-'}</div>
          </div>
        </div>
        <div className="fv-action-sheet-grid">
          {/* Captain */}
          {!isReserve && (
            <button className={`fv-action-sheet-btn fv-as-cap${isCaptain ? ' active' : ''}`}
              onClick={() => { onSetCaptain(); onClose() }}>
              <i className="bi bi-star-fill"></i>
              <span>{isCaptain ? 'Captain ✓' : 'Captain'}</span>
            </button>
          )}

          {/* Vice Captain */}
          {!isReserve && (
            <button className={`fv-action-sheet-btn fv-as-vc${isVC ? ' active' : ''}`}
              onClick={() => { onSetVC(); onClose() }}>
              <i className="bi bi-star-half"></i>
              <span>{isVC ? 'Vice Capt ✓' : 'Vice Capt'}</span>
            </button>
          )}

          {/* Swap */}
          <button className="fv-action-sheet-btn fv-as-swap"
            onClick={() => { onSwap(); onClose() }}>
            <i className="bi bi-arrow-left-right"></i>
            <span>Swap</span>
          </button>

          {/* Emergency (reserves only, not 7s) */}
          {isReserve && !is7s && (
            <button className={`fv-action-sheet-btn fv-as-emg${isEmergency ? ' active' : ''}`}
              onClick={() => { onToggleEmg(); onClose() }}>
              <i className="bi bi-shield-exclamation"></i>
              <span>{isEmergency ? 'Remove EMG' : 'Emergency'}</span>
            </button>
          )}

          {/* 7s (reserves only, not emergency) */}
          {isReserve && has7sFixture && !isEmergency && (
            <button className={`fv-action-sheet-btn fv-as-7s${is7s ? ' active' : ''}`}
              onClick={() => { onToggle7s(); onClose() }}>
              <i className="bi bi-7-circle"></i>
              <span>{is7s ? 'Remove 7s' : '7s Squad'}</span>
            </button>
          )}

          {/* 7s Captain */}
          {is7s && sevens_captain_enabled && (
            <button className={`fv-action-sheet-btn fv-as-7c${is7sCaptain ? ' active' : ''}`}
              onClick={() => { onSet7sCaptain(); onClose() }}>
              <i className="bi bi-7-circle-fill"></i>
              <span>{is7sCaptain ? '7s Capt ✓' : '7s Captain'}</span>
            </button>
          )}

          {/* LTIL */}
          {(isReserve) && (
            <button className="fv-action-sheet-btn fv-as-ltil"
              onClick={() => { onAddLTIL(); onClose() }}>
              <i className="bi bi-bandaid"></i>
              <span>LTIL</span>
            </button>
          )}

          {/* View player */}
          <button className="fv-action-sheet-btn fv-as-view"
            onClick={() => { onViewPlayer(); onClose() }}>
            <i className="bi bi-person-lines-fill"></i>
            <span>View</span>
          </button>
        </div>
      </div>
    </>
  )
}
