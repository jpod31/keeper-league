import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** A new player's year-one outlook in the draft room (models/pre_afl.py
 *  scouting_summary): a coloured dot and his chance of 10+ AFL games next
 *  year. Hover or focus opens a card with the verdict and his best ranking
 *  among players of his role drafted since 2019. It replaces a browser
 *  tooltip, which was slow to show, unstyled and never appeared on a phone. */
export interface Outlook { label: string | null; tone: 'good' | 'warn' | 'slow' | null; ten: number | null; pick: number | null; best: string | null }

export function OutlookChip({ o }: { o: Outlook }) {
  const ref = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ x: number; y: number; up: boolean } | null>(null)
  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const up = r.bottom + 170 > window.innerHeight
    setAt({ x: Math.min(Math.max(r.left + r.width / 2, 160), window.innerWidth - 160), y: up ? r.top - 8 : r.bottom + 8, up })
  }
  const hide = () => setAt(null)
  const tone = o.tone || 'warn'
  return (
    <>
      <button ref={ref} type="button" className={`dr-out dr-${tone}`} onMouseEnter={show} onMouseLeave={hide}
        onFocus={show} onBlur={hide} onClick={e => { e.stopPropagation(); at ? hide() : show() }}
        aria-label={`${o.ten}% chance of 10 or more AFL games in his first season${o.label ? `. ${o.label}` : ''}`}>
        <i />{o.ten}%
      </button>
      {at && createPortal(
        <div className={`dr-outcard dr-${tone}${at.up ? ' up' : ''}`} style={{ left: at.x, top: at.y }} role="tooltip">
          <div className="dr-outcard-top"><b>{o.ten}%</b><span>chance of 10+ AFL games in his first season</span></div>
          {o.label && <div className="dr-outcard-verdict"><i />{o.label}</div>}
          {o.best && <div className="dr-outcard-best">{o.best}</div>}
        </div>,
        document.body,
      )}
    </>
  )
}
