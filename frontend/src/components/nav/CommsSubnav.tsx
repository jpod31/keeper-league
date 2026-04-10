import { Link } from 'react-router'

interface Props {
  active: 'chat' | 'messages' | 'activity'
  leagueId: string
}

const TABS: { key: 'chat' | 'messages' | 'activity'; label: string; mobileLabel: string; icon: string; to: (id: string) => string }[] = [
  { key: 'chat', label: 'League Chat', mobileLabel: 'Chat', icon: 'bi-megaphone', to: id => `/leagues/${id}/chat` },
  { key: 'messages', label: 'Messages', mobileLabel: 'Messages', icon: 'bi-chat-dots', to: id => `/leagues/${id}/messages` },
  { key: 'activity', label: 'Activity', mobileLabel: 'Activity', icon: 'bi-activity', to: id => `/leagues/${id}/activity` },
]

export function CommsSubnav({ active, leagueId }: Props) {
  return (
    <>
      <div className="league-subnav d-none d-lg-flex">
        {TABS.map(t => (
          <Link key={t.key} to={t.to(leagueId)} className={`league-subtab${active === t.key ? ' active' : ''}`}>
            <i className={`bi ${t.icon}`}></i>{t.label}
          </Link>
        ))}
      </div>
      <div className="mob-subnav d-lg-none">
        {TABS.map(t => (
          <Link key={t.key} to={t.to(leagueId)} className={`mob-subnav-item${active === t.key ? ' active' : ''}`}>
            <i className={`bi ${t.icon}`}></i>{t.mobileLabel}
          </Link>
        ))}
      </div>
    </>
  )
}
