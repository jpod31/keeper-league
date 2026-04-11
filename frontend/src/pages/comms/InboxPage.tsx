import { useParams, useNavigate } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { CommsSubnav } from '../../components/nav/CommsSubnav'

interface Conversation {
  id: number
  other_team_id: number | null
  other_team_name: string
  other_team_owner: string
  unread: number
  last_message_body: string | null
  last_message_at: string | null
}

interface InboxData {
  league: { id: number; name: string }
  user_team: { id: number; name: string }
  conversations: Conversation[]
  all_teams: { id: number; name: string; owner: string }[]
}

function relTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString()
}

export function InboxPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const { data, loading } = useFetch<InboxData>(`/leagues/${leagueId}/messages?format=json`)
  const [newRecipient, setNewRecipient] = useState<number | null>(null)
  const [newBody, setNewBody] = useState('')
  const [sending, setSending] = useState(false)

  if (loading) return <Spinner text="Loading messages..." />
  if (!data) return <p className="text-danger">Failed to load messages</p>

  async function startConversation() {
    if (!newRecipient || !newBody.trim()) return
    setSending(true)
    const fd = new FormData()
    fd.set('recipient_team_id', String(newRecipient))
    fd.set('body', newBody.trim())
    try {
      const res = await fetch(`/leagues/${leagueId}/messages/send`, {
        method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual',
      })
      if (res.status < 500) {
        setNewBody('')
        setNewRecipient(null)
        window.location.reload()
      }
    } finally { setSending(false) }
  }

  return (
    <div>
      <CommsSubnav active="messages" leagueId={leagueId!} />
      <div className="page-header">
        <h2><i className="bi bi-envelope me-2" style={{ color: '#58a6ff' }}></i>Messages</h2>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Conversations</h5>
            </div>
            <div className="card-body p-0">
              {data.conversations.length === 0 ? (
                <div className="text-center text-secondary py-5">
                  <i className="bi bi-chat-dots" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }}></i>
                  No conversations yet
                </div>
              ) : (
                data.conversations.map(c => (
                  <div
                    key={c.id}
                    className="d-flex justify-content-between align-items-center"
                    style={{
                      padding: '.75rem 1rem',
                      borderBottom: '1px solid var(--kl-border)',
                      cursor: 'pointer',
                      background: c.unread ? 'rgba(88,166,255,.04)' : 'transparent',
                    }}
                    onClick={() => navigate(`/leagues/${leagueId}/messages/${c.id}`)}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="d-flex align-items-center gap-2">
                        <strong style={{ fontSize: '.9rem' }}>{c.other_team_name}</strong>
                        {c.unread > 0 && (
                          <span className="badge bg-danger">{c.unread}</span>
                        )}
                      </div>
                      <div className="text-secondary" style={{
                        fontSize: '.75rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {c.last_message_body}
                      </div>
                    </div>
                    <span className="text-secondary" style={{ fontSize: '.7rem' }}>{relTime(c.last_message_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>New Message</h5></div>
            <div className="card-body">
              <div className="mb-2">
                <label className="form-label" style={{ fontSize: '.75rem' }}>Send to</label>
                <select className="form-select form-select-sm" value={newRecipient ?? ''} onChange={e => setNewRecipient(Number(e.target.value) || null)}>
                  <option value="">Select team…</option>
                  {data.all_teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.owner})</option>)}
                </select>
              </div>
              <div className="mb-2">
                <textarea className="form-control form-control-sm" rows={3} placeholder="Message..." value={newBody} onChange={e => setNewBody(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-sm w-100" disabled={!newRecipient || !newBody.trim() || sending} onClick={startConversation}>
                <i className="bi bi-send me-1"></i>Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
