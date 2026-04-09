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
    <div>
      <h4 className="fw-bold mb-4" style={{ color: 'var(--kl-text-heading)' }}>League Settings</h4>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header">
              <span className="fw-bold" style={{ fontSize: '.85rem' }}>General</span>
            </div>
            <div className="card-body">
              <form onSubmit={handleSave}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">League Name</label>
                    <input className="form-control" value={data.name} onChange={e => setData({ ...data, name: e.target.value })}
                      style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Season</label>
                    <input className="form-control" value={data.season_year} disabled
                      style={{ background: 'var(--kl-bg-elevated)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-secondary)' }} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Squad Size</label>
                    <input className="form-control" value={data.max_roster_size} disabled
                      style={{ background: 'var(--kl-bg-elevated)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-secondary)' }} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary btn-sm mt-3" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <span className="fw-bold" style={{ fontSize: '.85rem' }}>Invite</span>
            </div>
            <div className="card-body">
              <div className="info-row">
                <span className="info-label">Code</span>
                <span className="info-value">{data.invite_code}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
