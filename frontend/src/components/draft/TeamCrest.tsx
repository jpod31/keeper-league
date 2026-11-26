import { useState } from 'react'
import { useLeague } from '../../contexts/LeagueContext'

export interface TeamCard { id: number; name: string; logo: string | null; accent: string; flags?: number }

function initials(name: string) {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const STAR = '10,1 12.6,7 19,7.4 14,11.6 15.8,18.4 10,14.6 4.2,18.4 6,11.6 1,7.4 7.4,7'

/** Gold stars over a crest, one per flag, the way a club wears them over its
 *  badge. They sit above the crest or the initials alike, so a crest uploaded
 *  later gets them too. Lucas, 2026-11-26. */
export function FlagStars({ n, size }: { n: number; size: number }) {
  if (!n || n < 1) return null
  const s = Math.max(9, Math.min(16, Math.round(size * 0.36)))
  return (
    <span className="tc-stars" style={{ ['--st' as string]: `${s}px` } as React.CSSProperties}
      title={`${n} premiership${n === 1 ? '' : 's'}`} aria-label={`${n} premiership${n === 1 ? '' : 's'}`}>
      {Array.from({ length: Math.min(n, 5) }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" aria-hidden="true"><polygon points={STAR} /></svg>
      ))}
    </span>
  )
}

/** A fantasy team's crest on its own accent, or its initials when it has none,
 *  with a star above for every flag. */
export function TeamCrest({ team, size = 24 }: { team: TeamCard | undefined; size?: number }) {
  const [failed, setFailed] = useState(false)
  const league = useLeague()?.league
  const accent = team?.accent ?? '#ececf6'
  const flags = team?.flags ?? (team?.id ? league?.teams.find(t => t.id === team.id)?.flags : 0) ?? 0
  // A club's own crest stands on its own: no tile behind it (Lucas,
  // 2026-11-26). Only the initials, for a club with no crest, sit on a tile.
  const hasLogo = !!team?.logo && !failed
  return (
    <span className="tc-wrap">
      <FlagStars n={flags} size={size} />
      <span
        className={`tc-crest${hasLogo ? ' tc-logo' : ''}`}
        style={hasLogo ? { width: size, height: size } : {
          width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)),
          background: `color-mix(in srgb, ${accent} 22%, #121215)`,
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 55%, transparent)`,
          color: accent,
        }}
        aria-hidden="true"
      >
        {team?.logo && !failed
          ? <img src={team.logo} alt="" loading="lazy" onError={() => setFailed(true)} />
          : initials(team?.name ?? '?')}
      </span>
    </span>
  )
}

export const CREST_CSS = `
.tc-crest { display: inline-flex; align-items: center; justify-content: center; flex: none;
  border-radius: 7px; overflow: hidden; font-weight: 800; letter-spacing: -.02em; line-height: 1; }
.tc-crest img { width: 100%; height: 100%; object-fit: cover; }
`
