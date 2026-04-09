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
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', background: 'var(--kl-bg-body)' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 1rem' }}>
        <div className="text-center mb-4">
          <i className="bi bi-trophy-fill" style={{ fontSize: '2.5rem', color: 'var(--kl-accent-blue)' }}></i>
          <h3 className="fw-bold mt-2" style={{ color: 'var(--kl-text-heading)' }}>Keeper League</h3>
          <p style={{ color: 'var(--kl-text-secondary)', fontSize: '.85rem' }}>Sign in to your account</p>
        </div>

        <div className="card">
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-danger py-2" style={{ fontSize: '.85rem' }}>{error}</div>}
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '.8rem', color: 'var(--kl-text-secondary)' }}>Username</label>
                <input type="text" className="form-control" value={username} onChange={e => setUsername(e.target.value)}
                  style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }}
                  autoFocus required />
              </div>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '.8rem', color: 'var(--kl-text-secondary)' }}>Password</label>
                <input type="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)}
                  style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }}
                  required />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Signing in...</> : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center mt-3" style={{ fontSize: '.85rem', color: 'var(--kl-text-secondary)' }}>
          Don't have an account? <Link to="/auth/register" style={{ color: 'var(--kl-accent-blue)' }}>Register</Link>
        </p>
      </div>
    </div>
  )
}
