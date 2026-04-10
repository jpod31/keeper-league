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

// Placeholder for pages not yet migrated
import { PlaceholderPage } from './pages/PlaceholderPage'

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
          <Route path="history" element={<PlaceholderPage title="History" />} />
          <Route path="history/:year" element={<PlaceholderPage title="Season Archive" />} />
          <Route path="finals" element={<PlaceholderPage title="Finals" />} />
          <Route path="afl-live" element={<PlaceholderPage title="AFL Live" />} />
          <Route path="gameday/afl-game/:gameId" element={<AflGamePage />} />

          {/* Draft */}
          <Route path="draft" element={<L><DraftRoomPage /></L>} />
          <Route path="draft/setup" element={<PlaceholderPage title="Draft Setup" />} />
          <Route path="draft/mock" element={<PlaceholderPage title="Mock Draft" />} />
          <Route path="draft/recap" element={<PlaceholderPage title="Draft Recap" />} />

          {/* Trades */}
          <Route path="trades" element={<TradeCenterPage />} />
          <Route path="trades/propose" element={<TradeProposePage />} />
          <Route path="trades/:tradeId" element={<TradeDetailPage />} />

          {/* Comms */}
          <Route path="chat" element={<LeagueChatPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="activity" element={<ActivityFeedPage />} />
          <Route path="messages" element={<PlaceholderPage title="Messages" />} />

          {/* Players */}
          <Route path="player-pool" element={<PlayerPoolPage />} />
          <Route path="players/compare" element={<PlaceholderPage title="Player Compare" />} />
          <Route path="player-ratings" element={<PlaceholderPage title="Player Ratings" />} />
          <Route path="injuries" element={<PlaceholderPage title="Injuries" />} />
          <Route path="keepers" element={<PlaceholderPage title="Keeper Values" />} />
          <Route path="list-changes" element={<PlaceholderPage title="List Changes" />} />
          <Route path="stats" element={<PlaceholderPage title="Advanced Stats" />} />

          {/* Settings & Admin */}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="scoring" element={<PlaceholderPage title="Scoring" />} />
          <Route path="commissioner" element={<PlaceholderPage title="Commissioner Hub" />} />

          {/* Reserve 7s */}
          <Route path="reserve7s/team" element={<PlaceholderPage title="Reserve 7s" />} />
          <Route path="reserve7s/gameday" element={<PlaceholderPage title="7s Gameday" />} />
          <Route path="reserve7s/standings" element={<PlaceholderPage title="7s Standings" />} />
          <Route path="reserve7s/fixture" element={<PlaceholderPage title="7s Fixture" />} />
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
