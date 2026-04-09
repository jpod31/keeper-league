import { createContext, useContext, useState, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; message: string; type: ToastType }

interface ToastCtx { toast: (message: string, type?: ToastType) => void }
const ToastContext = createContext<ToastCtx>(null!)

let _nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = _nextId++
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const colorMap = { success: 'var(--kl-accent-green)', error: 'var(--kl-accent-red)', info: 'var(--kl-accent-blue)' }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '8px 16px', borderRadius: 10, fontSize: '.85rem', fontWeight: 500,
            background: 'var(--kl-bg-card)', border: `1px solid ${colorMap[t.type]}`,
            color: colorMap[t.type], boxShadow: '0 4px 12px rgba(0,0,0,.3)',
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() { return useContext(ToastContext) }
