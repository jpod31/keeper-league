import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) { navigate('/leagues', { replace: true }); return null }
  const from = (location.state as { from?: string })?.from || '/leagues'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const err = await login(username, password)
    setLoading(false)
    if (err) setError(err)
    else navigate(from, { replace: true })
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card text-center">
        <div className="auth-logo">
          <img src="/static/icons/kl-logo.png" alt="KL" className="auth-logo-img" />
          <div className="auth-logo-wordmark">
            <div className="auth-logo-text">Keeper League</div>
            <div className="auth-logo-sub">Fantasy AFL</div>
          </div>
        </div>
        <h3 className="fw-bold mb-1">Welcome back</h3>
        <p className="text-secondary mb-4" style={{ fontSize: '.9rem' }}>Sign in to your Keeper League account</p>
        <form onSubmit={handleSubmit} className="text-start">
          {error && (
            <div className="alert alert-danger py-2" style={{ fontSize: '.85rem' }}>{error}</div>
          )}
          <div className="mb-3">
            <label htmlFor="username" className="form-label">Username or Email</label>
            <input type="text" className="form-control" id="username"
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username or email"
              autoFocus required />
          </div>
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Password</label>
            <input type="password" className="form-control" id="password"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required />
          </div>
          <div className="form-check mb-4">
            <input type="checkbox" className="form-check-input" id="remember" />
            <label className="form-check-label" htmlFor="remember" style={{ fontSize: '.8rem', color: '#8b949e' }}>Remember me</label>
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
            {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Signing in...</> : 'Sign In'}
          </button>
        </form>
        <p className="text-center mt-4 mb-0" style={{ fontSize: '.85rem', color: '#8b949e' }}>
          Don't have an account? <Link to="/auth/register" style={{ color: '#58a6ff', textDecoration: 'none' }}>Create one</Link>
        </p>
      </div>
    </div>
  )
}
