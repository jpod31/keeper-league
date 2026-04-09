import { useState, useEffect } from 'react'
import { api } from '../lib/api'

export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = () => {
    if (!url) return
    setLoading(true)
    api<T>(url)
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!url) { setLoading(false); return }
    refetch()
  }, [url])

  return { data, loading, error, refetch }
}
