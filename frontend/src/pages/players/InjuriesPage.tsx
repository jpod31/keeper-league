import { useParams, Link } from 'react-router'
import { useState, useMemo } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'

interface InjuredPlayer {
  id: number
  name: string
  position: string
  afl_team: string
  injury_severity: string
  injury_type: string
  injury_return: string
  rostered_by: string | null
}

interface InjuriesData {
  league: { id: number; name: string }
  current_round: number | null
  fantasy_teams: string[]
  players: InjuredPlayer[]
}

const SEV_COLOR: Record<string, string> = {
  out: '#f85149',
  test: '#d29922',
  major: '#f85149',
  minor: '#d29922',
  tbc: '#8b949e',
}

export function InjuriesPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<InjuriesData>(`/leagues/${leagueId}/injuries?format=json`)
  const [posFilter, setPosFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [sevFilter, setSevFilter] = useState('')

  const filtered = useMemo(() => {
    if (!data) return []
    return data.players.filter(p => {
      if (posFilter && p.position !== posFilter) return false
      if (teamFilter === 'fa' && p.rostered_by) return false
      if (teamFilter && teamFilter !== 'fa' && p.rostered_by !== teamFilter) return false
      if (sevFilter && p.injury_severity !== sevFilter) return false
      return true
    })
  }, [data, posFilter, teamFilter, sevFilter])

  if (loading) return <Spinner text="Loading injuries..." />
  if (!data) return <p className="text-danger">Failed to load injuries</p>

  return (
    <div>
      <div className="d-none d-lg-block"><PlayersSubnav active="injuries" leagueId={leagueId!} /></div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{data.league.name}</Link> / Players / Injuries
        </div>
        <h2><i className="bi bi-bandaid me-2" style={{ color: '#f85149' }}></i>Injuries</h2>
        <div className="text-secondary" style={{ fontSize: '.85rem' }}>
          {filtered.length} players · Round {data.current_round ?? '—'}
        </div>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <select className="form-select form-select-sm" style={{ maxWidth: 140 }} value={posFilter} onChange={e => setPosFilter(e.target.value)}>
          <option value="">All positions</option>
          {['DEF', 'MID', 'RUC', 'FWD'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ maxWidth: 200 }} value={teamFilter} onChange={e => setTeamFilter(e.target.value)}>
          <option value="">All players</option>
          <option value="fa">Free agents only</option>
          {data.fantasy_teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="form-select form-select-sm" style={{ maxWidth: 140 }} value={sevFilter} onChange={e => setSevFilter(e.target.value)}>
          <option value="">All severities</option>
          <option value="test">Test</option>
          <option value="out">Out</option>
          <option value="major">Major</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>Player</th>
                <th className="mob-hide">Team</th>
                <th>Pos</th>
                <th>Severity</th>
                <th className="mob-hide">Type</th>
                <th className="mob-hide">Return</th>
                <th>Rostered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong></td>
                  <td className="mob-hide"><span className="text-secondary" style={{ fontSize: '.75rem' }}>{p.afl_team}</span></td>
                  <td><span className={`pos-badge pos-${p.position}`}>{p.position}</span></td>
                  <td>
                    <span className="badge" style={{ background: (SEV_COLOR[p.injury_severity] || '#6e7681') + '20', color: SEV_COLOR[p.injury_severity] || '#8b949e', fontSize: '.7rem' }}>
                      {p.injury_severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="mob-hide text-secondary" style={{ fontSize: '.75rem' }}>{p.injury_type}</td>
                  <td className="mob-hide text-secondary" style={{ fontSize: '.75rem' }}>{p.injury_return || '—'}</td>
                  <td>
                    {p.rostered_by ? (
                      <span className="text-secondary" style={{ fontSize: '.75rem' }}>{p.rostered_by}</span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(63,185,80,.12)', color: '#3fb950', fontSize: '.65rem' }}>FREE</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-4 text-secondary">No players match the current filters.</div>
          )}
        </div>
      </div>
    </div>
  )
}
