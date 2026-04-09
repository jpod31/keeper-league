import { useParams, useNavigate } from 'react-router'
import { useState, useEffect } from 'react'
import { api, post } from '../../lib/api'
import { useLeague } from '../../contexts/LeagueContext'
import { useToast } from '../../components/ui/Toast'
import { Spinner } from '../../components/ui/Spinner'

interface RosterPlayer { id: number; name: string; position: string; sc_avg: number }

export function TradeProposePage() {
  const { leagueId } = useParams()
  const { league } = useLeague()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [targetTeam, setTargetTeam] = useState<number | ''>('')
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([])
  const [theirRoster, setTheirRoster] = useState<RosterPlayer[]>([])
  const [sending, setSending] = useState<number[]>([])
  const [receiving, setReceiving] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const myTeamId = league?.user_team?.id

  useEffect(() => {
    if (!myTeamId) return
    api<RosterPlayer[]>(`/api/leagues/${leagueId}/trades/roster/${myTeamId}`).then(setMyRoster)
  }, [myTeamId, leagueId])

  useEffect(() => {
    if (!targetTeam) { setTheirRoster([]); return }
    api<RosterPlayer[]>(`/api/leagues/${leagueId}/trades/roster/${targetTeam}`).then(setTheirRoster)
  }, [targetTeam, leagueId])

  const toggle = (list: number[], setList: (v: number[]) => void, id: number) => {
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])
  }

  const handleSubmit = async () => {
    if (!targetTeam || !sending.length || !receiving.length) { toast('Select players for both sides', 'error'); return }
    setSubmitting(true)
    try {
      await post(`/api/leagues/${leagueId}/trades/propose`, {
        target_team_id: targetTeam, sending, receiving, message,
      })
      toast('Trade proposed!', 'success')
      navigate(`/leagues/${leagueId}/trades`)
    } catch {
      toast('Failed to propose trade', 'error')
    }
    setSubmitting(false)
  }

  if (!league) return <Spinner />

  const otherTeams = league.teams.filter(t => t.id !== myTeamId)

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">Propose Trade</h1>

      <div className="mb-4">
        <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Trade With</label>
        <select value={targetTeam} onChange={e => { setTargetTeam(Number(e.target.value) || ''); setReceiving([]) }}
          className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:outline-none">
          <option value="">Select team...</option>
          {otherTeams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.owner})</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PlayerSelect title="You Send" players={myRoster} selected={sending} onToggle={id => toggle(sending, setSending, id)} />
        <PlayerSelect title="You Receive" players={theirRoster} selected={receiving} onToggle={id => toggle(receiving, setReceiving, id)} />
      </div>

      <div className="mb-6">
        <label className="block text-xs font-medium text-[#8b949e] mb-1.5">Message (optional)</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
          className="w-full px-3 py-2.5 rounded-xl bg-[#0d1117] border border-[#21262d] text-sm text-[#e6edf3] focus:border-[#58a6ff] focus:outline-none transition resize-none" />
      </div>

      <button onClick={handleSubmit} disabled={submitting || !sending.length || !receiving.length}
        className="px-6 py-2.5 rounded-xl bg-[#58a6ff] text-sm font-bold text-white hover:bg-[#388bfd] transition disabled:opacity-50">
        {submitting ? 'Proposing...' : 'Propose Trade'}
      </button>
    </div>
  )
}

function PlayerSelect({ title, players, selected, onToggle }: {
  title: string; players: RosterPlayer[]; selected: number[]; onToggle: (id: number) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-[#e6edf3] mb-2">{title}</h3>
      <div className="rounded-xl border border-[#21262d] bg-[#0d1117] max-h-72 overflow-y-auto">
        {players.length === 0 ? (
          <p className="text-xs text-[#484f58] py-4 text-center">Select a team</p>
        ) : players.map(p => (
          <button key={p.id} onClick={() => onToggle(p.id)}
            className={`w-full flex items-center gap-3 px-4 py-2 text-xs border-b border-[#21262d] last:border-0 transition ${
              selected.includes(p.id) ? 'bg-[#58a6ff10]' : 'hover:bg-[#161b22]'
            }`}>
            <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
              selected.includes(p.id) ? 'bg-[#58a6ff] border-[#58a6ff] text-white' : 'border-[#21262d]'
            }`}>
              {selected.includes(p.id) && '\u2713'}
            </span>
            <span className="text-[10px] text-[#484f58] w-8">{p.position}</span>
            <span className="flex-1 text-left font-medium text-[#e6edf3]">{p.name}</span>
            <span className="font-black text-[#e6edf3]">{p.sc_avg.toFixed(0)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
