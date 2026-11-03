import { useParams, Link } from 'react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { post } from '../../lib/api'
import { AdminSubnav } from '../../components/nav/AdminSubnav'
import { LeagueBreadcrumb } from '../../components/ui/LeagueBreadcrumb'
import { DraftPlanEditor, type DraftPlan } from '../../components/draft/DraftPlanEditor'
import { TeamCrest, CREST_CSS, type TeamCard } from '../../components/draft/TeamCrest'
import { useLeague } from '../../contexts/LeagueContext'

type TradeMode = 'window' | 'until_round' | 'all_year'

interface Settings extends DraftPlan {
  num_regular_rounds: number
  opening_round: boolean
  fixture_weighting: 'random' | 'ladder'
  finals_teams: number
  captain_scoring_enabled: boolean
  sevens_captain_enabled: boolean
  squad_size: number
  offseason_draft_min_picks: number
  ssp_enabled: boolean
  ssp_slots: number
  ssp_cutoff_round: number
  mid_season_draft_enabled: boolean
  mid_season_draft_after_round: number
  mid_season_delist_required: number
  mid_season_trade_mode: TradeMode
  mid_season_trade_until_round: number
}

interface Check {
  key: string; level: 'ok' | 'warn' | 'block'; label: string; detail: string
  action: { kind: 'step'; step: string; label: string } | { kind: 'link'; to: string; label: string } | null
  teams?: { team_id: number; count: number }[]
}

interface FixtureRow { team: string; team_id: number; finish: number; vs?: (number | null)[]; vs_even?: number }
interface FixturePreview { weighting: 'random' | 'ladder'; from_year: number; full_cycles: number; extra_rounds: number; teams: FixtureRow[] }
interface LadderRow extends TeamCard { pos: number; wins: number; losses: number; draws: number; pct: number }

interface Preview {
  fixture: FixturePreview | null
  from_year: number
  to_year: number
  settings: Settings
  current: Settings
  errors: string[]
  checks: Check[]
  can_start: boolean
  team_count: number
  teams: TeamCard[]
  ladder: LadderRow[]
}

interface Summary {
  year: number; rounds: number; opening_round: boolean; fixtures: number
  trades_expired: number; ltil_released: number
  first_round: number | null; first_matches: { home_id: number; away_id: number }[]
  teams: TeamCard[]
}

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']
const TRADE_MODES: { value: TradeMode; label: string }[] = [
  { value: 'window', label: '2-day window' },
  { value: 'until_round', label: 'Until a round' },
  { value: 'all_year', label: 'All season' },
]

