import { useState, useEffect, useCallback, useRef } from 'react'
import { api, ApiError } from '../lib/api'

/**
 * Generic GET-and-cache hook with one transient-error retry built in.
 *
 * When the user navigates away from a page and back (common SPA flow),
 * the component re-mounts and re-fetches. If the underlying request
 * trips a transient failure, gunicorn worker just got SIGHUP'd, a
 * brief network hiccup, the ratings-sync flock briefly locked the DB,
 * we used to drop straight into the empty-state "Failed to load X"
 * dead-end. Now we retry once after a short delay before surfacing the
 * error, which makes most of those one-off failures invisible.
 *
 * 4xx errors don't retry (a 401 means re-auth, a 404 means the row
 * isn't coming back), only network/transport errors and 5xx retry.
 */
// Last good answer per URL, for pages that ask to keep it (useKeptFetch).
const kept = new Map<string, unknown>()
const KEEP_MAX = 40
function keep(url: string, value: unknown) {
  kept.delete(url)
  kept.set(url, value)
  if (kept.size > KEEP_MAX) kept.delete(kept.keys().next().value as string)
}

/** useFetch for a page that only reads: coming back to it shows the last
 *  copy straight away, with no spinner, and refreshes behind it. Not for a
 *  page that fills a form from its data, which would start from a stale copy. */
export function useKeptFetch<T>(url: string | null) {
  return useFetch<T>(url, true)
}

export function useFetch<T>(url: string | null, keepLast = false) {
  const [data, setData] = useState<T | null>(() => (keepLast && url && kept.has(url) ? (kept.get(url) as T) : null))
  const [loading, setLoading] = useState(() => !(keepLast && url && kept.has(url)))
  const [error, setError] = useState<string | null>(null)
  const initialLoad = useRef(true)
  const urlRef = useRef(url)
  urlRef.current = url

  const refetch = useCallback(() => {
    const currentUrl = urlRef.current
    if (!currentUrl) return
    // Only show spinner on first load, not on background refreshes
    if (initialLoad.current) {
      setLoading(true)
    }
    const got = (d: T) => { if (keepLast) keep(currentUrl, d); setData(d); setError(null) }
    api<T>(currentUrl)
      .then(got)
      .catch(async (e: unknown) => {
        // Retry once for transient errors. Network errors (fetch failed
        // entirely) are NOT ApiError. Server 5xx ARE ApiError with
        // status >= 500. 4xx are real client errors, don't retry.
        const isTransient =
          !(e instanceof ApiError) ||
          (e instanceof ApiError && e.status >= 500)
        if (isTransient) {
          await new Promise(r => setTimeout(r, 400))
          // If the URL changed underneath us (user navigated away
          // mid-flight), drop the retry, they're on another page now.
          if (urlRef.current !== currentUrl) return
          try {
            got(await api<T>(currentUrl)); return
          } catch (e2) {
            setError(e2 instanceof Error ? e2.message : 'unknown error')
            return
          }
        }
        setError(e instanceof Error ? e.message : 'unknown error')
      })
      .finally(() => { setLoading(false); initialLoad.current = false })
  }, [])

  useEffect(() => {
    if (!url) { setLoading(false); return }
    initialLoad.current = !data // Show spinner only if no data yet
    refetch()
  }, [url])

  return { data, loading, error, refetch }
}
