/**
 * Season Review — the full-screen, slide-by-slide year in review.
 *
 * Owns the deck: fetch, theming, navigation (buttons / arrow keys / swipe /
 * progress segments) and the mount transition. Slides themselves live in
 * slides.tsx and only draw.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { api } from '../../lib/api'
import { SLIDES } from './slides'
import type { SeasonReviewData } from './types'
import './review.css'

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
  const touch = useRef<{ x: number; y: number } | null>(null)

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
    return SLIDES.filter(s => {
      try { return s.enabled(ctx) } catch { return false }
    })
  }, [data, teamId])

  const go = (next: number) => {
    if (next < 0 || next >= deck.length) return
    setDir(next > i ? 1 : -1)
    setI(next)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(i + 1) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, deck.length, onClose])

  const slide = deck[i]
  const theme = slide?.theme ?? ['#7c5cff', '#ff5fa2', '#1a0b3d']
  const last = i === deck.length - 1

  const body = (
    <div
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
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? i + 1 : i - 1)
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

      <div className="sr-top">
        <div className="sr-segs">
          {deck.map((s, n) => (
            <button
              key={s.key}
              type="button"
              className={`sr-seg${n < i ? ' done' : ''}${n === i ? ' active' : ''}`}
              onClick={() => go(n)}
              aria-label={s.name}
              title={s.name}
            >
              <span className="sr-seg-fill" />
            </button>
          ))}
        </div>
        <div className="sr-bar">
          <span className="sr-badge"><b>{year.toString().slice(-2)}</b> Season in Review</span>
          <span className="sr-bar-spacer" />
          {deck.length > 0 && <span className="sr-chip">{i + 1} / {deck.length}</span>}
          <button className="sr-x" onClick={onClose} aria-label="Close review">
            <i className="bi bi-x-lg" />
          </button>
        </div>
      </div>

      <div className="sr-stage">
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
              initial={{ opacity: 0, x: dir * 44, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: dir * -44, filter: 'blur(6px)' }}
              transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {slide.render({ d: data, teamId })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {data && deck.length > 0 && (
        <div className="sr-nav">
          <button className="sr-btn" onClick={() => go(i - 1)} disabled={i === 0}>
            <i className="bi bi-arrow-left" /> Back
          </button>
          <div className="sr-nav-mid">
            <span className="sr-nav-title">{slide?.name}</span>
          </div>
          {last ? (
            <button className="sr-btn primary" onClick={onClose}>
              Done <i className="bi bi-check-lg" />
            </button>
          ) : (
            <button className="sr-btn primary" onClick={() => go(i + 1)}>
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