function fmt(key: keyof Settings, s: Settings): string {
  const v = s[key]
  if (key === 'draft_order_basis' || key === 'draft_style') {
    const basis = { reverse_ladder: 'Reverse ladder', ladder: 'Ladder', custom: 'Custom order' }[s.draft_order_basis]
    return `${basis}, ${s.draft_style === 'snake' ? 'snake' : 'same order each round'}`
  }
  if (key === 'draft_custom_order') return s.draft_order_basis === 'custom' ? 'Custom order set' : 'Not used'
  if (key === 'draft_compensation') return s.draft_compensation.length ? `${s.draft_compensation.length} added` : 'None'
  if (typeof v === 'boolean') return v ? 'On' : 'Off'
  if (key === 'finals_teams') return v === 0 ? 'No finals' : `Top ${v}`
  if (key === 'fixture_weighting') return v === 'ladder' ? 'Ladder-weighted' : 'Even'
  if (key === 'mid_season_trade_mode') return TRADE_MODES.find(m => m.value === v)?.label ?? String(v)
  return String(v)
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const CSS = `
${CREST_CSS}
.ns { width: 100%; min-width: 0; --ns-gap: 20px; }
.ns-hero { position: relative; overflow: hidden; border-radius: 18px; border: 1px solid var(--kl-border);
  background: radial-gradient(120% 140% at 0% 0%, rgba(88,166,255,.10), transparent 55%), var(--kl-bg-card);
  padding: 22px 24px; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 24px; align-items: center; margin-bottom: var(--ns-gap); }
@media (max-width: 991px) { .ns-hero { grid-template-columns: 1fr; padding: 18px; } }
.ns-kicker { font-size: .84rem; color: var(--kl-text-secondary); margin: 0 0 6px; }
.ns-years { display: flex; align-items: baseline; gap: 14px; font-variant-numeric: tabular-nums; line-height: 1; margin: 0; }
.ns-years .from { font-size: 2.1rem; font-weight: 700; color: var(--kl-text-faint); }
.ns-years .arrow { font-size: 1.3rem; color: var(--kl-text-muted); align-self: center; }
.ns-years .to { font-size: 3.2rem; font-weight: 800; letter-spacing: -.03em; color: var(--kl-text-heading); }
.ns-status { margin: 12px 0 0; font-size: .92rem; color: var(--kl-text-primary); display: flex; gap: 8px; align-items: center; }
.ns-status .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.ns-ladder-h { font-size: .8rem; color: var(--kl-text-secondary); margin: 0 0 8px; }
.ns-ladder { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 8px; }
@media (max-width: 991px) { .ns-ladder { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.ns-lad { background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 12px; padding: 10px 8px 9px;
  display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; min-width: 0;
  animation: ns-in .5s var(--kl-ease-out) both; animation-delay: calc(var(--i) * 70ms); }
.ns-lad.prem { border-color: rgba(227,179,65,.55); background: linear-gradient(180deg, rgba(227,179,65,.10), var(--kl-bg-body) 70%); }
.ns-lad-pos { font-size: .74rem; font-weight: 700; color: var(--kl-text-muted); font-variant-numeric: tabular-nums; }
.ns-lad.prem .ns-lad-pos { color: #e3b341; }
.ns-lad-name { font-size: .8rem; font-weight: 650; color: var(--kl-text-primary); width: 100%; line-height: 1.25; min-height: 2.5em;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.ns-lad-rec { font-size: .72rem; color: var(--kl-text-muted); font-variant-numeric: tabular-nums; }
@media (max-width: 575px) { .ns-lad-name { font-size: .74rem; overflow-wrap: normal; word-break: normal; } }
@keyframes ns-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .ns-lad { animation: none; } }

.ns-grid { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: var(--ns-gap); align-items: start; }
@media (max-width: 1099px) { .ns-grid { grid-template-columns: minmax(0, 1fr); } }
.ns-step { margin-bottom: var(--ns-gap); }
.ns-step-h { display: flex; align-items: center; gap: 10px; margin: 0 0 10px; }
.ns-step-n { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: .82rem; font-weight: 800;
  background: var(--kl-bg-elevated); color: var(--kl-text-primary); flex: none; font-variant-numeric: tabular-nums; }
.ns-step-n.done { background: rgba(63,185,80,.16); color: #56d364; }
.ns-step-h h2 { margin: 0; font-size: 1.12rem; font-weight: 700; color: var(--kl-text-heading); }
.ns-step-h span.sub { font-size: .82rem; color: var(--kl-text-secondary); margin-left: auto; }

.ns-panel { background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 14px; overflow: hidden; margin-bottom: 14px; }
.ns-panel-h { padding: 14px 18px 4px; }
.ns-panel-h h3 { margin: 0; font-size: .98rem; font-weight: 700; color: var(--kl-text-heading); }
.ns-panel-h p { margin: 2px 0 0; font-size: .8rem; color: var(--kl-text-secondary); }

.ns-check { display: flex; gap: 12px; padding: 13px 18px; border-top: 1px solid var(--kl-border); align-items: flex-start; }
.ns-check:first-child { border-top: 0; }
.ns-check > i { font-size: 1.05rem; margin-top: 1px; }
.ns-check-b { flex: 1; min-width: 0; }
.ns-check-t { font-size: .9rem; font-weight: 650; color: var(--kl-text-heading); }
.ns-check-d { font-size: .8rem; color: var(--kl-text-secondary); margin-top: 2px; }
.ns-check-err { font-size: .8rem; color: #ff7b72; margin-top: 6px; padding: 7px 10px; border-radius: 8px;
  background: rgba(248,81,73,.08); border: 1px solid rgba(248,81,73,.22); }
.ns-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.ns-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--kl-bg-body); border: 1px solid var(--kl-border);
  border-radius: 999px; padding: 3px 10px 3px 4px; font-size: .78rem; color: var(--kl-text-primary); }
.ns-chip b { font-variant-numeric: tabular-nums; }
.ns-act { flex: none; border-radius: 8px; padding: 6px 12px; font-size: .8rem; font-weight: 650; text-decoration: none; white-space: nowrap;
  border: 1px solid var(--kl-border-light); background: var(--kl-bg-elevated); color: var(--kl-text-heading); }
.ns-act:hover { border-color: #58a6ff; color: #fff; }
.ns-act.block { border-color: rgba(248,81,73,.5); background: rgba(248,81,73,.1); color: #ffa198; }
.ns-act.block:hover { background: rgba(248,81,73,.18); }
.ns-act:focus-visible { outline: 2px solid #58a6ff; outline-offset: 2px; }
.ns-done-line { display: flex; gap: 8px; align-items: center; padding: 11px 18px; border-top: 1px solid var(--kl-border);
  font-size: .82rem; color: var(--kl-text-secondary); }
.ns-done-line i { color: #3fb950; }

.ns-row { display: flex; align-items: center; gap: 16px; padding: 12px 18px; border-top: 1px solid var(--kl-border); position: relative; min-height: 60px; }
.ns-panel-h + .ns-row { border-top: 0; margin-top: 6px; }
.ns-row.changed { box-shadow: inset 3px 0 0 #d29922; background: rgba(210,153,34,.04); }
.ns-row.off { opacity: .42; }
.ns-row-l { flex: 1 1 200px; min-width: 0; }
.ns-row-t { font-size: .88rem; font-weight: 600; color: var(--kl-text-primary); }
.ns-row-p { font-size: .77rem; color: var(--kl-text-secondary); margin-top: 1px; }
.ns-row-was { font-size: .74rem; color: #e3b341; margin-top: 2px; }
@media (max-width: 575px) { .ns-row { flex-wrap: wrap; row-gap: 10px; } .ns-row .ns-seg { margin-left: auto; } }

.ns-num { display: inline-flex; align-items: center; border: 1px solid var(--kl-border); border-radius: 9px; background: var(--kl-bg-body); }
.ns-num button { border: 0; background: transparent; color: var(--kl-text-secondary); width: 30px; height: 34px; font-size: 1rem; }
.ns-num button:hover:not(:disabled) { color: var(--kl-text-heading); }
.ns-num button:disabled { opacity: .3; }
.ns-num button:focus-visible, .ns-num input:focus-visible { outline: 2px solid #58a6ff; outline-offset: -2px; border-radius: 8px; }
.ns-num input { width: 40px; border: 0; background: transparent; color: var(--kl-text-heading); text-align: center; font-size: .92rem;
  font-weight: 700; font-variant-numeric: tabular-nums; -moz-appearance: textfield; }
.ns-num input::-webkit-inner-spin-button, .ns-num input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.ns-seg { display: inline-flex; background: var(--kl-bg-body); border: 1px solid var(--kl-border); border-radius: 9px; padding: 3px; }
.ns-seg button { border: 0; background: transparent; color: var(--kl-text-secondary); font-size: .8rem; font-weight: 650; padding: 6px 12px; border-radius: 7px; white-space: nowrap; }
.ns-seg button[aria-pressed="true"] { background: rgba(88,166,255,.16); color: #58a6ff; }
.ns-seg button:focus-visible { outline: 2px solid #58a6ff; }
.ns-switch { position: relative; width: 44px; height: 26px; flex: none; }
.ns-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
.ns-switch span { position: absolute; inset: 0; border-radius: 999px; background: var(--kl-bg-elevated); border: 1px solid var(--kl-border-light);
  transition: background var(--kl-dur-base) var(--kl-ease); pointer-events: none; }
.ns-switch span::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--kl-text-muted); transition: transform var(--kl-dur-base) var(--kl-ease-out), background var(--kl-dur-base); }
.ns-switch input:checked + span { background: rgba(63,185,80,.25); border-color: #3fb950; }
.ns-switch input:checked + span::after { transform: translateX(18px); background: #56d364; }
.ns-switch input:focus-visible + span { outline: 2px solid #58a6ff; outline-offset: 2px; }

.ns-draw-wrap { padding: 4px 18px 16px; }
.ns-draw-p { font-size: .8rem; color: var(--kl-text-secondary); margin: 0 0 10px; }
.ns-draw { width: 100%; border-collapse: separate; border-spacing: 0 4px; font-variant-numeric: tabular-nums; }
.ns-draw th { font-size: .74rem; font-weight: 650; color: var(--kl-text-muted); text-align: center; padding: 0 2px 2px; }
.ns-draw th:first-child { text-align: left; }
.ns-draw td { text-align: center; padding: 0 2px; }
.ns-draw-team { display: flex; align-items: center; gap: 8px; font-size: .82rem; color: var(--kl-text-primary); white-space: nowrap; }
.ns-draw-team small { color: var(--kl-text-muted); width: 26px; font-size: .74rem; }
.ns-cell { display: inline-grid; place-items: center; width: 30px; height: 26px; border-radius: 7px; font-size: .82rem; font-weight: 650;
  background: var(--kl-bg-body); color: var(--kl-text-muted); }
.ns-cell.more { color: #79c0ff; box-shadow: inset 0 0 0 1px rgba(88,166,255,.35); }
.ns-cell.self { background: transparent; color: var(--kl-text-faint); }
.ns-pill { display: inline-block; font-size: .74rem; font-weight: 650; border-radius: 999px; padding: 2px 9px; }
.ns-pill.hard { background: rgba(240,136,62,.12); color: #ffa657; }
.ns-pill.easy { background: rgba(63,185,80,.12); color: #56d364; }
.ns-pill.even { background: var(--kl-bg-elevated); color: var(--kl-text-secondary); }
.ns-scroll { overflow-x: auto; }

.ns-aside { position: sticky; top: 84px; }
@media (max-width: 1099px) { .ns-aside { position: static; } }
.ns-glance { padding: 6px 18px 4px; }
.ns-g { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid rgba(40,50,74,.7); font-size: .82rem; }
.ns-g:first-child { border-top: 0; }
.ns-g dt { color: var(--kl-text-secondary); font-weight: 500; }
.ns-g dd { margin: 0; text-align: right; color: var(--kl-text-primary); font-weight: 600; }
.ns-g dd s { display: block; font-size: .72rem; color: var(--kl-text-muted); font-weight: 500; }
.ns-g.changed dd { color: #e3b341; }
.ns-go { padding: 14px 18px 18px; border-top: 1px solid var(--kl-border); }
.ns-go-btn { width: 100%; border: 0; border-radius: 11px; padding: 12px 14px; font-size: .95rem; font-weight: 750;
  background: #3fb950; color: #04140a; display: flex; justify-content: center; align-items: center; gap: 8px;
  transition: filter var(--kl-dur-fast); }
.ns-go-btn:hover:not(:disabled) { filter: brightness(1.08); }
.ns-go-btn:disabled { background: var(--kl-bg-elevated); color: var(--kl-text-muted); }
.ns-go-btn:focus-visible { outline: 2px solid #56d364; outline-offset: 3px; }
.ns-go-note { font-size: .78rem; color: var(--kl-text-secondary); margin-top: 8px; text-align: center; }
.ns-go-err { font-size: .8rem; color: #ff7b72; margin-bottom: 10px; }
.ns-confirm { background: rgba(63,185,80,.07); border: 1px solid rgba(63,185,80,.3); border-radius: 11px; padding: 12px; }
.ns-confirm p { font-size: .84rem; color: var(--kl-text-primary); margin: 0 0 10px; }
.ns-confirm-row { display: flex; gap: 8px; }
.ns-confirm-row .ns-go-btn { flex: 1; }
.ns-cancel { border: 1px solid var(--kl-border-light); background: transparent; color: var(--kl-text-primary); border-radius: 11px; padding: 0 14px; font-weight: 650; font-size: .85rem; }

.ns-open { text-align: center; padding: 34px 22px 28px; }
.ns-open h2 { font-size: 3rem; font-weight: 800; letter-spacing: -.03em; margin: 0; color: var(--kl-text-heading); font-variant-numeric: tabular-nums; }
.ns-open > p { color: var(--kl-text-secondary); font-size: .92rem; margin: 6px auto 22px; max-width: 60ch; }
.ns-matches { max-width: 520px; margin: 0 auto 22px; text-align: left; }
.ns-matches h3 { font-size: .86rem; font-weight: 650; color: var(--kl-text-secondary); margin: 0 0 8px; }
.ns-match { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 10px;
  padding: 9px 12px; border: 1px solid var(--kl-border); border-radius: 11px; background: var(--kl-bg-body); margin-bottom: 6px; font-size: .86rem; }
.ns-match span.t { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--kl-text-primary); }
.ns-match span.t.away { justify-content: flex-end; text-align: right; }
.ns-match span.t em { font-style: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ns-match span.v { font-size: .74rem; color: var(--kl-text-muted); }
.ns-btn { display: inline-flex; align-items: center; gap: 6px; border-radius: 10px; padding: 9px 16px; font-size: .86rem; font-weight: 700; text-decoration: none; }
.ns-btn.primary { background: #3fb950; color: #04140a; }
.ns-btn.ghost { border: 1px solid var(--kl-border-light); color: var(--kl-text-primary); }
`

function Num({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="ns-num">
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <input type="number" inputMode="numeric" aria-label={label} min={min} max={max} value={value}
        onChange={e => onChange(e.target.value === '' ? min : Number(e.target.value))} />
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </span>
  )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <span className="ns-switch">
      <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={e => onChange(e.target.checked)} />
      <span></span>
    </span>
  )
}

