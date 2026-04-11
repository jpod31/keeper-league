import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import { api } from '../lib/api'
import { useAuth } from './AuthContext'

export interface NotificationItem {
  id: number
  type: string
  title: string
  body: string
  url: string | null
  is_read: boolean
  created_at: string
}

interface RealtimeCtx {
  unreadCount: number
  notifications: NotificationItem[]
  markAllRead: () => Promise<void>
  refresh: () => Promise<void>
  socket: Socket | null
  subscribe: (event: string, handler: (payload: unknown) => void) => () => void
}

const RealtimeContext = createContext<RealtimeCtx>({
  unreadCount: 0,
  notifications: [],
  markAllRead: async () => {},
  refresh: async () => {},
  socket: null,
  subscribe: () => () => {},
})

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const socketRef = useRef<Socket | null>(null)
  const listenersRef = useRef<Map<string, Set<(p: unknown) => void>>>(new Map())

  const refresh = useCallback(async () => {
    if (!user) return
    try {
      const count = await api<{ count: number }>('/api/notifications/unread-count')
      setUnreadCount(count.count ?? 0)
    } catch { /* ignore */ }
    try {
      const list = await api<{ items: NotificationItem[] }>('/api/notifications/recent')
      setNotifications(list.items ?? [])
    } catch { /* ignore */ }
  }, [user])

  const markAllRead = useCallback(async () => {
    if (!user) return
    try {
      await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'same-origin' })
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch { /* ignore */ }
  }, [user])

  const subscribe = useCallback((event: string, handler: (p: unknown) => void) => {
    let set = listenersRef.current.get(event)
    if (!set) {
      set = new Set()
      listenersRef.current.set(event, set)
    }
    set.add(handler)
    return () => { set?.delete(handler) }
  }, [])

  useEffect(() => {
    if (!user) return
    refresh()

    const socket = io('/notifications', {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    const dispatch = (event: string, payload: unknown) => {
      const set = listenersRef.current.get(event)
      if (set) for (const h of set) h(payload)
    }

    const onNotification = (payload: unknown) => {
      const n = payload as NotificationItem
      setNotifications(prev => [n, ...prev].slice(0, 15))
      setUnreadCount(c => c + 1)
      dispatch('notification', payload)
    }
    const onNewMessage = (payload: unknown) => {
      setUnreadCount(c => c + 1)
      dispatch('new_message', payload)
    }
    const onChatMessage = (payload: unknown) => dispatch('chat_message', payload)

    socket.on('notification', onNotification)
    socket.on('new_message', onNewMessage)
    socket.on('chat_message', onChatMessage)

    return () => {
      socket.off('notification', onNotification)
      socket.off('new_message', onNewMessage)
      socket.off('chat_message', onChatMessage)
      socket.disconnect()
      socketRef.current = null
    }
  }, [user, refresh])

  return (
    <RealtimeContext.Provider value={{
      unreadCount, notifications, markAllRead, refresh, socket: socketRef.current, subscribe,
    }}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime() { return useContext(RealtimeContext) }
