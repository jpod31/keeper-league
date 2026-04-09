import { createContext, useContext, useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { api } from '../lib/api'

export interface LeagueInfo {
  id: number
  name: string
  season_year: number
  invite_code: string
  commissioner_id: number
  user_team: { id: number; name: string } | null
  teams: { id: number; name: string; owner: string }[]
  is_commissioner: boolean
  active_draft: boolean
  season_phase: string
}

interface LeagueCtx {
  league: LeagueInfo | null
  loading: boolean
  error: string | null
  refresh: () => void
}

const LeagueContext = createContext<LeagueCtx>(null!)

export function LeagueProvider({ children }: { children: React.ReactNode }) {
  const { leagueId } = useParams()
  const [league, setLeague] = useState<LeagueInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch_ = () => {
    if (!leagueId) return
    setLoading(true)
    api<LeagueInfo>(`/api/leagues/${leagueId}/context`)
      .then(d => { setLeague(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetch_() }, [leagueId])

  return (
    <LeagueContext.Provider value={{ league, loading, error, refresh: fetch_ }}>
      {children}
    </LeagueContext.Provider>
  )
}

export function useLeague() { return useContext(LeagueContext) }