function Seg<T extends string | number>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string
}) {
  return (
    <span className="ns-seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={String(o.value)} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </span>
  )
}

export function NewSeasonPage() {
  const { leagueId } = useParams()
  const { data, loading, error } = useFetch<Preview>(`/leagues/${leagueId}/new-season?format=json`)
  const { refresh: refreshLeague } = useLeague()
  const [form, setForm] = useState<Settings | null>(null)
  const [live, setLive] = useState<Preview | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [failMsg, setFailMsg] = useState<string | null>(null)
  const [stepMsg, setStepMsg] = useState<Record<string, string>>({})
  const [done, setDone] = useState<Summary | null>(null)
  const seq = useRef(0)

  useEffect(() => { if (data && !form) setForm(data.settings) }, [data, form])

  // Re-run the checks as settings change: squad size moves who is over or
  // under the cap, rounds + finals can overrun the AFL season.
  const refresh = useCallback((settings: Settings) => {
    const n = ++seq.current
    return post<Preview>(`/leagues/${leagueId}/new-season/preview?format=json`, { settings })
      .then(p => { if (n === seq.current) setLive(p) })
      .catch(() => {})
  }, [leagueId])

  useEffect(() => {
    if (!form || !data) return
    const t = setTimeout(() => { refresh(form) }, 250)
    return () => clearTimeout(t)
  }, [form, data, refresh])

  const changedKeys = useMemo(() => {
    if (!form || !data) return [] as (keyof Settings)[]
    return (Object.keys(form) as (keyof Settings)[]).filter(k => !same(form[k], data.current[k]))
  }, [form, data])

  if (loading) return <Spinner text="Loading..." />
  const view = live ?? data
  if (error || !data || !view || !form) {
    return <p className="text-danger">{error?.includes('403') ? 'Only the commissioner can start a new season.' : 'The new season page didn’t load. Refresh to try again.'}</p>
  }

  const s = form
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setForm(f => (f ? { ...f, [k]: v } : f)); setConfirming(false) }
  const teamById = new Map(view.teams.map(t => [t.id, t]))
  const isChanged = (k: keyof Settings) => changedKeys.includes(k)

  async function runStep(step: string) {
    setBusy(step)
    try {
      const fd = new FormData()
      fd.set('step', step)
      const res = await fetch(`/leagues/${leagueId}/offseason/start-step?format=json`, { method: 'POST', body: fd, credentials: 'same-origin' })
      const body = await res.json().catch(() => null) as { success?: boolean; messages?: string[] } | null
      setStepMsg(m => ({ ...m, [step]: res.ok ? '' : (body?.messages?.join(' ') || 'That didn’t go through. Try again from the Commissioner Hub.') }))
      if (form) await refresh(form)
    } finally {
      setBusy(null)
    }
  }

  async function start() {
    if (!form) return
    setBusy('start')
    setFailMsg(null)
    try {
      const r = await post<{ success: boolean; summary?: Summary; error?: string }>(
        `/leagues/${leagueId}/new-season?format=json`, { settings: form })
      if (r.success && r.summary) {
        setDone(r.summary)
        refreshLeague()  // the top bar and rail read the league's year
        window.scrollTo({ top: 0 })
      }
      else setFailMsg(r.error || 'The season didn’t start.')
    } catch (e) {
      const raw = (e as Error).message || ''
      try { setFailMsg(JSON.parse(raw).error || raw) } catch { setFailMsg(raw || 'The season didn’t start.') }
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  const crumbs = (
    <>
      <style>{CSS}</style>
      <div className="d-none d-lg-block"><AdminSubnav active="commissioner" leagueId={leagueId!} /></div>
      <div className="page-breadcrumb mb-3">
        <LeagueBreadcrumb leagueId={leagueId!} /> / Admin / <Link to={`/leagues/${leagueId}/commissioner`}>Commissioner</Link> / New season
      </div>
    </>
  )

  if (done) {
    const doneTeams = new Map(done.teams.map(t => [t.id, t]))
    const roundName = done.first_round === 0 ? 'Opening Round' : `Round ${done.first_round}`
    return (
      <div className="ns">
        {crumbs}
        <section className="ns-panel ns-open">
          <p className="ns-kicker">The new season is open</p>
          <h2>{done.year}</h2>
          <p>
            {done.rounds} rounds{done.opening_round ? ' plus Opening Round' : ''}, {done.fixtures} matches drawn.
            {done.ltil_released > 0 && ` ${done.ltil_released} players came off the LTIL.`}
            {done.trades_expired > 0 && ` ${done.trades_expired} pending trade offer${done.trades_expired !== 1 ? 's' : ''} expired.`}
            {' '}Every manager has been told.
          </p>
          {done.first_matches.length > 0 && (
            <div className="ns-matches">
              <h3>{roundName}</h3>
              {done.first_matches.map((m, i) => {
                const h = doneTeams.get(m.home_id), a = doneTeams.get(m.away_id)
                return (
                  <div className="ns-match" key={i}>
                    <span className="t"><TeamCrest team={h} size={26} /><em>{h?.name}</em></span>
                    <span className="v">v</span>
                    <span className="t away"><em>{a?.name}</em><TeamCrest team={a} size={26} /></span>
                  </div>
                )
              })}
            </div>
          )}
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <Link to={`/leagues/${leagueId}/fixture`} className="ns-btn primary"><i className="bi bi-calendar-week"></i>See the {done.year} fixture</Link>
            <Link to={`/leagues/${leagueId}/commissioner`} className="ns-btn ghost">Back to the hub</Link>
          </div>
        </section>
      </div>
    )
  }

  const blocks = view.checks.filter(c => c.level === 'block')
  const warns = view.checks.filter(c => c.level === 'warn')
  const oks = view.checks.filter(c => c.level === 'ok')
  const premier = view.ladder[0]

  const statusLine = blocks.length
    ? { color: '#f85149', text: `${blocks.length} thing${blocks.length !== 1 ? 's' : ''} to clear before ${view.to_year} can start.` }
    : view.errors.length
      ? { color: '#f85149', text: 'A setting needs fixing before you start.' }
      : { color: '#3fb950', text: `Ready to start. ${premier ? `${premier.name} are the ${view.from_year} premiers.` : ''}` }

  const row = (k: keyof Settings, title: string, help: string, control: React.ReactNode, off = false) => (
    <div className={`ns-row${isChanged(k) ? ' changed' : ''}${off ? ' off' : ''}`} key={k}>
      <div className="ns-row-l">
        <div className="ns-row-t">{title}</div>
        <div className="ns-row-p">{help}</div>
        {isChanged(k) && <div className="ns-row-was">Was {fmt(k, data.current)}</div>}
      </div>
      {control}
    </div>
  )

  const checkRow = (c: Check) => (
    <div className="ns-check" key={c.key}>
      <i className={`bi ${c.level === 'block' ? 'bi-x-circle-fill' : 'bi-exclamation-circle-fill'}`}
        style={{ color: c.level === 'block' ? '#f85149' : '#d29922' }}></i>
      <div className="ns-check-b">
        <div className="ns-check-t">{c.label}</div>
        {c.detail && <div className="ns-check-d">{c.detail}</div>}
        {c.action?.kind === 'step' && stepMsg[c.action.step] && (
          <div className="ns-check-err" role="status">{stepMsg[c.action.step]}</div>
        )}
        {c.teams && (
          <div className="ns-chips">
            {c.teams.map(t => (
              <span className="ns-chip" key={t.team_id}><TeamCrest team={teamById.get(t.team_id)} size={20} />{teamById.get(t.team_id)?.name} <b>{t.count}</b></span>
            ))}
          </div>
        )}
      </div>
      {c.action?.kind === 'step' && (
        <button type="button" className={`ns-act${c.level === 'block' ? ' block' : ''}`} disabled={busy === c.action.step}
          onClick={() => c.action?.kind === 'step' && runStep(c.action.step)}>
          {busy === c.action.step ? 'Working' : c.action.label}
        </button>
      )}
      {c.action?.kind === 'link' && (
        <Link className="ns-act" to={`/leagues/${leagueId}/${c.action.to}`}>{c.action.label}</Link>
      )}
    </div>
  )

  const glance: [string, keyof Settings, string][] = [
    ['Rounds', 'num_regular_rounds', `${s.num_regular_rounds}${s.opening_round ? ' plus Opening Round' : ''}`],
    ['Draw', 'fixture_weighting', fmt('fixture_weighting', s)],
    ['Finals', 'finals_teams', fmt('finals_teams', s)],
    ['Drafts', 'draft_order_basis', fmt('draft_order_basis', s)],
    ['Squad', 'squad_size', `${s.squad_size} players`],
    ['Captain scoring', 'captain_scoring_enabled', fmt('captain_scoring_enabled', s)],
    ['SSP', 'ssp_enabled', s.ssp_enabled ? `${s.ssp_slots} per team` : 'Off'],
    ['Mid-season', 'mid_season_draft_enabled', s.mid_season_draft_enabled ? `After round ${s.mid_season_draft_after_round}` : 'Off'],
  ]
  const glanceChanged = (k: keyof Settings) => {
    const linked: Partial<Record<keyof Settings, (keyof Settings)[]>> = {
      num_regular_rounds: ['num_regular_rounds', 'opening_round'],
      draft_order_basis: ['draft_order_basis', 'draft_style', 'draft_custom_order', 'draft_compensation'],
      ssp_enabled: ['ssp_enabled', 'ssp_slots'],
      mid_season_draft_enabled: ['mid_season_draft_enabled', 'mid_season_draft_after_round'],
    }
    return (linked[k] ?? [k]).some(isChanged)
  }
  const glanceWas = (k: keyof Settings): string => {
    const c = data.current
    if (k === 'num_regular_rounds') return `${c.num_regular_rounds}${c.opening_round ? ' plus Opening Round' : ''}`
    if (k === 'squad_size') return `${c.squad_size} players`
    if (k === 'ssp_enabled') return c.ssp_enabled ? `${c.ssp_slots} per team` : 'Off'
    if (k === 'mid_season_draft_enabled') return c.mid_season_draft_enabled ? `After round ${c.mid_season_draft_after_round}` : 'Off'
    return fmt(k, c)
  }

  const fx = view.fixture

  return (
    <div className="ns">
      {crumbs}

      <section className="ns-hero" aria-labelledby="ns-title">
        <div>
          <p className="ns-kicker">Season handover</p>
          <h1 className="ns-years" id="ns-title">
            <span className="from">{view.from_year}</span>
            <i className="bi bi-arrow-right arrow" aria-hidden="true"></i>
            <span className="to">{view.to_year}</span>
          </h1>
          <p className="ns-status"><span className="dot" style={{ background: statusLine.color }}></span>{statusLine.text}</p>
        </div>
        {view.ladder.length > 0 && (
          <div>
            <p className="ns-ladder-h">How {view.from_year} finished</p>
            <ol className="ns-ladder list-unstyled m-0" style={{ '--n': view.ladder.length } as React.CSSProperties}>
              {view.ladder.map((t, i) => (
                <li key={t.id} className={`ns-lad${i === 0 ? ' prem' : ''}`} style={{ '--i': i } as React.CSSProperties}>
                  <span className="ns-lad-pos">{i === 0 ? 'Premiers' : ORD[i]}</span>
                  <TeamCrest team={t} size={36} />
                  <span className="ns-lad-name" title={t.name}>{t.name}</span>
                  <span className="ns-lad-rec">{t.wins}-{t.losses}{t.draws ? `-${t.draws}` : ''}, {t.pct}%</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <div className="ns-grid">
        <div>
          <section className="ns-step" aria-labelledby="ns-s1">
            <div className="ns-step-h">
              <span className={`ns-step-n${blocks.length ? '' : ' done'}`}>{blocks.length ? 1 : <i className="bi bi-check-lg"></i>}</span>
              <h2 id="ns-s1">Close out {view.from_year}</h2>
              <span className="sub">{blocks.length ? `${blocks.length} to clear` : 'All clear'}</span>
            </div>
            <div className="ns-panel">
              {blocks.map(checkRow)}
              {warns.map(checkRow)}
              {oks.length > 0 && (
                <div className="ns-done-line" style={blocks.length + warns.length === 0 ? { borderTop: 0 } : undefined}>
                  <i className="bi bi-check-circle-fill"></i>
                  <span>{oks.map(o => o.label).join('. ')}.</span>
                </div>
              )}
            </div>
          </section>

          <section className="ns-step" aria-labelledby="ns-s2">
            <div className="ns-step-h">
              <span className="ns-step-n">2</span>
              <h2 id="ns-s2">Shape {view.to_year}</h2>
              <span className="sub">{changedKeys.length ? `${changedKeys.length} change${changedKeys.length !== 1 ? 's' : ''} from ${view.from_year}` : `Same rules as ${view.from_year}`}</span>
            </div>

            <div className="ns-panel">
              <div className="ns-panel-h"><h3>Fixture and draw</h3></div>
              {row('num_regular_rounds', 'Home-and-away rounds', 'Finals weeks come on top of these.',
                <Num label="rounds" value={s.num_regular_rounds} min={1} max={24} onChange={n => set('num_regular_rounds', n)} />)}
              {row('opening_round', 'Opening Round', 'A round 0 played in the AFL’s Opening Round.',
                <Switch label="Opening Round" checked={s.opening_round} onChange={b => set('opening_round', b)} />)}
              {row('finals_teams', 'Finals', 'Top 4 adds three weeks after the home-and-away season.',
                <Seg label="Finals" value={s.finals_teams} onChange={v => set('finals_teams', v)}
                  options={[{ value: 0, label: 'No finals' }, { value: 4, label: 'Top 4' }]} />)}
              {row('fixture_weighting', 'Draw', 'Who gets the leftover games once everyone has played everyone.',
                <Seg label="Draw" value={s.fixture_weighting} onChange={v => set('fixture_weighting', v)}
                  options={[{ value: 'random', label: 'Even' }, { value: 'ladder', label: 'Ladder-weighted' }]} />)}
              {fx && (
                <div className="ns-draw-wrap">
                  {fx.weighting === 'ladder' && fx.extra_rounds > 0 ? (
                    <>
                      <p className="ns-draw-p">
                        Everyone plays everyone {fx.full_cycles} times. The {fx.extra_rounds} leftover round{fx.extra_rounds !== 1 ? 's' : ''} pair
                        sides that finished close together, so top sides meet each other again. Blue numbers include that extra game.
                      </p>
                      <div className="ns-scroll">
                        <table className="ns-draw">
                          <thead>
                            <tr>
                              <th scope="col">Games against</th>
                              {fx.teams.map((_, i) => <th key={i} scope="col">{ORD[i]}</th>)}
                              <th scope="col">Draw</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fx.teams.map(t => {
                              const d = t.vs_even ?? 0
                              return (
                                <tr key={t.team_id}>
                                  <th scope="row" style={{ fontWeight: 400 }}>
                                    <span className="ns-draw-team"><small>{ORD[t.finish - 1]}</small><TeamCrest team={teamById.get(t.team_id)} size={22} />{t.team}</span>
                                  </th>
                                  {(t.vs ?? []).map((g, i) => (
                                    <td key={i}><span className={`ns-cell${g == null ? ' self' : g > fx.full_cycles ? ' more' : ''}`}>{g ?? '-'}</span></td>
                                  ))}
                                  <td><span className={`ns-pill ${d < 0 ? 'hard' : d > 0 ? 'easy' : 'even'}`}>{d < 0 ? 'Harder' : d > 0 ? 'Easier' : 'Even'}</span></td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <p className="ns-draw-p" style={{ margin: 0 }}>
                      {fx.extra_rounds === 0
                        ? `${s.num_regular_rounds} rounds is exactly ${fx.full_cycles} full cycles, so every side plays every other side ${fx.full_cycles} times.`
                        : `Everyone plays everyone ${fx.full_cycles} times. The ${fx.extra_rounds} leftover round${fx.extra_rounds !== 1 ? 's are' : ' is'} drawn at random.`}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="ns-panel">
              <div className="ns-panel-h">
                <h3>{view.to_year} drafts</h3>
                <p>The mid-season and off-season drafts held in {view.to_year}.</p>
              </div>
              <DraftPlanEditor
                teams={view.teams}
                year={view.to_year}
                value={s}
                onChange={p => { setForm(f => (f ? { ...f, ...p } : f)); setConfirming(false) }}
                addedFor={`the ${view.to_year} off-season draft`}
              />
            </div>

            <div className="ns-panel">
              <div className="ns-panel-h"><h3>Lists</h3></div>
              {row('squad_size', 'Squad size', 'The list cap. Players on the LTIL don’t count.',
                <Num label="players" value={s.squad_size} min={20} max={60} onChange={n => set('squad_size', n)} />)}
              {row('offseason_draft_min_picks', 'Places kept for the off-season draft', 'Lists finish the off-season delists this many under the cap.',
                <Num label="places" value={s.offseason_draft_min_picks} min={0} max={15} onChange={n => set('offseason_draft_min_picks', n)} />)}
              {row('ssp_enabled', 'SSP', 'Sign a replacement while a player is on the LTIL.',
                <Switch label="SSP" checked={s.ssp_enabled} onChange={b => set('ssp_enabled', b)} />)}
              {row('ssp_slots', 'LTIL slots per team', 'How many players a team can have on the LTIL.',
                <Num label="slots" value={s.ssp_slots} min={0} max={5} onChange={n => set('ssp_slots', n)} />, !s.ssp_enabled)}
              {row('ssp_cutoff_round', 'SSP closes after round', 'Signings stop once this round starts.',
                <Num label="round" value={s.ssp_cutoff_round} min={1} max={24} onChange={n => set('ssp_cutoff_round', n)} />, !s.ssp_enabled)}
            </div>

            <div className="ns-panel">
              <div className="ns-panel-h"><h3>Scoring</h3></div>
              {row('captain_scoring_enabled', 'Captain scores double', 'The named captain’s score counts twice.',
                <Switch label="Captain scores double" checked={s.captain_scoring_enabled} onChange={b => set('captain_scoring_enabled', b)} />)}
              {row('sevens_captain_enabled', '7s captain', 'The same for the 7s side.',
                <Switch label="7s captain" checked={s.sevens_captain_enabled} onChange={b => set('sevens_captain_enabled', b)} />)}
            </div>

            <div className="ns-panel">
              <div className="ns-panel-h"><h3>Mid-season</h3></div>
              {row('mid_season_draft_enabled', 'Mid-season trades, delists and draft', 'One window in the middle of the year.',
                <Switch label="Mid-season window" checked={s.mid_season_draft_enabled} onChange={b => set('mid_season_draft_enabled', b)} />)}
              {row('mid_season_draft_after_round', 'Opens after round', 'The window opens once this round is done.',
                <Num label="round" value={s.mid_season_draft_after_round} min={1} max={24} onChange={n => set('mid_season_draft_after_round', n)} />, !s.mid_season_draft_enabled)}
              {row('mid_season_delist_required', 'Delists required', 'Each team cuts at least this many.',
                <Num label="delists" value={s.mid_season_delist_required} min={0} max={10} onChange={n => set('mid_season_delist_required', n)} />, !s.mid_season_draft_enabled)}
              {row('mid_season_trade_mode', 'Trading', 'When trades are open during the season.',
                <Seg label="Trading" value={s.mid_season_trade_mode} onChange={v => set('mid_season_trade_mode', v)} options={TRADE_MODES} />, !s.mid_season_draft_enabled)}
              {s.mid_season_trade_mode === 'until_round' && row('mid_season_trade_until_round', 'Trades close after round', 'No trades once this round starts.',
                <Num label="round" value={s.mid_season_trade_until_round} min={1} max={24} onChange={n => set('mid_season_trade_until_round', n)} />, !s.mid_season_draft_enabled)}
            </div>

            <p style={{ fontSize: '.8rem', color: 'var(--kl-text-secondary)' }}>
              Formation, scoring rules and lockouts carry over as they are. Change those in <Link to={`/leagues/${leagueId}/settings`}>League Settings</Link>.
            </p>
          </section>
        </div>

        <aside className="ns-aside" aria-labelledby="ns-s3">
          <div className="ns-step-h">
            <span className="ns-step-n">3</span>
            <h2 id="ns-s3">Start {view.to_year}</h2>
          </div>
          <div className="ns-panel">
            <dl className="ns-glance m-0">
              {glance.map(([label, k, value]) => {
                const ch = glanceChanged(k)
                return (
                  <div className={`ns-g${ch ? ' changed' : ''}`} key={label}>
                    <dt>{label}</dt>
                    <dd>{value}{ch && <s>{glanceWas(k)}</s>}</dd>
                  </div>
                )
              })}
            </dl>
            <div className="ns-go">
              {view.errors.length > 0 && <div className="ns-go-err">{view.errors.join(' ')}</div>}
              {failMsg && <div className="ns-go-err">{failMsg}</div>}
              {confirming ? (
                <div className="ns-confirm" role="alertdialog" aria-label={`Start ${view.to_year}`}>
                  <p>This moves the league into {view.to_year}, draws the fixture and tells every manager. It can&rsquo;t be undone from the app.</p>
                  <div className="ns-confirm-row">
                    <button type="button" className="ns-go-btn" autoFocus disabled={busy === 'start'} onClick={start}>
                      {busy === 'start' ? <><span className="spinner-border spinner-border-sm"></span>Starting</> : `Start ${view.to_year}`}
                    </button>
                    <button type="button" className="ns-cancel" onClick={() => setConfirming(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="ns-go-btn" disabled={!view.can_start} onClick={() => setConfirming(true)}>
                  <i className="bi bi-calendar-plus"></i>Start the {view.to_year} season
                </button>
              )}
              {!confirming && (
                <div className="ns-go-note">
                  {blocks.length
                    ? `Clear ${blocks.length === 1 ? 'the red item' : `the ${blocks.length} red items`} in step 1 first.`
                    : changedKeys.length
                      ? `${changedKeys.length} change${changedKeys.length !== 1 ? 's' : ''}, everything else carries over from ${view.from_year}.`
                      : `Every rule carries over from ${view.from_year}.`}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
