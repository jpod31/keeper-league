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
    } catch { toast('Failed to save', 'error') }
    setSaving(false)
  }

  return (
    <div className="container py-4" style={{ maxWidth: 600 }}>
      <h4 className="fw-bold mb-4" style={{ color: 'var(--kl-text-heading)' }}>Profile</h4>
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSave}>
            <div className="mb-3">
              <label className="form-label">Username</label>
              <input className="form-control" value={user?.username || ''} disabled
                style={{ background: 'var(--kl-bg-elevated)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-secondary)' }} />
            </div>
            <div className="mb-3">
              <label className="form-label">Display Name</label>
              <input className="form-control" value={displayName} onChange={e => setDisplayName(e.target.value)}
                style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }} />
            </div>
            <div className="mb-3">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={email} onChange={e => setEmail(e.target.value)}
                style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
