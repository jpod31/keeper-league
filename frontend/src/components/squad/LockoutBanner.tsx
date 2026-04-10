import { useState, useEffect } from 'react'

interface Props {
  lockoutTime: string // ISO datetime string
}

export function LockoutBanner({ lockoutTime }: Props) {
  const [display, setDisplay] = useState('')
  const [isLocked, setIsLocked] = useState(false)

  useEffect(() => {
    const target = new Date(lockoutTime)

    function update() {
      const diff = target.getTime() - Date.now()
      if (diff <= 0) {
        setDisplay('LOCKED — Game has started')
        setIsLocked(true)
        return
      }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      const pad = (n: number) => String(n).padStart(2, '0')
      if (d > 0) {
        setDisplay(`Next lockout in ${d}d ${pad(h)}:${pad(m)}:${pad(s)}`)
      } else {
        setDisplay(`Next lockout in ${pad(h)}:${pad(m)}:${pad(s)}`)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [lockoutTime])

  return (
    <div className={`fv-lockout-banner${isLocked ? ' fv-lockout-locked' : ''}`}>
      <i className="bi bi-clock"></i>
      <span>{display}</span>
    </div>
  )
}
