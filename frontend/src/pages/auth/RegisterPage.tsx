import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { Trophy } from 'lucide-react'

export function RegisterPage() {
  const { register, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', displayName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) { navigate('/leagues', { replace: true }); return null }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

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
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Trophy className="w-10 h-10 text-[#58a6ff] mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-[#e6edf3]">Create Account</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-sm text-[#ef4444] bg-[#ef444410] border border-[#ef444430] rounded-xl px-4 py-2">{error}</div>}
          <Field label="Username" value={form.username} onChange={set('username')} autoFocus />
          <Field label="Display Name" value={form.displayName} onChange={set('displayName')} />
          <Field label="Email" type="email" value={form.email} onChange={set('email')} />
          <Field label="Password" type="password" value={form.password} onChange={set('password')} />
          <Field label="Confirm Password" type="password" value={form.confirm} onChange={set('confirm')} />
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#58a6ff] text-sm font-bold text-white hover:bg-[#388bfd] transition disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#8b949e] mt-6">
          Already have an account? <Link to="/auth/login" className="text-[#58a6ff] hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  )
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#8b949e] mb-1.5">{label}</label>
      <input {...props} required
        className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition" />
    </div>
  )
}
