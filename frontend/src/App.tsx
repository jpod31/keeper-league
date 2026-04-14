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
import { CommissionerPage } from './pages/leagues/CommissionerPage'
import { ScoringPage } from './pages/leagues/ScoringPage'
import { DraftValuesPage } from './pages/leagues/DraftValuesPage'
import { HistoryPage } from './pages/leagues/HistoryPage'
import { InvitePage } from './pages/leagues/InvitePage'

// Lazy-loaded heavy pages (code splitting)
const SquadPage = lazy(() => import('./pages/team/SquadPage').then(m => ({ default: m.SquadPage })))
const GamedayPage = lazy(() => import('./pages/matchups/GamedayPage').then(m => ({ default: m.GamedayPage })))
const Reserve7sGamedayPage = lazy(() => import('./pages/reserve7s/GamedayPage').then(m => ({ default: m.Reserve7sGamedayPage })))
const Reserve7sStandingsPage = lazy(() => import('./pages/reserve7s/StandingsPage').then(m => ({ default: m.Reserve7sStandingsPage })))
const Reserve7sFixturePage = lazy(() => import('./pages/reserve7s/FixturePage').then(m => ({ default: m.Reserve7sFixturePage })))
const Reserve7sTeamPage = lazy(() => import('./pages/reserve7s/TeamPage').then(m => ({ default: m.Reserve7sTeamPage })))
const AnalyticsPage = lazy(() => import('./pages/team/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const DraftRoomPage = lazy(() => import('./pages/draft/DraftRoomPage').then(m => ({ default: m.DraftRoomPage })))
const DraftSetupPage = lazy(() => import('./pages/draft/DraftSetupPage').then(m => ({ default: m.DraftSetupPage })))
const DraftRecapPage = lazy(() => import('./pages/draft/DraftRecapPage').then(m => ({ default: m.DraftRecapPage })))
const MockDraftPage = lazy(() => import('./pages/draft/MockDraftPage').then(m => ({ default: m.MockDraftPage })))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })))
const AdminLeaguesPage = lazy(() => import('./pages/admin/AdminLeaguesPage').then(m => ({ default: m.AdminLeaguesPage })))
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })))
const L = ({ children }: { children: React.ReactNode }) => <Suspense fallback={<Spinner />}>{children}</Suspense>

// Direct imports for lighter pages
import { LineupPage } from './pages/team/LineupPage'
import { TeamStatsPage } from './pages/team/TeamStatsPage'

// Matchup pages
import { StandingsPage } from './pages/matchups/StandingsPage'
import { FixturePage } from './pages/matchups/FixturePage'
import { RoundDetailPage } from './pages/matchups/RoundDetailPage'
import { MatchupDetailPage } from './pages/matchups/MatchupDetailPage'
import { AflGamePage } from './pages/matchups/AflGamePage'
import { FinalsPage } from './pages/matchups/FinalsPage'
import { AflLivePage } from './pages/matchups/AflLivePage'
import { ListChangesPage } from './pages/leagues/ListChangesPage'

// Trade pages
import { TradeCenterPage } from './pages/trades/TradeCenterPage'
import { TradeProposePage } from './pages/trades/TradeProposePage'
import { TradeDetailPage } from './pages/trades/TradeDetailPage'

// Comms pages
import { LeagueChatPage } from './pages/comms/LeagueChatPage'
import { NotificationsPage } from './pages/comms/NotificationsPage'
import { ActivityFeedPage } from './pages/comms/ActivityFeedPage'
import { InboxPage } from './pages/comms/InboxPage'
import { ConversationPage } from './pages/comms/ConversationPage'

// Player pages
import { PlayerPoolPage } from './pages/players/PlayerPoolPage'
import { InjuriesPage } from './pages/players/InjuriesPage'
import { PlayerRatingsPage } from './pages/players/PlayerRatingsPage'
import { PlayerComparePage } from './pages/players/PlayerComparePage'
import { KeepersPage } from './pages/players/KeepersPage'
import { StatsPage } from './pages/players/StatsPage'
import { ScoutingPage } from './pages/players/ScoutingPage'


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
        <Route path="/leagues/invite/:code" element={<InvitePage />} />

        {/* Admin */}
        <Route path="/admin" element={<L><AdminDashboardPage /></L>} />
        <Route path="/admin/users" element={<L><AdminUsersPage /></L>} />
        <Route path="/admin/leagues" element={<L><AdminLeaguesPage /></L>} />
        <Route path="/admin/analytics" element={<L><AdminAnalyticsPage /></L>} />

        {/* League-scoped routes */}
        <Route path="/leagues/:leagueId" element={<LeagueShell />}>
          <Route index element={<DashboardPage />} />

          {/* Team */}
          <Route path="team/:teamId" element={<L><SquadPage /></L>} />
          <Route path="team/:teamId/lineup/:round" element={<LineupPage />} />
          <Route path="team/:teamId/stats" element={<TeamStatsPage />} />
          <Route path="team/:teamId/analytics" element={<L><AnalyticsPage /></L>} />
          <Route path="team/:teamId/draft-weights" element={<DraftValuesPage />} />

          {/* Matchups */}
          <Route path="standings" element={<StandingsPage />} />
          <Route path="gameday" element={<L><GamedayPage /></L>} />
          <Route path="fixture" element={<FixturePage />} />
          <Route path="fixture/:round" element={<RoundDetailPage />} />
          <Route path="matchup/:fixtureId" element={<MatchupDetailPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="history/:year" element={<HistoryPage />} />
          <Route path="finals" element={<FinalsPage />} />
          <Route path="afl-live" element={<AflLivePage />} />
          <Route path="gameday/afl-game/:gameId" element={<AflGamePage />} />

          {/* Draft */}
          <Route path="draft" element={<L><DraftRoomPage /></L>} />
          <Route path="draft/setup" element={<L><DraftSetupPage /></L>} />
          <Route path="draft/mock" element={<L><MockDraftPage /></L>} />
          <Route path="draft/recap" element={<L><DraftRecapPage /></L>} />
          <Route path="draft-values" element={<DraftValuesPage />} />

          {/* Trades */}
          <Route path="trades" element={<TradeCenterPage />} />
          <Route path="trades/propose" element={<TradeProposePage />} />
          <Route path="trades/:tradeId" element={<TradeDetailPage />} />

          {/* Comms */}
          <Route path="chat" element={<LeagueChatPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="activity" element={<ActivityFeedPage />} />
          <Route path="messages" element={<InboxPage />} />
          <Route path="messages/:convoId" element={<ConversationPage />} />

          {/* Players */}
          <Route path="player-pool" element={<PlayerPoolPage />} />
          <Route path="players/compare" element={<PlayerComparePage />} />
          <Route path="player-ratings" element={<PlayerRatingsPage />} />
          <Route path="injuries" element={<InjuriesPage />} />
          <Route path="keepers" element={<KeepersPage />} />
          <Route path="list-changes" element={<ListChangesPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="scouting" element={<ScoutingPage />} />

          {/* Settings & Admin */}
          <Route path="settings" element={<SettingsPage />} />
          <Route path="scoring" element={<ScoringPage />} />
          <Route path="commissioner" element={<CommissionerPage />} />

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
