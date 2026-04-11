import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { useRealtime } from '../contexts/RealtimeContext'

const ICONS: Record<string, string> = {
  trade_received: 'bi-arrow-left-right',
  trade_accepted: 'bi-check-circle',
  trade_rejected: 'bi-x-circle',
  trade_vetoed: 'bi-shield-exclamation',
  player_delisted: 'bi-person-dash',
  message_received: 'bi-envelope',
  season_transition: 'bi-calendar-event',
  draft_pick: 'bi-list-check',
  default: 'bi-bell',
}

function relTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString()
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

  const toggle = () => {
    if (!open) refresh()
    setOpen(!open)
  }

  return (
    <div className="dropdown" ref={ref}>
      <button
        className="nav-link position-relative"
        onClick={toggle}
        style={{ padding: '.4rem .55rem', background: 'none', border: 'none' }}
        aria-label="Notifications"
      >
        <i className="bi bi-bell" style={{ fontSize: '1.05rem' }}></i>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              background: '#f85149',
              color: '#fff',
              fontSize: '.6rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className="dropdown-menu dropdown-menu-end show"
          style={{
            background: 'var(--kl-bg-card)',
            borderColor: 'var(--kl-border)',
            minWidth: 320,
            maxWidth: 360,
            padding: 0,
            maxHeight: 480,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '.6rem .8rem',
              borderBottom: '1px solid var(--kl-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '.85rem' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--kl-accent-blue)',
                  fontSize: '.7rem',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--kl-text-muted)', fontSize: '.8rem' }}>
                <i className="bi bi-bell-slash" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '.5rem' }}></i>
                No notifications yet
              </div>
            ) : (
              notifications.map(n => {
                const icon = ICONS[n.type] || ICONS.default
                const href = n.url && n.url.startsWith('/leagues/') ? n.url.replace('/leagues/', '/leagues/') : n.url
                const content = (
                  <div
                    style={{
                      padding: '.6rem .8rem',
                      borderBottom: '1px solid var(--kl-border)',
                      background: n.is_read ? 'transparent' : 'rgba(88,166,255,.05)',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                    }}
                  >
                    <i className={`bi ${icon}`} style={{ color: 'var(--kl-accent-blue)', fontSize: '1rem', marginTop: 2 }}></i>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '.8rem', color: 'var(--kl-text-primary)' }}>{n.title}</div>
                      {n.body && (
                        <div
                          style={{
                            fontSize: '.72rem',
                            color: 'var(--kl-text-secondary)',
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {n.body}
                        </div>
                      )}
                      <div style={{ fontSize: '.65rem', color: 'var(--kl-text-muted)', marginTop: 2 }}>{relTime(n.created_at)}</div>
                    </div>
                  </div>
                )
                return href ? (
                  <Link
                    key={n.id}
                    to={href}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                    onClick={() => setOpen(false)}
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
