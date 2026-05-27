/**
 * PlayerChip — the single reusable player primitive.
 *
 * Three variants:
 *   - compact  (36px)  → tight list rows, sticky trays, condensed tables
 *   - default  (48px)  → standard squad / draft / wishlist rows
 *   - detailed (72px)  → modal headers, side-panel headers, draft cards
 *
 * Required: name + position. Everything else is optional so call sites
 * can pass only what they have. Position color classes (.pos-DEF/MID/RUC/FWD)
 * already exist in style.css and are applied automatically.
 *
 * Styles live as .pchip-* in static/style.css. They consume the
 * canonical --space-N tokens.
 */

import type { ReactNode } from 'react'

export type PlayerChipVariant = 'compact' | 'default' | 'detailed'

export interface PlayerChipProps {
  name: string
  position: string                  // 'DEF' | 'MID' | 'RUC' | 'FWD' | composite e.g. 'DEF/FWD'

  // Visuals
  variant?: PlayerChipVariant       // default: 'default'
  aflTeam?: string                  // 3-letter code; used as fallback alt text
  teamLogoUrl?: string              // absolute or root-relative; if absent, no logo rendered

  // Score / meta
  sc?: number | null                // displayed in the right slot
  scLabel?: string                  // tiny caption under the sc (e.g. "avg", "R14")
  metaLine?: ReactNode              // for detailed variant — line beneath name (age, games, opponent…)

  // Badges (rendered as a compact group)
  isCaptain?: boolean
  isVc?: boolean
  isEmergency?: boolean
  is7s?: boolean
  isLocked?: boolean

  // Trend indicator (up/down/flat). Subtle arrow next to sc.
  trend?: 'up' | 'down' | 'flat'

  // Behaviour
  onClick?: () => void
  ariaLabel?: string                // overrides the default "<name>, <position>"
  className?: string
  rightSlot?: ReactNode             // escape hatch — replaces sc/trend on the right
}

function Badge({ kind, title }: { kind: 'C' | 'VC' | 'E' | '7' | 'L'; title: string }) {
  return (
    <span className={`pchip-badge pchip-badge-${kind.toLowerCase()}`} title={title} aria-label={title}>
      {kind}
    </span>
  )
}

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'flat' }) {
  if (trend === 'flat') return null
  const cls = trend === 'up' ? 'pchip-trend-up' : 'pchip-trend-down'
  const arrow = trend === 'up' ? '▲' : '▼'
  return <span className={`pchip-trend ${cls}`} aria-hidden>{arrow}</span>
}

export function PlayerChip({
  name,
  position,
  variant = 'default',
  aflTeam,
  teamLogoUrl,
  sc,
  scLabel,
  metaLine,
  isCaptain,
  isVc,
  isEmergency,
  is7s,
  isLocked,
  trend,
  onClick,
  ariaLabel,
  className,
  rightSlot,
}: PlayerChipProps) {
  const interactive = !!onClick
  const Tag: 'button' | 'div' = interactive ? 'button' : 'div'
  const posCls = `pos-${position.split('/')[0].toUpperCase()}`

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!interactive) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.()
    }
  }

  const showLogo = !!teamLogoUrl
  const showBadges = isCaptain || isVc || isEmergency || is7s || isLocked

  return (
    <Tag
      className={[
        'pchip',
        `pchip-${variant}`,
        interactive ? 'pchip-interactive' : '',
        isLocked ? 'pchip-locked' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel ?? `${name}, ${position}`}
      type={Tag === 'button' ? 'button' : undefined}
    >
      {showLogo && (
        <img className="pchip-logo" src={teamLogoUrl} alt={aflTeam ?? ''} loading="lazy" />
      )}
      <div className="pchip-body">
        <div className="pchip-name-row">
          <span className="pchip-name" title={name}>{name}</span>
          {showBadges && (
            <span className="pchip-badges">
              {isCaptain && <Badge kind="C" title="Captain" />}
              {isVc && <Badge kind="VC" title="Vice-captain" />}
              {isEmergency && <Badge kind="E" title="Emergency" />}
              {is7s && <Badge kind="7" title="Reserve 7s" />}
              {isLocked && <Badge kind="L" title="Locked" />}
            </span>
          )}
        </div>
        {variant !== 'compact' && (
          <div className="pchip-meta">
            <span className={`pos-badge ${posCls} pchip-pos`}>{position}</span>
            {variant === 'detailed' && metaLine && <span className="pchip-meta-extra">{metaLine}</span>}
          </div>
        )}
      </div>
      <div className="pchip-right">
        {rightSlot ?? (
          (sc !== undefined && sc !== null) ? (
            <>
              <div className="pchip-sc">
                {sc}
                {trend && <TrendArrow trend={trend} />}
              </div>
              {scLabel && <div className="pchip-sc-label">{scLabel}</div>}
            </>
          ) : null
        )}
      </div>
    </Tag>
  )
}
