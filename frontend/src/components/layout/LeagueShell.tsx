import { Outlet, NavLink, useNavigate } from 'react-router'
import { LeagueProvider, useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../ui/Spinner'
import {
  Users, Gamepad2, UserPlus, CalendarDays, Megaphone,
  ShieldCheck, Settings, ArrowLeftRight, BarChart3,
  LayoutGrid, Radio,
} from 'lucide-react'
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

  if (loading) return <Spinner text="Loading league..." />
  if (error || !league) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-sm text-red-500">Failed to load league.</p>
    </div>
  )

  const t = league.user_team
  const lid = league.id

  return (
    <div>
      {/* Desktop tab bar */}
      <div className="hidden lg:block border-b border-[#21262d] bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 h-11 overflow-x-auto">
          <LeagueSelector />
          <div className="w-px h-5 bg-[#21262d] mx-2" />
          {t && (
            <>
              <Tab to={`/leagues/${lid}/team/${t.id}`} icon={<Users className="w-3.5 h-3.5" />}>My Team</Tab>
              <Tab to={`/leagues/${lid}/gameday`} icon={<Gamepad2 className="w-3.5 h-3.5" />}>Gameday</Tab>
            </>
          )}
          <Tab to={`/leagues/${lid}/player-pool`} icon={<UserPlus className="w-3.5 h-3.5" />}>Players</Tab>
          <Tab to={`/leagues/${lid}/fixture`} icon={<CalendarDays className="w-3.5 h-3.5" />}>League</Tab>
          {league.active_draft && (
            <Tab to={`/leagues/${lid}/draft`} className="!text-[#d29922]">Draft Room</Tab>
          )}
          <Tab to={`/leagues/${lid}/trades`} icon={<ArrowLeftRight className="w-3.5 h-3.5" />}>Trades</Tab>
          <Tab to={`/leagues/${lid}/chat`} icon={<Megaphone className="w-3.5 h-3.5" />}>Comms</Tab>
          {league.is_commissioner ? (
            <Tab to={`/leagues/${lid}/commissioner`} className="!text-[#d29922]" icon={<ShieldCheck className="w-3.5 h-3.5" />}>Admin</Tab>
          ) : (
            <Tab to={`/leagues/${lid}/settings`} icon={<Settings className="w-3.5 h-3.5" />}>Settings</Tab>
          )}
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#0d1117] border-t border-[#21262d] lg:hidden z-40 safe-bottom">
        <div className="flex items-stretch h-14">
          {t && (
            <>
              <MobTab to={`/leagues/${lid}/team/${t.id}`} icon={<Users className="w-5 h-5" />} label="Team" />
              <MobTab to={`/leagues/${lid}/gameday`} icon={<Gamepad2 className="w-5 h-5" />} label="Gameday" />
            </>
          )}
          <MobTab to={`/leagues/${lid}/afl-live`} icon={<Radio className="w-5 h-5" />} label="AFL" />
          <MobTab to={`/leagues/${lid}/player-pool`} icon={<UserPlus className="w-5 h-5" />} label="Players" />
          <button onClick={() => setMoreOpen(!moreOpen)} className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[#484f58]">
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 bg-[#161b22] rounded-t-2xl z-50 lg:hidden pb-safe">
            <div className="w-10 h-1 rounded-full bg-[#30363d] mx-auto mt-3 mb-4" />
            <div className="grid grid-cols-4 gap-3 px-4 pb-6">
              <MoreItem to={`/leagues/${lid}/standings`} onClick={() => setMoreOpen(false)} icon={<BarChart3 className="w-5 h-5" />} label="Ladder" />
              <MoreItem to={`/leagues/${lid}/fixture`} onClick={() => setMoreOpen(false)} icon={<CalendarDays className="w-5 h-5" />} label="Fixtures" />
              <MoreItem to={`/leagues/${lid}/trades`} onClick={() => setMoreOpen(false)} icon={<ArrowLeftRight className="w-5 h-5" />} label="Trades" />
              <MoreItem to={`/leagues/${lid}/chat`} onClick={() => setMoreOpen(false)} icon={<Megaphone className="w-5 h-5" />} label="Comms" />
              {t && <MoreItem to={`/leagues/${lid}/team/${t.id}/analytics`} onClick={() => setMoreOpen(false)} icon={<BarChart3 className="w-5 h-5" />} label="Analytics" />}
              <MoreItem to={`/leagues/${lid}/settings`} onClick={() => setMoreOpen(false)} icon={<Settings className="w-5 h-5" />} label="Settings" />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function LeagueSelector() {
  const { league } = useLeague()
  const navigate = useNavigate()
  if (!league) return null
  return (
    <button onClick={() => navigate(`/leagues/${league.id}`)}
      className="text-xs font-bold text-[#e6edf3] hover:text-[#58a6ff] transition flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[#161b22]">
      <span className="text-[#58a6ff]">&#9670;</span>
      {league.name}
      <span className="text-[10px] text-[#484f58] ml-1">{league.season_year}</span>
    </button>
  )
}

function Tab({ to, children, icon, className }: { to: string; children: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <NavLink to={to} end={false}
      className={({ isActive }) =>
        `flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition no-underline ${
          isActive ? 'bg-[#21262d] text-[#e6edf3]' : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22]'
        } ${className || ''}`
      }
    >
      {icon}{children}
    </NavLink>
  )
}

function MobTab({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink to={to}
      className={({ isActive }) =>
        `flex-1 flex flex-col items-center justify-center gap-0.5 no-underline transition ${
          isActive ? 'text-[#58a6ff]' : 'text-[#484f58]'
        }`
      }
    >
      {icon}
      <span className="text-[10px]">{label}</span>
    </NavLink>
  )
}

function MoreItem({ to, icon, label, onClick }: { to: string; icon: React.ReactNode; label: string; onClick: () => void }) {
  const navigate = useNavigate()
  return (
    <button onClick={() => { onClick(); navigate(to) }}
      className="flex flex-col items-center gap-1.5 py-2 text-[#8b949e] hover:text-[#e6edf3] transition">
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  )
}
