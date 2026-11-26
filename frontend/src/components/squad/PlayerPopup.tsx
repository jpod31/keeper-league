import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
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

// Which card is open is kept per browser history entry, so back from his full
// profile returns to the card you opened it from, and the full profile itself
// (a new entry) has no card over it. Lucas, 2026-11-27: "when you click more
// details on a player IT keeps the right hand pane afterwards". This provider
// never remounts, so usePageState (which reads once per mount) cannot do it.
const KEY = 'klcard:'
function readCard(entry: string): number | null {
  try { const v = sessionStorage.getItem(KEY + entry); return v ? Number(v) : null } catch { return null }
}
function writeCard(entry: string, id: number | null) {
  try { if (id == null) sessionStorage.removeItem(KEY + entry); else sessionStorage.setItem(KEY + entry, String(id)) } catch { /* private mode */ }
}

export function PlayerPopupProvider({ children }: { children: ReactNode }) {
  const { league } = useLeague()
  const location = useLocation()
  const entry = useRef(location.key)
  const [player, setPlayer] = useState<Detail | null>(null)
  // The detail endpoint hangs off a team, but what it returns is about the
  // player, so any team in the league will do.
  const teamId = league?.user_team?.id ?? league?.teams?.[0]?.id
  const load = useCallback(async (playerId: number, forEntry: string) => {
    if (!league || !teamId) return
    try {
      const d = await api<Detail>(`/leagues/${league.id}/team/${teamId}/api/player/${playerId}`)
      if (entry.current === forEntry) setPlayer(d)  // the page may have changed while it loaded
    } catch {
      /* leave the page as it is; the row is still there to try again */
      writeCard(forEntry, null)
    }
  }, [league, teamId])
  const open = useCallback((playerId: number) => {
    writeCard(entry.current, playerId)
    load(playerId, entry.current)
  }, [load])
  const close = useCallback(() => { setPlayer(null); writeCard(entry.current, null) }, [])
  useEffect(() => {
    entry.current = location.key
    const id = readCard(location.key)
    if (id == null) setPlayer(null)
    else if (player?.id !== id) load(id, location.key)
  }, [location.key, league?.id, teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Ctx.Provider value={open}>
      {children}
      {player && league && (
        <PlayerModal player={player} teamLogos={league.club_logos || {}} onClose={close} leagueId={String(league.id)} />
      )}
    </Ctx.Provider>
  )
}
