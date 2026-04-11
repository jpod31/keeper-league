import { useParams, Link } from 'react-router'
import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { useSocket } from '../../hooks/useSocket'

interface Message {
  id: number
  sender_user_id: number
  sender_name: string
  body: string
  created_at: string | null
  is_read: boolean
}

interface ConvoData {
  league: { id: number; name: string }
  user_team: { id: number; name: string }
  current_user_id: number
  convo: { id: number }
  other_team: { id: number; name: string; owner: string }
  messages: Message[]
}

function fmtTime(ts: string | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function ConversationPage() {
  const { leagueId, convoId } = useParams()
  const [data, setData] = useState<ConvoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentUserRef = useRef<number | null>(null)

  useEffect(() => {
    api<ConvoData>(`/leagues/${leagueId}/messages/${convoId}?format=json`)
      .then(d => {
        setData(d)
        setMessages(d.messages)
        currentUserRef.current = d.current_user_id
      })
      .finally(() => setLoading(false))
  }, [leagueId, convoId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  useSocket({
    namespace: '/notifications',
    onConnect: s => s.emit('join_conversation', { conversation_id: Number(convoId) }),
    events: {
      new_message: p => {
        const m = p as { conversation_id: number; sender_user_id: number; sender_name: string; body: string; created_at: string }
        if (m.conversation_id !== Number(convoId)) return
        if (m.sender_user_id === currentUserRef.current) return
        setMessages(prev => [...prev, {
          id: Date.now(),
          sender_user_id: m.sender_user_id,
          sender_name: m.sender_name,
          body: m.body,
          created_at: m.created_at,
          is_read: false,
        }])
      },
    },
  })

  if (loading) return <Spinner text="Loading conversation..." />
  if (!data) return <p className="text-danger">Failed to load conversation</p>

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = input.trim()
    if (!body) return
    setInput('')
    const optimistic: Message = {
      id: Date.now(),
      sender_user_id: data!.current_user_id,
      sender_name: 'You',
      body,
      created_at: new Date().toISOString(),
      is_read: false,
    }
    setMessages(prev => [...prev, optimistic])
    const fd = new FormData()
    fd.set('conversation_id', String(convoId))
    fd.set('body', body)
    try {
      await fetch(`/leagues/${leagueId}/messages/send`, {
        method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual',
      })
    } catch { /* ignore */ }
  }

  return (
    <div>
      <div className="page-header">
        <div className="d-flex align-items-center gap-3">
          <Link to={`/leagues/${leagueId}/messages`} className="text-secondary">
            <i className="bi bi-arrow-left"></i>
          </Link>
          <div>
            <h2 className="mb-0">{data.other_team.name}</h2>
            <div className="text-secondary" style={{ fontSize: '.75rem' }}>{data.other_team.owner}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ height: 'calc(100dvh - 260px)', display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollRef} className="card-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {messages.map(m => {
            const isMine = m.sender_user_id === data.current_user_id
            return (
              <div key={m.id} className={`d-flex mb-2 ${isMine ? 'justify-content-end' : ''}`}>
                <div style={{
                  maxWidth: '70%',
                  padding: '.5rem .75rem',
                  borderRadius: 10,
                  background: isMine ? 'rgba(88,166,255,.15)' : 'var(--kl-bg-elevated)',
                }}>
                  <div style={{ fontSize: '.85rem' }}>{m.body}</div>
                  <div style={{ fontSize: '.6rem', color: 'var(--kl-text-muted)', marginTop: 2 }}>
                    {fmtTime(m.created_at)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="card-footer" style={{ borderTop: '1px solid var(--kl-border)', padding: '.75rem' }}>
          <form className="d-flex gap-2" onSubmit={send}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Type a message..."
              autoComplete="off"
              maxLength={500}
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm px-3">
              <i className="bi bi-send"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
