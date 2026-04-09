import { Outlet, Link, useNavigate } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useState, useRef, useEffect } from 'react'
import {
  Trophy, User, LogOut, Settings, BarChart3, Bell,
} from 'lucide-react'

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
    <div className="min-h-screen bg-[#0d1117]">
      {/* Top nav */}
      <nav className="sticky top-0 z-40 border-b border-[#21262d] bg-[#0d1117]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/leagues" className="flex items-center gap-2 no-underline">
            <Trophy className="w-5 h-5 text-[#58a6ff]" />
            <span className="text-sm font-extrabold text-[#e6edf3] hidden sm:inline">Keeper League</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/leagues" className="text-xs text-[#8b949e] hover:text-[#e6edf3] px-2 py-1 rounded transition">
              Leagues
            </Link>
            {user?.is_admin && (
              <Link to="/admin" className="text-xs text-[#d29922] hover:text-[#fbbf24] px-2 py-1 rounded transition">
                <BarChart3 className="w-4 h-4" />
              </Link>
            )}

            {/* Notifications placeholder */}
            <button className="relative p-1.5 text-[#8b949e] hover:text-[#e6edf3] transition">
              <Bell className="w-4 h-4" />
            </button>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-8 h-8 rounded-full bg-[#21262d] flex items-center justify-center text-xs font-bold text-[#e6edf3] hover:bg-[#30363d] transition"
              >
                {(user?.display_name || user?.username || '?')[0].toUpperCase()}
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-[#161b22] border border-[#21262d] shadow-xl py-1 z-50">
                  <div className="px-3 py-2 border-b border-[#21262d]">
                    <p className="text-sm font-bold text-[#e6edf3]">{user?.display_name}</p>
                    <p className="text-xs text-[#484f58]">@{user?.username}</p>
                  </div>
                  <Link to="/auth/profile" onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3] transition no-underline">
                    <User className="w-4 h-4" /> Profile
                  </Link>
                  <Link to="/leagues" onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[#8b949e] hover:bg-[#21262d] hover:text-[#e6edf3] transition no-underline">
                    <Settings className="w-4 h-4" /> My Leagues
                  </Link>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#ef4444] hover:bg-[#21262d] transition">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <Outlet />
    </div>
  )
}
