import { useState } from 'react'
import { TeamCrest, CREST_CSS, type TeamCard } from './TeamCrest'

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

export interface PlanPreviewRow {
  pick: number; round: number; team: string; team_id?: number
  via: string | null; via_id?: number | null; label: string | null
}

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']

const BASIS: { v: DraftBasis; title: string; line: string }[] = [
  { v: 'reverse_ladder', title: 'Reverse ladder', line: 'Wooden spoon picks first' },
  { v: 'ladder', title: 'Ladder', line: 'Premier picks first' },
  { v: 'custom', title: 'Custom', line: 'You set the order' },
]

const CSS = `
${CREST_CSS}
.dp { padding: 4px 18px 18px; container-type: inline-size; }
.dp-group { margin-top: 16px; }
.dp-group-h { font-size: .9rem; font-weight: 650; color: var(--kl-text-heading); margin: 0 0 2px; }
.dp-group-p { font-size: .8rem; color: var(--kl-text-secondary); margin: 0 0 10px; }
.dp-opts { display: grid; gap: 8px; }
.dp-opts.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.dp-opts.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@container (max-width: 520px) { .dp-opts.three, .dp-opts.two { grid-template-columns: 1fr; } }
.dp-opt { text-align: left; background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 10px;
  padding: 11px 12px; color: var(--kl-text-primary); display: flex; gap: 10px; align-items: center;
  transition: border-color var(--kl-dur-fast) var(--kl-ease), background var(--kl-dur-fast) var(--kl-ease); }
.dp-opt:hover { border-color: var(--kl-border-light); }
.dp-opt[aria-pressed="true"] { border-color: #58a6ff; background: rgba(88,166,255,.08); }
.dp-opt:focus-visible { outline: 2px solid #58a6ff; outline-offset: 2px; }
.dp-opt-t { font-size: .86rem; font-weight: 650; display: block; }
.dp-opt-l { font-size: .76rem; color: var(--kl-text-secondary); display: block; margin-top: 1px; }
.dp-glyph { flex: none; width: 34px; height: 34px; border-radius: 8px; background: var(--kl-bg-elevated);
  display: grid; place-items: center; color: var(--kl-text-secondary); }
.dp-opt[aria-pressed="true"] .dp-glyph { color: #58a6ff; background: rgba(88,166,255,.12); }
.dp-pattern { display: grid; gap: 3px; flex: none; }
.dp-pattern div { display: flex; gap: 3px; }
.dp-pattern span { width: 15px; height: 15px; border-radius: 4px; font-size: .62rem; font-weight: 700; display: grid; place-items: center;
  background: var(--kl-bg-elevated); color: var(--kl-text-secondary); font-variant-numeric: tabular-nums; }
.dp-opt[aria-pressed="true"] .dp-pattern span { background: rgba(88,166,255,.14); color: #58a6ff; }
.dp-list { display: grid; gap: 6px; }
.dp-item { display: flex; align-items: center; gap: 10px; background: var(--kl-bg-body); border: 1px solid var(--kl-border);
  border-radius: 10px; padding: 6px 6px 6px 8px; font-size: .86rem; color: var(--kl-text-primary); }
.dp-item.drag-over { border-color: #58a6ff; }
.dp-item.dragging { opacity: .45; }
.dp-grip { color: var(--kl-text-faint); cursor: grab; padding: 0 2px; }
.dp-num { width: 22px; text-align: right; color: var(--kl-text-muted); font-weight: 600; font-variant-numeric: tabular-nums; }
.dp-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dp-icon { border: 0; background: transparent; color: var(--kl-text-secondary); width: 30px; height: 30px; border-radius: 7px; display: grid; place-items: center; }
.dp-icon:hover:not(:disabled) { color: var(--kl-text-heading); background: var(--kl-bg-elevated); }
.dp-icon:focus-visible { outline: 2px solid #58a6ff; outline-offset: 1px; }
.dp-icon:disabled { opacity: .25; }
.dp-add { display: grid; grid-template-columns: minmax(0, 1.3fr) auto auto minmax(0, 1fr) 30px; gap: 8px; align-items: center;
  background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-left: 3px solid #d29922; border-radius: 10px; padding: 8px; }
@container (max-width: 760px) { .dp-add { grid-template-columns: minmax(0, 1fr) auto 30px; } .dp-add .dp-seg, .dp-add .dp-note { grid-column: 1 / -1; }
  .dp-add > .dp-icon { grid-row: 1; grid-column: 3; } .dp-add .dp-seg { display: flex; } .dp-add .dp-seg button { flex: 1; } }
.dp-team { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dp-in { background: var(--kl-bg-card); border: 1px solid var(--kl-border); color: var(--kl-text-primary); border-radius: 7px;
  padding: 6px 8px; font-size: .82rem; min-width: 0; width: 100%; }
.dp-in:focus { outline: none; border-color: #58a6ff; }
.dp-step { display: inline-flex; align-items: center; border: 1px solid var(--kl-border); border-radius: 7px; background: var(--kl-bg-card); }
.dp-step button { border: 0; background: transparent; color: var(--kl-text-secondary); width: 26px; height: 30px; }
.dp-step button:hover:not(:disabled) { color: var(--kl-text-heading); }
.dp-step button:disabled { opacity: .3; }
.dp-step span { min-width: 58px; text-align: center; font-size: .8rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.dp-seg { display: inline-flex; background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 8px; padding: 2px; }
.dp-seg button { border: 0; background: transparent; color: var(--kl-text-secondary); font-size: .78rem; font-weight: 600; padding: 5px 10px; border-radius: 6px; white-space: nowrap; }
.dp-seg button.on { background: rgba(88,166,255,.16); color: #58a6ff; }
.dp-seg button:focus-visible { outline: 2px solid #58a6ff; }
.dp-addbtn { margin-top: 8px; border: 1px dashed var(--kl-border-light); background: transparent; color: var(--kl-text-secondary);
  border-radius: 10px; padding: 8px 12px; font-size: .82rem; font-weight: 600; width: 100%; }
.dp-addbtn:hover { color: var(--kl-text-heading); border-color: #58a6ff; }
.dp-board { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.dp-col { background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 12px; overflow: hidden; }
.dp-col-h { padding: 8px 12px; font-size: .78rem; font-weight: 650; color: var(--kl-text-secondary); border-bottom: 1px solid var(--kl-border);
  display: flex; justify-content: space-between; }
.dp-slot { display: flex; align-items: center; gap: 9px; padding: 7px 12px; border-bottom: 1px solid rgba(40,50,74,.6); font-size: .84rem; min-height: 40px; }
.dp-slot:last-child { border-bottom: 0; }
.dp-slot.added { background: rgba(210,153,34,.06); box-shadow: inset 3px 0 0 #d29922; }
.dp-slot .dp-num { width: 20px; }
.dp-slot-name { flex: 1; min-width: 0; color: var(--kl-text-primary); }
.dp-slot-name small { display: block; font-size: .72rem; color: var(--kl-text-muted); }
.dp-slot.tbd .dp-slot-name { color: var(--kl-text-secondary); }
.dp-tag { font-size: .7rem; font-weight: 650; color: #d29922; white-space: nowrap; }
.dp-ph { width: 22px; height: 22px; border-radius: 7px; border: 1px dashed var(--kl-border-light); flex: none; }
`

