import { createContext, useContext, useState, useEffect } from 'react'
import { useParams } from 'react-router'
import { api } from '../lib/api'

export interface LeagueInfo {
  id: number
  name: string
  season_year: number
  invite_code: string
  commissioner_id: number
  user_team: { id: number; name: string; logo?: string | null; accent?: string; flags?: number; flags7?: number } | null
  /** flags: premierships won (ladder toppers), gold stars over the crest;
   *  flags7: 7s premierships, purple outline stars under it. */
  teams: { id: number; name: string; owner: string; logo?: string | null; accent?: string; flags?: number; flags7?: number }[]
  /** AFL club name -> logo URL. */
  club_logos?: Record<string, string>
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
  /** The AFL season the site is in (ages, ratings, clubs). */
  afl_year?: number
  /** The latest AFL season with a game played: every average, last-3 and
   *  last-5 on the site comes from this year. */
  stats_year?: number
  /** True between the AFL draft and Opening Round, when those numbers are
   *  last season's and have to say so. */
  stats_are_last_season?: boolean
  /** Non-null once every fixture for the league's current year is completed,
   *  drives the Season Review takeover + the rail entry. */
  season_review_year: number | null
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

/** Which season the scores on screen are from, and how to label them.
 *  `tag` is the short form for tight spots ("'26"); both are empty while the
 *  numbers are this season's, so labels simply fall away once it starts. */
export function useStatsYear() {
  const { league } = useContext(LeagueContext)
  const year = league?.stats_year ?? null
  const isLast = !!league?.stats_are_last_season && year != null
  return {
    year,
    isLast,
    tag: isLast ? `'${String(year).slice(2)}` : '',
    label: isLast ? String(year) : '',
    aflYear: league?.afl_year ?? null,
  }
}
