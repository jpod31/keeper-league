import { useParams, Link } from 'react-router'
import { useState, useMemo } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'

interface Champion { year: number; team_name: string; wins: number; losses: number; draws: number; points_for: number; percentage: number }
interface AlltimeRow { team_name: string; wins: number; losses: number; draws: number; points_for: number; points_against: number; total_games: number; win_pct: number; percentage: number; seasons: number }
interface ScoreRecord { team_name: string; score: number; round: number; year: number }
interface SeasonPfRow { team_name: string; year: number; points_for: number; wins: number; losses: number }
interface Blowout { winner: string; loser: string; winner_score: number; loser_score: number; margin: number; round: number; year: number }
interface CombinedRow { home: string; away: string; home_score: number; away_score: number; total?: number; margin?: number; round: number; year: number }
interface PlayerRecord { player_name: string; score: number; team_name: string; round: number; year: number }
interface StreakRecord { team_name: string; streak: number; start_year: number | null; start_round: number | null; end_year: number | null; end_round: number | null }
interface PlayerCount { player_name: string; count: number; year: number; games: number }
interface PlayerAvg { player_name: string; avg: number; year: number; games: number }
interface RivalryFact { type: string; text: string; value: number }
interface H2HRecord { wins: number; losses: number; draws: number }

interface HistoryData {
  league: { id: number; name: string }
  champions: Champion[]
  alltime_standings: AlltimeRow[]
  top_scores: ScoreRecord[]
  lowest_scores: ScoreRecord[]
  top_season_pf: SeasonPfRow[]
  blowouts: Blowout[]
  close_matches: CombinedRow[]
  highest_combined: CombinedRow[]
  lowest_combined: CombinedRow[]
  win_streaks: StreakRecord[]
  loss_streaks: StreakRecord[]
  top_player_scores: PlayerRecord[]
  hundred_plus: PlayerCount[]
  best_averages: PlayerAvg[]
  rivalry_facts: RivalryFact[]
  closest_rivalry: { team1: string; team2: string; record: string; total: number } | null
  milestones: string[]
  teams: { id: number; name: string }[]
  h2h_data: Record<string, H2HRecord>
}

const STYLE = `
.rec-card { background:#161b22; border:1px solid #30363d; border-radius:8px; margin-bottom:16px; overflow:hidden; }
.rec-card-header { display:flex; align-items:center; gap:.5rem; padding:.6rem .9rem; border-bottom:1px solid #30363d; background:#0d1117; }
.rec-card-header h5 { margin:0; font-size:.85rem; font-weight:600; color:#e6edf3; }
.rec-card-header i { color:#8b949e; }
.rec-card-body { padding:0; }
.rec-card-body-padded { padding:16px; }
.rec-table { width:100%; margin:0; font-size:.8rem; }
.rec-table th { padding:.5rem .8rem; font-size:.68rem; color:#8b949e; text-transform:uppercase; letter-spacing:.5px; border-bottom:2px solid #30363d; background:#0d1117; text-align:left; }
.rec-table td { padding:.5rem .8rem; color:#c9d1d9; border-bottom:1px solid #21262d; }
.rec-table tbody tr:hover { background:rgba(88,166,255,.03); }
.rec-table tbody tr:last-child td { border-bottom:none; }
.rec-name { font-weight:600; color:#e6edf3; }
.rec-score { font-weight:700; color:#58a6ff; }
.rec-year { color:#8b949e; font-size:.75rem; }
.rec-win { color:#3fb950; font-weight:600; }
.rec-loss { color:#f85149; font-weight:600; }
.rec-empty { text-align:center; padding:32px 16px; color:#484f58; }
.rec-empty i { font-size:1.8rem; display:block; margin-bottom:8px; }
.rec-empty p { font-size:.82rem; margin:0; }
.champ-badge { display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:50%; background:rgba(210,153,34,.2); color:#e3b341; font-size:.65rem; font-weight:700; }
.streak-badge { display:inline-block; padding:2px 8px; border-radius:4px; background:rgba(63,185,80,.15); color:#3fb950; font-size:.72rem; font-weight:700; }
.loss-badge { display:inline-block; padding:2px 8px; border-radius:4px; background:rgba(248,81,73,.15); color:#f85149; font-size:.72rem; font-weight:700; }
.h2h-select { background:#0d1117; border:1px solid #30363d; color:#e6edf3; border-radius:6px; padding:.4rem .7rem; font-size:.82rem; min-width:160px; }
.h2h-vs { font-size:.75rem; font-weight:700; color:#8b949e; text-transform:uppercase; letter-spacing:.5px; }
.h2h-result-card { background:rgba(88,166,255,.04); border:1px solid rgba(88,166,255,.2); border-radius:8px; padding:20px; margin-top:16px; text-align:center; }
.h2h-team-name { font-size:1.05rem; font-weight:700; color:#e6edf3; }
.h2h-record { font-size:1.6rem; font-weight:800; color:#58a6ff; margin:8px 0; font-family: 'SF Mono', Menlo, monospace; }
.h2h-labels { font-size:.68rem; color:#8b949e; letter-spacing:.5px; }
`

