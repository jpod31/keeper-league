/**
 * MessagesPage — unified messenger. Left: conversation list with League
 * Chat pinned at the top as a group chat, then 1:1 DMs. Right: the active
 * thread (ChatPane). League chat is just the default/pinned conversation.
 *
 * Routes: /messages (no convoId → league chat active on desktop, list on
 * mobile) and /messages/:convoId where convoId is 'league' or a DM id.
 */
import { useParams, useNavigate } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { ChatPane } from './ChatPane'

interface Conversation {
  id: number
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
  const d = new Date(iso.includes('Z') || iso.includes('+') ? iso : iso + 'Z')
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString()
}

function initials(name: string): string {
  const w = (name || '').replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase()
  return (w[0] || '?').slice(0, 2).toUpperCase()
}

export function MessagesPage() {
  const { leagueId, convoId } = useParams()
  const navigate = useNavigate()
  const { data, loading, refetch } = useFetch<InboxData>(`/leagues/${leagueId}/messages?format=json`)
  const [newOpen, setNewOpen] = useState(false)
  const [newRecipient, setNewRecipient] = useState<number | null>(null)
  const [newBody, setNewBody] = useState('')
  const [sending, setSending] = useState(false)

  // Active selection: 'league' (default) or a DM id. On mobile, no convoId
  // means show the LIST; on desktop it means League Chat.
  const isLeague = !convoId || convoId === 'league'
  const showThread = !!convoId // mobile: a thread is open only if URL has a segment

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
        setNewBody(''); setNewRecipient(null); setNewOpen(false)
        refetch()
      }
    } finally { setSending(false) }
  }

  if (loading || !data) {
    return (
      <div className="msgr">
        <div className="msgr-list"><div className="msgr-list-head"><span>Messages</span></div>
          <div className="text-secondary py-4 text-center" style={{ fontSize: '.82rem' }}>Loading…</div>
        </div>
        <div className="msgr-thread" />
      </div>
    )
  }

  const activeConvo = !isLeague ? data.conversations.find(c => String(c.id) === convoId) : null
  const threadTitle = isLeague ? `${data.league.name} · League Chat` : (activeConvo?.other_team_name || 'Conversation')
  const threadSub = isLeague ? 'Everyone in the league' : (activeConvo?.other_team_owner || '')

  return (
    <div className={`msgr${showThread ? ' show-thread' : ''}`}>
      {/* ── Conversation list ── */}
      <div className="msgr-list">
        <div className="msgr-list-head">
          <span><i className="bi bi-chat-dots me-2"></i>Messages</span>
          <button type="button" className="msgr-new-btn" title="New direct message" onClick={() => setNewOpen(o => !o)}>
            <i className="bi bi-pencil-square"></i>
          </button>
        </div>

        {newOpen && (
          <div className="msgr-new">
            <select className="form-select form-select-sm" value={newRecipient ?? ''} onChange={e => setNewRecipient(Number(e.target.value) || null)}>
              <option value="">New message to…</option>
              {data.all_teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.owner})</option>)}
            </select>
            <textarea className="form-control form-control-sm mt-2" rows={2} placeholder="Message…" value={newBody} onChange={e => setNewBody(e.target.value)} />
            <button className="btn btn-primary btn-sm w-100 mt-2" disabled={!newRecipient || !newBody.trim() || sending} onClick={startConversation}>
              <i className="bi bi-send me-1"></i>Send
            </button>
          </div>
        )}

        {/* League chat — pinned group conversation */}
        <button
          type="button"
          className={`msgr-convo msgr-convo-league${isLeague ? ' active' : ''}`}
          onClick={() => navigate(`/leagues/${leagueId}/messages/league`)}
        >
          <span className="msgr-avatar msgr-avatar-group"><i className="bi bi-hash"></i></span>
          <span className="msgr-convo-body">
            <span className="msgr-convo-name">League Chat</span>
            <span className="msgr-convo-preview">Everyone in {data.league.name}</span>
          </span>
        </button>

        <div className="msgr-list-divider">Direct messages</div>

        {data.conversations.length === 0 ? (
          <div className="msgr-empty-dm">No DMs yet. Hit <i className="bi bi-pencil-square"></i> to message a team.</div>
        ) : data.conversations.map(c => (
          <button
            key={c.id}
            type="button"
            className={`msgr-convo${String(c.id) === convoId ? ' active' : ''}${c.unread ? ' unread' : ''}`}
            onClick={() => navigate(`/leagues/${leagueId}/messages/${c.id}`)}
          >
            <span className="msgr-avatar">{initials(c.other_team_name)}</span>
            <span className="msgr-convo-body">
              <span className="msgr-convo-name">{c.other_team_name}</span>
              <span className="msgr-convo-preview">{c.last_message_body || '—'}</span>
            </span>
            <span className="msgr-convo-meta">
              <span className="msgr-convo-time">{relTime(c.last_message_at)}</span>
              {c.unread > 0 && <span className="msgr-unread-badge">{c.unread}</span>}
            </span>
          </button>
        ))}
      </div>

      {/* ── Active thread ── */}
      <div className="msgr-thread">
        <div className="msgr-thread-head">
          <button type="button" className="msgr-back" onClick={() => navigate(`/leagues/${leagueId}/messages`)} aria-label="Back to messages">
            <i className="bi bi-arrow-left"></i>
          </button>
          <span className={`msgr-avatar${isLeague ? ' msgr-avatar-group' : ''}`}>
            {isLeague ? <i className="bi bi-hash"></i> : initials(threadTitle)}
          </span>
          <span className="msgr-thread-title">
            <span className="msgr-thread-name">{isLeague ? 'League Chat' : threadTitle}</span>
            <span className="msgr-thread-sub">{threadSub}</span>
          </span>
        </div>

        {isLeague ? (
          <ChatPane key="league" leagueId={leagueId!} mode="league" />
        ) : activeConvo ? (
          <ChatPane key={`dm-${convoId}`} leagueId={leagueId!} mode="dm" convoId={convoId} onSent={refetch} />
        ) : (
          <div className="msgr-thread-body"><div className="text-secondary text-center py-4" style={{ fontSize: '.82rem' }}>Conversation not found.</div></div>
        )}
      </div>
    </div>
  )
}
