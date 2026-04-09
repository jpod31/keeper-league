import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, post } from '../lib/api'

export interface User {
  id: number
  username: string
  display_name: string
  email: string
  is_admin: boolean
}

interface AuthCtx {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<string | null>
  register: (username: string, email: string, password: string, displayName: string) => Promise<string | null>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const u = await api<User>('/auth/api/me')
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = async (username: string, password: string) => {
    try {
      const res = await post<{ user: User; error?: string }>('/auth/api/login', { username, password })
      if (res.error) return res.error
      setUser(res.user)
      return null
    } catch (e: unknown) {
      return (e as Error).message || 'Login failed'
    }
  }

  const register = async (username: string, email: string, password: string, displayName: string) => {
    try {
      const res = await post<{ user: User; error?: string }>('/auth/api/register', {
        username, email, password, display_name: displayName,
      })
      if (res.error) return res.error
      setUser(res.user)
      return null
    } catch (e: unknown) {
      return (e as Error).message || 'Registration failed'
    }
  }

  const logout = async () => {
    await post('/auth/api/logout').catch(() => {})
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
