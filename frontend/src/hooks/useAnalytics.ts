import { useState, useEffect } from 'react'
import type { AnalyticsData } from '../types'

export function useAnalytics(apiUrl: string) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(apiUrl, { credentials: 'same-origin' })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [apiUrl])

  return { data, loading, error }
}
