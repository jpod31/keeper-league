import { useParams, Link } from 'react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { post } from '../../lib/api'
import { AdminSubnav } from '../../components/nav/AdminSubnav'
import { LeagueBreadcrumb } from '../../components/ui/LeagueBreadcrumb'
import { DraftPlanEditor, type DraftPlan } from '../../components/draft/DraftPlanEditor'

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

interface Check { key: string; level: 'ok' | 'warn' | 'block'; label: string; detail: string }

interface FixtureRow { team: string; finish: number; vs?: (number | null)[]; vs_even?: number }
interface FixturePreview {
  weighting: 'random' | 'ladder'
  from_year: number
  full_cycles: number
  extra_rounds: number
  teams: FixtureRow[]
}

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
  teams: { id: number; name: string }[]
}

interface Summary {
  year: number; rounds: number; opening_round: boolean; fixtures: number
  trades_expired: number; ltil_released: number
}

const TRADE_MODES: { value: TradeMode; label: string }[] = [
  { value: 'window', label: '2-day window' },
  { value: 'until_round', label: 'Until a round' },
  { value: 'all_year', label: 'All season' },
]

const CSS = `
.ns-page { width: 100%; min-width: 0; }
.ns-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
@media (max-width: 991px) { .ns-grid { grid-template-columns: minmax(0, 1fr); } }
.ns-card { background: var(--kl-bg-card); border: 1px solid var(--kl-border); border-radius: 10px; margin-bottom: 14px; }
.ns-card-h { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--kl-border);
  font-size: .78rem; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #8b949e; }
.ns-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid #21262d; min-height: 50px; }
.ns-row:last-child { border-bottom: none; }
.ns-row.off { opacity: .45; }
@media (max-width: 575px) { .ns-row { flex-wrap: wrap; row-gap: 8px; } .ns-row .ns-seg { margin-left: auto; } }
.ns-label { flex: 1 1 140px; min-width: 0; font-size: .85rem; color: #e6edf3; }
.ns-was { font-size: .7rem; font-weight: 600; color: #d29922; background: rgba(210,153,34,.1);
  border: 1px solid rgba(210,153,34,.3); border-radius: 999px; padding: 1px 8px; white-space: nowrap; }
.ns-num { width: 76px; background: #0d1117; border: 1px solid #30363d; color: #e6edf3; border-radius: 6px;
  padding: .3rem .5rem; font-size: .85rem; text-align: right; font-variant-numeric: tabular-nums; }
.ns-num:focus { outline: none; border-color: #58a6ff; }
.ns-seg { display: inline-flex; background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 2px; }
.ns-seg button { border: 0; background: transparent; color: #8b949e; font-size: .78rem; font-weight: 600;
  padding: 4px 10px; border-radius: 6px; white-space: nowrap; }
.ns-seg button.on { background: rgba(88,166,255,.16); color: #58a6ff; }
.ns-side { position: sticky; top: 76px; }
.ns-check { display: flex; gap: 10px; padding: 9px 14px; border-bottom: 1px solid #21262d; }
.ns-check:last-child { border-bottom: none; }
.ns-check i { font-size: .95rem; margin-top: 1px; }
.ns-check-l { font-size: .82rem; color: #e6edf3; font-weight: 600; }
.ns-check-d { font-size: .74rem; color: #8b949e; margin-top: 1px; }
.ns-errors { padding: 10px 14px; font-size: .78rem; color: #f85149; background: rgba(248,81,73,.06);
  border-bottom: 1px solid rgba(248,81,73,.2); }
.ns-go { padding: 14px; }
.ns-go .btn { width: 100%; font-weight: 700; }
.ns-steps { margin: 0; padding: 10px 14px 4px 32px; font-size: .78rem; color: #c9d1d9; }
.ns-steps li { margin-bottom: 4px; }
.ns-draw { width: 100%; border-collapse: collapse; font-size: .78rem; font-variant-numeric: tabular-nums; }
.ns-draw th { font-size: .68rem; font-weight: 700; color: #8b949e; text-transform: uppercase; letter-spacing: .04em;
  padding: 6px 4px; text-align: center; border-bottom: 1px solid #21262d; }
.ns-draw th:first-child, .ns-draw td:first-child { text-align: left; padding-left: 14px; }
.ns-draw td { padding: 6px 4px; text-align: center; color: #c9d1d9; border-bottom: 1px solid #21262d; }
.ns-draw tr:last-child td { border-bottom: none; }
.ns-draw td.self { color: #30363d; }
.ns-draw td.more { color: #58a6ff; font-weight: 700; }
.ns-draw td.less { color: #8b949e; }
.ns-draw .hard { color: #f0883e; font-weight: 600; }
.ns-draw .easy { color: #3fb950; font-weight: 600; }
.ns-note { padding: 8px 14px 10px; font-size: .74rem; color: #8b949e; }
.ns-done { text-align: center; padding: 28px 16px; }
.ns-done-year { font-size: 2.4rem; font-weight: 800; color: #3fb950; line-height: 1; font-variant-numeric: tabular-nums; }
.ns-done-sub { font-size: .85rem; color: #8b949e; margin: 8px 0 18px; }
`

