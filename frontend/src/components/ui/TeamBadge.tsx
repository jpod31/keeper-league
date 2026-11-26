import { useLeague } from '../../contexts/LeagueContext'
import { TeamCrest, type TeamCard } from '../draft/TeamCrest'

/** Look a team up in the league by id or by name, as a crest card. */
export function useTeamCard() {
  const { league } = useLeague()
  return (key: number | string | null | undefined): TeamCard | undefined => {
    if (key == null || !league) return undefined
    const t = league.teams.find(x => (typeof key === 'number' ? x.id === key : x.name === key))
    return t ? { id: t.id, name: t.name, logo: t.logo ?? null, accent: t.accent ?? '#ececf6', flags: t.flags ?? 0, flags7: t.flags7 ?? 0 } : undefined
  }
}

/**
 * A team shown as a team: its crest (or its initials on its own colour) and
 * its name. Use this anywhere a team's name would otherwise appear as bare
 * text. Styles: .tbadge in static/style.css.
 */
export function TeamBadge({
  team, name, size = 22, showName = true, className = '',
}: {
  team?: TeamCard
  /** Team id or name, looked up in the league, when no card is passed. */
  name?: number | string | null
  size?: number
  showName?: boolean
  className?: string
}) {
  const find = useTeamCard()
  const card = team ?? find(name)
  const label = card?.name ?? (typeof name === 'string' ? name : '')
  if (!label) return null
  return (
    <span className={`tbadge ${className}`} title={label}>
      <TeamCrest team={card ?? { id: 0, name: label, logo: null, accent: '#ececf6' }} size={size} />
      {showName && <span className="tbadge-name">{label}</span>}
    </span>
  )
}

/** A team's own colour as { hex, rgb }, for pages that paint with it. */
export function useTeamAccent() {
  const find = useTeamCard()
  return (id: number | null | undefined): { hex: string; rgb: string } => {
    const raw = (find(id)?.accent || '#ececf6').replace('#', '')
    const h = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw.slice(0, 6)
    const n = parseInt(h, 16)
    return { hex: `#${h}`, rgb: `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}` }
  }
}
