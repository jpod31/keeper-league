import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router'
import { LeagueProvider, useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../ui/Spinner'
import { RoundRecapModal } from '../RoundRecapModal'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
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

  // During loading, render the rail's silhouette (collapsed-width
  // shell with skeleton rows) so the content area's left offset is
  // reserved from first paint — no layout shift when data arrives.
  if (loading) {
    return (
      <>
        <aside className="kl-rail d-none d-lg-flex" aria-hidden>
          <div className="kl-rail-head">
            <span className="kl-skel kl-skel-avatar" />
          </div>
          <nav className="kl-rail-nav">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="kl-skel kl-skel-row" />
            ))}
          </nav>
        </aside>
        <Spinner text="Loading league..." />
      </>
    )
  }
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
      {/* ═══ Desktop left rail ═══ */}
      <LeagueRail
        lid={lid}
        teamId={t?.id}
        leagueName={league.name}
        leagueSeason={league.season_year}
        userLeagues={league.user_leagues}
        activeTab={activeTab}
        activeDraft={!!league.active_draft}
        isCommissioner={!!league.is_commissioner}
        pendingLtilCount={league.pending_ltil_count || 0}
        switcherOpen={selectorOpen}
        setSwitcherOpen={setSelectorOpen}
      />

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

// Refined / desaturated palette — pulled ~30-40% saturation out of
// the previous electric set. Each league still gets a recognisable
// colour identity but reads as "premium product" rather than "gamer
// dashboard". Tuned to look good as both the avatar gradient and as
// the rail's active-state fill.
const SWITCH_PALETTE: { hex: string; rgb: string }[] = [
  { hex: '#7a9bc4', rgb: '122,155,196' },   // slate blue
  { hex: '#cba679', rgb: '203,166,121' },   // warm tan
  { hex: '#b7a4cd', rgb: '183,164,205' },   // muted lilac
  { hex: '#8eb495', rgb: '142,180,149' },   // sage green
  { hex: '#c8a25e', rgb: '200,162,94' },    // refined gold
  { hex: '#c4847a', rgb: '196,132,122' },   // terracotta
  { hex: '#7eaac1', rgb: '126,170,193' },   // slate cyan
  { hex: '#bf8da6', rgb: '191,141,166' },   // dusty rose
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


// ── League rail (desktop left nav) ─────────────────────────────
// Fixed left rail, collapsed 80px → hover/pinned 240px. Top: league
// switcher avatar that opens the dropdown. Middle: vertical nav with
// full-width active state in the league accent + inline sub-tab
// expansion under the active section. Bottom: round status widget.

interface RailSection {
  to: string
  key: string
  icon: string
  label: string
  pulse?: boolean
  badge?: number
  sub?: { to: string; label: string; key: string }[]
}

function LeagueRail({
  lid, teamId, leagueName, leagueSeason, userLeagues,
  activeTab, activeDraft, isCommissioner, pendingLtilCount,
  switcherOpen, setSwitcherOpen,
}: {
  lid: number
  teamId?: number
  leagueName: string
  leagueSeason: number
  userLeagues: SwitcherLeague[]
  activeTab: string
  activeDraft: boolean
  isCommissioner: boolean
  pendingLtilCount: number
  switcherOpen: boolean
  setSwitcherOpen: (v: boolean | ((s: boolean) => boolean)) => void
}) {
  // Pinned-state persists across navigations.
  const [pinned, setPinned] = useState<boolean>(() => {
    try { return localStorage.getItem('kl_rail_pinned') === '1' } catch { return false }
  })
  const [hover, setHover] = useState(false)
  const expanded = pinned || hover || switcherOpen
  const accent = accentFor(lid)

  function togglePin() {
    setPinned(p => {
      const next = !p
      try { localStorage.setItem('kl_rail_pinned', next ? '1' : '0') } catch {}
      return next
    })
  }

  // Set body class so content margin adjusts globally
  useEffect(() => {
    document.body.classList.add('has-league-rail')
    return () => document.body.classList.remove('has-league-rail')
  }, [])
  useEffect(() => {
    document.body.classList.toggle('league-rail-expanded', expanded)
  }, [expanded])

  const sections: RailSection[] = []
  if (teamId) {
    sections.push({
      to: `/leagues/${lid}/team/${teamId}`, key: 'team', icon: 'bi-person-fill-gear', label: 'My Team',
      sub: [
        { to: `/leagues/${lid}/team/${teamId}`,           key: 'field',     label: 'Field' },
        { to: `/leagues/${lid}/team/${teamId}/stats`,     key: 'stats',     label: 'Stats' },
        { to: `/leagues/${lid}/team/${teamId}/analytics`, key: 'analytics', label: 'Analytics' },
        { to: `/leagues/${lid}/trades`,                   key: 'trades',    label: 'Trades' },
      ],
    })
    sections.push({ to: `/leagues/${lid}/gameday`, key: 'gameday', icon: 'bi-controller', label: 'Gameday' })
  }
  sections.push({
    to: `/leagues/${lid}/player-pool`, key: 'players', icon: 'bi-grid-3x3-gap-fill', label: 'Players',
    sub: [
      { to: `/leagues/${lid}/player-pool`,       key: 'pool',      label: 'Pool' },
      { to: `/leagues/${lid}/players/compare`,   key: 'compare',   label: 'Compare' },
      { to: `/leagues/${lid}/stats`,             key: 'stats',     label: 'Stats' },
      { to: `/leagues/${lid}/injuries`,          key: 'injuries',  label: 'Injuries' },
      { to: `/leagues/${lid}/player-ratings`,    key: 'ratings',   label: 'Ratings' },
      { to: `/leagues/${lid}/scouting`,          key: 'scouting',  label: 'Scouting' },
    ],
  })
  sections.push({
    to: `/leagues/${lid}/fixture`, key: 'league', icon: 'bi-calendar-week-fill', label: 'League',
    sub: [
      { to: `/leagues/${lid}/standings`,    key: 'ladder',   label: 'Ladder' },
      { to: `/leagues/${lid}/fixture`,      key: 'fixture',  label: 'Fixtures' },
      { to: `/leagues/${lid}/history`,      key: 'records',  label: 'Records' },
      { to: `/leagues/${lid}/list-changes`, key: 'changes',  label: 'Changes' },
    ],
  })
  if (activeDraft) {
    sections.push({ to: `/leagues/${lid}/draft`, key: 'draft', icon: 'bi-list-check', label: 'Draft Room', pulse: true })
  }
  sections.push({ to: `/leagues/${lid}/chat`, key: 'comms', icon: 'bi-megaphone-fill', label: 'Comms' })
  if (isCommissioner) {
    sections.push({ to: `/leagues/${lid}/commissioner`, key: 'commissioner', icon: 'bi-shield-lock-fill', label: 'Admin', badge: pendingLtilCount })
  } else {
    sections.push({ to: `/leagues/${lid}/settings`, key: 'settings', icon: 'bi-gear-fill', label: 'Settings' })
  }

  function isSectionActive(s: RailSection): boolean {
    if (s.key === 'commissioner') return activeTab === 'commissioner' || activeTab === 'settings'
    return activeTab === s.key
  }

  return (
    <>
      {/* Portal: league switcher gets rendered into the top bar's slot */}
      <TopBarSwitcher
        lid={lid}
        leagueName={leagueName}
        leagueSeason={leagueSeason}
        userLeagues={userLeagues}
        isOpen={switcherOpen}
        setOpen={setSwitcherOpen}
      />

      <aside
        className={`kl-rail d-none d-lg-flex${expanded ? ' expanded' : ''}${pinned ? ' pinned' : ''}`}
        style={{ '--lgs-rgb': accent.rgb } as React.CSSProperties}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        {/* Rail head — static identity badge + pin button.
            Switcher is in the top bar (portalled). */}
        <div className="kl-rail-head">
          <div className="kl-rail-id" title={`${leagueName} · ${leagueSeason}`}>
            <span className="kl-rail-avatar">{leagueInitials(leagueName)}</span>
            <span className="kl-rail-id-body">
              <span className="kl-rail-id-name">{leagueName}</span>
              <span className="kl-rail-id-sub">{leagueSeason} season</span>
            </span>
          </div>
          <button
            type="button"
            className={`kl-rail-pin${pinned ? ' pinned' : ''}`}
            onClick={togglePin}
            title={pinned ? 'Unpin nav' : 'Pin nav open'}
            aria-pressed={pinned}
          >
            <i className={`bi ${pinned ? 'bi-pin-angle-fill' : 'bi-pin-angle'}`}></i>
          </button>
        </div>

      {/* Nav */}
      <nav className="kl-rail-nav" role="tablist">
        {sections.map(section => {
          const active = isSectionActive(section)
          return (
            <div key={section.key} className={`kl-rail-item${active ? ' active' : ''}`}>
              <NavLink
                to={section.to}
                className={`kl-rail-row${active ? ' active' : ''}${section.pulse ? ' pulse' : ''}`}
                role="tab"
                aria-selected={active}
              >
                <span className="kl-rail-icon"><i className={`bi ${section.icon}`}></i></span>
                <span className="kl-rail-label">{section.label}</span>
                {section.pulse && <span className="kl-rail-pulse" aria-hidden="true"></span>}
                {section.badge !== undefined && section.badge > 0 && (
                  <span className="kl-rail-badge">{section.badge}</span>
                )}
              </NavLink>
              {/* Inline sub-tabs when active + rail expanded */}
              {active && section.sub && expanded && (
                <div className="kl-rail-sub">
                  {section.sub.map(st => (
                    <NavLink key={st.key} to={st.to} className="kl-rail-sub-row" end={false}>
                      <span className="kl-rail-sub-dot"></span>
                      <span>{st.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
    </>
  )
}

// ── Top-bar league switcher (portalled) ────────────────────────
// Renders into AppShell's #kl-bar-league-slot. Sits next to brand
// in the top bar; matches the previous switcher pill look.
function TopBarSwitcher({
  lid, leagueName, leagueSeason, userLeagues, isOpen, setOpen,
}: {
  lid: number
  leagueName: string
  leagueSeason: number
  userLeagues: SwitcherLeague[]
  isOpen: boolean
  setOpen: (v: boolean | ((s: boolean) => boolean)) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const accent = accentFor(lid)
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSlotEl(document.getElementById('kl-bar-league-slot'))
  }, [])

  useEffect(() => {
    if (!isOpen) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, setOpen])

  if (!slotEl) return null

  const ordered = (() => {
    const current = userLeagues.find(l => l.id === lid)
    const rest = userLeagues.filter(l => l.id !== lid).sort((a, b) => a.id - b.id)
    return current ? [current, ...rest] : userLeagues
  })()

  return createPortal(
    <div
      className="league-selector"
      ref={rootRef}
      style={{ '--lgs-rgb': accent.rgb } as React.CSSProperties}
    >
      <button
        type="button"
        className={`lg-switch${isOpen ? ' open' : ''}`}
        onClick={() => setOpen(s => !s)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="lg-switch-avatar">{leagueInitials(leagueName)}</span>
        <span className="lg-switch-body">
          <span className="lg-switch-name">{leagueName}</span>
          <span className="lg-switch-sub">{leagueSeason} season</span>
        </span>
        {userLeagues.length > 1 && (
          <span className="lg-switch-count">{userLeagues.length}</span>
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
            <div className="lg-switch-menu-head">Your leagues · {userLeagues.length}</div>
            {ordered.map(lg => {
              const a = accentFor(lg.id)
              const isCurrent = lg.id === lid
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
                    <span className="lg-switch-item-meta">{lg.season_year} season</span>
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
    </div>,
    slotEl,
  )
}

