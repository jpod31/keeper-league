import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router'
import { useAuth } from '../../contexts/AuthContext'
import { Trophy } from 'lucide-react'

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
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Trophy className="w-10 h-10 text-[#58a6ff] mx-auto mb-3" />
          <h1 className="text-2xl font-extrabold text-[#e6edf3]">Keeper League</h1>
          <p className="text-sm text-[#8b949e] mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-[#ef4444] bg-[#ef444410] border border-[#ef444430] rounded-xl px-4 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition"
              autoFocus required />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition"
              required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#58a6ff] text-sm font-bold text-white hover:bg-[#388bfd] transition disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-[#8b949e] mt-6">
          Don't have an account? <Link to="/auth/register" className="text-[#58a6ff] hover:underline">Register</Link>
        </p>
      </div>
    </div>
  )
}
