import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { useLeague } from '../../contexts/LeagueContext'

interface Standing {
  rank: number
  team_id: number
  name: string
  wins: number
  losses: number
  draws: number
  points: number
  pct: number
  for: number
  against: number
}

export function StandingsPage() {
  const { leagueId } = useParams()
  const { league } = useLeague()
  const { data, loading } = useFetch<Standing[]>(`/api/leagues/${leagueId}/standings`)

  if (loading) return <Spinner text="Loading standings..." />
  if (!data) return <p className="text-danger">Failed to load standings</p>

  const finalsCount = 4 // top 4 make finals

  return (
    <div>
      {/* Matches standings.html structure */}
      <div className="ldr-wrap">
        {/* Desktop table */}
        <div className="d-none d-lg-block">
          <table className="ldr-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Team</th>
                <th style={{ textAlign: 'center' }}>P</th>
                <th style={{ textAlign: 'center' }}>W</th>
                <th style={{ textAlign: 'center' }}>L</th>
                <th style={{ textAlign: 'center' }}>D</th>
                <th style={{ textAlign: 'center' }}>Pts</th>
                <th style={{ textAlign: 'right' }}>For</th>
                <th style={{ textAlign: 'right' }}>Against</th>
                <th style={{ textAlign: 'right' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s, i) => {
                const posClass = i === 0 ? 'ldr-pos-1' : i === 1 ? 'ldr-pos-2' : i === 2 ? 'ldr-pos-3' :
                  i < finalsCount ? 'ldr-pos-finals' : 'ldr-pos-out'
                const isUser = league?.user_team?.id === s.team_id
                return (
                  <tr key={s.team_id} className={i === finalsCount - 1 ? 'ldr-finals-line' : ''}
                    style={isUser ? { background: 'rgba(88,166,255,.04)' } : undefined}>
                    <td><span className={`ldr-pos ${posClass}`}>{i + 1}</span></td>
                    <td>
                      <Link to={`/leagues/${leagueId}/team/${s.team_id}`} className="ldr-name">
                        {s.name}
                        {isUser && <span className="badge ms-2" style={{ background: 'var(--kl-accent-blue)', fontSize: '.6rem', verticalAlign: 'middle' }}>You</span>}
                      </Link>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--kl-text-secondary)' }}>{s.wins + s.losses + s.draws}</td>
                    <td style={{ textAlign: 'center', color: s.wins > 0 ? 'var(--kl-accent-green)' : 'var(--kl-text-secondary)' }}>{s.wins}</td>
                    <td style={{ textAlign: 'center', color: s.losses > 0 ? 'var(--kl-accent-red)' : 'var(--kl-text-secondary)' }}>{s.losses}</td>
                    <td style={{ textAlign: 'center', color: 'var(--kl-text-secondary)' }}>{s.draws}</td>
                    <td style={{ textAlign: 'center' }} className="ldr-pts">{s.points}</td>
                    <td style={{ textAlign: 'right', color: 'var(--kl-text-secondary)' }}>{s.for.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--kl-text-secondary)' }}>{s.against.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: s.pct >= 100 ? 'var(--kl-accent-green)' : 'var(--kl-accent-red)' }}>
                      {s.pct.toFixed(1)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="d-lg-none">
          {data.map((s, i) => {
            const isUser = league?.user_team?.id === s.team_id
            return (
              <Link key={s.team_id} to={`/leagues/${leagueId}/team/${s.team_id}`}
                className="d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
                style={{
                  borderBottom: '1px solid #161b22',
                  background: isUser ? 'rgba(88,166,255,.04)' : undefined,
                }}>
                <span className={`ldr-pos ${i === 0 ? 'ldr-pos-1' : i === 1 ? 'ldr-pos-2' : i === 2 ? 'ldr-pos-3' : i < finalsCount ? 'ldr-pos-finals' : 'ldr-pos-out'}`}>
                  {i + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#e6edf3', fontSize: '.85rem' }}>{s.name}</div>
                  <div style={{ fontSize: '.72rem', color: '#8b949e' }}>{s.wins}-{s.losses}-{s.draws}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="ldr-pts" style={{ fontSize: '.9rem' }}>{s.points}</div>
                  <div style={{ fontSize: '.68rem', color: s.pct >= 100 ? 'var(--kl-accent-green)' : 'var(--kl-accent-red)' }}>
                    {s.pct.toFixed(1)}%
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '.75rem 1rem', borderTop: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '.7rem', color: '#484f58' }}>
            <span style={{ color: '#2ea043' }}>●</span> Top {finalsCount} qualify for finals
          </span>
        </div>
      </div>
    </div>
  )
}
