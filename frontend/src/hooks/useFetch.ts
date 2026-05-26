import { useState, useEffect, useCallback, useRef } from 'react'
import { api, ApiError } from '../lib/api'

/**
 * Generic GET-and-cache hook with one transient-error retry built in.
 *
 * When the user navigates away from a page and back (common SPA flow),
 * the component re-mounts and re-fetches. If the underlying request
 * trips a transient failure — gunicorn worker just got SIGHUP'd, a
 * brief network hiccup, the ratings-sync flock briefly locked the DB —
 * we used to drop straight into the empty-state "Failed to load X"
 * dead-end. Now we retry once after a short delay before surfacing the
 * error, which makes most of those one-off failures invisible.
 *
 * 4xx errors don't retry (a 401 means re-auth, a 404 means the row
 * isn't coming back) — only network/transport errors and 5xx retry.
 */
export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
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
    api<T>(currentUrl)
      .then(d => { setData(d); setError(null) })
      .catch(async (e: unknown) => {
        // Retry once for transient errors. Network errors (fetch failed
        // entirely) are NOT ApiError. Server 5xx ARE ApiError with
        // status >= 500. 4xx are real client errors — don't retry.
        const isTransient =
          !(e instanceof ApiError) ||
          (e instanceof ApiError && e.status >= 500)
        if (isTransient) {
          await new Promise(r => setTimeout(r, 400))
          // If the URL changed underneath us (user navigated away
          // mid-flight), drop the retry — they're on another page now.
          if (urlRef.current !== currentUrl) return
          try {
            const d = await api<T>(currentUrl)
            setData(d); setError(null); return
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
