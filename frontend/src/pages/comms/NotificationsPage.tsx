import { useParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { post } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/Toast'
import { Bell, Check } from 'lucide-react'

interface Notification {
  id: number
  type: string
  title: string
  body: string
  read: boolean
  created: string
  link: string | null
}

export function NotificationsPage() {
  const { leagueId } = useParams()
  const { data, loading, refetch } = useFetch<Notification[]>(`/api/leagues/${leagueId}/notifications`)
  const { toast } = useToast()

  const markRead = async (id: number) => {
    await post(`/api/leagues/${leagueId}/notifications/read/${id}`)
    refetch()
  }

  const markAllRead = async () => {
    await post(`/api/leagues/${leagueId}/notifications/read-all`)
    toast('All marked as read', 'success')
    refetch()
  }

  if (loading) return <Spinner />
  if (!data) return <p className="text-sm text-[#ef4444]">Failed to load</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-extrabold text-[#e6edf3]">Notifications</h1>
        {data.some(n => !n.read) && (
          <button onClick={markAllRead} className="text-xs text-[#58a6ff] hover:underline flex items-center gap-1">
            <Check className="w-3 h-3" /> Mark all read
          </button>
        )}
      </div>

      {data.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="w-8 h-8 text-[#21262d] mx-auto mb-3" />
          <p className="text-sm text-[#484f58]">No notifications</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.map(n => (
            <div key={n.id} onClick={() => !n.read && markRead(n.id)}
              className={`px-4 py-3 rounded-xl border transition cursor-pointer ${
                n.read ? 'bg-[#0d1117] border-[#21262d]' : 'bg-[#0d1117] border-[#58a6ff]/20 hover:bg-[#161b22]'
              }`}>
              <div className="flex items-start gap-3">
                {!n.read && <span className="w-2 h-2 rounded-full bg-[#58a6ff] mt-1.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#e6edf3]">{n.title}</p>
                  <p className="text-xs text-[#8b949e] mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-[#484f58] mt-1">{n.created}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
