import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'

export function RegisterPage() {
  const { register, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', displayName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) { navigate('/leagues', { replace: true }); return null }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const err = await register(form.username, form.email, form.password, form.displayName)
    setLoading(false)
    if (err) setError(err)
    else navigate('/leagues', { replace: true })
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
        <h3 className="fw-bold mb-1">Create your account</h3>
        <p className="text-secondary mb-4" style={{ fontSize: '.9rem' }}>Join a league or create your own</p>
        <form onSubmit={handleSubmit} className="text-start">
          {error && <div className="alert alert-danger py-2" style={{ fontSize: '.85rem' }}>{error}</div>}
          <div className="mb-3">
            <label htmlFor="username" className="form-label">Username</label>
            <input type="text" className="form-control" id="username"
              value={form.username} onChange={set('username')}
              placeholder="Choose a username" minLength={3} maxLength={80}
              autoFocus required />
          </div>
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input type="email" className="form-control" id="email"
              value={form.email} onChange={set('email')}
              placeholder="you@example.com" required />
          </div>
          <div className="mb-3">
            <label htmlFor="display_name" className="form-label">
              Display Name <span className="text-secondary" style={{ fontSize: '.75rem' }}>(optional)</span>
            </label>
            <input type="text" className="form-control" id="display_name"
              value={form.displayName} onChange={set('displayName')}
              placeholder="What others see" maxLength={80} />
          </div>
          <div className="row g-3 mb-4">
            <div className="col-6">
              <label htmlFor="password" className="form-label">Password</label>
              <input type="password" className="form-control" id="password"
                value={form.password} onChange={set('password')}
                placeholder="Min 6 characters" minLength={6} required />
            </div>
            <div className="col-6">
              <label htmlFor="confirm" className="form-label">Confirm</label>
              <input type="password" className="form-control" id="confirm"
                value={form.confirm} onChange={set('confirm')}
                placeholder="Re-enter" minLength={6} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p className="text-center mt-4 mb-0" style={{ fontSize: '.85rem', color: '#8b949e' }}>
          Already have an account? <Link to="/auth/login" style={{ color: '#58a6ff', textDecoration: 'none' }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
