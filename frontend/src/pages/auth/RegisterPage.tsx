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
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', background: 'var(--kl-bg-body)' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 1rem' }}>
        <div className="text-center mb-4">
          <i className="bi bi-trophy-fill" style={{ fontSize: '2.5rem', color: 'var(--kl-accent-blue)' }}></i>
          <h3 className="fw-bold mt-2" style={{ color: 'var(--kl-text-heading)' }}>Create Account</h3>
        </div>
        <div className="card">
          <div className="card-body p-4">
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-danger py-2" style={{ fontSize: '.85rem' }}>{error}</div>}
              {['username', 'displayName', 'email'].map(k => (
                <div className="mb-3" key={k}>
                  <label className="form-label" style={{ fontSize: '.8rem', color: 'var(--kl-text-secondary)' }}>
                    {k === 'displayName' ? 'Display Name' : k.charAt(0).toUpperCase() + k.slice(1)}
                  </label>
                  <input type={k === 'email' ? 'email' : 'text'} className="form-control" value={(form as Record<string, string>)[k]} onChange={set(k)}
                    style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }}
                    required={k !== 'displayName'} />
                </div>
              ))}
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '.8rem', color: 'var(--kl-text-secondary)' }}>Password</label>
                <input type="password" className="form-control" value={form.password} onChange={set('password')}
                  style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }} required />
              </div>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '.8rem', color: 'var(--kl-text-secondary)' }}>Confirm Password</label>
                <input type="password" className="form-control" value={form.confirm} onChange={set('confirm')}
                  style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }} required />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
        <p className="text-center mt-3" style={{ fontSize: '.85rem', color: 'var(--kl-text-secondary)' }}>
          Already have an account? <Link to="/auth/login" style={{ color: 'var(--kl-accent-blue)' }}>Sign In</Link>
        </p>
      </div>
    </div>
  )
}
