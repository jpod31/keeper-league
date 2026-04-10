import { Link } from 'react-router'
import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface ProfileTeam {
  id: number
  league_id: number
  name: string
  logo_url: string | null
  logo_prompt: string | null
  league_name: string
  league_year: number | null
}

interface NotifPref {
  in_app: boolean
  push: boolean
  email: boolean
}

interface ProfileData {
  user: {
    id: number
    username: string
    display_name: string | null
    email: string | null
    created_at: string | null
    email_digest_enabled: boolean
    push_subscription: boolean
  }
  notif_prefs: Record<string, NotifPref>
  teams: ProfileTeam[]
}

const NOTIF_TYPES: [string, string][] = [
  ['trade_received', 'Trade Received'],
  ['trade_accepted', 'Trade Accepted'],
  ['trade_rejected', 'Trade Rejected'],
  ['trade_vetoed', 'Trade Vetoed'],
  ['player_delisted', 'Player Delisted'],
  ['message_received', 'Message Received'],
  ['season_transition', 'Season Change'],
]

const PROFILE_CSS = `
.prof-team-logo { flex-shrink: 0; }
.prof-team-logo-img { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; border: 2px solid var(--kl-border); box-shadow: 0 4px 12px rgba(0,0,0,.3); }
.prof-team-logo-ph { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(145deg, #0d3618, #238636, #3fb950); color: #fff; font-weight: 800; font-size: .95rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,.3); letter-spacing: .5px; }
.prof-logo-btn { background: rgba(210,153,34,.1); border: 1px solid rgba(210,153,34,.3); color: #d29922; font-size: .72rem; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; white-space: nowrap; }
.prof-logo-btn:hover { background: rgba(210,153,34,.2); }
.logo-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,.85); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 16px; }
.logo-modal { background: #161b22; border: 1px solid #30363d; border-radius: 12px; max-width: 480px; width: 100%; max-height: 90vh; overflow-y: auto; }
.logo-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #30363d; }
.logo-modal-header h3 { margin: 0; font-size: 1rem; color: #e6edf3; font-weight: 700; }
.logo-modal-close { background: transparent; border: none; color: #8b949e; font-size: 1.2rem; cursor: pointer; }
.logo-modal-close:hover { color: #e6edf3; }
.logo-modal-body { padding: 20px; }
.logo-modal-current { text-align: center; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #21262d; }
.logo-modal-preview { width: 96px; height: 96px; border-radius: 14px; object-fit: cover; }
.logo-modal-prev-prompt { font-size: .7rem; color: #6e7681; margin-top: 6px; font-style: italic; }
.logo-modal-label { display: block; font-size: .85rem; font-weight: 600; color: #c9d1d9; margin-bottom: 6px; }
.logo-modal-input { width: 100%; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 8px 10px; font-size: .85rem; color: #c9d1d9; resize: vertical; }
.logo-modal-input:focus { outline: none; border-color: #58a6ff; }
.logo-modal-hint { font-size: .7rem; color: #6e7681; margin-top: 6px; }
.logo-modal-error { background: rgba(248,81,73,.1); border: 1px solid rgba(248,81,73,.3); color: #f85149; padding: 8px 12px; border-radius: 6px; font-size: .78rem; margin-top: 10px; }
.logo-modal-generate { width: 100%; margin-top: 12px; padding: 10px; background: linear-gradient(135deg, #d29922, #f0883e); color: #fff; border: none; border-radius: 6px; font-size: .85rem; font-weight: 700; cursor: pointer; }
.logo-modal-generate:hover { opacity: .9; }
.logo-modal-generate:disabled { opacity: .5; cursor: not-allowed; }
.logo-modal-loading { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 30px 0; color: #8b949e; font-size: .85rem; }
.logo-spinner { width: 36px; height: 36px; border: 3px solid #30363d; border-top-color: #d29922; border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.logo-modal-result-img { width: 100%; max-width: 280px; border-radius: 14px; display: block; margin: 0 auto 14px; }
.logo-result-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.logo-btn-accept, .logo-btn-regen, .logo-btn-close { padding: 8px 14px; font-size: .78rem; font-weight: 600; border-radius: 6px; cursor: pointer; border: 1px solid; }
.logo-btn-accept { background: rgba(63,185,80,.15); color: #3fb950; border-color: rgba(63,185,80,.3); }
.logo-btn-regen { background: rgba(210,153,34,.15); color: #d29922; border-color: rgba(210,153,34,.3); }
.logo-btn-close { background: transparent; color: #8b949e; border-color: #30363d; }
`

