import { Link } from 'react-router'

type AdminSubtab = 'commissioner' | 'settings' | 'scoring'

interface Props {
  active: AdminSubtab
  leagueId: string
}

const TABS: { key: AdminSubtab; icon: string; label: string; mobileLabel: string; path: (id: string) => string }[] = [
  { key: 'commissioner', icon: 'bi-shield-lock', label: 'Commissioner', mobileLabel: 'Hub', path: id => `/leagues/${id}/commissioner` },
  { key: 'settings', icon: 'bi-gear', label: 'Settings', mobileLabel: 'Settings', path: id => `/leagues/${id}/settings` },
  { key: 'scoring', icon: 'bi-calculator', label: 'Scoring', mobileLabel: 'Scoring', path: id => `/leagues/${id}/scoring` },
]

export function AdminSubnav({ active, leagueId }: Props) {
  return (
    <>
      <div className="league-subnav d-none d-lg-flex">
        {TABS.map(t => (
          <Link key={t.key} to={t.path(leagueId)} className={`league-subtab${active === t.key ? ' active' : ''}`}>
            <i className={`bi ${t.icon}`}></i>{t.label}
          </Link>
        ))}
      </div>
      <div className="mob-subnav d-lg-none">
        {TABS.map(t => (
          <Link key={t.key} to={t.path(leagueId)} className={`mob-subnav-item${active === t.key ? ' active' : ''}`}>
            <i className={`bi ${t.icon}`}></i>{t.mobileLabel}
          </Link>
        ))}
      </div>
    </>
  )
}
