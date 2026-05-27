import { useParams, Link } from 'react-router'
import { useMemo, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'
import { FilterBar, type ActiveFilter } from '../../components/ui/FilterBar'
import { useListSort } from '../../hooks/useListSort'
import { SortedByLabel } from '../../components/ui/SortedByLabel'

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

const SORT_LABELS = {
  name: 'Name',
  afl_team: 'AFL team',
  position: 'Position',
  injury_severity: 'Severity',
  injury_return: 'Return',
  rostered_by: 'Rostered',
}

// Severity gets a manual rank so "out" sorts above "test" instead of
// alphabetical noise. Higher = more severe.
const SEV_RANK: Record<string, number> = { out: 4, major: 4, test: 2, minor: 2, tbc: 1 }

export function InjuriesPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<InjuriesData>(`/leagues/${leagueId}/injuries?format=json`)
  const [posFilter, setPosFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [sevFilter, setSevFilter] = useState('')

  // Default: severity desc — most-severe injuries surface first.
  // Name and AFL team default to ascending on first click; everything
  // else (severity, sort by rostered) defaults to descending per the
  // project rule (see feedback_sort_descending.md).
  const sort = useListSort({
    storageKey: 'players.injuries.sort',
    defaultColumn: 'injury_severity',
    defaultDirection: 'desc',
    ascByDefaultColumns: ['name', 'afl_team', 'position', 'injury_return'],
  })

  const filtered = useMemo(() => {
    if (!data) return []
    const rows = data.players.filter(p => {
      if (posFilter && p.position !== posFilter) return false
      if (teamFilter === 'fa' && p.rostered_by) return false
      if (teamFilter && teamFilter !== 'fa' && p.rostered_by !== teamFilter) return false
      if (sevFilter && p.injury_severity !== sevFilter) return false
      return true
    })
    return [...rows].sort(sort.compare<InjuredPlayer>((row, col) => {
      if (col === 'injury_severity') return SEV_RANK[row.injury_severity] ?? 0
      if (col === 'rostered_by') return row.rostered_by || ''
      return (row as unknown as Record<string, string | number | null>)[col] ?? null
    }))
  }, [data, posFilter, teamFilter, sevFilter, sort])

  if (loading) return <Spinner text="Loading injuries..." />
  if (!data) return <p className="text-danger">Failed to load injuries</p>

  // Build the active-filter chips that the FilterBar shows under the bar.
  const activeFilters: ActiveFilter[] = []
  if (posFilter)  activeFilters.push({ key: 'pos',  label: `POS: ${posFilter}`,             onRemove: () => setPosFilter('') })
  if (teamFilter) activeFilters.push({ key: 'team', label: teamFilter === 'fa' ? 'Free agents only' : teamFilter, onRemove: () => setTeamFilter('') })
  if (sevFilter)  activeFilters.push({ key: 'sev',  label: `SEV: ${sevFilter.toUpperCase()}`, onRemove: () => setSevFilter('') })

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

      <FilterBar
        filters={
          <>
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
          </>
        }
        actions={<SortedByLabel column={sort.column} direction={sort.direction} columnLabels={SORT_LABELS} />}
        activeFilters={activeFilters}
        onClearAll={activeFilters.length > 0 ? () => { setPosFilter(''); setTeamFilter(''); setSevFilter('') } : undefined}
      />

      <div className="card mt-3">
        <div className="card-body p-0">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <SortableTh col="name" sort={sort}>Player</SortableTh>
                <SortableTh col="afl_team" sort={sort} className="mob-hide">Team</SortableTh>
                <SortableTh col="position" sort={sort}>Pos</SortableTh>
                <SortableTh col="injury_severity" sort={sort}>Severity</SortableTh>
                <th className="mob-hide">Type</th>
                <SortableTh col="injury_return" sort={sort} className="mob-hide">Return</SortableTh>
                <SortableTh col="rostered_by" sort={sort}>Rostered</SortableTh>
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

// Small inline component — keeps the table-header markup readable.
// Clicking the header toggles via useListSort, which handles the
// "first-click is the column's default direction" rule.
function SortableTh({
  col, sort, children, className,
}: {
  col: string
  sort: ReturnType<typeof useListSort>
  children: React.ReactNode
  className?: string
}) {
  const active = sort.column === col
  const arrow = active ? (sort.direction === 'asc' ? '↑' : '↓') : ''
  return (
    <th
      className={className}
      onClick={() => sort.toggle(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
    >
      {children} {arrow && <span style={{ opacity: .7, marginLeft: 2 }}>{arrow}</span>}
    </th>
  )
}
