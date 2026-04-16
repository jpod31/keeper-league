import { Outlet, NavLink, useLocation, useNavigate, Link } from 'react-router'
import { LeagueProvider, useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../ui/Spinner'
import { RoundRecapModal } from '../RoundRecapModal'
import { useState, useEffect, useMemo } from 'react'

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
  if (rest.startsWith('gameday')) return 'gameday'
  if (rest.startsWith('afl-live')) return 'live'
  if (rest.startsWith('player-pool') || rest.startsWith('players/') || rest.startsWith('player-ratings') || rest.startsWith('injuries') || rest.startsWith('stats')) return 'players'
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
        { label: 'List', icon: 'bi-table', to: `/leagues/${lid}/team/${t.id}?view=table`, key: 'table' },
        { label: 'Stats', icon: 'bi-graph-up', to: `/leagues/${lid}/team/${t.id}/stats`, key: 'stats' },
        { label: 'Analytics', icon: 'bi-bar-chart-line', to: `/leagues/${lid}/team/${t.id}/analytics`, key: 'analytics' },
        ...(league.is_owner ? [
          { label: '7s', icon: 'bi-7-circle', to: `/leagues/${lid}/reserve7s/team`, key: '7s', style: { color: '#bc8cff' } as React.CSSProperties },
          { label: 'Wishlist', icon: 'bi-star', to: `/leagues/${lid}/team/${t.id}?view=wishlist`, key: 'wishlist', style: { color: '#d29922' } as React.CSSProperties },
        ] : []),
        { label: 'Trades', icon: 'bi-arrow-left-right', to: `/leagues/${lid}/trades`, key: 'trades' },
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
        { label: '7s', icon: 'bi-7-circle', to: `/leagues/${lid}/reserve7s/standings`, key: '7s', style: { color: '#bc8cff' } },
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
          {/* League selector */}
          <div className="dropdown league-selector">
            <button
              type="button"
              className="btn btn-sm dropdown-toggle league-selector-btn"
              onClick={() => setSelectorOpen(s => !s)}
            >
              <i className="bi bi-trophy-fill me-1"></i>{league.name}
              {league.invite_code && (
                <span className="text-secondary ms-1" style={{ fontSize: '.65rem', letterSpacing: 1 }}>
                  {league.invite_code}
                </span>
              )}
            </button>
            {selectorOpen && (
              <ul
                className="dropdown-menu show"
                style={{ background: 'var(--kl-bg-card)', borderColor: 'var(--kl-border)', display: 'block' }}
              >
                {league.user_leagues.map(lg => (
                  <li key={lg.id}>
                    <Link
                      className={`dropdown-item${lg.id === lid ? ' active' : ''}`}
                      to={`/leagues/${lg.id}`}
                    >
                      {lg.name}
                      {lg.invite_code && (
                        <span className="text-secondary ms-1" style={{ fontSize: '.65rem', letterSpacing: 1 }}>{lg.invite_code}</span>
                      )}
                      <span className="text-secondary ms-1" style={{ fontSize: '.7rem' }}>{lg.season_year}</span>
                    </Link>
                  </li>
                ))}
                <li><hr className="dropdown-divider" style={{ borderColor: 'var(--kl-border)' }} /></li>
                <li>
                  <Link className="dropdown-item" to="/leagues/create">
                    <i className="bi bi-plus-circle me-2" style={{ color: '#3fb950' }}></i>Create League
                  </Link>
                </li>
              </ul>
            )}
          </div>

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

      {/* Page content (AppShell already wraps in .container py-4) */}
      <Outlet />

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
