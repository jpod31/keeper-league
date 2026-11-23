import { useEffect, useState } from 'react'
import { api, post } from '../../lib/api'

interface Note { id: number; player_id: number; body: string; created_at: string }

/** "Mon 23 Nov 2026, 5:14 pm" in the reader's own time zone. */
export function noteStamp(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}

const MAX = 2000

/**
 * A manager's private notes on one player: add as many as you like, each
 * stamped with when it was written, each deletable. Nobody else sees them,
 * and they follow the player across every league you are in.
 * Styles: .pn-* in static/style.css.
 */
export function PlayerNotes({ playerId, onCount }: { playerId: number; onCount?: (n: number) => void }) {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    setNotes(null)
    api<{ notes: Note[] }>(`/api/players/${playerId}/notes`)
      .then(d => { if (live) setNotes(d.notes) })
      .catch(() => { if (live) { setNotes([]); setError('Your notes could not be loaded.') } })
    return () => { live = false }
  }, [playerId])

  useEffect(() => { if (notes) onCount?.(notes.length) }, [notes])

  async function add() {
    const body = draft.trim()
    if (!body || saving) return
    setSaving(true); setError(null)
    try {
      const d = await post<{ note: Note }>(`/api/players/${playerId}/notes`, { body })
      setNotes(n => [d.note, ...(n || [])])
      setDraft('')
    } catch {
      setError('That note was not saved. Try again.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    const before = notes
    setNotes(n => (n || []).filter(x => x.id !== id))
    setConfirmId(null)
    try {
      await api(`/api/players/notes/${id}`, { method: 'DELETE' })
    } catch {
      setNotes(before)
      setError('That note was not deleted. Try again.')
    }
  }

  return (
    <section className="pn">
      <div className="pn-head">
        <h3>My notes</h3>
        {notes && notes.length > 0 && <span className="pn-count">{notes.length}</span>}
        <span className="pn-private"><i className="bi bi-lock-fill"></i> Only you see these</span>
      </div>

      <div className="pn-add">
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value.slice(0, MAX))}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add() }}
          placeholder="Write a note on this player"
          rows={2}
          aria-label="New note"
        />
        <button type="button" className="pn-save" onClick={add} disabled={!draft.trim() || saving}>
          {saving ? 'Saving' : 'Add note'}
        </button>
      </div>
      {error && <div className="pn-error" role="alert">{error}</div>}

      {notes === null ? (
        <div className="pn-empty">Loading notes</div>
      ) : notes.length === 0 ? (
        <div className="pn-empty">No notes yet.</div>
      ) : (
        <ul className="pn-list">
          {notes.map(n => (
            <li key={n.id} className="pn-note">
              <div className="pn-note-top">
                <time dateTime={n.created_at}>{noteStamp(n.created_at)}</time>
                {confirmId === n.id ? (
                  <span className="pn-confirm">
                    <button type="button" className="pn-del-yes" onClick={() => remove(n.id)}>Delete</button>
                    <button type="button" className="pn-del-no" onClick={() => setConfirmId(null)}>Keep</button>
                  </span>
                ) : (
                  <button type="button" className="pn-del" onClick={() => setConfirmId(n.id)} aria-label="Delete this note">
                    <i className="bi bi-trash3"></i>
                  </button>
                )}
              </div>
              <p>{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
