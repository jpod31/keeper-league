import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// In-page replacements for the browser's confirm() and alert().
//   if (!await ask('Accept this trade?')) return
//   tell('Scoring updated.')
// <DialogHost /> is mounted once in App. Before it mounts (or in a test with
// no host) these fall back to the browser's own boxes, so nothing is skipped.

interface Req {
  id: number
  kind: 'ask' | 'tell'
  message: string
  ok: string
  cancel: string
  danger: boolean
  resolve: (v: boolean) => void
}

let push: ((r: Req) => void) | null = null
let seq = 0

// Words that mean the action removes or cannot be undone: the button goes red.
const RISKY = /\b(delete|delist|veto|restart|reset|remove|cannot be undone|replace)\b/i

export function ask(message: string, opts: { ok?: string; cancel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise(resolve => {
    if (!push) { resolve(window.confirm(message)); return }
    push({
      id: ++seq, kind: 'ask', message,
      ok: opts.ok || 'Confirm', cancel: opts.cancel || 'Cancel',
      danger: opts.danger ?? RISKY.test(message), resolve,
    })
  })
}

export function tell(message: string): Promise<boolean> {
  return new Promise(resolve => {
    if (!push) { window.alert(message); resolve(true); return }
    push({ id: ++seq, kind: 'tell', message, ok: 'OK', cancel: '', danger: false, resolve })
  })
}

export function DialogHost() {
  const [queue, setQueue] = useState<Req[]>([])
  useEffect(() => {
    push = r => setQueue(q => [...q, r])
    return () => { push = null }
  }, [])
  const cur = queue[0]
  useEffect(() => {
    if (!cur) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cur.resolve(cur.kind === 'tell'); setQueue(q => q.slice(1)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cur])
  if (!cur) return null
  const close = (v: boolean) => { cur.resolve(v); setQueue(q => q.slice(1)) }
  const [head, ...rest] = cur.message.split(/\n\s*\n/)
  return createPortal(
    <div className="kl-dlg-back" onClick={() => close(cur.kind === 'tell')}>
      <div className="kl-dlg" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <p className="kl-dlg-head">{head}</p>
        {rest.map((line, i) => <p key={i} className="kl-dlg-body">{line}</p>)}
        <div className="kl-dlg-foot">
          {cur.kind === 'ask' && <button type="button" className="kx-btn" onClick={() => close(false)}>{cur.cancel}</button>}
          <button type="button" autoFocus className={`kx-btn ${cur.danger ? 'kl-dlg-danger' : 'kx-btn-gold'}`} onClick={() => close(true)}>{cur.ok}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
