import { Routes, Route, Navigate } from 'react-router'
import { lazy, Suspense } from 'react'
import { AppShell } from './components/layout/AppShell'
import { LeagueShell } from './components/layout/LeagueShell'
import { AuthGuard } from './components/layout/AuthGuard'
import { Spinner } from './components/ui/Spinner'

// Auth pages
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { ProfilePage } from './pages/auth/ProfilePage'

// League pages
import { LeagueListPage } from './pages/leagues/LeagueListPage'
import { DashboardPage } from './pages/leagues/DashboardPage'
import { CreateLeaguePage } from './pages/leagues/CreateLeaguePage'
import { SettingsPage } from './pages/leagues/SettingsPage'

// Lazy-loaded heavy pages (code splitting)
const SquadPage = lazy(() => import('./pages/team/SquadPage').then(m => ({ default: m.SquadPage })))
const GamedayPage = lazy(() => import('./pages/matchups/GamedayPage').then(m => ({ default: m.GamedayPage })))
const Reserve7sGamedayPage = lazy(() => import('./pages/reserve7s/GamedayPage').then(m => ({ default: m.Reserve7sGamedayPage })))
const Reserve7sStandingsPage = lazy(() => import('./pages/reserve7s/StandingsPage').then(m => ({ default: m.Reserve7sStandingsPage })))
const Reserve7sFixturePage = lazy(() => import('./pages/reserve7s/FixturePage').then(m => ({ default: m.Reserve7sFixturePage })))
const Reserve7sTeamPage = lazy(() => import('./pages/reserve7s/TeamPage').then(m => ({ default: m.Reserve7sTeamPage })))
const AnalyticsPage = lazy(() => import('./pages/team/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const DraftRoomPage = lazy(() => import('./pages/draft/DraftRoomPage').then(m => ({ default: m.DraftRoomPage })))
const L = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<Spinner />}>{children}</Suspense>

// Direct imports for lighter pages
import { LineupPage } from './pages/team/LineupPage'
import { TeamStatsPage } from './pages/team/TeamStatsPage'
// AnalyticsPage lazy loaded above

// Matchup pages
import { StandingsPage } from './pages/matchups/StandingsPage'
// GamedayPage lazy loaded above
import { FixturePage } from './pages/matchups/FixturePage'
import { RoundDetailPage } from './pages/matchups/RoundDetailPage'
import { MatchupDetailPage } from './pages/matchups/MatchupDetailPage'
import { AflGamePage } from './pages/matchups/AflGamePage'
import { FinalsPage } from './pages/matchups/FinalsPage'
import { ListChangesPage } from './pages/leagues/ListChangesPage'
import { LegacyPage } from './pages/LegacyPage'

// Trade pages
import { TradeCenterPage } from './pages/trades/TradeCenterPage'
import { TradeProposePage } from './pages/trades/TradeProposePage'
import { TradeDetailPage } from './pages/trades/TradeDetailPage'

// Comms pages
import { LeagueChatPage } from './pages/comms/LeagueChatPage'
import { NotificationsPage } from './pages/comms/NotificationsPage'
import { ActivityFeedPage } from './pages/comms/ActivityFeedPage'

// Player pages
import { PlayerPoolPage } from './pages/players/PlayerPoolPage'

// Draft pages
// DraftRoomPage lazy loaded above


export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/register" element={<RegisterPage />} />

      {/* Authenticated routes */}
      <Route element={<AuthGuard><AppShell /></AuthGuard>}>
        <Route path="/" element={<Navigate to="/leagues" replace />} />
        <Route path="/auth/profile" element={<ProfilePage />} />
        <Route path="/leagues" element={<LeagueListPage />} />
        <Route path="/leagues/create" element={<CreateLeaguePage />} />

        {/* League-scoped routes */}
        <Route path="/leagues/:leagueId" element={<LeagueShell />}>
          <Route index element={<DashboardPage />} />

          {/* Team */}
          <Route path="team/:teamId" element={<L><SquadPage /></L>} />
          <Route path="team/:teamId/lineup/:round" element={<LineupPage />} />
          <Route path="team/:teamId/stats" element={<TeamStatsPage />} />
          <Route path="team/:teamId/analytics" element={<L><AnalyticsPage /></L>} />

          {/* Matchups */}
          <Route path="standings" element={<StandingsPage />} />
          <Route path="gameday" element={<L><GamedayPage /></L>} />
          <Route path="fixture" element={<FixturePage />} />
          <Route path="fixture/:round" element={<RoundDetailPage />} />
          <Route path="matchup/:fixtureId" element={<MatchupDetailPage />} />
          <Route path="history" element={<LegacyPage title="League Records" description="All-time champions, records, and head-to-head history." path="/leagues/:leagueId/records" icon="bi-trophy" />} />
          <Route path="history/:year" element={<LegacyPage title="Season Archive" description="Historical season standings and results." path="/leagues/:leagueId/records" icon="bi-archive" />} />
          <Route path="finals" element={<FinalsPage />} />
          <Route path="afl-live" element={<LegacyPage title="AFL Live" description="Live AFL games for the current round." path="/leagues/:leagueId/afl-live" icon="bi-broadcast" />} />
          <Route path="gameday/afl-game/:gameId" element={<AflGamePage />} />

          {/* Draft */}
          <Route path="draft" element={<L><DraftRoomPage /></L>} />
          <Route path="draft/setup" element={<LegacyPage title="Draft Setup" description="Configure draft order, timing, and settings before going live." path="/leagues/:leagueId/draft/setup" icon="bi-gear" />} />
          <Route path="draft/mock" element={<LegacyPage title="Mock Draft" description="Practice draft against simulated opponents." path="/leagues/:leagueId/draft/mock" icon="bi-play-circle" />} />
          <Route path="draft/recap" element={<LegacyPage title="Draft Recap" description="Pick-by-pick review of your completed draft." path="/leagues/:leagueId/draft/recap" icon="bi-list-check" />} />

          {/* Trades */}
          <Route path="trades" element={<TradeCenterPage />} />
          <Route path="trades/propose" element={<TradeProposePage />} />
          <Route path="trades/:tradeId" element={<TradeDetailPage />} />

          {/* Comms */}
          <Route path="chat" element={<LeagueChatPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="activity" element={<ActivityFeedPage />} />
          <Route path="messages" element={<LegacyPage title="Messages" description="Direct messages with other managers in the league." path="/leagues/:leagueId/messages" icon="bi-envelope" />} />

          {/* Players */}
          <Route path="player-pool" element={<PlayerPoolPage />} />
          <Route path="players/compare" element={<LegacyPage title="Player Compare" description="Side-by-side comparison of player stats and form." path="/leagues/:leagueId/players/compare" icon="bi-people-fill" />} />
          <Route path="player-ratings" element={<LegacyPage title="Player Ratings" description="Player rating dashboard with trends and potential." path="/leagues/:leagueId/player-ratings" icon="bi-star" />} />
          <Route path="injuries" element={<LegacyPage title="Injuries" description="Current injury list across the league." path="/leagues/:leagueId/injuries" icon="bi-bandaid" />} />
          <Route path="keepers" element={<LegacyPage title="Keeper Values" description="Keeper value index for your squad." path="/leagues/:leagueId/keepers" icon="bi-shield-check" />} />
          <Route path="list-changes" element={<ListChangesPage />} />
          <Route path="stats" element={<LegacyPage title="Advanced Stats" description="Advanced per-stat breakdowns across the league." path="/leagues/:leagueId/stats" icon="bi-graph-up" />} />

          {/* Settings & Admin */}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="scoring" element={<LegacyPage title="Scoring Configuration" description="Configure custom scoring rules and stat weights." path="/leagues/:leagueId/scoring" icon="bi-calculator" />} />
          <Route path="commissioner" element={<LegacyPage title="Commissioner Hub" description="Commissioner admin tools, LTIL approvals, and league management." path="/leagues/:leagueId/commissioner" icon="bi-shield-lock" />} />

          {/* Reserve 7s */}
          <Route path="reserve7s/team" element={<L><Reserve7sTeamPage /></L>} />
          <Route path="reserve7s/gameday" element={<L><Reserve7sGamedayPage /></L>} />
          <Route path="reserve7s/standings" element={<L><Reserve7sStandingsPage /></L>} />
          <Route path="reserve7s/fixture" element={<L><Reserve7sFixturePage /></L>} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={
        <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl font-black text-[#21262d]">404</p>
            <p className="text-sm text-[#484f58] mt-2">Page not found</p>
          </div>
        </div>
      } />
    </Routes>
  )
}
