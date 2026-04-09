import { useParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { post } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { useState } from 'react'

interface TradeDetail {
  id: number
  proposer: { team_id: number; team_name: string; owner: string }
  recipient: { team_id: number; team_name: string; owner: string }
  status: string
  created: string
  message: string
  players_out: { name: string; position: string; sc_avg: number }[]
  players_in: { name: string; position: string; sc_avg: number }[]
  comments: { author: string; text: string; created: string }[]
  can_respond: boolean
  can_veto: boolean
}

export function TradeDetailPage() {
  const { leagueId, tradeId } = useParams()
  const { data, loading, refetch } = useFetch<TradeDetail>(`/api/leagues/${leagueId}/trades/${tradeId}`)
  const { toast } = useToast()
  const [comment, setComment] = useState('')

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load trade</p>

  const respond = async (action: string) => {
    try {
      await post(`/api/leagues/${leagueId}/trades/${tradeId}/respond`, { action })
      toast(`Trade ${action}`, 'success')
      refetch()
    } catch { toast('Action failed', 'error') }
  }

  const addComment = async () => {
    if (!comment.trim()) return
    try {
      await post(`/api/leagues/${leagueId}/trades/${tradeId}/comment`, { text: comment })
      setComment('')
      refetch()
    } catch { toast('Failed to add comment', 'error') }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-[10px] font-extrabold uppercase tracking-[2px] text-[#484f58] mb-1">Trade #{data.id}</p>
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">{data.proposer.team_name} → {data.recipient.team_name}</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <TradeColumn title={`${data.proposer.team_name} sends`} players={data.players_out} />
        <TradeColumn title={`${data.recipient.team_name} sends`} players={data.players_in} />
      </div>

      {data.message && (
        <div className="rounded-xl p-4 bg-[#0d1117] border border-[#21262d] mb-6">
          <p className="text-xs text-[#484f58] mb-1">Message</p>
          <p className="text-sm text-[#c9d1d9]">{data.message}</p>
        </div>
      )}

      {/* Actions */}
      {data.can_respond && data.status === 'pending' && (
        <div className="flex gap-2 mb-6">
          <button onClick={() => respond('accept')}
            className="px-4 py-2 rounded-xl bg-[#3fb950]/10 text-[#3fb950] text-sm font-bold border border-[#3fb950]/20 hover:bg-[#3fb950]/20 transition">
            Accept
          </button>
          <button onClick={() => respond('reject')}
            className="px-4 py-2 rounded-xl bg-[#ef4444]/10 text-[#ef4444] text-sm font-bold border border-[#ef4444]/20 hover:bg-[#ef4444]/20 transition">
            Reject
          </button>
        </div>
      )}

      {/* Comments */}
      <div>
        <h3 className="text-sm font-bold text-[#e6edf3] mb-3">Comments</h3>
        <div className="space-y-2 mb-4">
          {data.comments.map((c, i) => (
            <div key={i} className="px-4 py-2 rounded-xl bg-[#0d1117] border border-[#21262d]">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-[#e6edf3]">{c.author}</span>
                <span className="text-[10px] text-[#484f58]">{c.created}</span>
              </div>
              <p className="text-xs text-[#c9d1d9]">{c.text}</p>
            </div>
          ))}
          {!data.comments.length && <p className="text-xs text-[#484f58]">No comments yet</p>}
        </div>
        <div className="flex gap-2">
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment..."
            className="flex-1 px-3 py-2 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition"
            onKeyDown={e => e.key === 'Enter' && addComment()} />
          <button onClick={addComment}
            className="px-4 py-2 rounded-xl bg-[#21262d] text-sm font-bold text-[#8b949e] hover:text-[#e6edf3] transition">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

function TradeColumn({ title, players }: { title: string; players: { name: string; position: string; sc_avg: number }[] }) {
  return (
    <div>
      <p className="text-xs font-bold text-[#8b949e] mb-2">{title}</p>
      <div className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden">
        {players.map((p, i) => (
          <div key={i} className={`flex items-center px-4 py-2.5 text-xs ${i > 0 ? 'border-t border-[#21262d]' : ''}`}>
            <span className="text-[10px] text-[#484f58] w-8">{p.position}</span>
            <span className="flex-1 font-medium text-[#e6edf3]">{p.name}</span>
            <span className="font-black text-[#e6edf3]">{p.sc_avg.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