export function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [pushBtnText, setPushBtnText] = useState('Enable')

  // Logo modal state
  const [logoModalTeam, setLogoModalTeam] = useState<ProfileTeam | null>(null)
  const [logoPrompt, setLogoPrompt] = useState('')
  const [logoState, setLogoState] = useState<'input' | 'loading' | 'result'>('input')
  const [logoResultUrl, setLogoResultUrl] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)

  function refetch() {
    api<ProfileData>('/auth/profile?format=json')
      .then(d => {
        setData(d)
        setDisplayName(d.user.display_name || '')
        setEmail(d.user.email || '')
        setPushBtnText(d.user.push_subscription ? 'Enabled' : 'Enable')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { refetch() }, [])

  if (loading) return <Spinner text="Loading profile..." />
  if (!data) return <p className="text-danger">Failed to load profile</p>

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const form = new FormData()
      form.set('display_name', displayName)
      form.set('email', email)
      const res = await fetch('/auth/profile', {
        method: 'POST',
        body: form,
        credentials: 'include',
        redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      setMsg({ kind: 'success', text: 'Profile updated.' })
      refetch()
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function toggleDigest(on: boolean) {
    try {
      await fetch('/auth/notification-prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest_enabled: on }),
        credentials: 'include',
      })
      refetch()
    } catch (err) { console.error(err) }
  }

  async function toggleNotifPref(notifType: string, channel: 'in_app' | 'push' | 'email', enabled: boolean) {
    try {
      await fetch('/auth/notification-prefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notif_type: notifType, channel, enabled }),
        credentials: 'include',
      })
      refetch()
    } catch (err) { console.error(err) }
  }

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const arr = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i)
    return arr
  }

  async function enablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.')
      return
    }
    try {
      const r = await fetch('/push/vapid-key', { credentials: 'include' })
      const d = await r.json()
      if (!d.publicKey) { alert('Push not configured on server.'); return }
      const reg = await navigator.serviceWorker.ready
      const key = urlBase64ToUint8Array(d.publicKey)
      // Cast to BufferSource — Uint8Array is valid but TS lib expects ArrayBuffer-backed view
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key as unknown as BufferSource })
      await fetch('/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
        credentials: 'include',
      })
      setPushBtnText('Enabled')
    } catch (err) {
      alert(`Failed to enable push: ${(err as Error).message}`)
    }
  }

  function openLogoModal(team: ProfileTeam) {
    setLogoModalTeam(team)
    setLogoPrompt(team.logo_prompt || '')
    setLogoState('input')
    setLogoResultUrl(null)
    setLogoError(null)
  }

  function closeLogoModal() {
    setLogoModalTeam(null)
    setLogoState('input')
    setLogoResultUrl(null)
    setLogoError(null)
  }

  async function generateLogo() {
    if (!logoModalTeam) return
    const trimmed = logoPrompt.trim()
    if (!trimmed) {
      setLogoError('Please describe your logo.')
      return
    }
    setLogoError(null)
    setLogoState('loading')
    try {
      const res = await fetch(`/leagues/${logoModalTeam.league_id}/team/${logoModalTeam.id}/generate-logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: trimmed }),
        credentials: 'include',
      })
      const d = await res.json().catch(() => ({} as { logo_url?: string; error?: string }))
      if (!res.ok) {
        setLogoState('input')
        setLogoError(d.error || 'Generation failed.')
        return
      }
      setLogoResultUrl(d.logo_url ? `${d.logo_url}?t=${Date.now()}` : null)
      setLogoState('result')
    } catch (err) {
      setLogoState('input')
      setLogoError(`Network error: ${(err as Error).message}`)
    }
  }

  function acceptLogo() {
    closeLogoModal()
    refetch()
  }

  function regenerateLogo() {
    setLogoState('input')
    setLogoResultUrl(null)
  }

  const u = data.user
  const initial = ((u.display_name || u.username) || '?')[0].toUpperCase()

  return (
    <div className="row justify-content-center">
      <style>{PROFILE_CSS}</style>
      <div className="col-md-5">
        <div className="page-header">
          <h2>Profile</h2>
        </div>

        {/* User card */}
        <div className="card mb-4">
          <div className="card-body p-4">
            <div className="text-center mb-4">
              <span
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-2"
                style={{
                  width: 64, height: 64,
                  background: 'linear-gradient(135deg,#238636,#1f6feb)',
                  fontSize: '1.5rem', fontWeight: 700, color: '#fff',
                }}
              >
                {initial}
              </span>
              <div className="fw-bold">{u.display_name || u.username}</div>
              <div className="text-secondary" style={{ fontSize: '.8rem' }}>
                @{u.username} · Joined {u.created_at}
              </div>
            </div>
            {msg && (
              <div className={`alert alert-${msg.kind === 'success' ? 'success' : 'danger'}`} style={{ fontSize: '.85rem' }}>
                {msg.text}
              </div>
            )}
            <form onSubmit={handleSave}>
              <div className="mb-3">
                <label htmlFor="display_name" className="form-label">Display Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="display_name"
                  value={displayName}
                  maxLength={80}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="card mb-4">
          <div className="card-body p-4">
            <h5 className="fw-bold mb-3" style={{ fontSize: '.95rem' }}>Notification Preferences</h5>

            {/* Digest */}
            <div
              className="d-flex justify-content-between align-items-center mb-3 pb-3"
              style={{ borderBottom: '1px solid var(--kl-border)' }}
            >
              <div>
                <div className="fw-semibold" style={{ fontSize: '.85rem' }}>Weekly Email Digest</div>
                <div className="text-secondary" style={{ fontSize: '.75rem' }}>
                  Receive a summary of the week's activity every Monday
                </div>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={u.email_digest_enabled}
                  onChange={e => toggleDigest(e.target.checked)}
                />
              </div>
            </div>

            {/* Push */}
            <div
              className="d-flex justify-content-between align-items-center mb-3 pb-3"
              style={{ borderBottom: '1px solid var(--kl-border)' }}
            >
              <div>
                <div className="fw-semibold" style={{ fontSize: '.85rem' }}>Push Notifications</div>
                <div className="text-secondary" style={{ fontSize: '.75rem' }}>
                  Browser notifications when events happen
                </div>
              </div>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={enablePush}
                style={{ fontSize: '.75rem' }}
              >
                {pushBtnText}
              </button>
            </div>

            {/* Per-type matrix */}
            <div style={{ fontSize: '.8rem', color: 'var(--kl-text-secondary)', marginBottom: 8 }}>
              Choose channels for each notification type:
            </div>
            <table className="table table-sm mb-0" style={{ fontSize: '.8rem' }}>
              <thead>
                <tr>
                  <th style={{ border: 0 }}>Type</th>
                  <th className="text-center" style={{ border: 0, width: 60 }}>In-App</th>
                  <th className="text-center" style={{ border: 0, width: 60 }}>Push</th>
                  <th className="text-center" style={{ border: 0, width: 60 }}>Email</th>
                </tr>
              </thead>
              <tbody>
                {NOTIF_TYPES.map(([key, label]) => {
                  const pref = data.notif_prefs[key] || { in_app: true, push: false, email: false }
                  return (
                    <tr key={key}>
                      <td>{label}</td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={pref.in_app}
                          onChange={e => toggleNotifPref(key, 'in_app', e.target.checked)}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={pref.push}
                          onChange={e => toggleNotifPref(key, 'push', e.target.checked)}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={pref.email}
                          onChange={e => toggleNotifPref(key, 'email', e.target.checked)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Your teams */}
        <h5 className="fw-bold mb-3">Your Teams</h5>
        {data.teams.length > 0 ? (
          data.teams.map(team => (
            <div key={team.id} className="card mb-3" style={{ borderColor: 'var(--kl-border)' }}>
              <div className="card-body p-3">
                <div className="d-flex align-items-center gap-3">
                  <div className="prof-team-logo">
                    {team.logo_url ? (
                      <img src={team.logo_url} alt={team.name} className="prof-team-logo-img" />
                    ) : (
                      <div className="prof-team-logo-ph">{team.name.substring(0, 2).toUpperCase()}</div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link
                      to={`/leagues/${team.league_id}`}
                      className="fw-bold text-decoration-none"
                      style={{ color: 'var(--kl-text-heading)', fontSize: '.9rem' }}
                    >
                      {team.name}
                    </Link>
                    <div style={{ fontSize: '.75rem', color: 'var(--kl-text-faint)' }}>
                      {team.league_name} · {team.league_year}
                    </div>
                  </div>
                  <button className="prof-logo-btn" onClick={() => openLogoModal(team)}>
                    <i className="bi bi-stars me-1"></i>{team.logo_url ? 'Edit Logo' : 'Create Logo'}
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-secondary" style={{ fontSize: '.85rem' }}>You haven't joined any leagues yet.</p>
        )}
      </div>

      {/* Logo modal */}
      {logoModalTeam && (
        <div className="logo-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeLogoModal() }}>
          <div className="logo-modal">
            <div className="logo-modal-header">
              <h3><i className="bi bi-stars me-2" style={{ color: '#d29922' }}></i>Team Logo — {logoModalTeam.name}</h3>
              <button onClick={closeLogoModal} className="logo-modal-close"><i className="bi bi-x-lg"></i></button>
            </div>
            <div className="logo-modal-body">
              {logoModalTeam.logo_url && logoState === 'input' && (
                <div className="logo-modal-current">
                  <img src={logoModalTeam.logo_url} alt="Current logo" className="logo-modal-preview" />
                  {logoModalTeam.logo_prompt && (
                    <div className="logo-modal-prev-prompt">Prompt: {logoModalTeam.logo_prompt}</div>
                  )}
                </div>
              )}

              {logoState === 'input' && (
                <div>
                  <label className="logo-modal-label">Describe your team logo</label>
                  <textarea
                    className="logo-modal-input"
                    rows={3}
                    maxLength={400}
                    placeholder="e.g. A fierce red dragon breathing fire, with golden wings and a shield behind it"
                    value={logoPrompt}
                    onChange={e => setLogoPrompt(e.target.value)}
                  />
                  <div className="logo-modal-hint">
                    Be descriptive! Include colours, animals, symbols, or themes. Max 400 chars.
                  </div>
                  {logoError && <div className="logo-modal-error">{logoError}</div>}
                  <button className="logo-modal-generate" onClick={generateLogo}>
                    <i className="bi bi-stars me-1"></i>Generate Logo
                  </button>
                </div>
              )}

              {logoState === 'loading' && (
                <div className="logo-modal-loading">
                  <div className="logo-spinner"></div>
                  <span>Generating your logo... this takes ~15 seconds</span>
                </div>
              )}

              {logoState === 'result' && logoResultUrl && (
                <div>
                  <img src={logoResultUrl} alt="Generated logo" className="logo-modal-result-img" />
                  <div className="logo-result-actions">
                    <button onClick={acceptLogo} className="logo-btn-accept">
                      <i className="bi bi-check-lg me-1"></i>Accept
                    </button>
                    <button onClick={regenerateLogo} className="logo-btn-regen">
                      <i className="bi bi-arrow-clockwise me-1"></i>Regenerate
                    </button>
                    <button onClick={closeLogoModal} className="logo-btn-close">
                      <i className="bi bi-x-lg me-1"></i>Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
