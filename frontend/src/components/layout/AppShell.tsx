import { Outlet, Link, useNavigate } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { NotificationBell } from '../NotificationBell'
import { useState, useRef, useEffect } from 'react'

/**
 * Top-level app shell: brand, home, notifications, user menu, admin icon.
 * Plain flex — no Bootstrap collapse/navbar-collapse, no JS-gated popper classes.
 */
export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/auth/login')
  }

  const openJoin = () => {
    setMenuOpen(false)
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

  // Put has-bottom-nav on <body> so global CSS like
  // `body.has-bottom-nav main.container { padding-bottom: 80px }` works
  useEffect(() => {
    document.body.classList.add('has-bottom-nav')
    return () => document.body.classList.remove('has-bottom-nav')
  }, [])

  const initial = (user?.display_name || user?.username || '?')[0].toUpperCase()
  const displayName = user?.display_name || user?.username || ''

  return (
    <div>
      <style>{`
        .kl-topbar { position: sticky; top: 0; z-index: 1030; background: var(--kl-bg-card); border-bottom: 1px solid var(--kl-border); }
        .kl-topbar-inner { display: flex; align-items: center; gap: .75rem; padding: .6rem 1rem; max-width: 1320px; margin: 0 auto; }
        .kl-topbar-brand { display: flex; align-items: center; gap: .5rem; text-decoration: none; color: inherit; flex-shrink: 0; }
        .kl-topbar-brand img { width: 32px; height: 32px; border-radius: 6px; }
        .kl-topbar-brand .brand-text { font-weight: 800; font-size: .92rem; letter-spacing: -.2px; color: #e6edf3; }
        .kl-topbar-home { display: inline-flex; align-items: center; gap: .35rem; color: var(--kl-text-secondary); text-decoration: none; font-size: .8rem; font-weight: 500; padding: .4rem .6rem; border-radius: 6px; transition: color .15s, background .15s; }
        .kl-topbar-home:hover { color: var(--kl-text-primary); background: rgba(255,255,255,.03); }
        .kl-topbar-spacer { flex: 1 1 auto; }
        .kl-topbar-right { display: flex; align-items: center; gap: .25rem; flex-shrink: 0; }
        .kl-topbar-icon { display: inline-flex; align-items: center; justify-content: center; color: var(--kl-text-secondary); background: none; border: none; padding: .4rem .55rem; border-radius: 6px; font-size: 1.05rem; cursor: pointer; text-decoration: none; transition: color .15s, background .15s; }
        .kl-topbar-icon:hover { color: var(--kl-text-primary); background: rgba(255,255,255,.04); }
        .kl-user-btn { display: flex; align-items: center; gap: .5rem; background: none; border: none; color: inherit; padding: .3rem .5rem; border-radius: 6px; cursor: pointer; }
        .kl-user-btn:hover { background: rgba(255,255,255,.04); }
        .kl-user-avatar { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--kl-bg-elevated); font-size: .75rem; font-weight: 700; color: var(--kl-text-primary); flex-shrink: 0; }
        .kl-user-name { font-size: .82rem; font-weight: 500; color: var(--kl-text-secondary); }
        @media (max-width: 767.98px) { .kl-user-name, .kl-brand-text-lg, .kl-topbar-home span { display: none; } }
        .kl-user-menu { position: absolute; right: 0; top: 100%; margin-top: .25rem; min-width: 200px; background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 8px; box-shadow: 0 6px 24px rgba(0,0,0,.4); padding: .25rem 0; z-index: 1040; }
        .kl-user-menu a, .kl-user-menu button { display: flex; align-items: center; gap: .5rem; width: 100%; padding: .5rem .85rem; color: var(--kl-text-primary); text-decoration: none; font-size: .82rem; background: none; border: none; text-align: left; cursor: pointer; }
        .kl-user-menu a:hover, .kl-user-menu button:hover { background: rgba(255,255,255,.05); }
        .kl-user-menu hr { margin: .25rem 0; border: none; border-top: 1px solid var(--kl-border); }
      `}</style>

      <header className="kl-topbar">
        <div className="kl-topbar-inner">
          <Link className="kl-topbar-brand" to="/leagues">
            <img src="/static/icons/kl-logo.png" alt="KL" />
            <span className="brand-text kl-brand-text-lg">Keeper League</span>
          </Link>

          {user && (
            <Link className="kl-topbar-home" to="/leagues" title="My Leagues">
              <i className="bi bi-house"></i><span>Home</span>
            </Link>
          )}

          <div className="kl-topbar-spacer" />

          {user && (
            <div className="kl-topbar-right">
              {user.is_admin && (
                <Link className="kl-topbar-icon" to="/admin/analytics" title="Admin Analytics">
                  <i className="bi bi-bar-chart-line"></i>
                </Link>
              )}
              <NotificationBell />
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button type="button" className="kl-user-btn" onClick={() => setMenuOpen(o => !o)} aria-label="User menu">
                  <span className="kl-user-avatar">{initial}</span>
                  <span className="kl-user-name">{displayName}</span>
                  <i className="bi bi-chevron-down" style={{ fontSize: '.65rem', color: 'var(--kl-text-faint)' }}></i>
                </button>
                {menuOpen && (
                  <div className="kl-user-menu">
                    <Link to="/leagues" onClick={() => setMenuOpen(false)}><i className="bi bi-house"></i>My Leagues</Link>
                    <Link to="/leagues/create" onClick={() => setMenuOpen(false)}><i className="bi bi-plus-circle"></i>Create League</Link>
                    <button type="button" onClick={openJoin}><i className="bi bi-box-arrow-in-right"></i>Join League</button>
                    <hr />
                    <Link to="/auth/profile" onClick={() => setMenuOpen(false)}><i className="bi bi-person"></i>Profile</Link>
                    <hr />
                    <button type="button" onClick={handleLogout}><i className="bi bi-box-arrow-right"></i>Log Out</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

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
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 1060, width: '90%', maxWidth: 360,
              background: 'var(--kl-bg-card)', border: '1px solid var(--kl-border)', borderRadius: 12,
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
                  type="text" className="form-control" placeholder="e.g. A3K9MZ2P"
                  maxLength={12} required autoFocus
                  value={joinCode} onChange={e => setJoinCode(e.target.value)}
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
