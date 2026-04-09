import { useParams } from 'react-router'
import { useState, useEffect, useRef } from 'react'
import { api, post } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { Send } from 'lucide-react'

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
    api<ChatMsg[]>(`/api/leagues/${leagueId}/chat`).then(setMessages)
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
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-4">League Chat</h1>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
        {messages.map(m => {
          const isMe = m.author_id === user?.id
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                isMe ? 'bg-[#58a6ff]/15 border border-[#58a6ff]/20' : 'bg-[#0d1117] border border-[#21262d]'
              }`}>
                {!isMe && <p className="text-[10px] font-bold text-[#58a6ff] mb-0.5">{m.author}</p>}
                <p className="text-sm text-[#e6edf3]">{m.text}</p>
                <p className="text-[10px] text-[#484f58] mt-0.5 text-right">{m.created}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition" />
        <button onClick={handleSend} disabled={sending || !text.trim()}
          className="px-4 py-2.5 rounded-xl bg-[#58a6ff] text-white hover:bg-[#388bfd] transition disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
