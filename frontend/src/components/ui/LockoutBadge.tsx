/**
 * LockoutBadge — single anchored pill in the top bar showing AFL round
 * and the countdown to next lockout. Replaces the old horizontal
 * LockoutBanner strip that sat above the field view.
 *
 * Portals into AppShell's #kl-bar-lockout-slot so any league-scoped
 * page can mount it from LeagueShell without owning the chrome.
 *
 * Tone shifts:
 *   - default            → muted glass
 *   - ≤ 24h to lockout   → sapphire glow
 *   - ≤ 2h               → rust glow
 *   - locked / live game → live red dot
 *
 * Click navigates to the user's squad page (where lockout context lives
 * in full). Hidden when no lockout time is known.
 *
 * Styles live as .kl-lockbadge-* in static/style.css. Consumes the
 * canonical --space-N tokens.
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'

export interface LockoutBadgeProps {
  round: number
  lockoutTime: string | null      // ISO datetime
  /** Where to navigate when the badge is clicked (typically the squad page). */
  squadHref?: string
}

type Urgency = 'far' | 'soon' | 'imminent' | 'locked'

function urgencyFor(diffMs: number): Urgency {
  if (diffMs <= 0) return 'locked'
  if (diffMs <= 2 * 3600 * 1000) return 'imminent'
  if (diffMs <= 24 * 3600 * 1000) return 'soon'
  return 'far'
}

function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return 'LIVE'
  const d = Math.floor(diffMs / 86400000)
  const h = Math.floor((diffMs % 86400000) / 3600000)
  const m = Math.floor((diffMs % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  const s = Math.floor((diffMs % 60000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function LockoutBadge({ round, lockoutTime, squadHref }: LockoutBadgeProps) {
  const navigate = useNavigate()
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setSlotEl(document.getElementById('kl-bar-lockout-slot'))
  }, [])

  // Tick every second so the countdown stays live. Cheap — single setInterval.
  useEffect(() => {
    if (!lockoutTime) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [lockoutTime])

  if (!slotEl || !lockoutTime) return null

  const target = new Date(lockoutTime).getTime()
  const diff = target - Date.now()
  const urgency = urgencyFor(diff)
  const display = formatCountdown(diff)
  // tick is read so React knows this render depends on it — referencing
  // it directly here keeps the effect dependency-free.
  void tick

  const onClick = () => {
    if (squadHref) navigate(squadHref)
  }

  return createPortal(
    <button
      type="button"
      className={`kl-lockbadge kl-lockbadge-${urgency}`}
      onClick={onClick}
      title={
        urgency === 'locked'
          ? `Round ${round} — lockout active`
          : `Round ${round} — next lockout at ${new Date(lockoutTime).toLocaleString()}`
      }
      aria-label={`Round ${round}, ${urgency === 'locked' ? 'lockout active' : `next lockout in ${display}`}`}
    >
      <span className="kl-lockbadge-icon" aria-hidden>
        {urgency === 'locked' ? <span className="kl-lockbadge-dot" /> : <i className="bi bi-stopwatch" />}
      </span>
      <span className="kl-lockbadge-round">R{round}</span>
      <span className="kl-lockbadge-sep">·</span>
      <span className="kl-lockbadge-countdown">{display}</span>
    </button>,
    slotEl,
  )
}
