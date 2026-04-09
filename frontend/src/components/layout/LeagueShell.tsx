import { Outlet, NavLink, useNavigate } from 'react-router'
import { LeagueProvider, useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../ui/Spinner'
import { useState } from 'react'

export function LeagueShell() {
  return (
    <LeagueProvider>
      <LeagueShellInner />
    </LeagueProvider>
  )
}

function LeagueShellInner() {
  const { league, loading, error } = useLeague()
  const [moreOpen, setMoreOpen] = useState(false)
  const navigate = useNavigate()

  if (loading) return <Spinner text="Loading league..." />
  if (error || !league) return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
      <p className="text-danger">Failed to load league.</p>
    </div>
  )

  const t = league.user_team
  const lid = league.id

  return (
    <div>
      {/* Desktop tab bar - matches league_base.html */}
      <div className="league-nav d-none d-lg-block">
        <div className="league-nav-inner">
          {/* League selector */}
          <button className="league-tab" onClick={() => navigate(`/leagues/${lid}`)} style={{ fontWeight: 700 }}>
            <i className="bi bi-trophy-fill me-1" style={{ color: 'var(--kl-accent-blue)' }}></i>
            {league.name}
            <span style={{ fontSize: '.65rem', color: 'var(--kl-text-faint)', marginLeft: 4 }}>{league.season_year}</span>
          </button>

          <nav className="league-tabs d-none d-lg-flex">
            {t && (
              <>
                <NavLink to={`/leagues/${lid}/team/${t.id}`} className={({ isActive }) => `league-tab${isActive ? ' active' : ''}`}>
                  <i className="bi bi-people"></i><span>My Team</span>
                </NavLink>
                <NavLink to={`/leagues/${lid}/gameday`} className={({ isActive }) => `league-tab${isActive ? ' active' : ''}`}>
                  <i className="bi bi-controller"></i><span>Gameday</span>
                </NavLink>
              </>
            )}
            <NavLink to={`/leagues/${lid}/player-pool`} className={({ isActive }) => `league-tab${isActive ? ' active' : ''}`}>
              <i className="bi bi-person-plus"></i><span>Players</span>
            </NavLink>
            <NavLink to={`/leagues/${lid}/fixture`} className={({ isActive }) => `league-tab${isActive ? ' active' : ''}`}>
              <i className="bi bi-calendar-week"></i><span>League</span>
            </NavLink>
            {league.active_draft && (
              <NavLink to={`/leagues/${lid}/draft`} className={({ isActive }) => `league-tab${isActive ? ' active' : ''}`} style={{ color: 'var(--kl-accent-yellow)' }}>
                <i className="bi bi-list-check"></i><span>Draft Room</span>
              </NavLink>
            )}
            <NavLink to={`/leagues/${lid}/trades`} className={({ isActive }) => `league-tab${isActive ? ' active' : ''}`}>
              <i className="bi bi-arrow-left-right"></i><span>Trades</span>
            </NavLink>
            <NavLink to={`/leagues/${lid}/chat`} className={({ isActive }) => `league-tab${isActive ? ' active' : ''}`}>
              <i className="bi bi-megaphone"></i><span>Comms</span>
            </NavLink>
            {league.is_commissioner ? (
              <NavLink to={`/leagues/${lid}/commissioner`} className={({ isActive }) => `league-tab${isActive ? ' active' : ''}`} style={{ color: 'var(--kl-accent-yellow)' }}>
                <i className="bi bi-shield-lock"></i><span>Admin</span>
              </NavLink>
            ) : (
              <NavLink to={`/leagues/${lid}/settings`} className={({ isActive }) => `league-tab${isActive ? ' active' : ''}`}>
                <i className="bi bi-gear"></i><span>Settings</span>
              </NavLink>
            )}
          </nav>
        </div>
      </div>

      {/* Page content */}
      <div className="container py-4">
        <Outlet />
      </div>

      {/* Mobile bottom nav - matches league_base.html */}
      <nav className="mobile-bottom-nav d-lg-none">
        {t && (
          <>
            <NavLink to={`/leagues/${lid}/team/${t.id}`} className={({ isActive }) => `mob-nav-item${isActive ? ' active' : ''}`}>
              <i className="bi bi-people"></i><span>Team</span>
            </NavLink>
            <NavLink to={`/leagues/${lid}/gameday`} className={({ isActive }) => `mob-nav-item${isActive ? ' active' : ''}`}>
              <i className="bi bi-controller"></i><span>Gameday</span>
            </NavLink>
          </>
        )}
        <NavLink to={`/leagues/${lid}/afl-live`} className={({ isActive }) => `mob-nav-item${isActive ? ' active' : ''}`}>
          <i className="bi bi-broadcast"></i><span>AFL Live</span>
        </NavLink>
        <NavLink to={`/leagues/${lid}/player-pool`} className={({ isActive }) => `mob-nav-item${isActive ? ' active' : ''}`}>
          <i className="bi bi-person-plus"></i><span>Players</span>
        </NavLink>
        <button className="mob-nav-item" onClick={() => setMoreOpen(!moreOpen)}>
          <i className="bi bi-grid-3x3-gap"></i><span>More</span>
        </button>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1040 }} onClick={() => setMoreOpen(false)} className="d-lg-none" />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--kl-bg-card)', borderRadius: '16px 16px 0 0', zIndex: 1050, paddingBottom: 'env(safe-area-inset-bottom)' }} className="d-lg-none">
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--kl-border)', margin: '12px auto 16px' }} />
            <div className="d-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '0 16px 20px' }}>
              <MoreItem icon="bi-bar-chart" label="Ladder" onClick={() => { setMoreOpen(false); navigate(`/leagues/${lid}/standings`) }} />
              <MoreItem icon="bi-calendar-week" label="Fixtures" onClick={() => { setMoreOpen(false); navigate(`/leagues/${lid}/fixture`) }} />
              <MoreItem icon="bi-arrow-left-right" label="Trades" onClick={() => { setMoreOpen(false); navigate(`/leagues/${lid}/trades`) }} />
              <MoreItem icon="bi-megaphone" label="Comms" onClick={() => { setMoreOpen(false); navigate(`/leagues/${lid}/chat`) }} />
              {t && <MoreItem icon="bi-bar-chart-line" label="Analytics" onClick={() => { setMoreOpen(false); navigate(`/leagues/${lid}/team/${t.id}/analytics`) }} />}
              <MoreItem icon="bi-gear" label="Settings" onClick={() => { setMoreOpen(false); navigate(`/leagues/${lid}/settings`) }} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function MoreItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="d-flex flex-column align-items-center gap-1 py-2 border-0"
      style={{ background: 'none', color: 'var(--kl-text-secondary)', fontSize: '.68rem', fontWeight: 600 }}>
      <i className={`bi ${icon}`} style={{ fontSize: '1.2rem' }}></i>
      <span>{label}</span>
    </button>
  )
}
