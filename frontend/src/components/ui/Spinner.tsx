import { useEffect, useState } from 'react'
import { PageLoader } from './PageLoader'

/**
 * Delayed inline loader. Renders nothing for the first 400ms, then shows
 * the big pulsing KL logo + glow halo. This means fast pages never flash
 * a loader, slow pages get a visible load state, and no page needs to opt
 * in manually. Every <Spinner /> callsite gets the smart behaviour for free.
 */
export function Spinner({ text, delay = 400 }: { text?: string; delay?: number } = {}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  if (!show) return null
  return <PageLoader text={text} />
}
