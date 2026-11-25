import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router'

// Going back puts you where you were.
//
// Each entry in the browser's history gets its own small store, kept in
// sessionStorage so it survives the full page load that happens when you come
// back from the server-rendered player profile. Two things live in it:
//
//   - whatever a page keeps with usePageState (filters, sort, the open tab,
//     how far a long list had been loaded, which player card was open)
//   - how far down the page was scrolled (ScrollMemory, mounted once in App)
//
// Every jump is instant: Bootstrap sets smooth scrolling on the page, and an
// animated restore lands late and gets recorded half way.
//
// A link you click makes a NEW history entry, so it starts fresh at the top.
// Back, forward and reload return to an old entry, so they restore it.

const PREFIX = 'klpm:'
const ORDER = 'klpm@order'
const KEEP = 60

function store(): Storage | null {
  try { return window.sessionStorage } catch { return null }
}

function entryOf(loc: { key: string; pathname: string }) {
  return `${PREFIX}${loc.key}:${loc.pathname}:`
}

function forget(entry: string) {
  const s = store()
  if (!s) return
  const gone: string[] = []
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i)
    if (k && k.startsWith(entry)) gone.push(k)
  }
  gone.forEach(k => s.removeItem(k))
}

// The first entry of every page load is keyed "default" by the router, so a
// fresh arrival on a path could pick up what an older visit left there. Only a
// return (back, forward, reload) may read it.
try {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (!nav || nav.type === 'navigate') forget(entryOf({ key: 'default', pathname: window.location.pathname }))
} catch { /* no timing API: nothing to clear */ }

function encode(v: unknown) {
  return JSON.stringify(v, (_k, x) => (x instanceof Set ? { __set: [...x] } : x))
}

function decode(raw: string) {
  return JSON.parse(raw, (_k, x) => (x && typeof x === 'object' && Array.isArray(x.__set) ? new Set(x.__set) : x))
}

function read<T>(key: string): T | undefined {
  const s = store()
  if (!s) return undefined
  try {
    const raw = s.getItem(key)
    return raw == null ? undefined : (decode(raw) as T)
  } catch { return undefined }
}

function write(entry: string, name: string, value: unknown) {
  const s = store()
  if (!s) return
  try {
    s.setItem(entry + name, encode(value))
    // Keep the newest entries only, so a long session cannot fill the store.
    const order: string[] = JSON.parse(s.getItem(ORDER) || '[]')
    if (order[order.length - 1] !== entry) {
      const next = order.filter(e => e !== entry)
      next.push(entry)
      while (next.length > KEEP) forget(next.shift()!)
      s.setItem(ORDER, JSON.stringify(next))
    }
  } catch { /* storage full or blocked: the page still works, it just forgets */ }
}

/** useState that comes back when you return to the page. `name` is unique
 *  within the page. Values must survive JSON (a Set is handled). */
export function usePageState<T>(name: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const loc = useLocation()
  const entry = entryOf(loc)
  const stored = useRef(false)
  const [value, setValue] = useState<T>(() => {
    const kept = read<T>(entry + name)
    if (kept !== undefined) { stored.current = true; return kept }
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })
  const first = useRef(true)
  useEffect(() => {
    // Nothing is written until the value changes from where it started.
    if (first.current) { first.current = false; if (!stored.current) return }
    write(entry, name, value)
  }, [entry, name, value])
  return [value, setValue]
}

/** Go back in history when there is somewhere in the app to go back to,
 *  otherwise to `fallback`. For a page's own "back" link, so it lands on the
 *  page as it was left and not on a fresh copy of it. */
export function useGoBack(fallback: string) {
  const navigate = useNavigate()
  const loc = useLocation()
  return () => {
    const idx = (window.history.state && window.history.state.idx) as number | undefined
    if (loc.key !== 'default' && typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate(fallback)
  }
}

const TAKEOVER = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const

/** Put a scroller back at `want` once it is tall enough, and hold it there
 *  briefly while the layout settles. `room()` is how far it can scroll now.
 *  If the page has finished growing and is only a little short (a line that
 *  is no longer there), it settles at the end instead of waiting. Anything
 *  the user does takes over at once. `ended` runs however it finishes.
 *  Returns the function that stops it early. */
function holdAt(want: number, room: () => number, set: (v: number) => void, pos: () => number, ended: () => void) {
  const started = Date.now()
  let held = 0
  let last = -1
  let steady = 0
  let over = false
  const stop = () => {
    if (over) return
    over = true
    window.clearInterval(timer)
    TAKEOVER.forEach(e => window.removeEventListener(e, stop))
    ended()
  }
  const tick = () => {
    const r = room()
    steady = r === last ? steady + 1 : 0
    last = r
    const closeEnough = steady >= 12 && r >= want * 0.8
    if (r >= want - 1 || closeEnough || Date.now() - started > 8000) {
      const to = Math.max(0, Math.min(want, r))
      if (Math.abs(pos() - to) > 1) set(to)
      if (++held >= 6) stop()
    }
  }
  TAKEOVER.forEach(e => window.addEventListener(e, stop, { passive: true }))
  const timer = window.setInterval(tick, 50)
  tick()
  return stop
}

/** For a list that scrolls inside its own box (the desktop pool table):
 *  `<div ref={useKeptScroll('table')}>`. The window is handled by ScrollMemory. */
export function useKeptScroll(name: string) {
  const loc = useLocation()
  const entry = entryOf(loc)
  return useCallback((el: HTMLElement | null) => {
    if (!el) return
    const key = '@s:' + name
    const want = read<number>(entry + key) || 0
    // Scrolls made while the position is being put back are ours, not the
    // user's, and are not recorded.
    let restoring = want > 0
    const stop = restoring
      ? holdAt(want, () => el.scrollHeight - el.clientHeight, v => el.scrollTo({ top: v, behavior: 'instant' }), () => el.scrollTop,
          () => { restoring = false })
      : null
    const onScroll = () => { if (!restoring) write(entry, key, Math.round(el.scrollTop)) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { stop?.(); el.removeEventListener('scroll', onScroll) }
  }, [entry, name])
}

/** Remembers and restores the window scroll per history entry. */
export function ScrollMemory() {
  const loc = useLocation()
  const type = useNavigationType()
  const entry = useRef('')
  const path = useRef<string | null>(null)
  const restoring = useRef<(() => void) | null>(null)

  useEffect(() => {
    try { window.history.scrollRestoration = 'manual' } catch { /* old browser */ }
    let frame = 0
    const onScroll = () => {
      if (restoring.current || frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!restoring.current && entry.current) write(entry.current, '@y', Math.round(window.scrollY))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
  }, [])

  useLayoutEffect(() => {
    const from = path.current
    entry.current = entryOf(loc)
    path.current = loc.pathname
    restoring.current?.()

    if (type !== 'POP') {
      // A link to another page starts at the top. A change of query string on
      // the same page (a filter in the address) leaves the scroll alone.
      if (type === 'PUSH' && from !== null && from !== loc.pathname && !loc.hash) window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }
    if (loc.hash) return
    const y = read<number>(entry.current + '@y') || 0
    if (y <= 0) { window.scrollTo({ top: 0, behavior: 'instant' }); return }

    // The page is still loading its data, so it is not tall enough yet.
    const stop: () => void = holdAt(
      y,
      () => document.documentElement.scrollHeight - window.innerHeight,
      v => window.scrollTo({ top: v, behavior: 'instant' }),
      () => window.scrollY,
      () => { if (restoring.current === stop) restoring.current = null },
    )
    restoring.current = stop
  }, [loc.key, loc.pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { restoring.current?.() }, [])
  return null
}
