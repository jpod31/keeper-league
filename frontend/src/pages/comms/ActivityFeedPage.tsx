import { useParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Activity {
  id: number
  type: string
  text: string
  actor: string
  created: string
}

const typeIcons: Record<string, string> = {
  trade: '\u21C4', draft: '\u2611', lineup: '\u270E', score: '\u26BD', join: '\u2795',
}

export function ActivityFeedPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<Activity[]>(`/api/leagues/${leagueId}/activity`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load activity</p>

  return (
    <div>
      <h1 className="text-xl font-extrabold text-[#e6edf3] mb-6">Activity Feed</h1>
      <div className="space-y-2">
        {data.map(a => (
          <div key={a.id} className="flex gap-3 px-4 py-3 rounded-xl bg-[#0d1117] border border-[#21262d]">
            <span className="text-base mt-0.5">{typeIcons[a.type] || '\u2022'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#c9d1d9]">{a.text}</p>
              <p className="text-[10px] text-[#484f58] mt-0.5">{a.actor} &middot; {a.created}</p>
            </div>
          </div>
        ))}
        {!data.length && <p className="text-sm text-[#484f58] text-center py-8">No activity yet</p>}
      </div>
    </div>
  )
}
