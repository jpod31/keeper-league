import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { Spinner } from '../ui/Spinner'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner text="Loading..." />
  if (!user) return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />

  return <>{children}</>
}
