import { Outlet, Link, useNavigate } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { NotificationBell } from '../NotificationBell'
import { useState, useRef, useEffect } from 'react'

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const menuRef = useRef<HTMLLIElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false)
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(t)) setMobileMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    setMobileMenuOpen(false)
    await logout()
    navigate('/auth/login')
  }

  const openJoin = () => {
    setMenuOpen(false)
    setMobileMenuOpen(false)
    setJoinOpen(true)
  }

  const submitJoin = (e: React.FormEvent) => {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (code) {
      setJoinOpen(false)
      setJoinCode('')
      navigate(`/leagues/invite/${encodeURIComponent(code)}`)
    }
  }

  const initial = (user?.display_name || user?.username || '?')[0].toUpperCase()
  const displayName = user?.display_name || user?.username || ''

  // Style helpers for dropdowns — force right-alignment without Bootstrap JS/Popper.
  // Bootstrap 5 CSS gates .dropdown-menu-end rules behind [data-bs-popper]; since we
  // don't load bootstrap.bundle.js, we inline the positioning so the menu stays on-screen.
  const rightAlignedMenu: React.CSSProperties = {
    background: 'var(--kl-bg-card)',
    borderColor: 'var(--kl-border)',
    position: 'absolute',
    right: 0,
    left: 'auto',
    top: '100%',
    marginTop: '.125rem',
  }

  return (
    <div className="has-bottom-nav">
      <nav className="navbar navbar-expand-lg border-bottom border-secondary-subtle">
        <div className="container">
          <Link className="navbar-brand d-flex align-items-center gap-2" to="/leagues">
            <img src="/static/icons/kl-logo.png" alt="KL" className="brand-logo" />
            <span className="brand-text d-none d-lg-inline">Keeper League</span>
          </Link>

          {user && (
            <>
              {/* Mobile: notif bell + user avatar inline */}
              <div className="d-flex align-items-center gap-1 d-lg-none">
                {user.is_admin && (
                  <Link className="nav-link" to="/admin/analytics" title="Admin Analytics" style={{ padding: '.4rem .55rem' }}>
                    <i className="bi bi-bar-chart-line" style={{ fontSize: '1.05rem' }}></i>
                  </Link>
                )}
                <NotificationBell />
                <div className="dropdown" ref={mobileMenuRef} style={{ position: 'relative' }}>
                  <a
                    className="nav-link dropdown-toggle p-1"
                    href="#"
                    role="button"
                    onClick={e => { e.preventDefault(); setMobileMenuOpen(!mobileMenuOpen) }}
                  >
                    <span
                      className="d-inline-flex align-items-center justify-content-center rounded-circle"
                      style={{ width: 28, height: 28, background: 'var(--kl-bg-elevated)', fontSize: '.75rem', fontWeight: 600 }}
                    >
                      {initial}
                    </span>
                  </a>
                  {mobileMenuOpen && (
                    <ul className="dropdown-menu dropdown-menu-end show" style={rightAlignedMenu}>
                      <li><Link className="dropdown-item" to="/leagues" onClick={() => setMobileMenuOpen(false)}><i className="bi bi-house me-2"></i>Home</Link></li>
                      <li><Link className="dropdown-item" to="/leagues/create" onClick={() => setMobileMenuOpen(false)}><i className="bi bi-plus-circle me-2"></i>Create League</Link></li>
                      <li><button type="button" className="dropdown-item" onClick={openJoin}><i className="bi bi-box-arrow-in-right me-2"></i>Join League</button></li>
                      <li><hr className="dropdown-divider" style={{ borderColor: 'var(--kl-border)' }} /></li>
                      <li><Link className="dropdown-item" to="/auth/profile" onClick={() => setMobileMenuOpen(false)}><i className="bi bi-person me-2"></i>Profile</Link></li>
                      <li><hr className="dropdown-divider" style={{ borderColor: 'var(--kl-border)' }} /></li>
                      <li><button type="button" className="dropdown-item" onClick={handleLogout}><i className="bi bi-box-arrow-right me-2"></i>Log Out</button></li>
                    </ul>
                  )}
                </div>
              </div>

              {/* Desktop: collapsible navbar */}
              <div className="collapse navbar-collapse d-none d-lg-flex" id="nav">
                <ul className="navbar-nav me-auto">
                  <li className="nav-item">
                    <Link className="nav-link" to="/leagues"><i className="bi bi-house me-1"></i>Home</Link>
                  </li>
                </ul>
                <ul className="navbar-nav d-flex align-items-center">
                  {user.is_admin && (
                    <li className="nav-item">
                      <Link className="nav-link" to="/admin/analytics" title="Admin Analytics"><i className="bi bi-bar-chart-line"></i></Link>
                    </li>
                  )}
                  <li className="nav-item">
                    <NotificationBell />
                  </li>
                  <li className="nav-item dropdown" ref={menuRef} style={{ position: 'relative' }}>
                    <a
                      className="nav-link dropdown-toggle d-flex align-items-center gap-2"
                      href="#"
                      role="button"
                      onClick={e => { e.preventDefault(); setMenuOpen(!menuOpen) }}
                    >
                      <span
                        className="d-inline-flex align-items-center justify-content-center rounded-circle"
                        style={{ width: 28, height: 28, background: 'var(--kl-bg-elevated)', fontSize: '.75rem', fontWeight: 600 }}
                      >
                        {initial}
                      </span>
                      <span>{displayName}</span>
                    </a>
                    {menuOpen && (
                      <ul className="dropdown-menu dropdown-menu-end show" style={rightAlignedMenu}>
                        <li><Link className="dropdown-item" to="/leagues/create" onClick={() => setMenuOpen(false)}><i className="bi bi-plus-circle me-2"></i>Create League</Link></li>
                        <li><button type="button" className="dropdown-item" onClick={openJoin}><i className="bi bi-box-arrow-in-right me-2"></i>Join League</button></li>
                        <li><hr className="dropdown-divider" style={{ borderColor: 'var(--kl-border)' }} /></li>
                        <li><Link className="dropdown-item" to="/auth/profile" onClick={() => setMenuOpen(false)}><i className="bi bi-person me-2"></i>Profile</Link></li>
                        <li><hr className="dropdown-divider" style={{ borderColor: 'var(--kl-border)' }} /></li>
                        <li><button type="button" className="dropdown-item" onClick={handleLogout}><i className="bi bi-box-arrow-right me-2"></i>Log Out</button></li>
                      </ul>
                    )}
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </nav>

      <main className="container py-4">
        <Outlet />
      </main>

      {/* Join League modal */}
      {joinOpen && (
        <>
          <div
            onClick={() => setJoinOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1055 }}
          />
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              zIndex: 1060,
              width: '90%',
              maxWidth: 360,
              background: 'var(--kl-bg-card)',
              border: '1px solid var(--kl-border)',
              borderRadius: 12,
            }}
          >
            <div style={{ borderBottom: '1px solid var(--kl-border)', padding: '.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h6 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Join a League</h6>
              <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={() => setJoinOpen(false)}></button>
            </div>
            <form onSubmit={submitJoin} style={{ padding: '1rem' }}>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '.8rem' }}>League Invite Code</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. A3K9MZ2P"
                  maxLength={12}
                  required
                  autoFocus
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  style={{ textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', fontWeight: 600 }}
                />
              </div>
              <button type="submit" className="btn btn-primary w-100 btn-sm">
                <i className="bi bi-box-arrow-in-right me-1"></i>Join
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
