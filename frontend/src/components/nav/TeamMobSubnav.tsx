import { Link } from 'react-router'

interface Props {
  active: 'field' | 'list' | 'stats' | 'analytics' | 'trades'
  leagueId: string
  teamId: string
}

/**
 * Mobile-only sub-navigation bar shown across all team-scoped pages
 * (Lineup, TeamStats, Analytics). Mirrors the `mob-subnav` block in
 * the Jinja templates so users can swap between team views on mobile
 * without going back to the squad page.
 */
export function TeamMobSubnav({ active, leagueId, teamId }: Props) {
  const tabs: { key: Props['active']; label: string; icon: string; to: string }[] = [
    { key: 'field', label: 'Field', icon: 'bi-diagram-3', to: `/leagues/${leagueId}/team/${teamId}` },
    { key: 'list', label: 'List', icon: 'bi-table', to: `/leagues/${leagueId}/team/${teamId}?view=table` },
    { key: 'stats', label: 'Stats', icon: 'bi-graph-up', to: `/leagues/${leagueId}/team/${teamId}/stats` },
    { key: 'analytics', label: 'Analytics', icon: 'bi-bar-chart-line', to: `/leagues/${leagueId}/team/${teamId}/analytics` },
    { key: 'trades', label: 'Trades', icon: 'bi-arrow-left-right', to: `/leagues/${leagueId}/trades` },
  ]
  return (
    <div className="mob-subnav d-lg-none">
      {tabs.map(t => (
        <Link
          key={t.key}
          to={t.to}
          className={`mob-subnav-item text-decoration-none${active === t.key ? ' active' : ''}`}
        >
          <i className={`bi ${t.icon}`}></i><span>{t.label}</span>
        </Link>
      ))}
    </div>
  )
}
