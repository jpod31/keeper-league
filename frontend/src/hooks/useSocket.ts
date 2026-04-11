import { useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface UseSocketOptions {
  namespace: string
  onConnect?: (socket: Socket) => void
  events?: Record<string, (payload: unknown) => void>
}

/**
 * Shared Socket.IO hook with automatic reconnect, connection state tracking,
 * and event handler lifecycle management. Used by draft/gameday/chat pages.
 */
export function useSocket({ namespace, onConnect, events }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null)
  const [state, setState] = useState<ConnectionState>('connecting')
  const onConnectRef = useRef(onConnect)
  const eventsRef = useRef(events)

  useEffect(() => { onConnectRef.current = onConnect })
  useEffect(() => { eventsRef.current = events })

  useEffect(() => {
    const socket = io(namespace, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setState('connected')
      onConnectRef.current?.(socket)
    })
    socket.on('disconnect', () => setState('disconnected'))
    socket.on('connect_error', () => setState('error'))
    socket.io.on('reconnect_attempt', () => setState('connecting'))

    const handlers: Array<[string, (p: unknown) => void]> = []
    const registered = eventsRef.current ?? {}
    for (const [name, handler] of Object.entries(registered)) {
      const wrapped = (payload: unknown) => handler(payload)
      socket.on(name, wrapped)
      handlers.push([name, wrapped])
    }

    return () => {
      for (const [name, wrapped] of handlers) socket.off(name, wrapped)
      socket.disconnect()
    }
  }, [namespace])

  return { socket: socketRef.current, state }
}
