import { useAuth } from '../../contexts/AuthContext'
import { useState } from 'react'
import { post } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'

export function ProfilePage() {
  const { user, refresh } = useAuth()
  const { toast } = useToast()
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await post('/auth/api/profile', { display_name: displayName, email })
      await refresh()
      toast('Profile updated', 'success')
    } catch {
      toast('Failed to save', 'error')
    }
    setSaving(false)
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">Profile</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Username</label>
          <input value={user?.username || ''} disabled
            className="w-full px-3 py-2.5 rounded-xl bg-[#161b22] border border-[#21262d] text-sm text-[#484f58]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Display Name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition" />
        </div>
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#58a6ff] text-sm font-bold text-white hover:bg-[#388bfd] transition disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
