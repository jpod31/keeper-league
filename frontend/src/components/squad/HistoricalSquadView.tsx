/**
 * HistoricalSquadView — read-only render of a past round's lineup using
 * the SAME FieldView the live squad uses (field background + positioned
 * cards), just with isOwner=false so there are no actions.
 *
 * The backend lineup endpoint now returns a FieldData-shaped snapshot,
 * so we hand it straight to <FieldView>.
 */

import { useEffect, useState } from 'react'
import { FieldView, type FieldData } from './FieldView'

interface HistData {
  team: { id: number; name: string }
  round: number
  max_round: number
  locked: boolean
  field_data: FieldData | null
  team_logos: Record<string, string>
}

export interface HistoricalSquadViewProps {
  leagueId: string | number
  teamId: string | number
  round: number
}

export function HistoricalSquadView({ leagueId, teamId, round }: HistoricalSquadViewProps) {
  const [data, setData] = useState<HistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    let cancelled = false
    fetch(`/api/leagues/${leagueId}/team/${teamId}/lineup/${round}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => { if (!cancelled) setError('Failed to load lineup') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [leagueId, teamId, round])

  if (loading) return <div className="hsv-loading">Loading round {round}…</div>
  if (error) return <div className="hsv-error">{error}</div>
  if (!data || !data.field_data) return <div className="hsv-error">No saved lineup for round {round}.</div>

  return (
    <div className="hsv">
      <div className="hsv-banner">
        <i className="bi bi-clock-history"></i>
        Viewing R{data.round} archive — read-only
      </div>
      <FieldView
        fd={data.field_data}
        teamLogos={data.team_logos}
        isOwner={false}
      />
    </div>
  )
}
