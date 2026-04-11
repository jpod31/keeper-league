import { useParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Champion { year: number; team_name: string; wins: number; losses: number; draws: number; points_for: number; percentage: number }
interface AlltimeRow { team_name: string; wins: number; losses: number; draws: number; points_for: number; points_against: number; total_games: number; win_pct: number; percentage: number; seasons: number }
interface ScoreRecord { team_name: string; score: number; round: number; year: number }
interface Blowout { winner: string; loser: string; winner_score: number; loser_score: number; margin: number; round: number; year: number }
interface PlayerRecord { player_name: string; score: number; team_name: string; round: number; year: number }
interface StreakRecord { team_name: string; streak: number; start_year: number | null; start_round: number | null; end_year: number | null; end_round: number | null }
interface PlayerCount { player_name: string; count: number; year: number; games: number }
interface PlayerAvg { player_name: string; avg: number; year: number; games: number }
interface RivalryFact { type: string; text: string; value: number }

interface HistoryData {
  league: { id: number; name: string }
  champions: Champion[]
  alltime_standings: AlltimeRow[]
  top_scores: ScoreRecord[]
  lowest_scores: ScoreRecord[]
  top_season_pf: { team_name: string; year: number; points_for: number; wins: number; losses: number }[]
  blowouts: Blowout[]
  close_matches: { home: string; away: string; home_score: number; away_score: number; margin: number; round: number; year: number }[]
  highest_combined: { home: string; away: string; home_score: number; away_score: number; total: number; round: number; year: number }[]
  lowest_combined: { home: string; away: string; home_score: number; away_score: number; total: number; round: number; year: number }[]
  win_streaks: StreakRecord[]
  loss_streaks: StreakRecord[]
  top_player_scores: PlayerRecord[]
  hundred_plus: PlayerCount[]
  best_averages: PlayerAvg[]
  rivalry_facts: RivalryFact[]
  closest_rivalry: { team1: string; team2: string; record: string; total: number } | null
  milestones: string[]
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card mb-3">
      <div className="card-header">
        <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>
          <i className={`bi ${icon} me-2`} style={{ color: '#d29922' }}></i>{title}
        </h5>
      </div>
      <div className="card-body p-0">{children}</div>
    </div>
  )
}

export function HistoryPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<HistoryData>(`/leagues/${leagueId}/records?format=json`)

  if (loading) return <Spinner text="Loading league history..." />
  if (!data) return <p className="text-danger">Failed to load history</p>

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-trophy me-2" style={{ color: '#d29922' }}></i>League Records</h2>
      </div>

      {data.milestones.length > 0 && (
        <div className="alert alert-info">
          {data.milestones.map((m, i) => <div key={i}>🏆 {m}</div>)}
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-6">
          <Card title="Champions" icon="bi-trophy-fill">
            <table className="table table-sm mb-0">
              <thead><tr><th>Year</th><th>Champion</th><th className="text-end">W-L-D</th><th className="text-end">PF</th></tr></thead>
              <tbody>
                {data.champions.map(c => (
                  <tr key={c.year}>
                    <td><strong>{c.year}</strong></td>
                    <td>{c.team_name}</td>
                    <td className="text-end">{c.wins}-{c.losses}-{c.draws}</td>
                    <td className="text-end">{c.points_for.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="All-Time Standings" icon="bi-list-ol">
            <table className="table table-sm mb-0">
              <thead><tr><th>Team</th><th className="text-end">W</th><th className="text-end">L</th><th className="text-end">%</th><th className="text-end">Seasons</th></tr></thead>
              <tbody>
                {data.alltime_standings.map((a, i) => (
                  <tr key={i}>
                    <td><strong>{a.team_name}</strong></td>
                    <td className="text-end">{a.wins}</td>
                    <td className="text-end">{a.losses}</td>
                    <td className="text-end">{a.win_pct.toFixed(0)}%</td>
                    <td className="text-end">{a.seasons}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Highest Team Scores" icon="bi-arrow-up-circle">
            <table className="table table-sm mb-0">
              <tbody>
                {data.top_scores.map((s, i) => (
                  <tr key={i}>
                    <td style={{ width: 24, color: '#484f58' }}>{i + 1}</td>
                    <td><strong>{s.team_name}</strong></td>
                    <td className="text-end"><strong>{s.score.toFixed(0)}</strong></td>
                    <td className="text-secondary" style={{ fontSize: '.7rem' }}>R{s.round} {s.year}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Biggest Blowouts" icon="bi-lightning">
            <table className="table table-sm mb-0">
              <tbody>
                {data.blowouts.map((b, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{b.winner}</strong> {b.winner_score.toFixed(0)} - {b.loser_score.toFixed(0)} {b.loser}
                      <div className="text-secondary" style={{ fontSize: '.7rem' }}>R{b.round} {b.year}</div>
                    </td>
                    <td className="text-end"><span className="badge bg-danger">+{b.margin.toFixed(0)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="col-lg-6">
          <Card title="Top Player Scores" icon="bi-person-fill">
            <table className="table table-sm mb-0">
              <tbody>
                {data.top_player_scores.map((p, i) => (
                  <tr key={i}>
                    <td style={{ width: 24, color: '#484f58' }}>{i + 1}</td>
                    <td>
                      <strong>{p.player_name}</strong>
                      <div className="text-secondary" style={{ fontSize: '.7rem' }}>{p.team_name} · R{p.round} {p.year}</div>
                    </td>
                    <td className="text-end"><strong>{p.score.toFixed(0)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Most 100+ Scores (Season)" icon="bi-trophy">
            <table className="table table-sm mb-0">
              <tbody>
                {data.hundred_plus.map((p, i) => (
                  <tr key={i}>
                    <td><strong>{p.player_name}</strong><div className="text-secondary" style={{ fontSize: '.7rem' }}>{p.year}</div></td>
                    <td className="text-end"><strong>{p.count}</strong> / {p.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Best Season Averages" icon="bi-graph-up">
            <table className="table table-sm mb-0">
              <tbody>
                {data.best_averages.map((p, i) => (
                  <tr key={i}>
                    <td><strong>{p.player_name}</strong><div className="text-secondary" style={{ fontSize: '.7rem' }}>{p.year} · {p.games} games</div></td>
                    <td className="text-end"><strong>{p.avg.toFixed(1)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card title="Longest Win Streaks" icon="bi-fire">
            <table className="table table-sm mb-0">
              <tbody>
                {data.win_streaks.map((s, i) => (
                  <tr key={i}>
                    <td><strong>{s.team_name}</strong><div className="text-secondary" style={{ fontSize: '.7rem' }}>{s.start_year} R{s.start_round} – {s.end_year} R{s.end_round}</div></td>
                    <td className="text-end"><span className="badge bg-success">{s.streak}W</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      {data.rivalry_facts.length > 0 && (
        <Card title="Rivalry Facts" icon="bi-fire">
          <div className="px-3 py-2">
            {data.rivalry_facts.map((f, i) => (
              <div key={i} className="py-1" style={{ fontSize: '.85rem', borderBottom: '1px solid var(--kl-border)' }}>
                {f.text}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