function SameGlyph() {
  return <span className="dp-pattern"><div><span>1</span><span>2</span><span>3</span></div><div><span>1</span><span>2</span><span>3</span></div></span>
}
function SnakeGlyph() {
  return <span className="dp-pattern"><div><span>1</span><span>2</span><span>3</span></div><div><span>3</span><span>2</span><span>1</span></div></span>
}

interface BoardSlot { pick: number; round: number; teamId?: number; placeholder?: string; viaId?: number | null; label?: string | null }

/** Board for a plan whose ladder isn't known yet: ladder positions stand in
 *  for teams, a custom order shows the teams themselves. */
function localBoard(plan: DraftPlan, teamCount: number, rounds: number): BoardSlot[] {
  const base: { teamId?: number; placeholder?: string }[] =
    plan.draft_order_basis === 'custom' && plan.draft_custom_order.length === teamCount
      ? plan.draft_custom_order.map(id => ({ teamId: id }))
      : Array.from({ length: teamCount }, (_, i) => ({
          placeholder: plan.draft_order_basis === 'ladder' ? ORD[i] : ORD[teamCount - 1 - i],
        }))
  const out: BoardSlot[] = []
  let n = 1
  for (let r = 1; r <= rounds; r++) {
    const order = plan.draft_style === 'snake' && r % 2 === 0 ? [...base].reverse() : base
    const added = plan.draft_compensation.filter(c => c.round === r && c.team_id)
    for (const c of added.filter(c => c.placement === 'start')) out.push({ pick: n++, round: r, teamId: c.team_id, label: c.note || 'Added pick' })
    for (const s of order) out.push({ pick: n++, round: r, ...s })
    for (const c of added.filter(c => c.placement === 'end')) out.push({ pick: n++, round: r, teamId: c.team_id, label: c.note || 'Added pick' })
  }
  return out
}

