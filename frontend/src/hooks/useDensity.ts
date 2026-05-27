/**
 * useDensity — per-page comfortable/compact preference, persisted to
 * localStorage. Apply the returned `density` value to a container as
 * a `data-density="..."` attribute, and add the matching CSS in
 * style.css (e.g. .table[data-density="compact"] td { padding: ... }).
 *
 * Pair with <DensityToggle> from components/ui.
 */

import { useCallback, useEffect, useState } from 'react'

export type Density = 'comfortable' | 'compact'

export interface UseDensityReturn {
  density: Density
  setDensity: (d: Density) => void
  toggle: () => void
}

export function useDensity(storageKey: string, defaultDensity: Density = 'comfortable'): UseDensityReturn {
  const [density, setDensityState] = useState<Density>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw === 'comfortable' || raw === 'compact') return raw
    } catch {
      // quota / private mode — fall through to default
    }
    return defaultDensity
  })

  useEffect(() => {
    try { localStorage.setItem(storageKey, density) } catch { /* ignore */ }
  }, [storageKey, density])

  const setDensity = useCallback((d: Density) => setDensityState(d), [])
  const toggle = useCallback(() => setDensityState(d => d === 'compact' ? 'comfortable' : 'compact'), [])

  return { density, setDensity, toggle }
}
