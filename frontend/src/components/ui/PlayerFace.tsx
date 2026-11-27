import { useState, type CSSProperties } from 'react'
import { clubVars } from '../../lib/clubs'

/** His headshot in a circle on his AFL club's colours; a silhouette when we
 *  have no photo. Used by the Honour Board and the Record Book. Styles:
 *  .pface in static/style.css. */
export function PlayerFace({ name, afl_team, photo_url, size = 44 }: { name?: string; afl_team?: string; photo_url?: string | null; size?: number }) {
  const [bad, setBad] = useState(false)
  return (
    <span className="pface" style={{ ...clubVars(afl_team), width: size, height: size } as CSSProperties} aria-hidden={!name}>
      {photo_url && !bad
        ? <img src={photo_url} alt="" onError={() => setBad(true)} />
        : <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7" /><path d="M6 40c1-9 7-14 14-14s13 5 14 14z" /></svg>}
    </span>
  )
}
