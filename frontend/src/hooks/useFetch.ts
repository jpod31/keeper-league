import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'

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
      .catch(e => setError(e.message))
      .finally(() => { setLoading(false); initialLoad.current = false })
  }, [])

  useEffect(() => {
    if (!url) { setLoading(false); return }
    initialLoad.current = !data // Show spinner only if no data yet
    refetch()
  }, [url])

  return { data, loading, error, refetch }
}
