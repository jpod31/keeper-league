import { useEffect, useRef, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { post } from '../../lib/api'
import { DraftPlanEditor, type DraftPlan, type PlanPreviewRow } from './DraftPlanEditor'
import type { TeamCard } from './TeamCrest'

interface PlanResponse {
  year: number
  offseason: boolean
  plan: DraftPlan
  saved: DraftPlan
  errors: string[]
  preview: PlanPreviewRow[]
  teams: TeamCard[]
  draft_created: boolean
}

const CSS = `
.dpc { background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 14px; margin-top: 24px; overflow: hidden; }
.dpc-h { display: flex; align-items: center; gap: 12px; padding: 16px 18px 12px; border-bottom: 1px solid var(--kl-border); flex-wrap: wrap; }
.dpc-h h5 { margin: 0; font-size: 1rem; font-weight: 700; color: var(--kl-text-heading); }
.dpc-h p { margin: 2px 0 0; font-size: .8rem; color: var(--kl-text-secondary); }
.dpc-h > div { flex: 1; min-width: 200px; }
.dpc-save { border: 0; border-radius: 9px; padding: 8px 16px; font-size: .84rem; font-weight: 700; background: #58a6ff; color: #04111f; }
.dpc-save:disabled { background: var(--kl-bg-elevated); color: var(--kl-text-muted); }
.dpc-save:focus-visible { outline: 2px solid #58a6ff; outline-offset: 2px; }
.dpc-note { margin: 12px 18px 0; padding: 9px 12px; border-radius: 9px; font-size: .8rem; display: flex; gap: 8px; align-items: flex-start; }
.dpc-note.warn { background: rgba(210,153,34,.08); color: #e3b341; border: 1px solid rgba(210,153,34,.25); }
.dpc-note.err { background: rgba(248,81,73,.08); color: #ff7b72; border: 1px solid rgba(248,81,73,.25); }
.dpc-note.ok { background: rgba(63,185,80,.08); color: #56d364; border: 1px solid rgba(63,185,80,.25); }
`

/** This year's supplemental draft plan, edited where the draft is created. */
export function DraftPlanCard({ leagueId }: { leagueId: string }) {
  const url = `/leagues/${leagueId}/draft-plan?format=json`
  const { data } = useFetch<PlanResponse>(url)
  const [plan, setPlan] = useState<DraftPlan | null>(null)
  const [live, setLive] = useState<PlanResponse | null>(null)
  const [saved, setSaved] = useState<DraftPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (data && !plan) { setPlan(data.plan); setSaved(data.saved) }
  }, [data, plan])

  useEffect(() => {
    if (!plan || !data) return
    const n = ++seq.current
    const t = setTimeout(() => {
      post<PlanResponse>(url, { plan }).then(r => { if (n === seq.current) setLive(r) }).catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [plan, data, url])

  if (!data || !plan) return null
  const view = live ?? data
  const dirty = JSON.stringify(plan) !== JSON.stringify(saved)

  async function save() {
    if (!plan) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await post<PlanResponse>(url, { plan, save: true })
      setSaved(r.saved)
      setMsg({ ok: true, text: 'Draft order saved.' })
    } catch (e) {
      const raw = (e as Error).message || ''
      let text = 'The draft order wasn’t saved.'
      try { text = (JSON.parse(raw).errors || []).join(' ') || text } catch { /* keep default */ }
      setMsg({ ok: false, text })
    } finally {
      setBusy(false)
    }
  }

  const draftName = data.offseason ? `the ${data.year} off-season draft` : 'the off-season draft'

  return (
    <section className="dpc" aria-labelledby="dpc-title">
      <style>{CSS}</style>
      <div className="dpc-h">
        <div>
          <h5 id="dpc-title">{data.year} draft order</h5>
          <p>For the supplemental drafts held in {data.year}.</p>
        </div>
        <button type="button" className="dpc-save" disabled={!dirty || busy || view.errors.length > 0} onClick={save}>
          {busy ? 'Saving' : dirty ? 'Save draft order' : 'Saved'}
        </button>
      </div>
      {data.draft_created && (
        <div className="dpc-note warn"><i className="bi bi-info-circle"></i>
          <span>A supplemental draft is already set up with the order it had then. Changes apply to the next one you create.</span>
        </div>
      )}
      {view.errors.length > 0 && (
        <div className="dpc-note err"><i className="bi bi-exclamation-circle"></i><span>{view.errors.join(' ')}</span></div>
      )}
      {msg && <div className={`dpc-note ${msg.ok ? 'ok' : 'err'}`}><i className={`bi ${msg.ok ? 'bi-check-circle' : 'bi-exclamation-circle'}`}></i><span>{msg.text}</span></div>}
      <DraftPlanEditor
        teams={data.teams}
        year={data.year}
        value={plan}
        onChange={p => { setPlan(p); setMsg(null) }}
        preview={view.errors.length ? null : view.preview}
        addedFor={draftName}
      />
    </section>
  )
}
