import { Link } from 'react-router'

interface Props {
  active: string
  leagueId: string
}

export function LeagueSubnav({ active, leagueId }: Props) {
  const tabs = [
    { key: 'ladder', icon: 'bi-bar-chart', label: 'Ladder', to: `/leagues/${leagueId}/standings` },
    { key: 'fixture', icon: 'bi-calendar-week', label: 'Fixtures', to: `/leagues/${leagueId}/fixture` },
    { key: 'records', icon: 'bi-trophy', label: 'Records', to: `/leagues/${leagueId}/history` },
    { key: 'keepers', icon: 'bi-shield-check', label: 'Keepers', to: `/leagues/${leagueId}/keepers` },
    { key: 'changes', icon: 'bi-clock-history', label: 'Changes', to: `/leagues/${leagueId}/list-changes` },
    { key: '7s', icon: 'bi-7-circle', label: '7s', to: `/leagues/${leagueId}/reserve7s/standings` },
  ]

  return (
    <>
      {/* Desktop subnav */}
      <div className="league-subnav d-none d-lg-flex">
        {tabs.map(t => (
          <Link key={t.key}
            to={t.to}
            className={`league-subtab${active === t.key ? ' active' : ''}`}
            style={t.key === '7s' && active === '7s' ? { color: '#bc8cff' } : undefined}>
            <i className={`bi ${t.icon}`}></i>{t.label}
          </Link>
        ))}
      </div>

      {/* Mobile subnav */}
      <div className="mob-subnav d-lg-none">
        {tabs.map(t => (
          <Link key={t.key}
            to={t.to}
            className={`mob-subnav-item${active === t.key ? ' active' : ''}`}
            style={t.key === '7s' && active === '7s' ? { color: '#bc8cff', borderBottomColor: '#bc8cff' } : undefined}>
            <i className={`bi ${t.icon}`}></i>{t.label}
          </Link>
        ))}
      </div>
    </>
  )
}
