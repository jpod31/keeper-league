import { Outlet, Link, useNavigate } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { NotificationBell } from '../NotificationBell'
import { useState, useRef, useEffect } from 'react'

/**
 * Top-level app shell — glass-blur sticky header.
 * Brand mark + home pill on the left, right-side glass cluster of
 * admin / bell / user-pill on the right. User dropdown styled to
 * match the league switcher.
 *
 * Inline <style> block keeps the chrome's CSS co-located so a future
 * design swap is one file's worth of work.
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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', onKey)
    }
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
        /* ── Glass sticky top bar ─────────────────────────────── */
        .kl-bar {
          position: sticky; top: 0; z-index: 1030;
          /* Deep navy ambient at top-centre + cool dark canvas. The
             ambient gives the whole app a cool blue character without
             being loud. */
          background:
            radial-gradient(900px 200px at 50% -40px, rgba(60,120,210,.16), transparent 60%),
            linear-gradient(180deg, rgba(255,255,255,.025), transparent),
            rgba(8,14,28,.82);
          backdrop-filter: blur(16px) saturate(130%);
          -webkit-backdrop-filter: blur(16px) saturate(130%);
          border-bottom: 1px solid rgba(110,130,180,.12);
        }
        .kl-bar-league-slot {
          display: inline-flex;
          align-items: center;
          margin-left: 4px;
        }
        .kl-bar-inner {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 18px;
          max-width: 1360px;
          margin: 0 auto;
        }

        /* Brand */
        .kl-bar-brand {
          display: inline-flex; align-items: center; gap: 10px;
          text-decoration: none;
          flex-shrink: 0;
          color: inherit;
          padding: 4px 4px 4px 0;
          border-radius: 12px;
          transition: opacity .15s ease;
        }
        .kl-bar-brand:hover { opacity: .9; }
        .kl-bar-brand-mark {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .kl-bar-brand-mark img {
          width: 100%; height: 100%; object-fit: contain;
          /* Tiny soft glow so the logo sits comfortably on the dark glass
             without changing its own colours. */
          filter: drop-shadow(0 2px 8px rgba(0,0,0,.4));
        }
        .kl-bar-wordmark {
          font-weight: 800;
          font-size: .92rem;
          letter-spacing: -.015em;
          color: #f0f6fc;
        }

        /* Home pill */
        .kl-bar-home {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.08);
          color: #c9d1d9;
          text-decoration: none;
          font-size: .78rem;
          font-weight: 600;
          transition: background .15s ease, color .15s ease, border-color .15s ease, transform .15s ease;
        }
        .kl-bar-home:hover {
          background: rgba(255,255,255,.08);
          color: #f0f6fc;
          border-color: rgba(255,255,255,.16);
          transform: translateY(-1px);
        }
        .kl-bar-home i { font-size: .9rem; }

        .kl-bar-spacer { flex: 1 1 auto; }

        /* Right-side glass cluster */
        .kl-bar-cluster {
          display: inline-flex; align-items: center;
          gap: 4px;
          padding: 4px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 999px;
          backdrop-filter: blur(8px);
        }
        .kl-bar-icon-btn,
        .kl-bar-cluster .nav-link {
          display: inline-flex !important; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          border-radius: 50% !important;
          background: transparent !important;
          border: 0 !important;
          padding: 0 !important;
          color: #c9d1d9 !important;
          font-size: 1.05rem;
          cursor: pointer;
          text-decoration: none;
          position: relative;
          transition: background .14s ease, color .14s ease, transform .14s ease;
        }
        .kl-bar-icon-btn:hover,
        .kl-bar-cluster .nav-link:hover {
          background: rgba(255,255,255,.08) !important;
          color: #f0f6fc !important;
          transform: scale(1.05);
        }
        /* Notification dot inside the bell button */
        .kl-bar-cluster .notif-dot {
          position: absolute;
          top: 7px; right: 8px;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #ff5470;
          box-shadow: 0 0 0 2px rgba(7,8,13,.95), 0 0 10px rgba(255,84,112,.7);
          animation: kl-pulse-dot 1.6s ease-out infinite;
        }
        @keyframes kl-pulse-dot {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%      { transform: scale(1.15); opacity: .85; }
        }

        /* User pill */
        .kl-bar-user {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 4px 12px 4px 4px;
          border-radius: 999px;
          background: transparent;
          border: 0;
          color: #c9d1d9;
          cursor: pointer;
          transition: background .14s ease, color .14s ease;
        }
        .kl-bar-user:hover { background: rgba(255,255,255,.08); color: #f0f6fc; }
        .kl-bar-user-avatar {
          width: 30px; height: 30px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: .78rem;
          font-weight: 800;
          color: #07080d;
          background: linear-gradient(135deg, #b5ff3c 0%, #2ee59d 100%);
          box-shadow: 0 4px 12px -4px rgba(46,229,157,.5);
          letter-spacing: -.01em;
          flex-shrink: 0;
        }
        .kl-bar-user-name {
          font-size: .82rem;
          font-weight: 600;
          color: #c9d1d9;
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .kl-bar-user-chev {
          font-size: .64rem;
          color: #6e7681;
          transition: transform .2s ease, color .15s ease;
        }
        .kl-bar-user.open .kl-bar-user-chev { transform: rotate(180deg); color: #f0f6fc; }

        /* Dropdown panel (same DNA as league switcher) */
        .kl-bar-menu {
          position: absolute;
          right: 0;
          top: calc(100% + 8px);
          min-width: 240px;
          background: linear-gradient(180deg, #161b22, #0d1117);
          border: 1px solid rgba(48,54,61,.85);
          border-radius: 14px;
          padding: 8px;
          box-shadow: 0 24px 56px -16px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.02) inset;
          backdrop-filter: blur(10px);
          z-index: 1040;
          animation: kl-bar-menu-in .14s cubic-bezier(.2,.7,.2,1);
        }
        @keyframes kl-bar-menu-in {
          from { opacity: 0; transform: translateY(-4px) scale(.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .kl-bar-menu-head {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 10px 12px;
          border-bottom: 1px solid rgba(48,54,61,.5);
          margin-bottom: 8px;
        }
        .kl-bar-menu-head-name { font-size: .92rem; font-weight: 700; color: #f0f6fc; }
        .kl-bar-menu-head-sub  { font-size: .68rem; color: #8b949e; }
        .kl-bar-menu-item {
          display: flex; align-items: center; gap: 10px;
          width: 100%;
          padding: 8px 10px;
          border-radius: 10px;
          background: transparent;
          border: 0;
          color: #c9d1d9;
          font-size: .82rem;
          font-weight: 600;
          text-decoration: none;
          text-align: left;
          cursor: pointer;
          transition: background .14s ease, transform .14s ease, color .14s ease;
        }
        .kl-bar-menu-item:hover {
          background: rgba(255,255,255,.05);
          color: #f0f6fc;
          transform: translateX(2px);
          text-decoration: none;
        }
        .kl-bar-menu-item i { font-size: .9rem; color: #8b949e; transition: color .14s ease; }
        .kl-bar-menu-item:hover i { color: #f0f6fc; }
        .kl-bar-menu-item-danger { color: #ff8a82; }
        .kl-bar-menu-item-danger:hover { background: rgba(248,81,73,.1); color: #ff8a82; }
        .kl-bar-menu-item-danger i { color: #f85149; }
        .kl-bar-menu-divider {
          height: 1px;
          margin: 6px 4px;
          background: rgba(48,54,61,.6);
        }

        /* Mobile (<992px) — bar still visible but compact, no name */
        @media (max-width: 991.98px) {
          .kl-bar-inner { padding: 8px 12px; }
          .kl-bar-wordmark { display: none; }
          .kl-bar-home { display: none; }
          .kl-bar-user-name { display: none; }
          .kl-bar-user-chev { display: none; }
        }
      `}</style>

      <header className="kl-bar">
        <div className="kl-bar-inner">
          <Link className="kl-bar-brand" to="/leagues" aria-label="Keeper League home">
            <span className="kl-bar-brand-mark">
              <img src="/static/icons/kl-logo.png" alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            </span>
            <span className="kl-bar-wordmark">Keeper League</span>
          </Link>

          {user && (
            <Link className="kl-bar-home" to="/leagues" title="Your leagues">
              <i className="bi bi-house-door-fill"></i><span>Home</span>
            </Link>
          )}

          {/* Portal slot — LeagueShell injects its switcher here when mounted */}
          <div id="kl-bar-league-slot" className="kl-bar-league-slot" />

          <div className="kl-bar-spacer" />

          {user && (
            <div className="kl-bar-cluster">
              {user.is_admin && (
                <Link className="kl-bar-icon-btn" to="/admin/analytics" title="Admin Analytics">
                  <i className="bi bi-bar-chart-line-fill"></i>
                </Link>
              )}
              <NotificationBell />
              <div ref={menuRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`kl-bar-user${menuOpen ? ' open' : ''}`}
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="User menu"
                  aria-expanded={menuOpen}
                >
                  <span className="kl-bar-user-avatar">{initial}</span>
                  <span className="kl-bar-user-name">{displayName}</span>
                  <i className="bi bi-chevron-down kl-bar-user-chev"></i>
                </button>
                {menuOpen && (
                  <div className="kl-bar-menu" role="menu">
                    <div className="kl-bar-menu-head">
                      <span className="kl-bar-user-avatar">{initial}</span>
                      <div>
                        <div className="kl-bar-menu-head-name">{displayName || 'You'}</div>
                        <div className="kl-bar-menu-head-sub">{user.email || ''}</div>
                      </div>
                    </div>
                    <Link className="kl-bar-menu-item" to="/leagues" onClick={() => setMenuOpen(false)}>
                      <i className="bi bi-house-door"></i>My leagues
                    </Link>
                    <Link className="kl-bar-menu-item" to="/leagues/create" onClick={() => setMenuOpen(false)}>
                      <i className="bi bi-plus-circle"></i>Create a league
                    </Link>
                    <button type="button" className="kl-bar-menu-item" onClick={openJoin}>
                      <i className="bi bi-box-arrow-in-right"></i>Join a league
                    </button>
                    <div className="kl-bar-menu-divider"></div>
                    <Link className="kl-bar-menu-item" to="/auth/profile" onClick={() => setMenuOpen(false)}>
                      <i className="bi bi-person-circle"></i>Profile
                    </Link>
                    <div className="kl-bar-menu-divider"></div>
                    <button type="button" className="kl-bar-menu-item kl-bar-menu-item-danger" onClick={handleLogout}>
                      <i className="bi bi-box-arrow-right"></i>Log out
                    </button>
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
