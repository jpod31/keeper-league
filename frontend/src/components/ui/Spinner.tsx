import { useState, useEffect } from 'react'
import { KLLoader } from './KLLoader'

/**
 * Smart loading indicator:
 *  - 0–400ms:   render nothing (most loads finish here — zero visual disruption)
 *  - 400ms+:    full-screen KL loader (for genuinely slow loads)
 *
 * This eliminates the dark-screen flash on fast page transitions while still
 * giving feedback when something actually takes a while.
 */
export function Spinner(_props: { text?: string } = {}) {
  void _props
  const [phase, setPhase] = useState<'hidden' | 'full'>('hidden')

  useEffect(() => {
    const t = setTimeout(() => setPhase('full'), 400)
    return () => clearTimeout(t)
  }, [])

  if (phase === 'hidden') return null
  return <KLLoader />
}
