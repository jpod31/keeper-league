import { useParams } from 'react-router'
import { useState, useEffect, useRef } from 'react'
import { api, post } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

interface ChatMsg {
  id: number
  author: string
  author_id: number
  text: string
  created: string
}

export function LeagueChatPage() {
  const { leagueId } = useParams()
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = () => {
    api<ChatMsg[]>(`/api/leagues/${leagueId}/chat`).then(setMessages).catch(() => {})
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [leagueId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await post(`/api/leagues/${leagueId}/chat/send`, { text: text.trim() })
      setText('')
      fetchMessages()
    } catch {}
    setSending(false)
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="fw-bold mb-0" style={{ color: 'var(--kl-text-heading)' }}>League Chat</h4>
      </div>

      <div className="card">
        <div className="card-body" style={{ height: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          {messages.length === 0 && (
            <div className="text-center py-5" style={{ color: 'var(--kl-text-faint)' }}>
              <i className="bi bi-chat-dots" style={{ fontSize: '2rem' }}></i>
              <p className="mt-2 mb-0" style={{ fontSize: '.85rem' }}>No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map(m => {
            const isMe = m.author_id === user?.id
            return (
              <div key={m.id} className={`d-flex mb-2${isMe ? ' justify-content-end' : ''}`}>
                <div style={{
                  maxWidth: '75%', padding: '8px 12px', borderRadius: 12,
                  background: isMe ? 'rgba(88,166,255,.1)' : 'var(--kl-bg-elevated)',
                  border: isMe ? '1px solid rgba(88,166,255,.2)' : '1px solid var(--kl-border)',
                }}>
                  {!isMe && <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--kl-accent-blue)', marginBottom: 2 }}>{m.author}</div>}
                  <div style={{ fontSize: '.85rem', color: 'var(--kl-text-primary)' }}>{m.text}</div>
                  <div style={{ fontSize: '.6rem', color: 'var(--kl-text-faint)', textAlign: 'right', marginTop: 2 }}>{m.created}</div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
        <div className="card-footer d-flex gap-2">
          <input className="form-control form-control-sm" value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            style={{ background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }} />
          <button className="btn btn-primary btn-sm" onClick={handleSend} disabled={sending || !text.trim()}>
            <i className="bi bi-send"></i>
          </button>
        </div>
      </div>
    </div>
  )
}