type Tab = 'records' | 'h2h' | 'alltime'

function Empty({ icon, text }: { icon: string; text: string }) {
  return <div className="rec-empty"><i className={`bi ${icon}`}></i><p>{text}</p></div>
}

function Card({ title, icon, color, children }: { title: string; icon: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rec-card">
      <div className="rec-card-header">
        <i className={`bi ${icon}`} style={{ color }}></i>
        <h5>{title}</h5>
      </div>
      <div className="rec-card-body">{children}</div>
    </div>
  )
}

function streakPeriod(s: StreakRecord): string {
  if (s.start_year == null) return '—'
  if (s.start_year === s.end_year) return `${s.start_year} R${s.start_round}–R${s.end_round}`
  return `${s.start_year} R${s.start_round} – ${s.end_year} R${s.end_round}`
}

export function HistoryPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<HistoryData>(`/leagues/${leagueId}/records?format=json`)
  const [tab, setTab] = useState<Tab>('records')
  const [h2hT1, setH2hT1] = useState<string>('')
  const [h2hT2, setH2hT2] = useState<string>('')

  const h2hResult = useMemo(() => {
    if (!data || !h2hT1 || !h2hT2) return null
    if (h2hT1 === h2hT2) return { same: true, wins: 0, losses: 0, draws: 0 }
    const key = `${h2hT1}-${h2hT2}`
    const rec = data.h2h_data[key]
    if (!rec) return { same: false, empty: true, wins: 0, losses: 0, draws: 0 }
    return { same: false, empty: false, ...rec }
  }, [data, h2hT1, h2hT2])

  if (loading) return <Spinner text="Loading league history..." />
  if (!data) return <p className="text-danger">Failed to load history</p>

  const sortedTeams = [...data.teams].sort((a, b) => a.name.localeCompare(b.name))
  const t1Name = sortedTeams.find(t => String(t.id) === h2hT1)?.name || ''
  const t2Name = sortedTeams.find(t => String(t.id) === h2hT2)?.name || ''

  return (
    <div>
      <style>{STYLE}</style>
      <div className="d-none d-lg-block"><LeagueSubnav active="records" leagueId={leagueId!} /></div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{data.league.name}</Link> / Records
        </div>
        <h2><i className="bi bi-trophy me-2" style={{ color: '#d29922' }}></i>League Records</h2>
      </div>

      {data.milestones.length > 0 && (
        <div className="alert alert-info" style={{ fontSize: '.82rem' }}>
          {data.milestones.map((m, i) => <div key={i}><i className="bi bi-trophy me-1"></i>{m}</div>)}
        </div>
      )}

      <div className="league-subnav" style={{ marginBottom: '1rem' }}>
        <a href="#records" className={`league-subtab${tab === 'records' ? ' active' : ''}`} onClick={e => { e.preventDefault(); setTab('records') }}>
          <i className="bi bi-trophy"></i>Records
        </a>
        <a href="#h2h" className={`league-subtab${tab === 'h2h' ? ' active' : ''}`} onClick={e => { e.preventDefault(); setTab('h2h') }}>
          <i className="bi bi-arrow-left-right"></i>Head-to-Head
        </a>
        <a href="#alltime" className={`league-subtab${tab === 'alltime' ? ' active' : ''}`} onClick={e => { e.preventDefault(); setTab('alltime') }}>
          <i className="bi bi-bar-chart-fill"></i>All-Time
        </a>
      </div>

      {tab === 'records' && (
        <>
          <Card title="Season Champions" icon="bi-trophy-fill" color="#d29922">
            {data.champions.length === 0 ? <Empty icon="bi-trophy" text="No champions yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>Year</th><th>Champion</th><th className="text-end">Record</th><th className="text-end">PF</th><th className="text-end">%</th></tr></thead>
                <tbody>
                  {data.champions.map(c => (
                    <tr key={c.year}>
                      <td className="rec-year"><strong>{c.year}</strong></td>
                      <td className="rec-name">{c.team_name}</td>
                      <td className="text-end">{c.wins}-{c.losses}-{c.draws}</td>
                      <td className="text-end rec-score">{c.points_for.toFixed(0)}</td>
                      <td className="text-end" style={{ color: '#8b949e' }}>{c.percentage.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Highest Single-Round Scores" icon="bi-arrow-up-circle" color="#3fb950">
            {data.top_scores.length === 0 ? <Empty icon="bi-arrow-up-circle" text="No round scores yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Team</th><th className="text-center">Round</th><th className="text-center">Year</th><th className="text-end">Score</th></tr></thead>
                <tbody>
                  {data.top_scores.map((s, i) => (
                    <tr key={i}><td>{i === 0 ? <span className="champ-badge">1</span> : <span style={{ color: '#484f58' }}>{i + 1}</span>}</td><td className="rec-name">{s.team_name}</td><td className="text-center">R{s.round}</td><td className="text-center rec-year">{s.year}</td><td className="text-end rec-score">{s.score.toFixed(0)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Highest Season Points For" icon="bi-graph-up-arrow" color="#3fb950">
            {data.top_season_pf.length === 0 ? <Empty icon="bi-graph-up" text="No season data yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Team</th><th className="text-center">Year</th><th className="text-center">Record</th><th className="text-end">PF</th></tr></thead>
                <tbody>
                  {data.top_season_pf.map((s, i) => (
                    <tr key={i}><td>{i === 0 ? <span className="champ-badge">1</span> : <span style={{ color: '#484f58' }}>{i + 1}</span>}</td><td className="rec-name">{s.team_name}</td><td className="text-center rec-year">{s.year}</td><td className="text-center"><span className="rec-win">{s.wins}</span>-<span className="rec-loss">{s.losses}</span></td><td className="text-end rec-score">{s.points_for.toFixed(0)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Longest Win Streaks" icon="bi-fire" color="#f0883e">
            {data.win_streaks.length === 0 ? <Empty icon="bi-fire" text="No completed fixtures yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Team</th><th className="text-center">Streak</th><th>Period</th></tr></thead>
                <tbody>
                  {data.win_streaks.map((s, i) => (
                    <tr key={i}><td>{i === 0 ? <span className="champ-badge" style={{ background: 'rgba(240,136,62,.15)', color: '#f0883e' }}>1</span> : <span style={{ color: '#484f58' }}>{i + 1}</span>}</td><td className="rec-name">{s.team_name}</td><td className="text-center"><span className="streak-badge">{s.streak}W</span></td><td className="rec-year">{streakPeriod(s)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Biggest Blowouts" icon="bi-wind" color="#f85149">
            {data.blowouts.length === 0 ? <Empty icon="bi-wind" text="No completed fixtures yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Winner</th><th>Loser</th><th className="text-center">Margin</th><th className="text-center d-none d-md-table-cell">When</th></tr></thead>
                <tbody>
                  {data.blowouts.map((b, i) => (
                    <tr key={i}><td>{i === 0 ? <span className="champ-badge" style={{ background: 'rgba(248,81,73,.15)', color: '#f85149' }}>1</span> : <span style={{ color: '#484f58' }}>{i + 1}</span>}</td><td className="rec-name">{b.winner} <span className="rec-win">{b.winner_score.toFixed(0)}</span></td><td style={{ color: '#8b949e' }}>{b.loser} <span className="rec-loss">{b.loser_score.toFixed(0)}</span></td><td className="text-center rec-score">+{b.margin.toFixed(0)}</td><td className="text-center rec-year d-none d-md-table-cell">{b.year} R{b.round}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Lowest Single-Round Scores" icon="bi-arrow-down-circle" color="#f85149">
            {data.lowest_scores.length === 0 ? <Empty icon="bi-arrow-down-circle" text="No round scores yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Team</th><th className="text-center">Round</th><th className="text-center">Year</th><th className="text-end">Score</th></tr></thead>
                <tbody>
                  {data.lowest_scores.map((s, i) => (
                    <tr key={i}><td style={{ color: '#484f58' }}>{i + 1}</td><td className="rec-name">{s.team_name}</td><td className="text-center">R{s.round}</td><td className="text-center rec-year">{s.year}</td><td className="text-end rec-loss">{s.score.toFixed(0)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Closest Matches" icon="bi-bullseye" color="#d29922">
            {data.close_matches.length === 0 ? <Empty icon="bi-bullseye" text="No completed fixtures yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Home</th><th>Away</th><th className="text-center">Margin</th><th className="text-center d-none d-md-table-cell">When</th></tr></thead>
                <tbody>
                  {data.close_matches.map((m, i) => (
                    <tr key={i}><td style={{ color: '#484f58' }}>{i + 1}</td><td className="rec-name">{m.home} <span style={{ color: '#8b949e' }}>{m.home_score.toFixed(0)}</span></td><td className="rec-name">{m.away} <span style={{ color: '#8b949e' }}>{m.away_score.toFixed(0)}</span></td><td className="text-center" style={{ color: '#d29922', fontWeight: 700 }}>{(m.margin ?? 0).toFixed(0)}</td><td className="text-center rec-year d-none d-md-table-cell">{m.year} R{m.round}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Highest Combined Scores" icon="bi-arrow-up-circle" color="#3fb950">
            {data.highest_combined.length === 0 ? <Empty icon="bi-arrow-up-circle" text="No combined scores yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Home</th><th>Away</th><th className="text-end">Total</th><th className="text-center d-none d-md-table-cell">When</th></tr></thead>
                <tbody>
                  {data.highest_combined.map((m, i) => (
                    <tr key={i}><td style={{ color: '#484f58' }}>{i + 1}</td><td className="rec-name">{m.home} <span style={{ color: '#8b949e' }}>{m.home_score.toFixed(0)}</span></td><td className="rec-name">{m.away} <span style={{ color: '#8b949e' }}>{m.away_score.toFixed(0)}</span></td><td className="text-end rec-score">{(m.total ?? 0).toFixed(0)}</td><td className="text-center rec-year d-none d-md-table-cell">{m.year} R{m.round}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Lowest Combined Scores" icon="bi-arrow-down-circle" color="#f85149">
            {data.lowest_combined.length === 0 ? <Empty icon="bi-arrow-down-circle" text="No combined scores yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Home</th><th>Away</th><th className="text-end">Total</th><th className="text-center d-none d-md-table-cell">When</th></tr></thead>
                <tbody>
                  {data.lowest_combined.map((m, i) => (
                    <tr key={i}><td style={{ color: '#484f58' }}>{i + 1}</td><td className="rec-name">{m.home} <span style={{ color: '#8b949e' }}>{m.home_score.toFixed(0)}</span></td><td className="rec-name">{m.away} <span style={{ color: '#8b949e' }}>{m.away_score.toFixed(0)}</span></td><td className="text-end rec-loss">{(m.total ?? 0).toFixed(0)}</td><td className="text-center rec-year d-none d-md-table-cell">{m.year} R{m.round}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Longest Losing Streaks" icon="bi-snow" color="#58a6ff">
            {data.loss_streaks.length === 0 ? <Empty icon="bi-snow" text="No losing streaks yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Team</th><th className="text-center">Streak</th><th>Period</th></tr></thead>
                <tbody>
                  {data.loss_streaks.map((s, i) => (
                    <tr key={i}><td style={{ color: '#484f58' }}>{i + 1}</td><td className="rec-name">{s.team_name}</td><td className="text-center"><span className="loss-badge">{s.streak}L</span></td><td className="rec-year">{streakPeriod(s)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Highest Individual Scores" icon="bi-person-fill" color="#58a6ff">
            {data.top_player_scores.length === 0 ? <Empty icon="bi-person" text="No player scores yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Player</th><th>Team</th><th className="text-end">Score</th><th className="text-center d-none d-md-table-cell">When</th></tr></thead>
                <tbody>
                  {data.top_player_scores.map((p, i) => (
                    <tr key={i}><td>{i === 0 ? <span className="champ-badge">1</span> : <span style={{ color: '#484f58' }}>{i + 1}</span>}</td><td className="rec-name">{p.player_name}</td><td style={{ color: '#8b949e' }}>{p.team_name}</td><td className="text-end rec-score">{p.score.toFixed(0)}</td><td className="text-center rec-year d-none d-md-table-cell">{p.year} R{p.round}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Most 100+ Scores in a Season" icon="bi-award" color="#d29922">
            {data.hundred_plus.length === 0 ? <Empty icon="bi-award" text="No 100+ scores yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Player</th><th className="text-center">Year</th><th className="text-end">100+ / Games</th></tr></thead>
                <tbody>
                  {data.hundred_plus.map((p, i) => (
                    <tr key={i}><td style={{ color: '#484f58' }}>{i + 1}</td><td className="rec-name">{p.player_name}</td><td className="text-center rec-year">{p.year}</td><td className="text-end"><strong style={{ color: '#d29922' }}>{p.count}</strong> <span style={{ color: '#8b949e' }}>/ {p.games}</span></td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Highest Season Average (min 10 games)" icon="bi-graph-up" color="#58a6ff">
            {data.best_averages.length === 0 ? <Empty icon="bi-graph-up" text="No season averages yet" /> : (
              <table className="rec-table">
                <thead><tr><th style={{ width: 40 }}>#</th><th>Player</th><th className="text-center">Year</th><th className="text-center">GP</th><th className="text-end">Avg</th></tr></thead>
                <tbody>
                  {data.best_averages.map((p, i) => (
                    <tr key={i}><td style={{ color: '#484f58' }}>{i + 1}</td><td className="rec-name">{p.player_name}</td><td className="text-center rec-year">{p.year}</td><td className="text-center" style={{ color: '#8b949e' }}>{p.games}</td><td className="text-end rec-score">{p.avg.toFixed(1)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {tab === 'h2h' && (
        <Card title="Head-to-Head Records" icon="bi-arrow-left-right" color="#bc8cff">
          <div className="rec-card-body-padded">
            {data.teams.length < 2 ? (
              <Empty icon="bi-arrow-left-right" text="Need at least 2 teams for head-to-head records." />
            ) : (
              <>
                <div className="d-flex align-items-center gap-3 flex-wrap mb-3">
                  <select className="h2h-select" value={h2hT1} onChange={e => setH2hT1(e.target.value)}>
                    <option value="">Select team...</option>
                    {sortedTeams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                  </select>
                  <span className="h2h-vs">vs</span>
                  <select className="h2h-select" value={h2hT2} onChange={e => setH2hT2(e.target.value)}>
                    <option value="">Select team...</option>
                    {sortedTeams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                  </select>
                </div>

                {h2hResult?.same && (
                  <div className="rec-empty" style={{ padding: 24 }}>
                    <p style={{ color: '#8b949e', margin: 0 }}>Please select two different teams.</p>
                  </div>
                )}
                {h2hResult && !h2hResult.same && h2hResult.empty && (
                  <div className="rec-empty" style={{ padding: 24 }}>
                    <i className="bi bi-arrow-left-right"></i><p>These teams have no head-to-head record.</p>
                  </div>
                )}
                {h2hResult && !h2hResult.same && !h2hResult.empty && (
                  <div className="h2h-result-card">
                    <div className="d-flex align-items-center justify-content-center flex-wrap gap-2">
                      <span className="h2h-team-name">{t1Name}</span>
                      <span className="h2h-vs">vs</span>
                      <span className="h2h-team-name">{t2Name}</span>
                    </div>
                    <div className="h2h-record">{h2hResult.wins}-{h2hResult.draws}-{h2hResult.losses}</div>
                    <div className="h2h-labels">
                      <span>{t1Name}</span> WINS — DRAWS — <span>{t2Name}</span> WINS
                    </div>
                  </div>
                )}

                {(data.rivalry_facts.length > 0 || data.closest_rivalry) && (
                  <div className="mt-4">
                    <h6 style={{ fontSize: '.82rem', fontWeight: 600, color: '#8b949e', marginBottom: 12 }}>
                      <i className="bi bi-fire me-1"></i>Rivalry Fun Facts
                    </h6>
                    {data.closest_rivalry && (
                      <div style={{ background: 'rgba(188,140,255,.06)', border: '1px solid rgba(188,140,255,.15)', borderRadius: 8, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="bi bi-people-fill" style={{ color: '#bc8cff', fontSize: '1.1rem' }}></i>
                        <div>
                          <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#e6edf3' }}>Closest Rivalry</div>
                          <div style={{ fontSize: '.75rem', color: '#8b949e' }}>
                            {data.closest_rivalry.team1} vs {data.closest_rivalry.team2} — {data.closest_rivalry.record} across {data.closest_rivalry.total} games
                          </div>
                        </div>
                      </div>
                    )}
                    {data.rivalry_facts.map((f, i) => {
                      const styles = f.type === 'dominance'
                        ? { bg: 'rgba(63,185,80,.05)', border: '1px solid rgba(63,185,80,.12)', icon: 'bi-trophy-fill', color: '#3fb950' }
                        : f.type === 'unbeaten'
                          ? { bg: 'rgba(210,153,34,.06)', border: '1px solid rgba(210,153,34,.15)', icon: 'bi-shield-fill-check', color: '#d29922' }
                          : { bg: 'rgba(88,166,255,.05)', border: '1px solid rgba(88,166,255,.12)', icon: 'bi-lightning-fill', color: '#58a6ff' }
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', marginBottom: 6, background: styles.bg, border: styles.border, borderRadius: 8, fontSize: '.78rem' }}>
                          <i className={`bi ${styles.icon}`} style={{ color: styles.color }}></i>
                          <span style={{ color: '#c9d1d9' }}>{f.text}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="mt-4 d-none d-lg-block">
                  <h6 style={{ fontSize: '.82rem', fontWeight: 600, color: '#8b949e', marginBottom: 12 }}>
                    <i className="bi bi-grid-3x3-gap me-1"></i>Full Head-to-Head Matrix
                  </h6>
                  <div className="table-responsive">
                    <table className="rec-table" style={{ fontSize: '.75rem' }}>
                      <thead>
                        <tr>
                          <th></th>
                          {sortedTeams.map(t => <th key={t.id} className="text-center" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', maxWidth: 30, padding: '8px 4px' }}>{t.name}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTeams.map(t1 => (
                          <tr key={t1.id}>
                            <td className="rec-name" style={{ whiteSpace: 'nowrap' }}>{t1.name}</td>
                            {sortedTeams.map(t2 => {
                              if (t1.id === t2.id) return <td key={t2.id} className="text-center" style={{ background: 'rgba(33,38,45,.5)', color: '#30363d' }}>—</td>
                              const rec = data.h2h_data[`${t1.id}-${t2.id}`]
                              if (!rec) return <td key={t2.id} className="text-center" style={{ color: '#30363d' }}>0-0-0</td>
                              const color = rec.wins > rec.losses ? '#3fb950' : rec.losses > rec.wins ? '#f85149' : '#d29922'
                              return <td key={t2.id} className="text-center" style={{ fontWeight: 600, color }}>{rec.wins}-{rec.draws}-{rec.losses}</td>
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: '.68rem', color: '#30363d', marginTop: 8 }}>Format: W-D-L (from row team's perspective)</p>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {tab === 'alltime' && (
        <Card title="All-Time Standings" icon="bi-bar-chart-fill" color="#58a6ff">
          {data.alltime_standings.length === 0 ? <Empty icon="bi-bar-chart" text="No standings yet" /> : (
            <table className="rec-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Team</th>
                  <th className="text-center">Seasons</th>
                  <th className="text-center">W-D-L</th>
                  <th className="text-end d-none d-md-table-cell">Win %</th>
                  <th className="text-end d-none d-md-table-cell">PF</th>
                  <th className="text-end d-none d-md-table-cell">PA</th>
                  <th className="text-end">%</th>
                </tr>
              </thead>
              <tbody>
                {data.alltime_standings.map((a, i) => (
                  <tr key={i}>
                    <td>{i < 3 ? <span className="champ-badge">{i + 1}</span> : <span style={{ color: '#484f58' }}>{i + 1}</span>}</td>
                    <td className="rec-name">{a.team_name}</td>
                    <td className="text-center" style={{ color: '#8b949e' }}>{a.seasons}</td>
                    <td className="text-center"><span className="rec-win">{a.wins}</span>-{a.draws}-<span className="rec-loss">{a.losses}</span></td>
                    <td className="text-end d-none d-md-table-cell">{a.win_pct.toFixed(0)}%</td>
                    <td className="text-end d-none d-md-table-cell">{a.points_for.toFixed(0)}</td>
                    <td className="text-end d-none d-md-table-cell">{a.points_against.toFixed(0)}</td>
                    <td className="text-end rec-score">{a.percentage.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  )
}
