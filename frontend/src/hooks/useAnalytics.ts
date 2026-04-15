import { useState, useEffect } from 'react'
import type { AnalyticsData } from '../types'

export function useAnalytics(apiUrl: string) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120000) // 2 min timeout

    fetch(apiUrl, { credentials: 'same-origin', signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => {
        if (e.name === 'AbortError') {
          setError('timeout')
        } else {
          setError(e.message)
        }
        setLoading(false)
      })
      .finally(() => clearTimeout(timeout))

    return () => { controller.abort(); clearTimeout(timeout) }
  }, [apiUrl])

  return { data, loading, error }
}