export function DraftPlanEditor({
  teams, value, onChange, year, preview, addedFor,
}: {
  teams: TeamCard[]
  value: DraftPlan
  onChange: (p: DraftPlan) => void
  /** The season whose ladder sets the order. */
  year: number
  /** First rounds of the real draft, from the server; omitted when the ladder isn't known yet. */
  preview?: PlanPreviewRow[] | null
  /** Which draft added picks go into, e.g. "the 2026 off-season draft". */
  addedFor: string
}) {
  const byId = new Map(teams.map(t => [t.id, t]))
  const set = (patch: Partial<DraftPlan>) => onChange({ ...value, ...patch })
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  function chooseBasis(b: DraftBasis) {
    if (b === 'custom' && value.draft_custom_order.length !== teams.length) {
      // Start from the order the draft would run in right now.
      const fromPreview = (preview ?? []).filter(r => r.round === 1 && !r.label).map(r => r.via_id ?? r.team_id)
      const seed = fromPreview.length === teams.length && fromPreview.every(Boolean)
        ? (fromPreview as number[]) : teams.map(t => t.id)
      set({ draft_order_basis: b, draft_custom_order: seed })
    } else {
      set({ draft_order_basis: b })
    }
  }

  function moveTo(from: number, to: number) {
    if (to < 0 || to >= value.draft_custom_order.length || from === to) return
    const o = [...value.draft_custom_order]
    const [x] = o.splice(from, 1)
    o.splice(to, 0, x)
    set({ draft_custom_order: o })
  }

  const setAdded = (i: number, patch: Partial<AddedPick>) =>
    set({ draft_compensation: value.draft_compensation.map((c, k) => (k === i ? { ...c, ...patch } : c)) })

  const slots: BoardSlot[] = preview
    ? preview.map(p => ({ pick: p.pick, round: p.round, teamId: p.team_id, viaId: p.via_id, label: p.label }))
    : localBoard(value, teams.length, 2)
  const rounds = [...new Set(slots.map(s => s.round))]

  return (
    <div className="dp">
      <style>{CSS}</style>

      <div className="dp-group">
        <h4 className="dp-group-h">Who picks first</h4>
        <div className="dp-opts three" role="group" aria-label="Draft order">
          {BASIS.map(b => (
            <button key={b.v} type="button" className="dp-opt" aria-pressed={value.draft_order_basis === b.v} onClick={() => chooseBasis(b.v)}>
              <span className="dp-glyph">
                <i className={`bi ${b.v === 'reverse_ladder' ? 'bi-sort-numeric-up-alt' : b.v === 'ladder' ? 'bi-sort-numeric-down' : 'bi-grip-vertical'}`}></i>
              </span>
              <span><span className="dp-opt-t">{b.title}</span><span className="dp-opt-l">{b.line}</span></span>
            </button>
          ))}
        </div>
      </div>

      <div className="dp-group">
        <h4 className="dp-group-h">Each round</h4>
        <div className="dp-opts two" role="group" aria-label="Order each round">
          <button type="button" className="dp-opt" aria-pressed={value.draft_style === 'linear'} onClick={() => set({ draft_style: 'linear' })}>
            <SameGlyph />
            <span><span className="dp-opt-t">Same order</span><span className="dp-opt-l">Every round runs like round 1</span></span>
          </button>
          <button type="button" className="dp-opt" aria-pressed={value.draft_style === 'snake'} onClick={() => set({ draft_style: 'snake' })}>
            <SnakeGlyph />
            <span><span className="dp-opt-t">Snake</span><span className="dp-opt-l">Order flips every second round</span></span>
          </button>
        </div>
      </div>

      {value.draft_order_basis === 'custom' && (
        <div className="dp-group">
          <h4 className="dp-group-h">Your order</h4>
          <p className="dp-group-p">Drag teams, or use the arrows. This is round 1.</p>
          <div className="dp-list">
            {value.draft_custom_order.map((id, i) => (
              <div
                key={id}
                className={`dp-item${overIdx === i && dragIdx !== i ? ' drag-over' : ''}${dragIdx === i ? ' dragging' : ''}`}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={e => { e.preventDefault(); setOverIdx(i) }}
                onDrop={e => { e.preventDefault(); if (dragIdx !== null) moveTo(dragIdx, i); setDragIdx(null); setOverIdx(null) }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null) }}
              >
                <i className="bi bi-grip-vertical dp-grip"></i>
                <span className="dp-num">{i + 1}</span>
                <TeamCrest team={byId.get(id)} size={26} />
                <span className="dp-name">{byId.get(id)?.name ?? '?'}</span>
                <button type="button" className="dp-icon" aria-label={`Move ${byId.get(id)?.name} up`} disabled={i === 0} onClick={() => moveTo(i, i - 1)}>
                  <i className="bi bi-chevron-up"></i>
                </button>
                <button type="button" className="dp-icon" aria-label={`Move ${byId.get(id)?.name} down`} disabled={i === value.draft_custom_order.length - 1} onClick={() => moveTo(i, i + 1)}>
                  <i className="bi bi-chevron-down"></i>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dp-group">
        <h4 className="dp-group-h">Added picks</h4>
        <p className="dp-group-p">Compensation or priority picks for {addedFor}, slotted at the start or end of a round.</p>
        <div className="dp-list">
          {value.draft_compensation.map((c, i) => (
            <div className="dp-add" key={i}>
              <div className="dp-team">
                <TeamCrest team={byId.get(c.team_id)} size={28} />
                <select className="dp-in" value={c.team_id || ''} aria-label="Team" onChange={e => setAdded(i, { team_id: Number(e.target.value) })}>
                  <option value="">Choose a team</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="dp-step" aria-label="Round">
                <button type="button" aria-label="Earlier round" disabled={c.round <= 1} onClick={() => setAdded(i, { round: c.round - 1 })}><i className="bi bi-dash"></i></button>
                <span>Round {c.round}</span>
                <button type="button" aria-label="Later round" disabled={c.round >= 20} onClick={() => setAdded(i, { round: c.round + 1 })}><i className="bi bi-plus"></i></button>
              </div>
              <div className="dp-seg" role="group" aria-label="Placement">
                <button type="button" className={c.placement === 'start' ? 'on' : ''} onClick={() => setAdded(i, { placement: 'start' })}>Start of round</button>
                <button type="button" className={c.placement === 'end' ? 'on' : ''} onClick={() => setAdded(i, { placement: 'end' })}>End of round</button>
              </div>
              <input className="dp-in dp-note" maxLength={40} placeholder="Label, e.g. Compensation" aria-label="Label"
                value={c.note} onChange={e => setAdded(i, { note: e.target.value })} />
              <button type="button" className="dp-icon" aria-label="Remove this pick"
                onClick={() => set({ draft_compensation: value.draft_compensation.filter((_, k) => k !== i) })}>
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="dp-addbtn"
          onClick={() => set({ draft_compensation: [...value.draft_compensation, { team_id: 0, round: 1, placement: 'end', note: '' }] })}>
          <i className="bi bi-plus-lg me-1"></i>Add a pick
        </button>
      </div>

      <div className="dp-group">
        <h4 className="dp-group-h">Draft board</h4>
        <p className="dp-group-p">
          {preview
            ? 'How the first rounds run, traded picks included.'
            : value.draft_order_basis === 'custom'
              ? 'Your custom order. Traded picks are applied on the night.'
              : `Teams fill in from the ${year} ladder when the draft is created.`}
        </p>
        <div className="dp-board">
          {rounds.map(r => (
            <div className="dp-col" key={r}>
              <div className="dp-col-h"><span>Round {r}</span></div>
              {slots.filter(s => s.round === r).map(s => {
                const team = s.teamId ? byId.get(s.teamId) : undefined
                const via = s.viaId ? byId.get(s.viaId) : undefined
                return (
                  <div key={s.pick} className={`dp-slot${s.label ? ' added' : ''}${s.placeholder ? ' tbd' : ''}`}>
                    <span className="dp-num">{s.pick}</span>
                    {team ? <TeamCrest team={team} size={22} /> : <span className="dp-ph" />}
                    <span className="dp-slot-name">
                      {team ? team.name : `${s.placeholder} on the ladder`}
                      {via && <small>via {via.name}</small>}
                    </span>
                    {s.label && <span className="dp-tag">{s.label}</span>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
