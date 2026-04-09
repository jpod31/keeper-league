import { useParams } from 'react-router'
import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { api } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { Search, Clock, Send } from 'lucide-react'

interface DraftState {
  active: boolean
  completed: boolean
  current_pick: number
  current_team: { id: number; name: string }
  timer_remaining: number
  picks: { pick: number; team: string; player: string; position: string }[]
  round: number
  paused: boolean
}

interface AvailablePlayer {
  id: number
  name: string
  position: string
  afl_team: string
  sc_avg: number
  age: number
}

interface ChatMsg { author: string; text: string; time: string }

export function DraftRoomPage() {
  const { leagueId } = useParams()
  const { user } = useAuth()
  const socketRef = useRef<Socket | null>(null)
  const [state, setState] = useState<DraftState | null>(null)
  const [available, setAvailable] = useState<AvailablePlayer[]>([])
  const [search, setSearch] = useState('')
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')

  useEffect(() => {
    const socket = io('/draft', { withCredentials: true })
    socketRef.current = socket

    socket.on('connect', () => socket.emit('join_draft', { league_id: Number(leagueId) }))
    socket.on('draft_state', setState)
    socket.on('pick_made', () => {
      fetchAvailable()
      socket.emit('join_draft', { league_id: Number(leagueId) }) // refresh state
    })
    socket.on('timer_tick', ({ remaining }: { remaining: number }) => {
      setState(prev => prev ? { ...prev, timer_remaining: remaining } : prev)
    })
    socket.on('draft_chat_msg', (msg: ChatMsg) => setChat(prev => [...prev, msg]))
    socket.on('draft_completed', setState)

    return () => { socket.disconnect() }
  }, [leagueId])

  const fetchAvailable = useCallback(() => {
    const params = new URLSearchParams({ search })
    api<AvailablePlayer[]>(`/leagues/${leagueId}/draft/api/available?${params}`).then(setAvailable)
  }, [leagueId, search])

  useEffect(() => { fetchAvailable() }, [fetchAvailable])

  const makePick = (playerId: number) => {
    socketRef.current?.emit('make_pick', { league_id: Number(leagueId), player_id: playerId })
  }

  const sendChat = () => {
    if (!chatInput.trim()) return
    socketRef.current?.emit('draft_chat', { league_id: Number(leagueId), message: chatInput.trim() })
    setChatInput('')
  }

  if (!state) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-10 h-10 border-3 border-[#21262d] border-t-[#d29922] rounded-full animate-spin" />
      <p className="text-sm text-[#6e7681]">Connecting to draft room...</p>
    </div>
  )

  if (!state.active && !state.completed) return (
    <div className="text-center py-20">
      <p className="text-lg font-bold text-[#e6edf3]">Draft hasn't started yet</p>
      <p className="text-sm text-[#8b949e] mt-2">Waiting for the commissioner to begin the draft.</p>
    </div>
  )

  const isMyTurn = state.current_team?.name === user?.display_name

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-12rem)]">
      {/* Pick history */}
      <div className="lg:col-span-1 rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[#21262d] bg-[#161b22]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#e6edf3]">Draft Board</span>
            <span className="text-xs text-[#484f58]">Rd {state.round}</span>
          </div>
          {state.active && (
            <div className={`mt-2 flex items-center gap-2 ${isMyTurn ? 'text-[#3fb950]' : 'text-[#fbbf24]'}`}>
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs font-bold">{state.current_team.name}</span>
              <span className="text-xs tabular-nums ml-auto">{Math.floor(state.timer_remaining / 60)}:{String(state.timer_remaining % 60).padStart(2, '0')}</span>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {[...state.picks].reverse().map((p, i) => (
            <div key={i} className="flex items-center px-4 py-2 text-xs border-b border-[#21262d]">
              <span className="text-[#484f58] w-6">{p.pick}</span>
              <span className="text-[#8b949e] flex-1">{p.team}</span>
              <span className="font-bold text-[#e6edf3]">{p.player}</span>
              <span className="text-[#484f58] ml-2 w-8">{p.position}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Available players */}
      <div className="lg:col-span-1 rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[#21262d] bg-[#161b22]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#484f58]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#21262d] text-xs text-[#e6edf3] focus:outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {available.map(p => (
            <button key={p.id} onClick={() => isMyTurn && makePick(p.id)}
              disabled={!isMyTurn}
              className="w-full flex items-center px-4 py-2 text-xs border-b border-[#21262d] hover:bg-[#161b22] transition disabled:opacity-50">
              <span className="flex-1 text-left font-medium text-[#e6edf3]">{p.name}</span>
              <span className="text-[#484f58] w-8">{p.position}</span>
              <span className="text-[#8b949e] w-8 text-right">{p.age}</span>
              <span className="font-black text-[#e6edf3] w-10 text-right">{p.sc_avg.toFixed(0)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="lg:col-span-1 rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-[#21262d] bg-[#161b22]">
          <span className="text-sm font-bold text-[#e6edf3]">Chat</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {chat.map((m, i) => (
            <div key={i}>
              <span className="text-[10px] font-bold text-[#58a6ff]">{m.author}: </span>
              <span className="text-xs text-[#c9d1d9]">{m.text}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2 p-3 border-t border-[#21262d]">
          <input value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Message..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#21262d] text-xs text-[#e6edf3] focus:outline-none" />
          <button onClick={sendChat} className="p-1.5 rounded-lg bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3] transition">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
