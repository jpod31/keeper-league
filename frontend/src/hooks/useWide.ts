import { useEffect, useState } from 'react'

/** True at Bootstrap's lg width and up (the desktop layouts). For pieces that
 *  are costly to render twice, where hiding one copy with d-lg-none is not
 *  enough. */
export function useWide(query = '(min-width: 992px)') {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return wide
}
