import { createContext, useContext, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastOptions {
  type?: ToastType
  title?: string
  duration?: number      // ms; default 4000
  onClick?: () => void
}

interface ToastItem {
  id: number
  message: string
  type: ToastType
  title?: string
  duration: number
  onClick?: () => void
}

interface ToastCtx {
  /** Backward-compatible: toast('msg', 'success') OR toast('msg', { type, title, duration, onClick }) */
  toast: (message: string, opts?: ToastType | ToastOptions) => void
}
const ToastContext = createContext<ToastCtx>(null!)

let _nextId = 0

const ICONS: Record<ToastType, string> = {
  success: 'bi-check-circle-fill',
  error:   'bi-exclamation-octagon-fill',
  info:    'bi-info-circle-fill',
  warning: 'bi-exclamation-triangle-fill',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, opts?: ToastType | ToastOptions) => {
    const id = _nextId++
    // Normalise: legacy `toast('msg', 'error')` → opts object
    const normalised: ToastOptions = typeof opts === 'string'
      ? { type: opts }
      : (opts || {})
    const item: ToastItem = {
      id,
      message,
      type: normalised.type || 'info',
      title: normalised.title,
      duration: normalised.duration ?? 4000,
      onClick: normalised.onClick,
    }
    setToasts(prev => {
      // Cap at 4 visible — drop oldest if pushing a 5th
      const next = prev.length >= 4 ? prev.slice(prev.length - 3) : prev
      return [...next, item]
    })
    setTimeout(() => dismiss(id), item.duration)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="kl-toasts" role="region" aria-label="Notifications" aria-live="polite">
          <AnimatePresence initial={false}>
            {toasts.map(t => (
              <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const handleClick = () => {
    if (item.onClick) item.onClick()
    onDismiss()
  }
  const clickable = !!item.onClick
  return (
    <motion.div
      className={`kl-toast kl-toast-${item.type}${clickable ? ' clickable' : ''}`}
      role="status"
      layout
      initial={{ x: 120, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 120, opacity: 0, transition: { duration: .24, ease: [.4, 0, 1, 1] } }}
      transition={{ type: 'spring', stiffness: 240, damping: 24, mass: 1.1 }}
      onClick={clickable ? handleClick : undefined}
    >
      <span className="kl-toast-icon">
        <i className={`bi ${ICONS[item.type]}`}></i>
      </span>
      <span className="kl-toast-body">
        {item.title && <span className="kl-toast-title">{item.title}</span>}
        <span className="kl-toast-msg">{item.message}</span>
      </span>
      <button
        type="button"
        className="kl-toast-close"
        aria-label="Dismiss"
        onClick={(e) => { e.stopPropagation(); onDismiss() }}
      >
        <i className="bi bi-x-lg"></i>
      </button>
      <span
        className="kl-toast-progress"
        style={{ animationDuration: `${item.duration}ms` }}
      />
    </motion.div>
  )
}

export function useToast() { return useContext(ToastContext) }
