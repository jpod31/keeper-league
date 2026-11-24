import { useParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { CommsSubnav } from '../../components/nav/CommsSubnav'
import { NoticeList, type Notice } from '../../components/comms/NoticeList'

interface ActivityData {
  league: { id: number; name: string }
  entries: Notice[]
}

export function ActivityFeedPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<ActivityData>(`/leagues/${leagueId}/activity?format=json`)

  if (loading) return <Spinner text="Loading activity..." />
  if (!data) return <p className="text-danger">Failed to load activity feed</p>

  return (
    <div className="kx-page nt-page">
      <CommsSubnav active="activity" leagueId={leagueId!} />
      <div className="kx-head">
        <h2>Activity</h2>
      </div>
      <NoticeList items={data.entries} empty="Nothing yet. Trades, signings and delistings across the league show up here." />
    </div>
  )
}
