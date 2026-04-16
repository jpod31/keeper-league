import { Link } from 'react-router'
import { useLeague } from '../../contexts/LeagueContext'

interface Props {
  active: 'ladder' | 'fixture' | 'finals' | 'records' | 'changes' | '7s'
  leagueId: string
}

export function LeagueSubnav({ active, leagueId }: Props) {
  const { league } = useLeague()
  const showFinals = !!league && league.finals_teams > 0

  const tabs = [
    { key: 'ladder', icon: 'bi-bar-chart', label: 'Ladder', to: `/leagues/${leagueId}/standings` },
    { key: 'fixture', icon: 'bi-calendar-week', label: 'Fixtures', to: `/leagues/${leagueId}/fixture` },
    ...(showFinals ? [{ key: 'finals', icon: 'bi-trophy', label: 'Finals', to: `/leagues/${leagueId}/finals` }] : []),
    { key: 'records', icon: 'bi-trophy', label: 'Records', to: `/leagues/${leagueId}/history` },
    { key: 'changes', icon: 'bi-clock-history', label: 'Changes', to: `/leagues/${leagueId}/list-changes` },
    { key: '7s', icon: 'bi-7-circle', label: '7s', to: `/leagues/${leagueId}/reserve7s/standings` },
  ]

  return (
    <>
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
