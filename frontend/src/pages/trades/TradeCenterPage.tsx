import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { Plus } from 'lucide-react'

interface Trade {
  id: number
  proposer: string
  recipient: string
  status: string
  created: string
  players_out: string[]
  players_in: string[]
}

interface TradesData {
  incoming: Trade[]
  outgoing: Trade[]
  completed: Trade[]
}

const statusColors: Record<string, string> = {
  pending: '#fbbf24', accepted: '#3fb950', rejected: '#ef4444',
  vetoed: '#ef4444', expired: '#484f58',
}

export function TradeCenterPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<TradesData>(`/api/leagues/${leagueId}/trades`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load trades</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-extrabold text-[#e6edf3]">Trade Center</h1>
        <Link to={`/leagues/${leagueId}/trades/propose`}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#58a6ff]/10 text-[#58a6ff] text-xs font-bold border border-[#58a6ff]/20 hover:bg-[#58a6ff]/20 transition no-underline">
          <Plus className="w-4 h-4" /> Propose Trade
        </Link>
      </div>

      {data.incoming.length > 0 && <TradeSection title="Incoming" trades={data.incoming} leagueId={leagueId!} />}
      {data.outgoing.length > 0 && <TradeSection title="Outgoing" trades={data.outgoing} leagueId={leagueId!} />}
      {data.completed.length > 0 && <TradeSection title="History" trades={data.completed} leagueId={leagueId!} />}
      {!data.incoming.length && !data.outgoing.length && !data.completed.length && (
        <p className="text-sm text-[#484f58] text-center py-12">No trades yet</p>
      )}
    </div>
  )
}

function TradeSection({ title, trades, leagueId }: { title: string; trades: Trade[]; leagueId: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-bold text-[#8b949e] mb-3">{title}</h2>
      <div className="space-y-2">
        {trades.map(t => (
          <Link key={t.id} to={`/leagues/${leagueId}/trades/${t.id}`}
            className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#0d1117] border border-[#21262d] hover:bg-[#161b22] transition no-underline">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-[#e6edf3]">{t.proposer} → {t.recipient}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                  style={{ color: statusColors[t.status] || '#8b949e', borderColor: (statusColors[t.status] || '#8b949e') + '40' }}>
                  {t.status}
                </span>
              </div>
              <p className="text-xs text-[#484f58] truncate">
                Out: {t.players_out.join(', ')} | In: {t.players_in.join(', ')}
              </p>
            </div>
            <span className="text-[10px] text-[#484f58] shrink-0">{t.created}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
