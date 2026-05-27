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
  is_owner: boolean
  active_draft: boolean
  season_phase: string
  pending_ltil_count: number
  finals_teams: number
  user_leagues: {
    id: number
    name: string
    season_year: number
    invite_code: string
    is_commissioner: boolean
    team_id: number
    team_name: string
  }[]
  current_round: number
  next_lockout_at: string | null
  current_matchup: {
    fixture_id: number
    opponent_id: number | null
    opponent_name: string
    user_is_home: boolean
    status: string                  // 'scheduled' | 'live' | 'completed'
    user_score: number | null
    opponent_score: number | null
  } | null
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
    // Only show loading spinner on first load (no cached data yet).
    // Subsequent refreshes update silently so there's no flash.
    if (!league) setLoading(true)
    api<LeagueInfo>(`/api/leagues/${leagueId}/context`)
      .then(d => { setLeague(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // Reset when switching leagues so the spinner shows for the new league
    setLeague(null)
    setLoading(true)
    fetch_()
  }, [leagueId])

  return (
    <LeagueContext.Provider value={{ league, loading, error, refresh: fetch_ }}>
      {children}
    </LeagueContext.Provider>
  )
}

export function useLeague() { return useContext(LeagueContext) }
