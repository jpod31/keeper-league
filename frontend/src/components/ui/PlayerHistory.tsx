import { useEffect, useRef, useState } from 'react'

/** One stint a player has had with a club in this league. A player who was
 *  drafted, delisted and drafted again has two. Shared by the player pool and
 *  the former players page so both tell the same story. */
export interface Stint {
  coach: string | null
  team: string | null
  team_id?: number
  method: string | null
  acquired_at: string | null
  is_active: boolean
  delisted: boolean
  left?: 'delisted' | 'traded' | 'moved' | null
  left_at?: string | null
  left_to?: string | null
  pick_number: number | null
  draft_round?: number | null
  draft_label?: string | null
  draft_year: number | string | null
  draft_type: string | null
}

export interface Acquired {
  coach: string | null
  team?: string | null
  method: string | null
  pick_number: number | null
  draft_year: number | string | null
  draft_type: string | null
  draft_label?: string | null
}

const day = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/** How a club got him: the label, icon and colour for one stint. */
export function stintStyle(e: Stint): { label: string; icon: string; color: string } {
  const when = e.acquired_at ? ` · ${day(e.acquired_at)}` : ''
  if ((e.method === 'draft' || e.method === 'supplemental') && e.pick_number) {
    const which = e.draft_label || (e.draft_year ? `${e.draft_year} draft` : 'draft')
    return {
      label: `Pick ${e.pick_number} · ${which}`,
      icon: e.method === 'draft' ? 'bi-trophy' : 'bi-stars',
      color: e.method === 'draft' ? '#f6c35c' : '#d6b0ff',
    }
  }
  if (e.method === 'trade') return { label: `Traded in${when}`, icon: 'bi-arrow-left-right', color: '#ffa671' }
  if (e.method === 'ssp') return { label: `SSP signing${when}`, icon: 'bi-bandaid', color: '#f0b38a' }
  if (e.method === 'commissioner') return { label: `Commissioner move${when}`, icon: 'bi-shield', color: '#d7d1cb' }
  return { label: e.method || 'Listed', icon: 'bi-person-plus', color: '#d7d1cb' }
}

/** How the stint ended, when it has. */
export function stintExit(e: Stint): string | null {
  if (e.is_active) return null
  const when = e.left_at ? ` ${day(e.left_at)}` : ''
  if (e.left === 'delisted' || e.delisted) return `Delisted${when}`
  if (e.left === 'traded') return `Traded${e.left_to ? ` to ${e.left_to}` : ''}${when}`
  return 'Moved on'
}

export function StintLine({ e, compact = false }: { e: Stint; compact?: boolean }) {
  const s = stintStyle(e)
  return (
    <div style={{ fontSize: compact ? '.8125rem' : '.8125rem', lineHeight: 1.3, opacity: e.is_active ? 1 : 0.72 }}>
      <div style={{ color: '#eae7e4', fontWeight: e.is_active ? 700 : 500 }}>{e.team || e.coach || 'Unlisted'}</div>
      <div style={{ color: s.color }}>
        <i className={`bi ${s.icon}`} style={{ marginRight: 4 }}></i>{s.label}
      </div>
    </div>
  )
}

/** The full stack, oldest to newest, as a timeline. */
export function StintTimeline({ history }: { history: Stint[] }) {
  return (
    <div className="pp-acq-popover-list">
      {history.map((e, i) => {
        const s = stintStyle(e)
        const exit = stintExit(e)
        const isLast = i === history.length - 1
        return (
          <div key={i} className="pp-acq-popover-item">
            <div className="pp-acq-popover-rail">
              <span className="pp-acq-popover-dot" style={{ background: s.color }}></span>
              {!isLast && <span className="pp-acq-popover-line"></span>}
            </div>
            <div className="pp-acq-popover-body">
              <div className="pp-acq-popover-team">
                {e.team || e.coach || 'Unlisted'}
                {e.is_active && <span className="pp-acq-popover-current">CURRENT</span>}
              </div>
              <div className="pp-acq-popover-meta" style={{ color: s.color }}>
                <i className={`bi ${s.icon}`}></i>{s.label}
              </div>
              {exit && <div className="pp-acq-popover-meta" style={{ color: '#eae7e4' }}>{exit}</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** The headline stint, plus a "+N prior" pill that opens the full stack when
 *  a player has had more than one. */
export function AcquiredHistory({
  history, fallback,
}: { history: Stint[] | undefined; fallback: Acquired | null }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (history && history.length > 0) {
    if (history.length === 1) return <StintLine e={history[0]} />
    const headline = [...history].reverse().find(e => e.is_active) || history[history.length - 1]
    return (
      <div ref={rootRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <StintLine e={headline} />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
          className={`pp-acq-toggle${open ? ' open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <i className="bi bi-clock-history"></i>
          <span>+{history.length - 1} prior</span>
          <i className="bi bi-chevron-down" style={{ marginLeft: 2, transition: 'transform .15s ease', transform: open ? 'rotate(180deg)' : 'none' }}></i>
        </button>
        {open && (
          <div className="pp-acq-popover" onClick={(e) => e.stopPropagation()} role="menu">
            <div className="pp-acq-popover-head">Listed {history.length} times</div>
            <StintTimeline history={history} />
          </div>
        )}
      </div>
    )
  }
  if (!fallback) return <span aria-hidden="true">-</span>
  return (
    <>
      {fallback.coach && <div style={{ color: '#eae7e4' }}>{fallback.coach}</div>}
      <div style={{ fontSize: '.8125rem' }}>
        {(fallback.method === 'draft' || fallback.method === 'supplemental') && fallback.pick_number
          ? `Pick ${fallback.pick_number}${fallback.draft_label ? ` · ${fallback.draft_label}` : fallback.draft_year ? ` · ${fallback.draft_year}` : ''}`
          : fallback.method === 'trade' ? 'Trade'
            : fallback.method === 'ssp' ? 'SSP'
              : fallback.method || '-'}
      </div>
    </>
  )
}
