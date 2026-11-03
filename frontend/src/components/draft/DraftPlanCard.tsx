import { useEffect, useRef, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { post } from '../../lib/api'
import { DraftPlanEditor, type DraftPlan, type PlanPreviewRow } from './DraftPlanEditor'

interface PlanResponse {
  year: number
  offseason: boolean
  plan: DraftPlan
  saved: DraftPlan
  errors: string[]
  preview: PlanPreviewRow[]
  teams: { id: number; name: string }[]
  draft_created: boolean
}

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
      setMsg({ ok: true, text: 'Saved.' })
    } catch (e) {
      const raw = (e as Error).message || ''
      let text = 'Could not save.'
      try { text = (JSON.parse(raw).errors || []).join(' ') || text } catch { /* keep default */ }
      setMsg({ ok: false, text })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card mt-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
          <i className="bi bi-list-ol me-2" style={{ color: '#2dd4bf' }}></i>{data.year} draft order
        </h5>
        <button type="button" className="btn btn-primary btn-sm" disabled={!dirty || busy || view.errors.length > 0} onClick={save}>
          {busy ? 'Saving...' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>
      <div className="card-body p-0">
        {data.draft_created && (
          <div style={{ padding: '8px 14px', fontSize: '.78rem', color: '#d29922', borderBottom: '1px solid #21262d' }}>
            A supplemental draft is already created with the order it had then. Changes here apply to the next one you create.
          </div>
        )}
        {view.errors.length > 0 && (
          <div style={{ padding: '8px 14px', fontSize: '.78rem', color: '#f85149', borderBottom: '1px solid #21262d' }}>
            {view.errors.map(e => <div key={e}>{e}</div>)}
          </div>
        )}
        <DraftPlanEditor
          teams={data.teams}
          year={data.year}
          value={plan}
          onChange={setPlan}
          preview={view.errors.length ? null : view.preview}
          addedNote={data.offseason ? `${data.year} off-season draft` : 'off-season draft only'}
        />
        {msg && (
          <div style={{ padding: '0 14px 12px', fontSize: '.78rem', color: msg.ok ? '#3fb950' : '#f85149' }}>{msg.text}</div>
        )}
      </div>
    </div>
  )
}
