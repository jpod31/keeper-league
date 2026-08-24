/**
 * Season Review — the full-screen, slide-by-slide year in review.
 *
 * Runs as a story: slides advance on a timer with the progress segments
 * filling in real time, and pause the moment the viewer looks like they're
 * reading (pointer over the content, or they've just scrolled). Manual
 * controls always win — buttons, arrow keys, the edge tap zones, or the
 * progress segments themselves.
 *
 * Slides live in slides.tsx and only draw; this file owns ordering, theming,
 * timing and motion.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../../lib/api'
import { SLIDES } from './slides'
import { useParallax, reduced } from './bits2'
import type { SeasonReviewData } from './types'
import './review.css'

/** How long a slide holds before advancing. Dense slides get longer. */
const HOLD_MS: Record<string, number> = {
  intro: 5200, numbers: 9000, ladder: 10000, you: 10000, arc: 10000,
  mvp: 9500, ironmen: 12000, best23: 14000, records: 12000, h2h: 12000,
  bench: 11000, sevens: 11000, draft: 12000, coaches: 13000,
  awards: 14000, outro: 12000,
}
const DEFAULT_HOLD = 10000

export function SeasonReview({
  leagueId, year, teamId, onClose,
}: {
  leagueId: number
  year: number
  teamId: number | null
  onClose: () => void
}) {
  const [data, setData] = useState<SeasonReviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [playing, setPlaying] = useState(!reduced())
  const [reading, setReading] = useState(false)
  const [done, setDone] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const scrollTimer = useRef<number | undefined>(undefined)

  useParallax(rootRef)

  useEffect(() => {
    let live = true
    api<SeasonReviewData>(`/api/leagues/${leagueId}/season-review?year=${year}`)
      .then(d => { if (live) { d.available ? setData(d) : setError('No review available yet.') } })
      .catch(() => { if (live) setError('Could not load the season review.') })
    return () => { live = false }
  }, [leagueId, year])

  // The takeover owns the viewport while it's up.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const deck = useMemo(() => {
    if (!data) return []
    const ctx = { d: data, teamId }
    return SLIDES.filter(s => { try { return s.enabled(ctx) } catch { return false } })
  }, [data, teamId])

  const go = useCallback((next: number) => {
    if (next < 0 || next >= deck.length) {
      if (next >= deck.length) { setPlaying(false); setDone(true) }
      return
    }
    setDir(next > i ? 1 : -1)
    setI(next)
    setDone(false)
  }, [deck.length, i])

  // Autoplay. One timeout per slide rather than a ticking interval — the bar
  // is a pure CSS animation, so nothing needs to re-render while it runs.
  const held = deck[i] ? (HOLD_MS[deck[i].key] ?? DEFAULT_HOLD) : DEFAULT_HOLD
  const paused = !playing || reading || !data
  useEffect(() => {
    if (paused || !deck.length) return
    const t = window.setTimeout(() => {
      if (i >= deck.length - 1) { setPlaying(false); setDone(true) }
      else { setDir(1); setI(n => n + 1) }
    }, held)
    return () => window.clearTimeout(t)
  }, [i, paused, held, deck.length])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowRight') { e.preventDefault(); setPlaying(false); go(i + 1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); setPlaying(false); go(i - 1) }
      if (e.key === ' ') { e.preventDefault(); setPlaying(p => !p) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, go, onClose])

  // Reading a dense slide shouldn't get yanked away mid-sentence.
  const onScroll = useCallback(() => {
    setReading(true)
    window.clearTimeout(scrollTimer.current)
    scrollTimer.current = window.setTimeout(() => setReading(false), 4000)
  }, [])
  useEffect(() => () => window.clearTimeout(scrollTimer.current), [])

  const slide = deck[i]
  const theme = slide?.theme ?? ['#7c5cff', '#ff5fa2', '#1a0b3d']
  const last = i === deck.length - 1

  const body = (
    <div
      ref={rootRef}
      className="sr-root"
      style={{ '--sr-a': theme[0], '--sr-b': theme[1], '--sr-c': theme[2] } as React.CSSProperties}
      role="dialog"
      aria-modal="true"
      aria-label={`${year} season in review`}
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
      onTouchEnd={e => {
        if (!touch.current) return
        const dx = e.changedTouches[0].clientX - touch.current.x
        const dy = e.changedTouches[0].clientY - touch.current.y
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) {
          setPlaying(false)
          go(dx < 0 ? i + 1 : i - 1)
        }
        touch.current = null
      }}
    >
      <div className="sr-field" aria-hidden>
        <span className="sr-blob sr-blob-1" />
        <span className="sr-blob sr-blob-2" />
        <span className="sr-blob sr-blob-3" />
      </div>
      <div className="sr-grain" aria-hidden />
      <div className="sr-vignette" aria-hidden />
      {slide && <div className="sr-flash" key={`flash-${slide.key}`} aria-hidden />}

      <div className="sr-top">
        <div className="sr-segs">
          {deck.map((s, n) => (
            <button
              key={s.key}
              type="button"
              className={`sr-seg${n < i ? ' done' : ''}${n === i ? ' active' : ''}`}
              onClick={() => { setPlaying(false); go(n) }}
              aria-label={s.name}
              title={s.name}
            >
              <span
                className={`sr-seg-fill${n === i && !paused ? ' timed' : ''}`}
                style={n === i && !paused
                  ? { animationDuration: `${HOLD_MS[s.key] ?? DEFAULT_HOLD}ms` }
                  : undefined}
              />
            </button>
          ))}
        </div>
        <div className="sr-bar">
          <span className="sr-badge"><b>{year.toString().slice(-2)}</b> Season in Review</span>
          <span className="sr-bar-spacer" />
          {deck.length > 0 && <span className="sr-chip">{i + 1} / {deck.length}</span>}
          <button
            className={`sr-play${playing ? ' on' : ''}`}
            onClick={() => { setPlaying(p => !p); setDone(false) }}
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause (space)' : 'Play (space)'}
          >
            <i className={`bi ${playing ? 'bi-pause-fill' : 'bi-play-fill'}`} />
          </button>
          <button className="sr-x" onClick={onClose} aria-label="Close review">
            <i className="bi bi-x-lg" />
          </button>
        </div>
      </div>

      <div
        className="sr-stage"
        onPointerEnter={() => setReading(true)}
        onPointerLeave={() => setReading(false)}
      >
        {!data && !error && (
          <div className="sr-slide" style={{ alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="sr-mega sr-grad" style={{ fontSize: 'clamp(2.6rem,9vw,6rem)' }}>{year}</div>
              <div className="sr-label" style={{ marginTop: 12 }}>Counting up your season…</div>
            </div>
          </div>
        )}
        {error && (
          <div className="sr-slide" style={{ alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 className="sr-h2">{error}</h2>
              <button className="sr-btn primary" style={{ marginTop: 16 }} onClick={onClose}>Close</button>
            </div>
          </div>
        )}
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          {data && slide && (
            <motion.div
              key={slide.key}
              className="sr-slide"
              custom={dir}
              onScroll={onScroll}
              initial={{ opacity: 0, x: dir * 60, scale: 1.05, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: dir * -50, scale: 0.97, filter: 'blur(10px)' }}
              transition={{ duration: 0.44, ease: [0.16, 0.86, 0.2, 1] }}
            >
              {slide.render({ d: data, teamId })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edge tap zones — narrow so scrolling and reading the middle of a
            dense slide is never hijacked. */}
        {data && deck.length > 0 && (
          <>
            <button className="sr-zone prev" aria-label="Previous"
                    onClick={() => { setPlaying(false); go(i - 1) }} />
            <button className="sr-zone next" aria-label="Next"
                    onClick={() => { setPlaying(false); go(i + 1) }} />
          </>
        )}
      </div>

      {data && deck.length > 0 && (
        <div className="sr-nav">
          <button className="sr-btn" onClick={() => { setPlaying(false); go(i - 1) }} disabled={i === 0}>
            <i className="bi bi-arrow-left" /> Back
          </button>
          <div className="sr-nav-mid">
            <span className="sr-nav-title">{slide?.name}</span>
          </div>
          {last && done ? (
            <>
              <button className="sr-btn" onClick={() => { setI(0); setDir(1); setDone(false); setPlaying(true) }}>
                <i className="bi bi-arrow-repeat" /> Replay
              </button>
              <button className="sr-btn primary" onClick={onClose}>
                Done <i className="bi bi-check-lg" />
              </button>
            </>
          ) : last ? (
            <button className="sr-btn primary" onClick={onClose}>
              Done <i className="bi bi-check-lg" />
            </button>
          ) : (
            <button className="sr-btn primary" onClick={() => { setPlaying(false); go(i + 1) }}>
              Next <i className="bi bi-arrow-right" />
            </button>
          )}
        </div>
      )}
    </div>
  )

  return createPortal(body, document.body)
}

export default SeasonReview
