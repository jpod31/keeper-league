import { useParams } from 'react-router'
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { Search } from 'lucide-react'

interface PoolPlayer {
  id: number
  name: string
  position: string
  afl_team: string
  age: number
  sc_avg: number
  games: number
  owner: string | null
  tag: string
}

interface PoolData {
  players: PoolPlayer[]
  total: number
  page: number
  per_page: number
}

const tagColors: Record<string, string> = {
  Elite: '#3fb950', Premium: '#58a6ff', 'Emerging Star': '#a371f7',
  Breakout: '#a371f7', Proven: '#8b949e', Steady: '#8b949e',
  Developing: '#fbbf24', Declining: '#ef4444', Fringe: '#484f58',
}

export function PlayerPoolPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'rostered'>('all')
  const [sortCol, setSortCol] = useState<'sc_avg' | 'age' | 'name' | 'games'>('sc_avg')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  const fetchPlayers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page), search, position: posFilter, status: statusFilter,
      sort: sortCol, dir: sortDir,
    })
    api<PoolData>(`/api/leagues/${leagueId}/player-pool?${params}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [leagueId, page, search, posFilter, statusFilter, sortCol, sortDir])

  useEffect(() => { fetchPlayers() }, [fetchPlayers])

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  const SortHeader = ({ col, label, className }: { col: typeof sortCol; label: string; className?: string }) => (
    <th onClick={() => toggleSort(col)}
      className={`px-3 py-2.5 text-[#484f58] font-medium cursor-pointer hover:text-[#8b949e] select-none ${className || ''}`}>
      {label} {sortCol === col && (sortDir === 'desc' ? '\u2193' : '\u2191')}
    </th>
  )

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-4">Player Pool</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#484f58]" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search players..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition" />
        </div>
        <select value={posFilter} onChange={e => { setPosFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl bg-[#0d1117] border border-[#21262d] text-xs text-[#8b949e] focus:outline-none">
          <option value="">All Positions</option>
          <option value="DEF">DEF</option><option value="MID">MID</option>
          <option value="RUC">RUC</option><option value="FWD">FWD</option>
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }}
          className="px-3 py-2 rounded-xl bg-[#0d1117] border border-[#21262d] text-xs text-[#8b949e] focus:outline-none">
          <option value="all">All</option><option value="available">Available</option><option value="rostered">Rostered</option>
        </select>
      </div>

      {loading && !data ? <Spinner /> : data && (
        <>
          <div className="rounded-xl border border-[#21262d] bg-[#0d1117] overflow-hidden overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-[#21262d] bg-[#161b22]">
                  <th className="text-left px-4 py-2.5 text-[#484f58] font-medium">Player</th>
                  <th className="text-left px-3 py-2.5 text-[#484f58] font-medium">Pos</th>
                  <th className="text-left px-3 py-2.5 text-[#484f58] font-medium">Team</th>
                  <SortHeader col="sc_avg" label="SC Avg" className="text-right" />
                  <SortHeader col="age" label="Age" className="text-right" />
                  <SortHeader col="games" label="Games" className="text-right" />
                  <th className="text-left px-3 py-2.5 text-[#484f58] font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map(p => (
                  <tr key={p.id} className="border-b border-[#21262d] hover:bg-[#161b22] transition">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#e6edf3]">{p.name}</span>
                        {p.tag && <span className="text-[10px] font-bold" style={{ color: tagColors[p.tag] || '#8b949e' }}>{p.tag}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-[#8b949e]">{p.position}</td>
                    <td className="px-3 py-2.5 text-[#8b949e]">{p.afl_team}</td>
                    <td className="text-right px-3 py-2.5 font-black text-[#e6edf3]">{p.sc_avg.toFixed(0)}</td>
                    <td className="text-right px-3 py-2.5 text-[#8b949e]">{p.age}</td>
                    <td className="text-right px-3 py-2.5 text-[#8b949e]">{p.games}</td>
                    <td className="px-3 py-2.5 text-[#484f58]">{p.owner || <span className="text-[#3fb950]">Free</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-[#484f58]">{data.total} players</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] disabled:opacity-30 transition">
                Prev
              </button>
              <span className="px-3 py-1.5 text-xs text-[#8b949e]">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={data.players.length < data.per_page}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] disabled:opacity-30 transition">
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
