import { Link } from 'react-router'
import { useLeague } from '../../contexts/LeagueContext'
import { TeamBadge } from '../ui/TeamBadge'

// One row style for notifications and the activity feed: the crest of the
// club the line is about, the line, and when. A notice carries no team id, so
// the club is found by its name in the title ("Charlies Demons delisted ...").

export interface Notice {
  id: number
  type: string
  title: string
  body: string | null
  link: string | null
  created_at: string | null
  is_read?: boolean
}

const ICONS: Record<string, string> = {
  trade_received: 'bi-arrow-left-right',
  trade_accepted: 'bi-check-lg',
  trade_rejected: 'bi-x-lg',
  trade_vetoed: 'bi-shield-exclamation',
  player_delisted: 'bi-person-dash',
  message_received: 'bi-chat-dots',
  list_change: 'bi-clock-history',
}

export function NoticeList({ items, empty }: { items: Notice[]; empty: string }) {
  const { league } = useLeague()
  // Longest name first, so "Lamb of North Cult" wins over a shorter name inside it.
  const teams = [...(league?.teams || [])].sort((a, b) => b.name.length - a.name.length)
  const teamIn = (text: string) => teams.find(t => text.includes(t.name))

  if (items.length === 0) return <p className="nt-none">{empty}</p>
  return (
    <div className="nt-list">
      {items.map(n => {
        const team = teamIn(n.title)
        const unread = n.is_read === false
        const inner = (
          <>
            <span className="nt-mark">
              {team
                ? <TeamBadge name={team.id} size={34} showName={false} />
                : <i className={`bi ${ICONS[n.type] || 'bi-bell'}`}></i>}
            </span>
            <span className="nt-text">
              <span className="nt-title">{n.title}</span>
              {n.body && <span className="nt-body">{n.body.length > 160 ? `${n.body.slice(0, 160)}...` : n.body}</span>}
            </span>
            <span className="nt-when">{n.created_at}</span>
          </>
        )
        const cls = `nt-row${unread ? ' unread' : ''}`
        // In-app links stay in the app: no page reload.
        return n.link && n.link.startsWith('/')
          ? <Link key={n.id} to={n.link} className={cls}>{inner}</Link>
          : <div key={n.id} className={cls}>{inner}</div>
      })}
    </div>
  )
}
