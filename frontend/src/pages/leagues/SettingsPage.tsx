import { useParams } from 'react-router'
import { useState, useEffect } from 'react'
import { api, post } from '../../lib/api'
import { useLeague } from '../../contexts/LeagueContext'
import { useToast } from '../../components/ui/Toast'
import { Spinner } from '../../components/ui/Spinner'

interface SettingsData {
  name: string
  season_year: number
  invite_code: string
  max_roster_size: number
  trade_review_hours: number
  lineup_lock: string
}

export function SettingsPage() {
  const { leagueId } = useParams()
  const { refresh } = useLeague()
  const { toast } = useToast()
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api<SettingsData>(`/api/leagues/${leagueId}/settings`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [leagueId])

  if (loading || !data) return <Spinner />

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await post(`/api/leagues/${leagueId}/settings`, data)
      refresh()
      toast('Settings saved', 'success')
    } catch { toast('Failed to save', 'error') }
    setSaving(false)
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">League Settings</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <Field label="League Name" value={data.name} onChange={v => setData({ ...data, name: v })} />
        <Field label="Season Year" value={String(data.season_year)} onChange={v => setData({ ...data, season_year: Number(v) })} type="number" />
        <div>
          <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Invite Code</label>
          <div className="flex gap-2">
            <input value={data.invite_code} readOnly
              className="flex-1 px-3 py-2.5 rounded-xl bg-[#161b22] border border-[#21262d] text-sm text-[#e6edf3]" />
            <button type="button" onClick={() => { navigator.clipboard.writeText(data.invite_code); toast('Copied!', 'success') }}
              className="px-3 py-2 rounded-xl bg-[#21262d] text-xs font-bold text-[#8b949e] hover:text-[#e6edf3] transition">
              Copy
            </button>
          </div>
        </div>
        <Field label="Max Roster Size" value={String(data.max_roster_size)} onChange={v => setData({ ...data, max_roster_size: Number(v) })} type="number" />
        <Field label="Trade Review Hours" value={String(data.trade_review_hours)} onChange={v => setData({ ...data, trade_review_hours: Number(v) })} type="number" />

        <button type="submit" disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#58a6ff] text-sm font-bold text-white hover:bg-[#388bfd] transition disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#8b949e] mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition" />
    </div>
  )
}
