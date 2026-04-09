import { useParams, useNavigate } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { post } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface LineupPlayer {
  id: number
  name: string
  position: string
  afl_team: string
  sc_avg: number
  is_captain: boolean
  is_vc: boolean
  is_emergency: number
  playing: boolean
  bench: boolean
  injury: string | null
}

interface LineupData {
  team: { id: number; name: string }
  round: number
  max_round: number
  players: LineupPlayer[]
  locked: boolean
}

const POS_ORDER = ['DEF', 'MID', 'RUC', 'FWD']

export function LineupPage() {
  const { leagueId, teamId, round } = useParams()
  const navigate = useNavigate()
  const { data, loading, refetch } = useFetch<LineupData>(`/api/leagues/${leagueId}/team/${teamId}/lineup/${round}`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load lineup</p>

  const setCaptain = async (playerId: number) => {
    setActionLoading(true)
    await post(`/leagues/${leagueId}/team/${teamId}/api/set-captain`, { player_id: playerId, round: data.round })
    refetch()
    setActionLoading(false)
  }

  const setVC = async (playerId: number) => {
    setActionLoading(true)
    await post(`/leagues/${leagueId}/team/${teamId}/api/set-vc`, { player_id: playerId, round: data.round })
    refetch()
    setActionLoading(false)
  }

  const setEmergency = async (playerId: number, slot: number) => {
    setActionLoading(true)
    await post(`/leagues/${leagueId}/team/${teamId}/api/set-emergency`, { player_id: playerId, round: data.round, slot })
    refetch()
    setActionLoading(false)
  }

  const playing = data.players.filter(p => p.playing)
  const bench = data.players.filter(p => p.bench)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-extrabold text-[#e6edf3]">Lineup</h1>
          <p className="text-xs text-[#8b949e]">{data.team.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/leagues/${leagueId}/team/${teamId}/lineup/${Number(round) - 1}`)}
            disabled={Number(round) <= 1}
            className="p-1.5 rounded-lg bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] disabled:opacity-30 transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-[#e6edf3] tabular-nums w-16 text-center">Rd {data.round}</span>
          <button onClick={() => navigate(`/leagues/${leagueId}/team/${teamId}/lineup/${Number(round) + 1}`)}
            disabled={Number(round) >= data.max_round}
            className="p-1.5 rounded-lg bg-[#21262d] text-[#8b949e] hover:bg-[#30363d] disabled:opacity-30 transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {data.locked && (
        <div className="text-xs text-[#fbbf24] bg-[#fbbf2410] border border-[#fbbf24]/20 rounded-xl px-4 py-2 mb-4">
          Lineup is locked for this round
        </div>
      )}

      {/* Playing */}
      {POS_ORDER.map(pos => {
        const posPlayers = playing.filter(p => p.position === pos)
        if (!posPlayers.length) return null
        return (
          <div key={pos} className="mb-4">
            <span className="text-xs font-black text-[#484f58] mb-2 block">{pos}</span>
            <div className="space-y-1">
              {posPlayers.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#0d1117] border border-[#21262d]">
                  <span className="flex-1 text-sm font-medium text-[#e6edf3]">
                    {p.name}
                    {p.injury && <span className="ml-2 text-[10px] text-[#ef4444]">{p.injury}</span>}
                  </span>
                  <span className="text-xs text-[#8b949e] tabular-nums">{p.sc_avg.toFixed(0)}</span>
                  {!data.locked && (
                    <div className="flex gap-1">
                      <button onClick={() => setCaptain(p.id)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.is_captain ? 'bg-[#fbbf24] text-black' : 'text-[#484f58] hover:text-[#fbbf24]'}`}>
                        C
                      </button>
                      <button onClick={() => setVC(p.id)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.is_vc ? 'bg-[#8b949e] text-black' : 'text-[#484f58] hover:text-[#8b949e]'}`}>
                        VC
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Bench */}
      {bench.length > 0 && (
        <div className="mt-6">
          <span className="text-xs font-black text-[#484f58] mb-2 block">BENCH</span>
          <div className="space-y-1">
            {bench.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-2 rounded-xl bg-[#161b22] border border-[#21262d]">
                <span className="text-[10px] text-[#484f58] w-8">{p.position}</span>
                <span className="flex-1 text-sm font-medium text-[#8b949e]">{p.name}</span>
                <span className="text-xs text-[#484f58] tabular-nums">{p.sc_avg.toFixed(0)}</span>
                {!data.locked && (
                  <div className="flex gap-1">
                    {[1, 2].map(slot => (
                      <button key={slot} onClick={() => setEmergency(p.id, slot)}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          p.is_emergency === slot ? 'bg-[#a371f7] text-white' : 'text-[#484f58] hover:text-[#a371f7]'
                        }`}>
                        E{slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
