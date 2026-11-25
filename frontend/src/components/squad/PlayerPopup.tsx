import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../../lib/api'
import { useLeague } from '../../contexts/LeagueContext'
import { PlayerModal } from './PlayerModal'
import { usePageState } from '../../lib/pageMemory'

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
  // Which card is open is kept with the page: back from his full profile
  // returns to the card you opened it from.
  const [openId, setOpenId] = usePageState<number | null>('card', null)
  // The detail endpoint hangs off a team, but what it returns is about the
  // player, so any team in the league will do.
  const teamId = league?.user_team?.id ?? league?.teams?.[0]?.id
  const open = useCallback(async (playerId: number) => {
    if (!league || !teamId) return
    try {
      setPlayer(await api<Detail>(`/leagues/${league.id}/team/${teamId}/api/player/${playerId}`))
      setOpenId(playerId)
    } catch {
      /* leave the page as it is; the row is still there to try again */
      setOpenId(null)
    }
  }, [league, teamId, setOpenId])
  const close = useCallback(() => { setPlayer(null); setOpenId(null) }, [setOpenId])
  useEffect(() => {
    if (openId != null && !player) open(openId)
    // Only when the page comes up: a card closed by hand stays closed.
  }, [league?.id, teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Ctx.Provider value={open}>
      {children}
      {player && league && (
        <PlayerModal player={player} teamLogos={league.club_logos || {}} onClose={close} leagueId={String(league.id)} />
      )}
    </Ctx.Provider>
  )
}
