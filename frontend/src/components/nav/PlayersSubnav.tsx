import { Link } from 'react-router'

type PlayerSubtab = 'pool' | 'compare' | 'stats' | 'injuries' | 'ratings' | 'scouting' | 'breakout'

interface Props {
  active: PlayerSubtab
  leagueId: string
}

const TABS: { key: PlayerSubtab; icon: string; label: string; path: (id: string) => string }[] = [
  { key: 'pool', icon: 'bi-person-plus', label: 'Pool', path: id => `/leagues/${id}/player-pool` },
  { key: 'compare', icon: 'bi-people', label: 'Compare', path: id => `/leagues/${id}/players/compare` },
  { key: 'stats', icon: 'bi-graph-up', label: 'Stats', path: id => `/leagues/${id}/stats` },
  { key: 'injuries', icon: 'bi-bandaid', label: 'Injuries', path: id => `/leagues/${id}/injuries` },
  { key: 'ratings', icon: 'bi-star-fill', label: 'Ratings', path: id => `/leagues/${id}/player-ratings` },
  { key: 'scouting', icon: 'bi-binoculars', label: 'Scouting', path: id => `/leagues/${id}/scouting` },
  { key: 'breakout', icon: 'bi-broadcast-pin', label: 'Breakout', path: id => `/leagues/${id}/breakout-radar` },
]

export function PlayersSubnav({ active, leagueId }: Props) {
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
            <i className={`bi ${t.icon}`}></i>{t.label}
          </Link>
        ))}
      </div>
    </>
  )
}