const ICON: Record<Check['level'], { cls: string; color: string }> = {
  ok: { cls: 'bi-check-circle-fill', color: '#3fb950' },
  warn: { cls: 'bi-exclamation-circle-fill', color: '#d29922' },
  block: { cls: 'bi-x-circle-fill', color: '#f85149' },
}

function fmt(key: keyof Settings, v: Settings[keyof Settings]): string {
  if (typeof v === 'boolean') return v ? 'On' : 'Off'
  if (key === 'finals_teams') return v === 0 ? 'No finals' : `Top ${v}`
  if (key === 'fixture_weighting') return v === 'ladder' ? 'Ladder-weighted' : 'Even'
  if (key === 'mid_season_trade_mode') return TRADE_MODES.find(m => m.value === v)?.label ?? String(v)
  return String(v)
}

export function NewSeasonPage() {
  const { leagueId } = useParams()
  const { data, loading, error } = useFetch<Preview>(`/leagues/${leagueId}/new-season?format=json`)
  const [form, setForm] = useState<Settings | null>(null)
  const [live, setLive] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)
  const [failMsg, setFailMsg] = useState<string | null>(null)
  const [done, setDone] = useState<Summary | null>(null)
  const seq = useRef(0)

  useEffect(() => { if (data && !form) setForm(data.settings) }, [data, form])

  // Re-run the checks as settings change: squad size moves who is over or
  // under the cap, rounds + finals can overrun the AFL season.
  useEffect(() => {
    if (!form || !data) return
    const n = ++seq.current
    const t = setTimeout(() => {
      post<Preview>(`/leagues/${leagueId}/new-season/preview?format=json`, { settings: form })
        .then(p => { if (n === seq.current) setLive(p) })
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [form, data, leagueId])

  const view = live ?? data
  const changed = useMemo(() => {
    if (!form || !data) return 0
    return (Object.keys(form) as (keyof Settings)[])
      .filter(k => JSON.stringify(form[k]) !== JSON.stringify(data.current[k])).length
  }, [form, data])

  if (loading) return <Spinner text="Loading..." />
  if (error || !data || !view || !form) {
    return <p className="text-danger">{error?.includes('403') ? 'Commissioner access required.' : 'Failed to load.'}</p>
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm(f => (f ? { ...f, [k]: v } : f))

  const was = (k: keyof Settings) =>
    JSON.stringify(form[k]) !== JSON.stringify(data.current[k]) ? <span className="ns-was">was {fmt(k, data.current[k])}</span> : null

  const num = (k: keyof Settings, min: number, max: number) => (
    <input
      type="number" className="ns-num" min={min} max={max}
      value={form[k] as number}
      onChange={e => set(k, (e.target.value === '' ? 0 : Number(e.target.value)) as never)}
    />
  )

  const toggle = (k: keyof Settings) => (
    <label className="settings-toggle mb-0">
      <input type="checkbox" checked={form[k] as boolean} onChange={e => set(k, e.target.checked as never)} />
      <span className="toggle-track"></span>
    </label>
  )

  const row = (label: string, k: keyof Settings, control: React.ReactNode, off = false) => (
    <div className={`ns-row${off ? ' off' : ''}`} key={k}>
      <span className="ns-label">{label}</span>
      {was(k)}
      {control}
    </div>
  )

  async function start() {
    if (!form || !view) return
    if (!confirm(`Start the ${view.to_year} season? This moves the league into ${view.to_year} and builds the fixture. It can't be undone from the app.`)) return
    setBusy(true)
    setFailMsg(null)
    try {
      const r = await post<{ success: boolean; summary?: Summary; error?: string }>(
        `/leagues/${leagueId}/new-season?format=json`, { settings: form })
      if (r.success && r.summary) setDone(r.summary)
      else setFailMsg(r.error || 'Could not start the season.')
    } catch (e) {
      const raw = (e as Error).message || ''
      try { setFailMsg(JSON.parse(raw).error || raw) } catch { setFailMsg(raw || 'Could not start the season.') }
    } finally {
      setBusy(false)
    }
  }

  const header = (
    <>
      <style>{CSS}</style>
      <div className="d-none d-lg-block"><AdminSubnav active="commissioner" leagueId={leagueId!} /></div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <LeagueBreadcrumb leagueId={leagueId!} /> / Admin / <Link to={`/leagues/${leagueId}/commissioner`}>Commissioner</Link> / New season
        </div>
        <div className="d-flex align-items-center mb-0">
          <i className="bi bi-calendar-plus me-2" style={{ fontSize: '1.4rem', color: '#3fb950' }}></i>
          <h4 className="mb-0 fw-bold" style={{ fontSize: '1.15rem' }}>Start the {done ? done.year : view.to_year} season</h4>
        </div>
      </div>
    </>
  )

  if (done) {
    return (
      <div className="ns-page">
        {header}
        <div className="ns-card ns-done">
          <div className="ns-done-year">{done.year}</div>
          <div className="ns-done-sub">
            {done.rounds} rounds{done.opening_round ? ' + Opening Round' : ''} · {done.fixtures} fixtures
            {done.ltil_released > 0 && ` · ${done.ltil_released} off the LTIL`}
            {done.trades_expired > 0 && ` · ${done.trades_expired} trade offer${done.trades_expired !== 1 ? 's' : ''} expired`}
          </div>
          <div className="d-flex gap-2 justify-content-center flex-wrap">
            <Link to={`/leagues/${leagueId}/fixture`} className="btn btn-sm btn-success">
              <i className="bi bi-calendar-week me-1"></i>See the fixture
            </Link>
            <Link to={`/leagues/${leagueId}/commissioner`} className="btn btn-sm btn-outline-secondary">Commissioner Hub</Link>
          </div>
        </div>
      </div>
    )
  }

  const blocks = view.checks.filter(c => c.level === 'block').length
  const s = form

  return (
    <div className="ns-page">
      {header}
      <div className="ns-grid">
        <div>
          <div className="ns-card">
            <div className="ns-card-h"><i className="bi bi-calendar-week"></i>Fixture</div>
            {row('Home-and-away rounds', 'num_regular_rounds', num('num_regular_rounds', 1, 24))}
            {row('Opening Round (round 0)', 'opening_round', toggle('opening_round'))}
            {row('Draw', 'fixture_weighting', (
              <div className="ns-seg">
                {(['random', 'ladder'] as const).map(w => (
                  <button key={w} type="button" className={s.fixture_weighting === w ? 'on' : ''} onClick={() => set('fixture_weighting', w)}>
                    {w === 'random' ? 'Even' : 'Ladder-weighted'}
                  </button>
                ))}
              </div>
            ))}
            {row('Finals', 'finals_teams', (
              <div className="ns-seg">
                {[0, 4].map(n => (
                  <button key={n} type="button" className={s.finals_teams === n ? 'on' : ''} onClick={() => set('finals_teams', n)}>
                    {n === 0 ? 'No finals' : 'Top 4'}
                  </button>
                ))}
              </div>
            ))}
          </div>

          {view.fixture && <DrawCard fx={view.fixture} toYear={view.to_year} />}

          <div className="ns-card">
            <div className="ns-card-h"><i className="bi bi-calculator"></i>Scoring</div>
            {row('Captain scores double', 'captain_scoring_enabled', toggle('captain_scoring_enabled'))}
            {row('7s captain', 'sevens_captain_enabled', toggle('sevens_captain_enabled'))}
          </div>

          <div className="ns-card">
            <div className="ns-card-h"><i className="bi bi-people"></i>Lists</div>
            {row('Squad size', 'squad_size', num('squad_size', 20, 60))}
            {row('Places kept open for the off-season draft', 'offseason_draft_min_picks', num('offseason_draft_min_picks', 0, 15))}
            {row('SSP (LTIL replacements)', 'ssp_enabled', toggle('ssp_enabled'))}
            {row('LTIL slots per team', 'ssp_slots', num('ssp_slots', 0, 5), !s.ssp_enabled)}
            {row('SSP open until round', 'ssp_cutoff_round', num('ssp_cutoff_round', 1, 24), !s.ssp_enabled)}
          </div>

          <div className="ns-card">
            <div className="ns-card-h"><i className="bi bi-list-ol"></i>{view.to_year} drafts</div>
            <DraftPlanEditor
              teams={view.teams}
              year={view.to_year}
              value={s}
              onChange={p => setForm(f => (f ? { ...f, ...p } : f))}
              addedNote={`${view.to_year} off-season draft`}
            />
          </div>

          <div className="ns-card">
            <div className="ns-card-h"><i className="bi bi-arrow-repeat"></i>Mid-season</div>
            {row('Mid-season trades, delists + draft', 'mid_season_draft_enabled', toggle('mid_season_draft_enabled'))}
            {row('Opens after round', 'mid_season_draft_after_round', num('mid_season_draft_after_round', 1, 24), !s.mid_season_draft_enabled)}
            {row('Delists required', 'mid_season_delist_required', num('mid_season_delist_required', 0, 10), !s.mid_season_draft_enabled)}
            {row('Trading', 'mid_season_trade_mode', (
              <div className="ns-seg">
                {TRADE_MODES.map(m => (
                  <button key={m.value} type="button" className={s.mid_season_trade_mode === m.value ? 'on' : ''}
                    onClick={() => set('mid_season_trade_mode', m.value)}>{m.label}</button>
                ))}
              </div>
            ), !s.mid_season_draft_enabled)}
            {s.mid_season_trade_mode === 'until_round' &&
              row('Trades close after round', 'mid_season_trade_until_round', num('mid_season_trade_until_round', 1, 24), !s.mid_season_draft_enabled)}
          </div>

          <div style={{ fontSize: '.75rem', color: '#8b949e', marginBottom: 16 }}>
            Formation, scoring rules and lockouts carry over as they are. Change them in{' '}
            <Link to={`/leagues/${leagueId}/settings`}>League Settings</Link>.
          </div>
        </div>

        <div className="ns-side">
          <div className="ns-card">
            <div className="ns-card-h"><i className="bi bi-list-check"></i>Before you start</div>
            {view.checks.map(c => (
              <div className="ns-check" key={c.key}>
                <i className={`bi ${ICON[c.level].cls}`} style={{ color: ICON[c.level].color }}></i>
                <div>
                  <div className="ns-check-l">{c.label}</div>
                  {c.detail && <div className="ns-check-d">{c.detail}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="ns-card">
            <div className="ns-card-h"><i className="bi bi-play-circle"></i>Starting {view.to_year}</div>
            {view.errors.length > 0 && (
              <div className="ns-errors">{view.errors.map(e => <div key={e}>{e}</div>)}</div>
            )}
            <ol className="ns-steps">
              <li>League moves to {view.to_year}, phase Regular</li>
              <li>
                {s.num_regular_rounds}-round fixture for {view.team_count} teams
                {s.opening_round ? ' + Opening Round' : ''}, 7s mirrored
              </li>
              <li>{changed > 0 ? `${changed} setting${changed !== 1 ? 's' : ''} changed, the rest` : 'Every setting'} carried from {view.from_year}</li>
              <li>Everyone notified</li>
            </ol>
            <div className="ns-go">
              {failMsg && <div className="mb-2" style={{ fontSize: '.78rem', color: '#f85149' }}>{failMsg}</div>}
              <button type="button" className="btn btn-success" disabled={!view.can_start || busy} onClick={start}>
                {busy
                  ? <><span className="spinner-border spinner-border-sm me-1"></span>Starting...</>
                  : <><i className="bi bi-calendar-plus me-1"></i>Start {view.to_year} season</>}
              </button>
              {blocks > 0 && (
                <div className="mt-2 text-center" style={{ fontSize: '.74rem', color: '#8b949e' }}>
                  Clear the {blocks} red item{blocks !== 1 ? 's' : ''} first.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']

function DrawCard({ fx, toYear }: { fx: FixturePreview; toYear: number }) {
  const n = fx.teams.length
  if (fx.weighting === 'random' || fx.extra_rounds === 0) {
    return (
      <div className="ns-card">
        <div className="ns-card-h"><i className="bi bi-shuffle"></i>{toYear} draw</div>
        <div className="ns-note">
          {fx.extra_rounds === 0
            ? `${fx.full_cycles} full rounds of everyone, so every side plays every rival ${fx.full_cycles} times.`
            : `Everyone plays everyone ${fx.full_cycles} times. The ${fx.extra_rounds} round${fx.extra_rounds !== 1 ? 's' : ''} left over are drawn at random.`}
        </div>
      </div>
    )
  }
  return (
    <div className="ns-card">
      <div className="ns-card-h"><i className="bi bi-bar-chart-steps"></i>{toYear} draw, games vs each {fx.from_year} finish</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="ns-draw">
          <thead>
            <tr>
              <th>{fx.from_year} finish</th>
              {fx.teams.map((_, i) => <th key={i}>{ORD[i] ?? i + 1}</th>)}
              <th>Draw</th>
            </tr>
          </thead>
          <tbody>
            {fx.teams.map(t => {
              const d = t.vs_even ?? 0
              return (
                <tr key={t.team}>
                  <td>{ORD[t.finish - 1]} {t.team}</td>
                  {(t.vs ?? []).map((g, i) => (
                    <td key={i} className={g == null ? 'self' : g > fx.full_cycles ? 'more' : 'less'}>{g ?? '-'}</td>
                  ))}
                  <td className={d < 0 ? 'hard' : d > 0 ? 'easy' : ''}>{d < 0 ? 'Harder' : d > 0 ? 'Easier' : 'Even'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="ns-note">
        Everyone plays everyone {fx.full_cycles} times. The {fx.extra_rounds} round{fx.extra_rounds !== 1 ? 's' : ''} left over
        pair sides that finished close together, so {n > 2 ? 'the top sides meet each other' : 'they meet'} an extra time.
      </div>
    </div>
  )
}
