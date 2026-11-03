import { useState } from 'react'

export interface TeamCard { id: number; name: string; logo: string | null; accent: string }

function initials(name: string) {
  const parts = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/** A fantasy team's crest on its own accent, or its initials when it has none. */
export function TeamCrest({ team, size = 24 }: { team: TeamCard | undefined; size?: number }) {
  const [failed, setFailed] = useState(false)
  const accent = team?.accent ?? '#58a6ff'
  return (
    <span
      className="tc-crest"
      style={{
        width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)),
        background: `color-mix(in srgb, ${accent} 22%, #0f1626)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accent} 55%, transparent)`,
        color: accent,
      }}
      aria-hidden="true"
    >
      {team?.logo && !failed
        ? <img src={team.logo} alt="" loading="lazy" onError={() => setFailed(true)} />
        : initials(team?.name ?? '?')}
    </span>
  )
}

export const CREST_CSS = `
.tc-crest { display: inline-flex; align-items: center; justify-content: center; flex: none;
  border-radius: 7px; overflow: hidden; font-weight: 800; letter-spacing: -.02em; line-height: 1; }
.tc-crest img { width: 100%; height: 100%; object-fit: cover; }
`
