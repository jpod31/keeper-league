/**
 * ChatPane — the right-hand thread of the messenger. Handles BOTH the
 * league group chat and 1:1 DMs behind one component, since they're the
 * same UI (message list + composer + live socket), only the endpoints
 * and socket rooms differ.
 *
 *   mode="league" → GET /chat, POST /chat/send (JSON), room join_league_chat, event chat_message
 *   mode="dm"     → GET /messages/:id, POST /messages/send (form), room join_conversation, event new_message
 */
import { useState, useEffect, useRef } from 'react'
import { api } from '../../lib/api'
import { useSocket } from '../../hooks/useSocket'

interface Msg {
  id: number
  sender_user_id: number
  sender_name: string
  body: string
  created_at: string | null
}

function fmtTime(ts: string | null): string {
  if (!ts) return ''
  try {
    const d = new Date(ts.includes('Z') || ts.includes('+') ? ts : ts + 'Z')
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch { return '' }
}

export function ChatPane({ leagueId, mode, convoId, onSent }: {
  leagueId: string
  mode: 'league' | 'dm'
  convoId?: string
  onSent?: () => void
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const meRef = useRef<number | null>(null)

  // NOTE: the parent keys this component per conversation, so it remounts
  // on switch — that re-runs the socket effect (joins the right room) and
  // refetches. useSocket joins its room in onConnect, which fires on the
  // fresh mount's connect.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const url = mode === 'league'
      ? `/leagues/${leagueId}/chat?format=json`
      : `/leagues/${leagueId}/messages/${convoId}?format=json`
    api<{ current_user_id: number; messages: Msg[] }>(url)
      .then(d => {
        if (cancelled) return
        meRef.current = d.current_user_id
        setMessages(d.messages || [])
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [leagueId, mode, convoId])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  useSocket({
    namespace: '/notifications',
    onConnect: s => {
      if (mode === 'league') s.emit('join_league_chat', { league_id: Number(leagueId) })
      else s.emit('join_conversation', { conversation_id: Number(convoId) })
    },
    events: mode === 'league'
      ? {
          chat_message: p => {
            const m = p as Msg
            if (m.sender_user_id === meRef.current) return
            setMessages(prev => [...prev, m])
          },
        }
      : {
          new_message: p => {
            const m = p as { conversation_id: number; sender_user_id: number; sender_name: string; body: string; created_at: string }
            if (m.conversation_id !== Number(convoId)) return
            if (m.sender_user_id === meRef.current) return
            setMessages(prev => [...prev, { id: Date.now(), sender_user_id: m.sender_user_id, sender_name: m.sender_name, body: m.body, created_at: m.created_at }])
          },
        },
  })

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = input.trim()
    if (!body) return
    setInput('')
    setMessages(prev => [...prev, { id: Date.now(), sender_user_id: meRef.current ?? -1, sender_name: 'You', body, created_at: new Date().toISOString() }])
    try {
      if (mode === 'league') {
        await fetch(`/leagues/${leagueId}/chat/send`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }), credentials: 'include',
        })
      } else {
        const fd = new FormData()
        fd.set('conversation_id', String(convoId))
        fd.set('body', body)
        await fetch(`/leagues/${leagueId}/messages/send`, { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' })
      }
      onSent?.()
    } catch { /* optimistic already shown */ }
  }

  return (
    <>
      <div ref={scrollRef} className="msgr-thread-body">
        {loading ? (
          <div className="text-center text-secondary py-4" style={{ fontSize: '.82rem' }}>Loading…</div>
        ) : messages.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><i className="bi bi-chat-text"></i></div>
            <h4>{mode === 'league' ? 'No messages yet' : 'Start the conversation'}</h4>
            <p>{mode === 'league' ? 'Kick off the league chat — share a take or rattle a trade partner.' : 'Say hi — propose a trade, ask a question, or shoot the breeze.'}</p>
          </div>
        ) : messages.map(m => {
          const mine = m.sender_user_id === meRef.current
          return (
            <div key={m.id} className={`msgr-row${mine ? ' mine' : ''}`}>
              <div className="msgr-bubble">
                {!mine && mode === 'league' && <div className="msgr-sender">{m.sender_name}</div>}
                <div className="msgr-text">{m.body}</div>
                <div className="msgr-time">{fmtTime(m.created_at)}</div>
              </div>
            </div>
          )
        })}
      </div>
      <form className="msgr-composer" onSubmit={send}>
        <input
          type="text" className="form-control form-control-sm"
          placeholder="Type a message…" autoComplete="off" maxLength={500}
          value={input} onChange={e => setInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-sm px-3"><i className="bi bi-send"></i></button>
      </form>
    </>
  )
}
