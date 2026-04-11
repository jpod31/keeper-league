import { Outlet, Link, useNavigate } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { NotificationBell } from '../NotificationBell'
import { useState, useRef, useEffect } from 'react'

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/auth/login')
  }

  return (
    <div className="has-bottom-nav">
      {/* Navbar - matches base.html */}
      <nav className="navbar navbar-expand-lg border-bottom border-secondary-subtle">
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center gap-2" to="/leagues">
            <i className="bi bi-trophy-fill" style={{ color: 'var(--kl-accent-blue)', fontSize: '1.2rem' }}></i>
            <span className="brand-text d-none d-lg-inline">Keeper League</span>
          </Link>

          <div className="d-flex align-items-center gap-1">
            {user?.is_admin && (
              <Link className="nav-link" to="/admin" style={{ padding: '.4rem .55rem' }}>
                <i className="bi bi-bar-chart-line" style={{ fontSize: '1.05rem' }}></i>
              </Link>
            )}
            <NotificationBell />
            <div className="dropdown" ref={menuRef}>
              <a className="nav-link dropdown-toggle p-1" href="#" role="button" onClick={() => setMenuOpen(!menuOpen)}>
                <span className="d-inline-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: 28, height: 28, background: 'var(--kl-bg-elevated)', fontSize: '.75rem', fontWeight: 600 }}>
                  {(user?.display_name || user?.username || '?')[0].toUpperCase()}
                </span>
              </a>
              {menuOpen && (
                <ul className="dropdown-menu dropdown-menu-end show"
                  style={{ background: 'var(--kl-bg-card)', borderColor: 'var(--kl-border)' }}>
                  <li><span className="dropdown-item-text fw-bold" style={{ fontSize: '.85rem' }}>{user?.display_name}</span></li>
                  <li><hr className="dropdown-divider" style={{ borderColor: 'var(--kl-border)' }} /></li>
                  <li><Link className="dropdown-item" to="/auth/profile" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-person me-2"></i>Profile
                  </Link></li>
                  <li><Link className="dropdown-item" to="/leagues" onClick={() => setMenuOpen(false)}>
                    <i className="bi bi-trophy me-2"></i>My Leagues
                  </Link></li>
                  <li><hr className="dropdown-divider" style={{ borderColor: 'var(--kl-border)' }} /></li>
                  <li><button className="dropdown-item" onClick={handleLogout} style={{ color: 'var(--kl-accent-red)' }}>
                    <i className="bi bi-box-arrow-right me-2"></i>Sign Out
                  </button></li>
                </ul>
              )}
            </div>
          </div>
        </div>
      </nav>

      <Outlet />
    </div>
  )
}
