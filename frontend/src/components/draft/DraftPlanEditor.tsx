export type DraftBasis = 'reverse_ladder' | 'ladder' | 'custom'
export type DraftStyle = 'linear' | 'snake'

export interface AddedPick {
  team_id: number
  round: number
  placement: 'start' | 'end'
  note: string
}

export interface DraftPlan {
  draft_order_basis: DraftBasis
  draft_style: DraftStyle
  draft_custom_order: number[]
  draft_compensation: AddedPick[]
}

export interface PlanPreviewRow { pick: number; round: number; team: string; via: string | null; label: string | null }

interface TeamRef { id: number; name: string }

const CSS = `
.dp-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #21262d; min-height: 50px; flex-wrap: wrap; row-gap: 8px; }
.dp-label { flex: 1 1 140px; min-width: 0; font-size: .85rem; color: #e6edf3; }
.dp-seg { display: inline-flex; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 2px; margin-left: auto; }
.dp-seg button { border: 0; background: transparent; color: #8b949e; font-size: .78rem; font-weight: 600; padding: 4px 10px; border-radius: 6px; white-space: nowrap; }
.dp-seg button.on { background: rgba(88,166,255,.16); color: #58a6ff; }
.dp-sub { padding: 8px 14px 12px; border-bottom: 1px solid #21262d; }
.dp-sub-h { font-size: .7rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #8b949e; margin-bottom: 6px; }
.dp-order { display: flex; flex-direction: column; gap: 4px; }
.dp-order-item { display: flex; align-items: center; gap: 8px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 4px 6px 4px 10px; font-size: .82rem; color: #e6edf3; }
.dp-order-item b { width: 18px; color: #58a6ff; font-variant-numeric: tabular-nums; }
.dp-order-item span { flex: 1; min-width: 0; }
.dp-icon { border: 0; background: transparent; color: #8b949e; padding: 2px 6px; border-radius: 4px; font-size: .85rem; }
.dp-icon:hover:not(:disabled) { color: #e6edf3; background: rgba(255,255,255,.06); }
.dp-icon:disabled { opacity: .3; }
.dp-add { display: grid; grid-template-columns: minmax(0, 1.4fr) 64px auto minmax(0, 1fr) 28px; gap: 6px; align-items: center; margin-bottom: 6px; }
@media (max-width: 575px) { .dp-add { grid-template-columns: minmax(0, 1fr) 64px 28px; } .dp-add .dp-seg, .dp-add .dp-note { grid-column: 1 / -1; margin-left: 0; } }
.dp-in { background: #0d1117; border: 1px solid #30363d; color: #e6edf3; border-radius: 6px; padding: .3rem .5rem; font-size: .8rem; min-width: 0; width: 100%; }
.dp-in:focus { outline: none; border-color: #58a6ff; }
.dp-addbtn { border: 1px dashed #30363d; background: transparent; color: #8b949e; border-radius: 6px; padding: 5px 10px; font-size: .78rem; font-weight: 600; }
.dp-addbtn:hover { color: #e6edf3; border-color: #8b949e; }
.dp-empty { font-size: .76rem; color: #8b949e; margin-bottom: 6px; }
.dp-prev { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
@media (max-width: 575px) { .dp-prev { grid-template-columns: 1fr; } }
.dp-prev-round { font-size: .68rem; font-weight: 700; color: #8b949e; text-transform: uppercase; letter-spacing: .05em; margin: 4px 0 2px; }
.dp-prev-row { display: flex; gap: 8px; font-size: .8rem; color: #c9d1d9; padding: 2px 0; }
.dp-prev-row b { width: 20px; color: #8b949e; font-variant-numeric: tabular-nums; font-weight: 600; }
.dp-tag { font-size: .68rem; font-weight: 700; color: #d29922; background: rgba(210,153,34,.1); border: 1px solid rgba(210,153,34,.3); border-radius: 999px; padding: 0 7px; white-space: nowrap; }
.dp-via { color: #8b949e; font-size: .74rem; }
`

