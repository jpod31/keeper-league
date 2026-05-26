import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRealtime } from '../contexts/RealtimeContext'

// Type → icon (bootstrap icon class name)
const ICONS: Record<string, string> = {
  trade_received:    'bi-arrow-left-right',
  trade_accepted:    'bi-check-circle-fill',
  trade_rejected:    'bi-x-circle-fill',
  trade_vetoed:      'bi-shield-exclamation',
  player_delisted:   'bi-person-dash-fill',
  list_change:       'bi-clock-history',
  message_received:  'bi-chat-dots-fill',
  season_transition: 'bi-calendar-event-fill',
  draft_pick:        'bi-list-check',
  default:           'bi-bell-fill',
}

// Type → palette token (drives the glass icon-circle accent)
type Tone = 'trade' | 'list' | 'draft' | 'message' | 'default'
function toneFor(type: string, title: string): Tone {
  const t = (type || '').toLowerCase()
  const lower = (title || '').toLowerCase()
  if (t.startsWith('trade') || lower.includes('trade')) return 'trade'
  if (t === 'draft_pick' || lower.includes('draft')) return 'draft'
  if (t === 'message_received') return 'message'
  if (t === 'list_change' || t === 'player_delisted' || lower.includes('delisted') || lower.includes('ltil')) return 'list'
  return 'default'
}

function relTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

type DayGroup = 'today' | 'yesterday' | 'week' | 'earlier'
function dayGroup(iso: string): DayGroup {
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z')
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const weekStart = todayStart - 7 * 86_400_000
  const t = d.getTime()
  if (t >= todayStart) return 'today'
  if (t >= yesterdayStart) return 'yesterday'
  if (t >= weekStart) return 'week'
  return 'earlier'
}

const GROUP_LABEL: Record<DayGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  earlier: 'Earlier',
}

interface Notif {
  id: number
  type: string
  title: string
  body?: string
  url?: string | null
  is_read: boolean
  created_at: string
}

export function NotificationBell() {
  const { unreadCount, notifications, markAllRead, refresh } = useRealtime()
  const [open, setOpen] = useState(false)

  // Close on Escape, and on route change (handled by useEffect on pathname elsewhere)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    // Lock body scroll while drawer is open
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    if (!open) refresh()
    setOpen(o => !o)
  }
  const onMarkAllRead = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    markAllRead()
  }

  // Group notifications by day
  const grouped: Record<DayGroup, Notif[]> = { today: [], yesterday: [], week: [], earlier: [] }
  for (const n of notifications as Notif[]) grouped[dayGroup(n.created_at)].push(n)
  const orderedGroups: DayGroup[] = ['today', 'yesterday', 'week', 'earlier']

  return (
    <>
      <a
        className={`nav-link position-relative${unreadCount > 0 ? ' has-unread' : ''}`}
        href="#"
        role="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      >
        <i className={`bi ${unreadCount > 0 ? 'bi-bell-fill' : 'bi-bell'}`} style={{ fontSize: '1.05rem' }}></i>
        {unreadCount > 0 && <span className="notif-dot"></span>}
      </a>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                className="kl-drawer-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: .18 }}
                onClick={() => setOpen(false)}
              />

              {/* Panel — slides in from right on desktop, up from bottom on mobile */}
              <motion.aside
                key="kl-notif-drawer"
                className="kl-drawer"
                role="dialog"
                aria-label="Notifications"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', stiffness: 360, damping: 36 }}
              >
                <header className="kl-drawer-head">
                  <div>
                    <div className="kl-drawer-eyebrow">Inbox</div>
                    <h2 className="kl-drawer-title">
                      Notifications
                      {unreadCount > 0 && <span className="kl-drawer-unread-chip">{unreadCount} unread</span>}
                    </h2>
                  </div>
                  <div className="kl-drawer-head-actions">
                    {unreadCount > 0 && (
                      <button type="button" className="kl-drawer-action" onClick={onMarkAllRead}>
                        Mark all read
                      </button>
                    )}
                    <button
                      type="button"
                      className="kl-drawer-close"
                      onClick={() => setOpen(false)}
                      aria-label="Close notifications"
                    >
                      <i className="bi bi-x-lg"></i>
                    </button>
                  </div>
                </header>

                <div className="kl-drawer-body">
                  {notifications.length === 0 ? (
                    <div className="kl-drawer-empty">
                      <div className="kl-drawer-empty-icon"><i className="bi bi-bell-slash"></i></div>
                      <div className="kl-drawer-empty-title">All caught up</div>
                      <div className="kl-drawer-empty-sub">You're up to date with everything in your leagues.</div>
                    </div>
                  ) : (
                    orderedGroups.map(g => {
                      const items = grouped[g]
                      if (items.length === 0) return null
                      return (
                        <section key={g} className="kl-drawer-group">
                          <div className="kl-drawer-group-head">
                            <span>{GROUP_LABEL[g]}</span>
                            <span className="kl-drawer-group-rule"></span>
                            <span className="kl-drawer-group-count">{items.length}</span>
                          </div>
                          <div className="kl-drawer-list">
                            {items.map((n, idx) => (
                              <NotifItem
                                key={n.id}
                                notif={n}
                                index={idx}
                                onClose={() => setOpen(false)}
                              />
                            ))}
                          </div>
                        </section>
                      )
                    })
                  )}
                </div>

                <footer className="kl-drawer-foot">
                  <Link
                    to="/leagues"
                    className="kl-drawer-foot-link"
                    onClick={() => setOpen(false)}
                  >
                    <i className="bi bi-clock-history"></i>
                    View full activity log
                  </Link>
                </footer>
              </motion.aside>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

function NotifItem({
  notif, index, onClose,
}: { notif: Notif; index: number; onClose: () => void }) {
  const icon = ICONS[notif.type] || ICONS.default
  const tone = toneFor(notif.type, notif.title)
  const body = (
    <>
      <span className={`kl-notif-icon kl-notif-icon-${tone}`}>
        <i className={`bi ${icon}`}></i>
      </span>
      <span className="kl-notif-body">
        <span className="kl-notif-title">{notif.title}</span>
        {notif.body && <span className="kl-notif-sub">{notif.body}</span>}
      </span>
      <span className="kl-notif-time">{relTime(notif.created_at)}</span>
    </>
  )
  const className = `kl-notif${notif.is_read ? '' : ' unread'} kl-notif-tone-${tone}`
  const style = { animationDelay: `${Math.min(index, 8) * 28}ms` } as React.CSSProperties
  return notif.url ? (
    <Link to={notif.url} className={className} style={style} onClick={onClose}>
      {body}
    </Link>
  ) : (
    <div className={className} style={style}>
      {body}
    </div>
  )
}
