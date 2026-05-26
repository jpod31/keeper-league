import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router'
import { LeagueProvider, useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../ui/Spinner'
import { RoundRecapModal } from '../RoundRecapModal'
import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

type SectionKey = 'team' | 'players' | 'league' | 'settings'

interface SubtabDef {
  label: string
  icon: string
  to: string
  key: string
  style?: React.CSSProperties
}

interface SectionDef {
  title: string
  tabs: SubtabDef[]
}

export function LeagueShell() {
  return (
    <LeagueProvider>
      <LeagueShellInner />
    </LeagueProvider>
  )
}

function detectActiveTab(pathname: string): string {
  // Strip /leagues/<id>/ prefix
  const m = pathname.match(/^\/leagues\/\d+\/?(.*)$/)
  const rest = m ? m[1] : ''
  if (!rest) return ''
  if (rest.startsWith('team/')) return 'team'
  if (rest.startsWith('gameday') || rest.startsWith('reserve7s/gameday')) return 'gameday'
  if (rest.startsWith('afl-live')) return 'live'
  if (rest.startsWith('player-pool') || rest.startsWith('players/') || rest.startsWith('player-ratings') || rest.startsWith('injuries') || rest.startsWith('stats')) return 'players'
  if (rest.startsWith('reserve7s/team')) return 'team'
  if (rest.startsWith('standings') || rest.startsWith('fixture') || rest.startsWith('matchup') || rest.startsWith('finals') || rest.startsWith('history') || rest.startsWith('list-changes') || rest.startsWith('reserve7s')) return 'league'
  if (rest.startsWith('draft')) return 'draft'
  if (rest.startsWith('chat') || rest.startsWith('notifications') || rest.startsWith('activity') || rest.startsWith('messages')) return 'comms'
  if (rest.startsWith('commissioner')) return 'commissioner'
  if (rest.startsWith('settings') || rest.startsWith('scoring')) return 'settings'
  if (rest.startsWith('trades')) return 'team' // Trades lives under My Team
  return ''
}

function LeagueShellInner() {
  const { league, loading, error } = useLeague()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)
  const [subtabOpen, setSubtabOpen] = useState<SectionKey | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)

  const activeTab = useMemo(() => detectActiveTab(pathname), [pathname])

  useEffect(() => {
    // Close sheets on route change
    setMoreOpen(false)
    setSubtabOpen(null)
    setSelectorOpen(false)
  }, [pathname])

  if (loading) return <Spinner text="Loading league..." />
  if (error || !league) return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
      <p className="text-danger">Failed to load league.</p>
    </div>
  )

  const lid = league.id
  const t = league.user_team

  const subtabSections: Record<SectionKey, SectionDef> = {
    team: {
      title: 'My Team',
      tabs: t ? [
        { label: 'Field', icon: 'bi-diagram-3', to: `/leagues/${lid}/team/${t.id}`, key: 'field' },
        { label: 'Stats', icon: 'bi-graph-up', to: `/leagues/${lid}/team/${t.id}/stats`, key: 'stats' },
        { label: 'Analytics', icon: 'bi-bar-chart-line', to: `/leagues/${lid}/team/${t.id}/analytics`, key: 'analytics' },
        { label: 'Trades', icon: 'bi-arrow-left-right', to: `/leagues/${lid}/trades`, key: 'trades' },
        ...(league.is_owner ? [
          { label: 'Wishlist', icon: 'bi-star', to: `/leagues/${lid}/team/${t.id}?view=wishlist`, key: 'wishlist', style: { color: '#d29922' } as React.CSSProperties },
        ] : []),
      ] : [],
    },
    players: {
      title: 'Players',
      tabs: [
        { label: 'Pool', icon: 'bi-person-plus', to: `/leagues/${lid}/player-pool`, key: 'pool' },
        { label: 'Compare', icon: 'bi-people', to: `/leagues/${lid}/players/compare`, key: 'compare' },
        { label: 'Stats', icon: 'bi-graph-up', to: `/leagues/${lid}/stats`, key: 'stats' },
        { label: 'Injuries', icon: 'bi-bandaid', to: `/leagues/${lid}/injuries`, key: 'injuries' },
        { label: 'Ratings', icon: 'bi-star-fill', to: `/leagues/${lid}/player-ratings`, key: 'ratings' },
        { label: 'Scouting', icon: 'bi-binoculars', to: `/leagues/${lid}/scouting`, key: 'scouting' },
        { label: 'Breakout', icon: 'bi-broadcast-pin', to: `/leagues/${lid}/breakout-radar`, key: 'breakout' },
      ],
    },
    league: {
      title: 'League',
      tabs: [
        { label: 'Ladder', icon: 'bi-bar-chart', to: `/leagues/${lid}/standings`, key: 'ladder' },
        { label: 'Fixtures', icon: 'bi-calendar-week', to: `/leagues/${lid}/fixture`, key: 'fixture' },
        ...(league.finals_teams > 0 ? [{ label: 'Finals', icon: 'bi-trophy', to: `/leagues/${lid}/finals`, key: 'finals' }] : []),
        { label: 'Records', icon: 'bi-trophy', to: `/leagues/${lid}/history`, key: 'records' },
        { label: 'Changes', icon: 'bi-clock-history', to: `/leagues/${lid}/list-changes`, key: 'changes' },
      ],
    },
    settings: {
      title: 'Settings',
      tabs: [
        { label: 'General', icon: 'bi-gear', to: `/leagues/${lid}/settings`, key: 'general' },
        { label: 'Scoring', icon: 'bi-calculator', to: `/leagues/${lid}/scoring`, key: 'scoring' },
      ],
    },
  }

  return (
    <>
      {/* ═══ Desktop league tab bar ═══ */}
      <div className="league-nav d-none d-lg-block">
        <div className="league-nav-inner">
          {/* League selector — modern pill switcher */}
          <LeagueSwitcher
            currentId={lid}
            currentName={league.name}
            currentSeason={league.season_year}
            leagues={league.user_leagues}
            isOpen={selectorOpen}
            setOpen={setSelectorOpen}
          />


          <nav className="league-tabs d-none d-lg-flex">
            {t && (
              <>
                <NavLink
                  to={`/leagues/${lid}/team/${t.id}`}
                  className={`league-tab${activeTab === 'team' ? ' active' : ''}`}
                >
                  <i className="bi bi-people"></i><span>My Team</span>
                </NavLink>
                <NavLink
                  to={`/leagues/${lid}/gameday`}
                  className={`league-tab${activeTab === 'gameday' ? ' active' : ''}`}
                >
                  <i className="bi bi-controller"></i><span>Gameday</span>
                </NavLink>
              </>
            )}
            <NavLink
              to={`/leagues/${lid}/player-pool`}
              className={`league-tab${activeTab === 'players' ? ' active' : ''}`}
            >
              <i className="bi bi-person-plus"></i><span>Players</span>
            </NavLink>
            <NavLink
              to={`/leagues/${lid}/fixture`}
              className={`league-tab${activeTab === 'league' ? ' active' : ''}`}
            >
              <i className="bi bi-calendar-week"></i><span>League</span>
            </NavLink>
            {league.active_draft && (
              <NavLink
                to={`/leagues/${lid}/draft`}
                className={`league-tab${activeTab === 'draft' ? ' active' : ''}`}
                style={{ color: '#d29922' }}
              >
                <i className="bi bi-list-check"></i><span>Draft Room</span>
              </NavLink>
            )}
            <NavLink
              to={`/leagues/${lid}/chat`}
              className={`league-tab${activeTab === 'comms' ? ' active' : ''}`}
            >
              <i className="bi bi-megaphone"></i><span>Comms</span>
            </NavLink>
            {league.is_commissioner ? (
              <NavLink
                to={`/leagues/${lid}/commissioner`}
                className={`league-tab${activeTab === 'commissioner' || activeTab === 'settings' ? ' active' : ''}`}
                style={{ color: '#d29922' }}
              >
                <i className="bi bi-shield-lock"></i>
                <span>
                  Admin
                  {league.pending_ltil_count > 0 && (
                    <span className="badge rounded-pill ms-1" style={{
                      background: '#d29922', color: '#000', fontSize: '.55rem', verticalAlign: 'middle',
                    }}>
                      {league.pending_ltil_count}
                    </span>
                  )}
                </span>
              </NavLink>
            ) : (
              <NavLink
                to={`/leagues/${lid}/settings`}
                className={`league-tab${activeTab === 'settings' ? ' active' : ''}`}
              >
                <i className="bi bi-gear"></i><span>Settings</span>
              </NavLink>
            )}
          </nav>
        </div>
      </div>

      {/* Page content — wrapped in a keyed motion div so route changes fade+slide */}
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>

      {/* Round recap popup — shows once per completed round on first visit */}
      <RoundRecapModal />

      {/* ═══ Mobile bottom nav ═══ */}
      <nav className="mobile-bottom-nav d-lg-none">
        {t && (
          <>
            <button
              type="button"
              className={`mob-nav-item${activeTab === 'team' ? ' active' : ''}`}
              onClick={() => setSubtabOpen('team')}
            >
              <i className="bi bi-people"></i><span>Team</span>
            </button>
            <NavLink
              to={`/leagues/${lid}/gameday`}
              className={`mob-nav-item${activeTab === 'gameday' ? ' active' : ''}`}
            >
              <i className="bi bi-controller"></i><span>Gameday</span>
            </NavLink>
          </>
        )}
        <NavLink
          to={`/leagues/${lid}/afl-live`}
          className={`mob-nav-item${activeTab === 'live' ? ' active' : ''}`}
        >
          <i className="bi bi-broadcast"></i><span>AFL Live</span>
        </NavLink>
        <button
          type="button"
          className={`mob-nav-item${activeTab === 'players' ? ' active' : ''}`}
          onClick={() => setSubtabOpen('players')}
        >
          <i className="bi bi-person-plus"></i><span>Players</span>
        </button>
        <button
          type="button"
          className={`mob-nav-item${activeTab === 'league' ? ' active' : ''}`}
          onClick={() => setSubtabOpen('league')}
        >
          <i className="bi bi-calendar-week"></i><span>League</span>
        </button>
        <button
          type="button"
          className={`mob-nav-item${['comms', 'commissioner', 'settings'].includes(activeTab) ? ' active' : ''}`}
          onClick={() => setMoreOpen(true)}
        >
          <i className="bi bi-grid-3x3-gap"></i><span>More</span>
        </button>
      </nav>

      {/* ═══ More sheet ═══ */}
      {moreOpen && (
        <>
          <div className="more-sheet-backdrop open" onClick={() => setMoreOpen(false)} />
          <div className="more-sheet open">
            <div className="more-sheet-handle"></div>
            <div className="more-sheet-grid">
              {league.active_draft && (
                <div className="more-sheet-item more-sheet-item-draft" onClick={() => navigate(`/leagues/${lid}/draft`)}>
                  <i className="bi bi-list-check"></i><span>Draft Room</span>
                </div>
              )}
              <div className="more-sheet-item" onClick={() => navigate(`/leagues/${lid}/chat`)}>
                <i className="bi bi-megaphone"></i><span>Comms</span>
              </div>
              {league.is_commissioner ? (
                <div
                  className="more-sheet-item"
                  style={{ color: '#d29922' }}
                  onClick={() => navigate(`/leagues/${lid}/commissioner`)}
                >
                  <i className="bi bi-shield-lock"></i>
                  <span>
                    Admin
                    {league.pending_ltil_count > 0 && (
                      <span className="badge rounded-pill ms-1" style={{ background: '#d29922', color: '#000', fontSize: '.55rem' }}>
                        {league.pending_ltil_count}
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="more-sheet-item" onClick={() => navigate(`/leagues/${lid}/settings`)}>
                  <i className="bi bi-gear"></i><span>Settings</span>
                </div>
              )}
            </div>
            <hr style={{ borderColor: 'var(--kl-border)', margin: '.5rem 1rem' }} />
            <div className="more-sheet-grid">
              <div className="more-sheet-item" onClick={() => navigate(`/leagues/${lid}/notifications`)}>
                <i className="bi bi-bell"></i><span>Notifications</span>
              </div>
              <div className="more-sheet-item" onClick={() => navigate('/auth/profile')}>
                <i className="bi bi-person"></i><span>Profile</span>
              </div>
              {league.user_leagues.filter(lg => lg.id !== lid).map(lg => (
                <div key={lg.id} className="more-sheet-item" onClick={() => navigate(`/leagues/${lg.id}`)}>
                  <i className="bi bi-trophy"></i><span>{lg.name}</span>
                </div>
              ))}
              <div className="more-sheet-item" style={{ color: '#3fb950' }} onClick={() => navigate('/leagues/create')}>
                <i className="bi bi-plus-circle"></i><span>Create League</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══ Subtab sheet ═══ */}
      {subtabOpen && (
        <>
          <div className="subtab-sheet-backdrop open" onClick={() => setSubtabOpen(null)} />
          <div className="subtab-sheet open">
            <div className="more-sheet-handle"></div>
            <div className="subtab-sheet-title">{subtabSections[subtabOpen].title}</div>
            <div className="more-sheet-grid">
              {subtabSections[subtabOpen].tabs.map(tab => (
                <div
                  key={tab.key}
                  className="more-sheet-item"
                  style={tab.style}
                  onClick={() => navigate(tab.to)}
                >
                  <i className={`bi ${tab.icon}`}></i>
                  <span>{tab.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── League switcher ───────────────────────────────────────────
// Pill button + dropdown panel that replaces the old Bootstrap dropdown.
// Each league gets a deterministic accent colour derived from its id so
// the avatar / glow stays consistent across renders. Click-outside +
// Escape both close it.

const SWITCH_PALETTE: { hex: string; rgb: string }[] = [
  { hex: '#58a6ff', rgb: '88,166,255' },
  { hex: '#ffb471', rgb: '255,180,113' },
  { hex: '#d2a8ff', rgb: '210,168,255' },
  { hex: '#7ee787', rgb: '126,231,135' },
  { hex: '#e3b341', rgb: '227,179,65' },
  { hex: '#ff7b72', rgb: '255,123,114' },
  { hex: '#79c0ff', rgb: '121,192,255' },
  { hex: '#f778ba', rgb: '247,120,186' },
]

function accentFor(id: number) {
  return SWITCH_PALETTE[(id || 0) % SWITCH_PALETTE.length]
}

function leagueInitials(name: string): string {
  if (!name) return '·'
  // Two-letter monogram from the league name — e.g. "Charlies Demons" → "CD"
  const words = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (words[0] || '·').slice(0, 2).toUpperCase()
}

interface SwitcherLeague {
  id: number
  name: string
  season_year: number
  invite_code?: string | null
}

function LeagueSwitcher({
  currentId, currentName, currentSeason, leagues, isOpen, setOpen,
}: {
  currentId: number
  currentName: string
  currentSeason: number
  leagues: SwitcherLeague[]
  isOpen: boolean
  setOpen: (v: boolean | ((s: boolean) => boolean)) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const accent = accentFor(currentId)

  // Close on outside click + Escape
  useEffect(() => {
    if (!isOpen) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, setOpen])

  // Order: current league first, then others by id (stable)
  const ordered = useMemo(() => {
    const current = leagues.find(l => l.id === currentId)
    const rest = leagues.filter(l => l.id !== currentId).sort((a, b) => a.id - b.id)
    return current ? [current, ...rest] : leagues
  }, [leagues, currentId])

  return (
    <div className="league-selector" ref={rootRef}
      style={{ '--lgs-rgb': accent.rgb } as React.CSSProperties}>
      <button
        type="button"
        className={`lg-switch${isOpen ? ' open' : ''}`}
        onClick={() => setOpen(s => !s)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="lg-switch-avatar">{leagueInitials(currentName)}</span>
        <span className="lg-switch-body">
          <span className="lg-switch-name">{currentName}</span>
          <span className="lg-switch-sub">{currentSeason} season</span>
        </span>
        {leagues.length > 1 && (
          <span className="lg-switch-count">{leagues.length}</span>
        )}
        <i className="bi bi-chevron-down lg-switch-chev"></i>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="lg-switch-menu"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: .98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: .98 }}
            transition={{ duration: .14, ease: [.2, .7, .2, 1] }}
          >
            <div className="lg-switch-menu-head">Your leagues · {leagues.length}</div>
            {ordered.map(lg => {
              const a = accentFor(lg.id)
              const isCurrent = lg.id === currentId
              return (
                <Link key={lg.id}
                  to={`/leagues/${lg.id}`}
                  className={`lg-switch-item${isCurrent ? ' active' : ''}`}
                  style={{ '--lgs-row-rgb': a.rgb } as React.CSSProperties}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <span className="lg-switch-item-avatar">{leagueInitials(lg.name)}</span>
                  <span className="lg-switch-item-body">
                    <span className="lg-switch-item-name">{lg.name}</span>
                    <span className="lg-switch-item-meta">
                      {lg.season_year} season
                      {lg.invite_code && <> · <span style={{ letterSpacing: 1, fontFamily: 'ui-monospace, monospace' }}>{lg.invite_code}</span></>}
                    </span>
                  </span>
                  {isCurrent && <i className="bi bi-check-circle-fill lg-switch-item-active-mark"></i>}
                </Link>
              )
            })}
            <div className="lg-switch-divider"></div>
            <Link to="/leagues/create" className="lg-switch-cta" onClick={() => setOpen(false)}>
              <i className="bi bi-plus-circle-fill"></i>Create a new league
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
