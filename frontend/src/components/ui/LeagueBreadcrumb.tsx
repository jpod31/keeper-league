/**
 * LeagueBreadcrumb — interactive league-name link with a hover popover
 * showing quick context (round, lockout, your team).
 *
 * Drop in anywhere a breadcrumb currently does:
 *   <Link to={`/leagues/${leagueId}`}>{data.league.name}</Link>
 *
 * Reads from LeagueContext for the popover so no extra HTTP needed.
 * Mobile falls back to a tap-toggle.
 *
 * Styles live as .lbc-* in static/style.css. Consumes --space-N tokens.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useLeague } from '../../contexts/LeagueContext'

export interface LeagueBreadcrumbProps {
  leagueId: string | number
  /** Displayed name. Pass in case LeagueContext hasn't loaded yet; we fall
   *  back to it then upgrade to context's name once available. */
  fallbackName?: string
}

function fmtCountdown(iso: string | null): string {
  if (!iso) return ''
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Locked'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function LeagueBreadcrumb({ leagueId, fallbackName }: LeagueBreadcrumbProps) {
  const { league } = useLeague()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  // Tap-outside to close on mobile (hover events don't fire there).
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const name = league?.name ?? fallbackName ?? '…'
  const hasContext = !!league
  const myTeamName = league?.user_team?.name
  const round = league?.current_round
  const lockout = league?.next_lockout_at ?? null

  return (
    <span
      ref={rootRef}
      className="lbc"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Link
        to={`/leagues/${leagueId}`}
        className="lbc-link"
        onClick={() => setOpen(false)}
        onFocus={() => setOpen(true)}
      >
        {name}
      </Link>
      {hasContext && open && (
        <span className="lbc-pop" role="tooltip">
          <span className="lbc-pop-head">
            <strong>{name}</strong>
            {league.season_year && <span className="lbc-pop-season"> · {league.season_year}</span>}
          </span>
          {round != null && round > 0 && (
            <span className="lbc-pop-row">
              <i className="bi bi-calendar-week"></i>
              Round {round}
              {lockout && <span className="lbc-pop-cd"> · {fmtCountdown(lockout)}</span>}
            </span>
          )}
          {myTeamName && (
            <span className="lbc-pop-row">
              <i className="bi bi-person-fill"></i>
              {myTeamName}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
