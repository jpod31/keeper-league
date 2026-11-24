import { useParams } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { NoticeList, type Notice } from '../../components/comms/NoticeList'

interface NotifData {
  league: { id: number; name: string }
  notifs: Notice[]
}

export function NotificationsPage() {
  const { leagueId } = useParams()
  const { data, loading, refetch } = useFetch<NotifData>(`/leagues/${leagueId}/notifications?format=json`)
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner text="Loading notifications..." />
  if (!data) return <p className="text-danger">Failed to load notifications</p>

  const { notifs } = data
  const unread = notifs.filter(n => n.is_read === false).length

  async function markAllRead() {
    setBusy(true)
    try {
      await fetch(`/leagues/${leagueId}/notifications/read-all`, { method: 'POST', credentials: 'include' })
      refetch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="kx-page nt-page">
      <div className="kx-head">
        <h2>Notifications</h2>
        <div className="kx-head-side">
          {unread > 0 && <span className="sq-chip">{unread} unread</span>}
          {unread > 0 && (
            <button type="button" className="kx-btn" onClick={markAllRead} disabled={busy}>Mark all read</button>
          )}
        </div>
      </div>
      <NoticeList items={notifs} empty="Nothing yet. Trades, delistings and messages show up here." />
    </div>
  )
}
