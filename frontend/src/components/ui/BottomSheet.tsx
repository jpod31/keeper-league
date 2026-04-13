import { useEffect, useRef } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxHeight?: string
}

/**
 * Mobile-native bottom sheet with backdrop, drag handle, and smooth animation.
 * Slides up from the bottom, covers up to maxHeight (default 85vh).
 */
export function BottomSheet({ open, onClose, title, children, maxHeight = '85vh' }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="kl-bs-backdrop" onClick={onClose} />
      <div className="kl-bs" ref={sheetRef} style={{ maxHeight }}>
        <div className="kl-bs-handle" onClick={onClose}>
          <div className="kl-bs-handle-bar" />
        </div>
        {title && (
          <div className="kl-bs-header">
            <span className="kl-bs-title">{title}</span>
            <button type="button" className="kl-bs-close" onClick={onClose} aria-label="Close">
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        )}
        <div className="kl-bs-body">
          {children}
        </div>
      </div>
    </>
  )
}
