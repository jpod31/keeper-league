import { useState } from 'react'
import { useNavigate } from 'react-router'
import { post } from '../../lib/api'
import { useToast } from '../../components/ui/Toast'

export function CreateLeaguePage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await post<{ league_id: number }>('/api/leagues/create', { name: name.trim(), team_name: teamName.trim() })
      toast('League created!', 'success')
      navigate(`/leagues/${res.league_id}`)
    } catch {
      toast('Failed to create league', 'error')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">Create League</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1.5">League Name</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus required
            className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Your Team Name</label>
          <input value={teamName} onChange={e => setTeamName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition" />
        </div>
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#58a6ff] text-sm font-bold text-white hover:bg-[#388bfd] transition disabled:opacity-50">
          {saving ? 'Creating...' : 'Create League'}
        </button>
      </form>
    </div>
  )
}
