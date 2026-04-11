import { useParams } from 'react-router'
import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { CommsSubnav } from '../../components/nav/CommsSubnav'
import { useSocket } from '../../hooks/useSocket'
import { ConnectionBanner } from '../../components/ui/ConnectionBanner'

interface ChatMessage {
  id: number
  sender_user_id: number
  sender_name: string
  body: string
  created_at: string | null
}

interface ChatData {
  league: { id: number; name: string }
  current_user_id: number
  messages: ChatMessage[]
}

function fmtTime(ts: string | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts.includes('Z') ? ts : ts + 'Z')
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

export function LeagueChatPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<ChatData | null>(null)
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentUserIdRef = useRef<number | null>(null)

  useEffect(() => {
    api<ChatData>(`/leagues/${leagueId}/chat?format=json`)
      .then(d => {
        setData(d)
        setMessages(d.messages)
        currentUserIdRef.current = d.current_user_id
      })
      .finally(() => setLoading(false))
  }, [leagueId])

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const { state: conn } = useSocket({
    namespace: '/notifications',
    onConnect: s => s.emit('join_league_chat', { league_id: Number(leagueId) }),
    events: {
      chat_message: p => {
        const msg = p as ChatMessage
        if (msg.sender_user_id === currentUserIdRef.current) return
        setMessages(prev => [...prev, msg])
      },
    },
  })

  if (loading) return <Spinner text="Loading chat..." />
  if (!data) return <p className="text-danger">Failed to load chat</p>

  const { current_user_id } = data

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = input.trim()
    if (!body) return
    setInput('')

    // Optimistic append
    const optimistic: ChatMessage = {
      id: Date.now(),
      sender_user_id: current_user_id,
      sender_name: 'You',
      body,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])

    try {
      await fetch(`/leagues/${leagueId}/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
        credentials: 'include',
      })
    } catch (err) {
      console.error('Failed to send:', err)
    }
  }

  return (
    <div>
      <ConnectionBanner state={conn} />
      <CommsSubnav active="chat" leagueId={leagueId!} />
      <div className="page-header">
        <div className="d-flex align-items-center justify-content-between">
          <h2><i className="bi bi-chat-dots me-2" style={{ color: 'var(--kl-accent-blue)' }}></i>League Chat</h2>
        </div>
      </div>

      <div className="card chat-wrapper" style={{ height: 'calc(100dvh - 260px)', display: 'flex', flexDirection: 'column' }}>
        <div ref={scrollRef} className="card-body" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {messages.length === 0 && (
            <div className="text-center text-secondary py-4" style={{ fontSize: '.85rem' }}>
              <i className="bi bi-chat-dots" style={{ fontSize: '2rem', display: 'block', marginBottom: '.5rem', color: 'var(--kl-border-light)' }}></i>
              No messages yet. Start the conversation!
            </div>
          )}
          {messages.map(m => {
            const isMine = m.sender_user_id === current_user_id
            return (
              <div key={m.id} className={`d-flex mb-2 ${isMine ? 'justify-content-end' : ''}`}>
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '.5rem .75rem',
                    borderRadius: 10,
                    background: isMine ? 'rgba(88,166,255,.15)' : 'var(--kl-bg-elevated)',
                  }}
                >
                  {!isMine && (
                    <div style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--kl-accent-blue)', marginBottom: 2 }}>
                      {m.sender_name}
                    </div>
                  )}
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
