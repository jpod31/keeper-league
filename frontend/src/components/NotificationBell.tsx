import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { useRealtime } from '../contexts/RealtimeContext'

const ICONS: Record<string, string> = {
  trade_received: 'bi-arrow-left-right',
  trade_accepted: 'bi-check-circle',
  trade_rejected: 'bi-x-circle',
  trade_vetoed: 'bi-shield-exclamation',
  player_delisted: 'bi-person-dash',
  message_received: 'bi-chat-dots',
  season_transition: 'bi-calendar-event',
  draft_pick: 'bi-list-check',
  default: 'bi-bell',
}

function relTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function NotificationBell() {
  const { unreadCount, notifications, markAllRead, refresh } = useRealtime()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!open) refresh()
    setOpen(!open)
  }

  const onMarkAllRead = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    markAllRead()
  }

  return (
    <div className="dropdown" ref={ref} style={{ position: 'relative' }}>
      <a
        className="nav-link position-relative"
        href="#"
        role="button"
        onClick={toggle}
        aria-expanded={open}
        style={{ padding: '.4rem .55rem' }}
      >
        <i className="bi bi-chat-dots" style={{ fontSize: '1.05rem' }}></i>
        {unreadCount > 0 && <span className="notif-dot"></span>}
      </a>
      {open && (
        <div
          className="dropdown-menu dropdown-menu-end p-0 notif-panel show"
          style={{
            position: 'absolute',
            right: 0,
            left: 'auto',
            top: '100%',
            marginTop: '.125rem',
            display: 'block',
          }}
        >
          <div className="d-flex justify-content-between align-items-center px-3 py-2 notif-panel-header">
            <span className="fw-bold" style={{ fontSize: '.85rem' }}>Notifications</span>
            <a
              href="#"
              onClick={onMarkAllRead}
              style={{ fontSize: '.72rem', color: '#58a6ff', textDecoration: 'none' }}
            >
              Mark all read
            </a>
          </div>
          <div style={{ fontSize: '.82rem' }}>
            {notifications.length === 0 ? (
              <div className="text-center text-secondary py-3" style={{ fontSize: '.8rem' }}>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => {
                const icon = ICONS[n.type] || ICONS.default
                const cls = n.is_read ? 'notif-item' : 'notif-item notif-unread'
                const body = (
                  <>
                    <i className={`bi ${icon} notif-type-icon`}></i>
                    <div className="flex-grow-1">
                      <div className="notif-title">{n.title}</div>
                      {n.body && <div className="notif-body">{n.body}</div>}
                    </div>
                    <span className="notif-time">{relTime(n.created_at)}</span>
                  </>
                )
                return n.url ? (
                  <Link key={n.id} to={n.url} className={cls} onClick={() => setOpen(false)}>
                    {body}
                  </Link>
                ) : (
                  <div key={n.id} className={cls}>
                    {body}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