export function DraftPlanEditor({
  teams, value, onChange, year, preview, addedNote,
}: {
  teams: TeamRef[]
  value: DraftPlan
  onChange: (p: DraftPlan) => void
  /** The season whose ladder sets the order. */
  year: number
  /** First rounds of the real draft; omitted when the ladder isn't known yet. */
  preview?: PlanPreviewRow[] | null
  addedNote?: string
}) {
  const name = (id: number) => teams.find(t => t.id === id)?.name ?? '?'
  const set = (patch: Partial<DraftPlan>) => onChange({ ...value, ...patch })

  function chooseBasis(b: DraftBasis) {
    if (b === 'custom' && value.draft_custom_order.length !== teams.length) {
      // Start the custom list from what the draft would be right now.
      const fromPreview = (preview ?? []).filter(r => r.round === 1 && !r.label && !r.via).map(r => teams.find(t => t.name === r.team)?.id)
      const seed = fromPreview.length === teams.length && fromPreview.every(Boolean)
        ? (fromPreview as number[]) : teams.map(t => t.id)
      set({ draft_order_basis: b, draft_custom_order: seed })
    } else {
      set({ draft_order_basis: b })
    }
  }

  function move(i: number, d: -1 | 1) {
    const o = [...value.draft_custom_order]
    const j = i + d
    if (j < 0 || j >= o.length) return
    ;[o[i], o[j]] = [o[j], o[i]]
    set({ draft_custom_order: o })
  }

  function setAdded(i: number, patch: Partial<AddedPick>) {
    set({ draft_compensation: value.draft_compensation.map((c, k) => (k === i ? { ...c, ...patch } : c)) })
  }

  const rounds = preview ? [...new Set(preview.map(r => r.round))] : []

  return (
    <>
      <style>{CSS}</style>
      <div className="dp-row">
        <span className="dp-label">Order</span>
        <div className="dp-seg">
          {([['reverse_ladder', 'Reverse ladder'], ['ladder', 'Ladder'], ['custom', 'Custom']] as const).map(([v, l]) => (
            <button key={v} type="button" className={value.draft_order_basis === v ? 'on' : ''} onClick={() => chooseBasis(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="dp-row">
        <span className="dp-label">Each round</span>
        <div className="dp-seg">
          <button type="button" className={value.draft_style === 'linear' ? 'on' : ''} onClick={() => set({ draft_style: 'linear' })}>Same order</button>
          <button type="button" className={value.draft_style === 'snake' ? 'on' : ''} onClick={() => set({ draft_style: 'snake' })}>Snake</button>
        </div>
      </div>

      {value.draft_order_basis === 'custom' && (
        <div className="dp-sub">
          <div className="dp-sub-h">Custom order, round 1</div>
          <div className="dp-order">
            {value.draft_custom_order.map((id, i) => (
              <div className="dp-order-item" key={id}>
                <b>{i + 1}</b>
                <span>{name(id)}</span>
                <button type="button" className="dp-icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><i className="bi bi-chevron-up"></i></button>
                <button type="button" className="dp-icon" aria-label="Move down" disabled={i === value.draft_custom_order.length - 1} onClick={() => move(i, 1)}><i className="bi bi-chevron-down"></i></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dp-sub">
        <div className="dp-sub-h">Added picks{addedNote ? ` · ${addedNote}` : ''}</div>
        {value.draft_compensation.length === 0 && (
          <div className="dp-empty">None. Compensation and priority picks go here.</div>
        )}
        {value.draft_compensation.map((c, i) => (
          <div className="dp-add" key={i}>
            <select className="dp-in" value={c.team_id || ''} onChange={e => setAdded(i, { team_id: Number(e.target.value) })}>
              <option value="">Team</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input className="dp-in" type="number" min={1} max={20} value={c.round} aria-label="Round"
              onChange={e => setAdded(i, { round: Number(e.target.value) || 1 })} />
            <div className="dp-seg" style={{ marginLeft: 0 }}>
              <button type="button" className={c.placement === 'start' ? 'on' : ''} onClick={() => setAdded(i, { placement: 'start' })}>Start of round</button>
              <button type="button" className={c.placement === 'end' ? 'on' : ''} onClick={() => setAdded(i, { placement: 'end' })}>End of round</button>
            </div>
            <input className="dp-in dp-note" maxLength={40} placeholder="Label, e.g. Compensation" value={c.note}
              onChange={e => setAdded(i, { note: e.target.value })} />
            <button type="button" className="dp-icon" aria-label="Remove" onClick={() => set({ draft_compensation: value.draft_compensation.filter((_, k) => k !== i) })}>
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        ))}
        <button type="button" className="dp-addbtn"
          onClick={() => set({ draft_compensation: [...value.draft_compensation, { team_id: 0, round: 1, placement: 'end', note: '' }] })}>
          <i className="bi bi-plus-lg me-1"></i>Add a pick
        </button>
      </div>

      <div className="dp-sub" style={{ borderBottom: 'none' }}>
        <div className="dp-sub-h">{preview ? 'First picks' : 'Order'}</div>
        {preview ? (
          <div className="dp-prev">
            {rounds.map(r => (
              <div key={r}>
                <div className="dp-prev-round">Round {r}</div>
                {preview.filter(p => p.round === r).map(p => (
                  <div className="dp-prev-row" key={p.pick}>
                    <b>{p.pick}</b>
                    <span>{p.team}{p.via && <span className="dp-via"> via {p.via}</span>}</span>
                    {p.label && <span className="dp-tag">{p.label}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="dp-empty" style={{ marginBottom: 0 }}>
            {value.draft_order_basis === 'custom'
              ? 'Your custom order above.'
              : `${value.draft_order_basis === 'ladder' ? 'Best to worst' : 'Worst to best'} on the ${year} ladder, set when the draft is created.`}
          </div>
        )}
      </div>
    </>
  )
}
