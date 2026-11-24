import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { api } from '../../lib/api'
import { useLeague } from '../../contexts/LeagueContext'
import { PlayerModal } from './PlayerModal'

// One way to look at a player, from anywhere in a league: his card slides in
// over the page you are on. The pool, trade block, former players and season
// squads used to send you to a separate page, which threw away your filters
// and your place in the list. The card links on to the full profile.
//
//   const openPlayer = useOpenPlayer()
//   <tr onClick={() => openPlayer(p.id)}>

type Detail = Parameters<typeof PlayerModal>[0]['player']

const Ctx = createContext<(playerId: number) => void>(() => {})

export function useOpenPlayer() { return useContext(Ctx) }

export function PlayerPopupProvider({ children }: { children: ReactNode }) {
  const { league } = useLeague()
  const [player, setPlayer] = useState<Detail | null>(null)
  // The detail endpoint hangs off a team, but what it returns is about the
  // player, so any team in the league will do.
  const teamId = league?.user_team?.id ?? league?.teams?.[0]?.id
  const open = useCallback(async (playerId: number) => {
    if (!league || !teamId) return
    try {
      setPlayer(await api<Detail>(`/leagues/${league.id}/team/${teamId}/api/player/${playerId}`))
    } catch {
      /* leave the page as it is; the row is still there to try again */
    }
  }, [league, teamId])
  return (
    <Ctx.Provider value={open}>
      {children}
      {player && league && (
        <PlayerModal player={player} teamLogos={league.club_logos || {}} onClose={() => setPlayer(null)} leagueId={String(league.id)} />
      )}
    </Ctx.Provider>
  )
}
