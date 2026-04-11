import { useParams, Link } from 'react-router'
import { useState, useEffect, useMemo } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'
import { AdminSubnav } from '../../components/nav/AdminSubnav'

interface OnFieldSlots { DEF?: number; MID?: number; FWD?: number; RUC?: number }

interface SettingsData {
  league: {
    id: number
    name: string
    season_year: number
    num_teams: number
    squad_size: number
    on_field_count: number
    draft_type: string
    pick_timer_secs: number
    delist_minimum: number
    scoring_type: string
    trade_window_open: boolean
    on_field_slots: OnFieldSlots
    flex_count: number
  }
  season_config: {
    num_regular_rounds: number
    finals_teams: number
    ssp_enabled: boolean
    ssp_cutoff_round: number
    ssp_slots: number
    mid_season_draft_enabled: boolean
    mid_season_draft_after_round: number
    mid_season_trade_mode: 'all_year' | 'until_round' | 'window'
    mid_season_trade_until_round: number
    mid_season_delist_required: number
    mid_delist_duration_days: number
    off_delist_duration_days: number
    off_trade_duration_days: number
    offseason_delist_min: number
    supplemental_draft_date: string | null
    captain_scoring_enabled: boolean
    sevens_captain_enabled: boolean
  }
  live_config: {
    enabled: boolean
    lockout_type: 'game_start' | 'round_start'
  }
  is_commissioner: boolean
  has_active_draft: boolean
  has_preseason: boolean
}

interface FormState {
  name: string
  num_teams: number
  squad_size: number
  draft_type: string
  pick_timer_secs: number
  delist_minimum: number
  def_count: number
  mid_count: number
  fwd_count: number
  ruc_count: number
  flex_count: number
  num_fixture_rounds: number
  finals_teams: number
  mid_season_draft_enabled: boolean
  mid_season_trade_mode: 'all_year' | 'until_round' | 'window'
  mid_season_trade_until_round: number
  mid_season_draft_after_round: number
  mid_delist_duration_days: number
  mid_season_delist_required: number
  off_delist_duration_days: number
  offseason_delist_min: number
  off_trade_duration_days: number
  supplemental_draft_date: string
  live_scoring_enabled: boolean
  lockout_type: 'game_start' | 'round_start'
  captain_scoring_enabled: boolean
  sevens_captain_enabled: boolean
  ssp_enabled: boolean
  ssp_cutoff_round: number
  ssp_slots: number
}

const STYLE = `
.settings-section-header { display:flex; justify-content:space-between; align-items:center; padding:.9rem 1.1rem; border-bottom:1px solid #21262d; background:#0d1117; border-radius:12px 12px 0 0; transition:background .15s; }
.settings-section-header.section-active { background:#161b22; }
.settings-status { display:inline-block; width:8px; height:8px; border-radius:50%; background:#484f58; margin-left:10px; }
.settings-status.status-on { background:#3fb950; box-shadow:0 0 0 2px rgba(63,185,80,.2); }
.settings-expand { max-height:0; overflow:hidden; transition:max-height .3s ease, padding .3s ease; padding:0 1.1rem; }
.settings-expand.expanded { max-height:1400px; padding:1rem 1.1rem; }
.settings-toggle { position:relative; display:inline-block; width:38px; height:22px; cursor:pointer; }
.settings-toggle input { opacity:0; width:0; height:0; }
.settings-toggle .toggle-track { position:absolute; inset:0; background:#30363d; border-radius:11px; transition:background .2s; }
.settings-toggle .toggle-track::before { content:''; position:absolute; width:16px; height:16px; left:3px; top:3px; background:#c9d1d9; border-radius:50%; transition:transform .2s; }
.settings-toggle input:checked + .toggle-track { background:#238636; }
.settings-toggle input:checked + .toggle-track::before { transform:translateX(16px); background:#fff; }
.sync-scores-btn { background:#0d1117; border:1px solid #30363d; color:#c9d1d9; border-radius:6px; padding:5px 12px; font-size:.75rem; display:flex; align-items:center; gap:6px; }
.sync-scores-btn:hover:not(:disabled) { border-color:#58a6ff; color:#58a6ff; }
`

const AFL_SEASON_ROUNDS = 24
const FINALS_WEEKS: Record<number, number> = { 0: 0, 4: 3, 6: 4, 8: 4 }

export function SettingsPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [expanded, setExpanded] = useState({ mid: false, ssp: true, off: true, live: false })
  const [genStatus, setGenStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [generating, setGenerating] = useState(false)

  const [form, setForm] = useState<FormState>({
    name: '', num_teams: 0, squad_size: 0, draft_type: 'snake',
    pick_timer_secs: 60, delist_minimum: 0,
    def_count: 0, mid_count: 0, fwd_count: 0, ruc_count: 0, flex_count: 0,
    num_fixture_rounds: 18, finals_teams: 4,
    mid_season_draft_enabled: false, mid_season_trade_mode: 'window',
    mid_season_trade_until_round: 18, mid_season_draft_after_round: 12,
    mid_delist_duration_days: 2, mid_season_delist_required: 1,
    off_delist_duration_days: 14, offseason_delist_min: 3,
    off_trade_duration_days: 14, supplemental_draft_date: '',
    live_scoring_enabled: false, lockout_type: 'game_start',
    captain_scoring_enabled: true, sevens_captain_enabled: false,
    ssp_enabled: true, ssp_cutoff_round: 4, ssp_slots: 1,
  })

  useEffect(() => {
    api<SettingsData>(`/leagues/${leagueId}/settings?format=json`)
      .then(d => {
        setData(d)
        setForm({
          name: d.league.name,
          num_teams: d.league.num_teams,
          squad_size: d.league.squad_size,
          draft_type: d.league.draft_type,
          pick_timer_secs: d.league.pick_timer_secs,
          delist_minimum: d.league.delist_minimum,
          def_count: d.league.on_field_slots.DEF ?? 5,
          mid_count: d.league.on_field_slots.MID ?? 7,
          fwd_count: d.league.on_field_slots.FWD ?? 5,
          ruc_count: d.league.on_field_slots.RUC ?? 1,
          flex_count: d.league.flex_count ?? 1,
          num_fixture_rounds: d.season_config.num_regular_rounds,
          finals_teams: d.season_config.finals_teams,
          mid_season_draft_enabled: d.season_config.mid_season_draft_enabled,
          mid_season_trade_mode: d.season_config.mid_season_trade_mode,
          mid_season_trade_until_round: d.season_config.mid_season_trade_until_round,
          mid_season_draft_after_round: d.season_config.mid_season_draft_after_round,
          mid_delist_duration_days: d.season_config.mid_delist_duration_days,
          mid_season_delist_required: d.season_config.mid_season_delist_required,
          off_delist_duration_days: d.season_config.off_delist_duration_days,
          offseason_delist_min: d.season_config.offseason_delist_min,
          off_trade_duration_days: d.season_config.off_trade_duration_days,
          supplemental_draft_date: d.season_config.supplemental_draft_date || '',
          live_scoring_enabled: d.live_config.enabled,
          lockout_type: d.live_config.lockout_type,
          captain_scoring_enabled: d.season_config.captain_scoring_enabled,
          sevens_captain_enabled: d.season_config.sevens_captain_enabled,
          ssp_enabled: d.season_config.ssp_enabled,
          ssp_cutoff_round: d.season_config.ssp_cutoff_round,
          ssp_slots: d.season_config.ssp_slots,
        })
        setExpanded({
          mid: d.season_config.mid_season_draft_enabled,
          ssp: d.season_config.ssp_enabled,
          off: true,
          live: d.live_config.enabled,
        })
      })
      .finally(() => setLoading(false))
  }, [leagueId])

  const totals = useMemo(() => {
    const onField = form.def_count + form.mid_count + form.fwd_count + form.ruc_count
    const total = onField + form.flex_count
    return { onField, flex: form.flex_count, total }
  }, [form.def_count, form.mid_count, form.fwd_count, form.ruc_count, form.flex_count])
  const posOk = totals.total <= form.squad_size
  const fixtureTotal = form.num_fixture_rounds + (FINALS_WEEKS[form.finals_teams] ?? 0)
  const fixtureOk = fixtureTotal <= AFL_SEASON_ROUNDS

  if (loading) return <Spinner text="Loading settings..." />
  if (!data) return <p className="text-danger">Failed to load settings</p>

  const { league, is_commissioner, has_active_draft } = data
  const disabled = !is_commissioner

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!is_commissioner) return
    if (!posOk) {
      setMsg({ kind: 'error', text: `Total positions (${totals.total}) exceed squad size (${form.squad_size}).` })
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const fd = new FormData()
      const pushString = (k: string, v: string | number) => fd.append(k, String(v))
      const pushCheckbox = (k: string, v: boolean) => { if (v) fd.append(k, 'on') }
      pushString('name', form.name)
      pushString('num_teams', form.num_teams)
      pushString('squad_size', form.squad_size)
      pushString('draft_type', form.draft_type)
      pushString('pick_timer_secs', form.pick_timer_secs)
      pushString('delist_minimum', form.delist_minimum)
      pushString('def_count', form.def_count)
      pushString('mid_count', form.mid_count)
      pushString('fwd_count', form.fwd_count)
      pushString('ruc_count', form.ruc_count)
      pushString('flex_count', form.flex_count)
      pushString('num_fixture_rounds', form.num_fixture_rounds)
      pushString('finals_teams', form.finals_teams)
      pushCheckbox('mid_season_draft_enabled', form.mid_season_draft_enabled)
      pushString('mid_season_trade_mode', form.mid_season_trade_mode)
      pushString('mid_season_trade_until_round', form.mid_season_trade_until_round)
      pushString('mid_season_draft_after_round', form.mid_season_draft_after_round)
      pushString('mid_delist_duration_days', form.mid_delist_duration_days)
      pushString('mid_season_delist_required', form.mid_season_delist_required)
      pushString('off_delist_duration_days', form.off_delist_duration_days)
      pushString('offseason_delist_min', form.offseason_delist_min)
      pushString('off_trade_duration_days', form.off_trade_duration_days)
      if (form.supplemental_draft_date) pushString('supplemental_draft_date', form.supplemental_draft_date)
      pushCheckbox('live_scoring_enabled', form.live_scoring_enabled)
      pushString('lockout_type', form.lockout_type)
      pushCheckbox('captain_scoring_enabled', form.captain_scoring_enabled)
      pushCheckbox('sevens_captain_enabled', form.sevens_captain_enabled)
      pushCheckbox('ssp_enabled', form.ssp_enabled)
      pushString('ssp_cutoff_round', form.ssp_cutoff_round)
      pushString('ssp_slots', form.ssp_slots)

      const res = await fetch(`/leagues/${leagueId}/settings`, {
        method: 'POST', body: fd, credentials: 'include', redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      setMsg({ kind: 'success', text: 'League settings updated.' })
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  async function generateFixtures() {
    if (!confirm('Generate fixtures for the season? Any existing fixtures will be replaced.')) return
    setGenerating(true)
    setGenStatus(null)
    try {
      const fd = new FormData()
      fd.append('num_rounds', String(form.num_fixture_rounds))
      const res = await fetch(`/leagues/${leagueId}/regenerate-fixtures`, {
        method: 'POST', body: fd, credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
      const body = await res.json().catch(() => ({ message: 'Unknown response' }))
      if (!res.ok) {
        setGenStatus({ kind: 'error', text: body.message || 'Request failed.' })
      } else {
        setGenStatus({ kind: 'success', text: body.message || 'Fixtures generated.' })
      }
    } catch (e) {
      setGenStatus({ kind: 'error', text: (e as Error).message })
    } finally {
      setGenerating(false)
    }
  }

  async function generatePreseason() {
    const ok = confirm(`Generate pre-season fixtures?${data?.has_preseason ? ' This will replace existing pre-season matches.' : ''}`)
    if (!ok) return
    try {
      await fetch(`/leagues/${leagueId}/generate-preseason`, { method: 'POST', credentials: 'include' })
      setMsg({ kind: 'success', text: 'Pre-season fixtures generated.' })
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
    }
  }

  async function syncSchedule() {
    try {
      await fetch(`/leagues/${leagueId}/sync-now`, { method: 'POST', credentials: 'include' })
      setMsg({ kind: 'success', text: 'Schedule synced from Squiggle.' })
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
    }
  }

  const tradeModeHelp =
    form.mid_season_trade_mode === 'all_year'
      ? 'Trades always open. Delist period + supplemental draft runs after the round above.'
      : form.mid_season_trade_mode === 'until_round'
        ? 'Trades close after the specified round. Delist period + supplemental draft runs after the draft round.'
        : 'Trade window opens for 2 days after the draft round, then 1 day delist period, then supplemental draft.'

  return (
    <>
      <style>{STYLE}</style>
      <AdminSubnav active="settings" leagueId={leagueId!} />
      <div className="row justify-content-center">
        <div className="col-md-7">
          <div className="page-header">
            <div className="page-breadcrumb">
              <Link to="/leagues">My Leagues</Link>
              {' / '}<Link to={`/leagues/${leagueId}`}>{league.name}</Link>
              {' / '}Settings
            </div>
            <div className="d-flex align-items-center gap-3">
              <Link to={`/leagues/${leagueId}`} className="btn btn-sm btn-outline-secondary" style={{ padding: '4px 10px' }}>
                <i className="bi bi-arrow-left"></i>
              </Link>
              <h2 className="mb-0">
                League Settings
                {!is_commissioner && (
                  <span className="badge ms-2" style={{ background: '#21262d', color: '#8b949e', fontSize: '.6rem', verticalAlign: 'middle' }}>
                    VIEW ONLY
                  </span>
                )}
              </h2>
            </div>
          </div>

          {has_active_draft && is_commissioner && (
            <div className="alert d-flex align-items-center gap-2 mb-3" style={{ background: 'rgba(210,153,34,.1)', border: '1px solid rgba(210,153,34,.2)', borderRadius: 10, fontSize: '.85rem' }}>
              <i className="bi bi-lock-fill" style={{ color: '#d29922' }}></i>
              <span style={{ color: '#c9d1d9' }}>
                Some settings are locked while a draft session is active. Delete the draft from{' '}
                <Link to={`/leagues/${leagueId}/draft/setup`} style={{ color: '#58a6ff' }}>Draft Setup</Link> to unlock.
              </span>
            </div>
          )}

          {msg && (
            <div className={`alert alert-${msg.kind === 'success' ? 'success' : 'danger'}`} style={{ fontSize: '.85rem' }}>
              {msg.text}
            </div>
          )}

          <fieldset disabled={disabled}>
            {/* General */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}><i className="bi bi-sliders me-2" style={{ color: '#8b949e' }}></i>General</h5></div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">League Name</label>
                    <input type="text" className="form-control" value={form.name} onChange={e => setField('name', e.target.value)} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">
                      Max Teams {has_active_draft && <i className="bi bi-lock-fill" style={{ color: '#d29922', fontSize: '.7rem' }} title="Locked — draft is active"></i>}
                    </label>
                    <input type="number" className="form-control" min={2} max={18} value={form.num_teams} onChange={e => setField('num_teams', Number(e.target.value))} disabled={has_active_draft} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">
                      Squad Size {has_active_draft && <i className="bi bi-lock-fill" style={{ color: '#d29922', fontSize: '.7rem' }}></i>}
                    </label>
                    <input type="number" className="form-control" min={5} max={60} value={form.squad_size} onChange={e => setField('squad_size', Number(e.target.value))} disabled={has_active_draft} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Positions Allocated</label>
                    <div className="form-control" style={{ background: '#21262d', fontWeight: 600, fontSize: '.85rem', color: posOk ? '#3fb950' : '#f85149' }}>
                      {totals.onField} field + {totals.flex} flex = {totals.total} / {form.squad_size}
                    </div>
                    <div className="form-text" style={{ color: '#484f58', fontSize: '.7rem' }}>On-field + flex must fit within squad size</div>
                    {!posOk && (
                      <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.4)', borderRadius: 6, color: '#f85149', fontSize: '.75rem', fontWeight: 600 }}>
                        Total positions ({totals.total}) exceed squad size ({form.squad_size}). Reduce positions or increase squad size.
                      </div>
                    )}
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">
                      Draft Type {has_active_draft && <i className="bi bi-lock-fill" style={{ color: '#d29922', fontSize: '.7rem' }}></i>}
                    </label>
                    <select className="form-select" value={form.draft_type} onChange={e => setField('draft_type', e.target.value)} disabled={has_active_draft}>
                      <option value="snake">Snake</option>
                      <option value="linear">Linear</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Pick Timer (s)</label>
                    <input type="number" className="form-control" min={30} max={600} value={form.pick_timer_secs} onChange={e => setField('pick_timer_secs', Number(e.target.value))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Trade Window</label>
                    <div className="mt-1">
                      <span className="badge" style={{ background: league.trade_window_open ? '#238636' : '#484f58' }}>
                        {league.trade_window_open ? 'Open' : 'Closed'}
                      </span>
                      <span className="text-secondary" style={{ fontSize: '.7rem', display: 'block', marginTop: 4 }}>
                        Durations configured below in Mid-Season &amp; Off-Season sections
                      </span>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Min Delists</label>
                    <input type="number" className="form-control" min={0} max={15} value={form.delist_minimum} onChange={e => setField('delist_minimum', Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

            {/* On-Field Formation */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}><i className="bi bi-diagram-3 me-2" style={{ color: '#8b949e' }}></i>On-Field Formation</h5></div>
              <div className="card-body">
                <div className="row g-2 mb-2">
                  <div className="col-3">
                    <label className="form-label" style={{ fontSize: '.75rem', color: '#58a6ff' }}>DEF</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={10} value={form.def_count} onChange={e => setField('def_count', Number(e.target.value))} />
                  </div>
                  <div className="col-3">
                    <label className="form-label" style={{ fontSize: '.75rem', color: '#bc8cff' }}>MID</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={12} value={form.mid_count} onChange={e => setField('mid_count', Number(e.target.value))} />
                  </div>
                  <div className="col-3">
                    <label className="form-label" style={{ fontSize: '.75rem', color: '#f0883e' }}>FWD</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={10} value={form.fwd_count} onChange={e => setField('fwd_count', Number(e.target.value))} />
                  </div>
                  <div className="col-3">
                    <label className="form-label" style={{ fontSize: '.75rem', color: '#3fb950' }}>RUC</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={3} value={form.ruc_count} onChange={e => setField('ruc_count', Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

            <div className="row g-2 mb-4">
              <div className="col-4">
                <label className="form-label" style={{ fontSize: '.75rem', color: '#d29922' }}>
                  <i className="bi bi-lightning-charge me-1"></i>FLEX Slots
                </label>
                <input type="number" className="form-control form-control-sm" min={0} max={10} value={form.flex_count} onChange={e => setField('flex_count', Number(e.target.value))} />
                <div className="form-text" style={{ color: '#484f58', fontSize: '.65rem' }}>Sidebar scoring slots — any position eligible.</div>
              </div>
            </div>

            {/* Fixtures */}
            <div className="card mb-4">
              <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}><i className="bi bi-calendar-week me-2" style={{ color: '#8b949e' }}></i>Fixtures</h5></div>
              <div className="card-body">
                <div className="row g-3 align-items-end">
                  <div className="col-md-4">
                    <label className="form-label">Regular Season Rounds</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={24} value={form.num_fixture_rounds} onChange={e => setField('num_fixture_rounds', Number(e.target.value))} />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Finals Format</label>
                    <select className="form-select form-select-sm" value={form.finals_teams} onChange={e => setField('finals_teams', Number(e.target.value))}>
                      <option value={0}>No Finals</option>
                      <option value={4}>Top 4 (3 wks)</option>
                      <option value={6}>Top 6 (4 wks)</option>
                      <option value={8}>Top 8 (4 wks)</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <button type="button" className="btn btn-outline-warning btn-sm w-100" disabled={!is_commissioner || generating} onClick={generateFixtures}>
                      {generating ? <><span className="spinner-border spinner-border-sm me-1"></span>Generating...</> : <><i className="bi bi-arrow-repeat me-1"></i>Generate Fixtures</>}
                    </button>
                  </div>
                </div>
                <div className="mt-2" style={{ fontSize: '.75rem', fontWeight: 600, color: fixtureOk ? '#3fb950' : '#f85149' }}>
                  {form.num_fixture_rounds} regular + {FINALS_WEEKS[form.finals_teams] ?? 0} finals weeks = {fixtureTotal} / {AFL_SEASON_ROUNDS} AFL rounds
                </div>
                {!fixtureOk && (
                  <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.4)', borderRadius: 6, color: '#f85149', fontSize: '.75rem', fontWeight: 600 }}>
                    Total season ({fixtureTotal} weeks) exceeds AFL season ({AFL_SEASON_ROUNDS} rounds).
                  </div>
                )}
                {genStatus && (
                  <div className="mt-2" style={{ fontSize: '.75rem', color: genStatus.kind === 'success' ? '#3fb950' : '#f85149' }}>
                    {genStatus.text}
                  </div>
                )}
                <div className="form-text mt-1" style={{ color: '#484f58', fontSize: '.7rem' }}>
                  AFL season has 24 rounds. Regular season + finals weeks must not exceed this.
                </div>
                {is_commissioner && (
                  <>
                    <hr style={{ borderColor: '#21262d', margin: '12px 0' }} />
                    <div className="d-flex align-items-center gap-3">
                      <button type="button" className="btn btn-outline-info btn-sm" onClick={generatePreseason}>
                        <i className="bi bi-trophy me-1"></i>{data.has_preseason ? 'Regenerate' : 'Generate'} Pre-Season Match
                      </button>
                      {data.has_preseason && (
                        <span className="badge" style={{ background: 'rgba(56,139,253,.15)', color: '#58a6ff', fontSize: '.7rem' }}>Pre-season fixtures exist</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Scoring System link */}
            <div className="card mb-4">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}><i className="bi bi-calculator me-2" style={{ color: '#d29922' }}></i>Scoring System</h5>
                <Link to={`/leagues/${leagueId}/scoring`} className="btn btn-outline-secondary btn-sm">
                  <i className="bi bi-pencil me-1"></i>Configure Scoring
                </Link>
              </div>
              <div className="card-body py-3">
                <div className="d-flex align-items-center gap-3">
                  <span className="badge" style={{ background: 'rgba(210,153,34,.15)', color: '#d29922', fontSize: '.75rem', padding: '4px 10px' }}>
                    {(league.scoring_type || 'supercoach').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  <span style={{ fontSize: '.75rem', color: '#8b949e' }}>Scoring type, custom stat weights, and hybrid configuration</span>
                </div>
              </div>
            </div>

            {/* Mid-Season */}
            <div className="card mb-4">
              <div className={`settings-section-header${expanded.mid ? ' section-active' : ''}`}>
                <h5 className="mb-0 fw-bold d-flex align-items-center" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-arrow-repeat me-2" style={{ color: '#2dd4bf' }}></i>Mid-Season
                  <span className={`settings-status${expanded.mid ? ' status-on' : ''}`}></span>
                </h5>
                <button type="button" className="btn btn-sm btn-outline-secondary" style={{ fontSize: '.7rem' }} onClick={() => setExpanded(e => ({ ...e, mid: !e.mid }))}>
                  <i className={`bi bi-chevron-${expanded.mid ? 'up' : 'down'}`}></i>
                </button>
              </div>
              <div className={`settings-expand${expanded.mid ? ' expanded' : ''}`}>
                <div className="d-flex align-items-center justify-content-between mb-2 pb-2" style={{ borderBottom: '1px solid #21262d' }}>
                  <div className="d-flex align-items-center gap-2">
                    <i className="bi bi-arrow-repeat" style={{ color: '#2dd4bf' }}></i>
                    <span className="fw-bold" style={{ fontSize: '.85rem' }}>Enable Mid-Season</span>
                  </div>
                  <label className="settings-toggle mb-0">
                    <input type="checkbox" checked={form.mid_season_draft_enabled} onChange={e => setField('mid_season_draft_enabled', e.target.checked)} />
                    <span className="toggle-track"></span>
                  </label>
                </div>

                <div className="mb-3 pb-2" style={{ borderBottom: '1px solid #21262d' }}>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <i className="bi bi-arrow-left-right" style={{ color: '#d29922' }}></i>
                    <span className="fw-bold" style={{ fontSize: '.85rem' }}>Trading</span>
                  </div>
                  <div className="d-flex flex-column gap-2" style={{ paddingLeft: 4 }}>
                    {([
                      { value: 'all_year', label: 'All Season', help: 'Trades open the entire year' },
                      { value: 'until_round', label: 'Until Round', help: 'Trades open from start of season until a round' },
                      { value: 'window', label: '2-Day Window', help: 'Trade window opens for 2 days after a specific round' },
                    ] as const).map(opt => (
                      <label key={opt.value} className="d-flex align-items-start gap-2" style={{ cursor: 'pointer' }}>
                        <input type="radio" name="mid_season_trade_mode" value={opt.value}
                          checked={form.mid_season_trade_mode === opt.value}
                          onChange={() => setField('mid_season_trade_mode', opt.value)}
                          style={{ marginTop: 3 }} />
                        <div>
                          <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#c9d1d9' }}>{opt.label}</span>
                          <div style={{ fontSize: '.68rem', color: '#6e7681' }}>{opt.help}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {form.mid_season_trade_mode === 'until_round' && (
                  <div className="row g-3 mb-2">
                    <div className="col-md-6">
                      <label className="form-label" style={{ fontSize: '.75rem' }}>Trades Open Until Round</label>
                      <input type="number" className="form-control form-control-sm" min={1} max={24} value={form.mid_season_trade_until_round} onChange={e => setField('mid_season_trade_until_round', Number(e.target.value))} />
                    </div>
                  </div>
                )}

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Supplemental Draft After Round</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={24} value={form.mid_season_draft_after_round} onChange={e => setField('mid_season_draft_after_round', Number(e.target.value))} />
                  </div>
                </div>

                <hr className="my-3" style={{ borderColor: '#21262d' }} />
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-x-circle" style={{ color: '#f85149' }}></i>
                  <span className="fw-bold" style={{ fontSize: '.85rem' }}>Mid-Season Delist</span>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Delist Period Duration (days)</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={7} value={form.mid_delist_duration_days} onChange={e => setField('mid_delist_duration_days', Number(e.target.value))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Min Delists Required</label>
                    <input type="number" className="form-control form-control-sm" min={0} max={10} value={form.mid_season_delist_required} onChange={e => setField('mid_season_delist_required', Number(e.target.value))} />
                  </div>
                </div>
                <div className="mt-2" style={{ fontSize: '.7rem', color: '#6e7681' }}>
                  <i className="bi bi-info-circle me-1"></i>{tradeModeHelp}
                </div>
              </div>
            </div>

            {/* SSP */}
            <div className="card mb-4">
              <div className={`settings-section-header${form.ssp_enabled ? ' section-active' : ''}`}>
                <h5 className="mb-0 fw-bold d-flex align-items-center" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-bandaid me-2" style={{ color: '#58a6ff' }}></i>SSP (Supplemental Selection Period)
                  <span className={`settings-status${form.ssp_enabled ? ' status-on' : ''}`}></span>
                </h5>
                <label className="settings-toggle mb-0">
                  <input type="checkbox" checked={form.ssp_enabled} onChange={e => { setField('ssp_enabled', e.target.checked); setExpanded(x => ({ ...x, ssp: e.target.checked })) }} />
                  <span className="toggle-track"></span>
                </label>
              </div>
              <div className={`settings-expand${expanded.ssp ? ' expanded' : ''}`}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Open Until Round</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={24} value={form.ssp_cutoff_round} onChange={e => setField('ssp_cutoff_round', Number(e.target.value))} />
                    <div className="form-text" style={{ fontSize: '.7rem' }}>SSP is open post-draft until this round begins</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>LTIL Slots</label>
                    <input type="number" className="form-control form-control-sm" min={0} max={5} value={form.ssp_slots} onChange={e => setField('ssp_slots', Number(e.target.value))} />
                    <div className="form-text" style={{ fontSize: '.7rem' }}>Max long-term injury replacements per team per season</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Off-Season */}
            <div className="card mb-4">
              <div className="settings-section-header section-active">
                <h5 className="mb-0 fw-bold d-flex align-items-center" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-calendar-x me-2" style={{ color: '#f0883e' }}></i>Off-Season
                </h5>
                <button type="button" className="btn btn-sm btn-outline-secondary" style={{ fontSize: '.7rem' }} onClick={() => setExpanded(e => ({ ...e, off: !e.off }))}>
                  <i className={`bi bi-chevron-${expanded.off ? 'up' : 'down'}`}></i>
                </button>
              </div>
              <div className={`settings-expand${expanded.off ? ' expanded' : ''}`}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Delist Period Duration (days)</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={30} value={form.off_delist_duration_days} onChange={e => setField('off_delist_duration_days', Number(e.target.value))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Min Delists Required</label>
                    <input type="number" className="form-control form-control-sm" min={0} max={15} value={form.offseason_delist_min} onChange={e => setField('offseason_delist_min', Number(e.target.value))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Trade Window Duration (days)</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={30} value={form.off_trade_duration_days} onChange={e => setField('off_trade_duration_days', Number(e.target.value))} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Supplemental Draft Date</label>
                    <input type="date" className="form-control form-control-sm" value={form.supplemental_draft_date} onChange={e => setField('supplemental_draft_date', e.target.value)} />
                    <div className="form-text" style={{ fontSize: '.65rem', color: '#6e7681' }}>After AFL draft ~Nov 30</div>
                  </div>
                </div>
                <div className="mt-2" style={{ fontSize: '.7rem', color: '#6e7681' }}>
                  <i className="bi bi-info-circle me-1"></i>Delist period and trade window open in parallel when the season transitions to off-season.
                </div>
              </div>
            </div>

            {/* Live Scoring */}
            <div className="card mb-4">
              <div className={`settings-section-header${form.live_scoring_enabled ? ' section-active' : ''}`}>
                <h5 className="mb-0 fw-bold d-flex align-items-center" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-broadcast me-2" style={{ color: '#238636' }}></i>Live Scoring
                  <span className={`settings-status${form.live_scoring_enabled ? ' status-on' : ''}`}></span>
                </h5>
                <label className="settings-toggle mb-0">
                  <input type="checkbox" checked={form.live_scoring_enabled} onChange={e => { setField('live_scoring_enabled', e.target.checked); setExpanded(x => ({ ...x, live: e.target.checked })) }} />
                  <span className="toggle-track"></span>
                </label>
              </div>
              <div className={`settings-expand${expanded.live ? ' expanded' : ''}`}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Lockout Type</label>
                    <select className="form-select form-select-sm" value={form.lockout_type} onChange={e => setField('lockout_type', e.target.value as 'game_start' | 'round_start')}>
                      <option value="game_start">Per-Game Rolling</option>
                      <option value="round_start">Round Start (all at once)</option>
                    </select>
                    <div className="form-text" style={{ fontSize: '.7rem' }}>Per-game: each player locks at their game's first bounce</div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Score Updates</label>
                    <div style={{ fontSize: '.75rem', color: '#8b949e', marginTop: 4 }}>
                      <i className="bi bi-clock me-1"></i>Scores sync automatically Thu-Sun at 11pm and Sat 5pm AEST.
                    </div>
                  </div>
                </div>
                <hr className="my-3" style={{ borderColor: '#21262d' }} />
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <span className="fw-bold" style={{ fontSize: '.85rem' }}>Captain Scoring</span>
                    <div style={{ fontSize: '.7rem', color: '#6e7681' }}>Double captain's points (or VC if captain DNP)</div>
                  </div>
                  <label className="settings-toggle mb-0">
                    <input type="checkbox" checked={form.captain_scoring_enabled} onChange={e => setField('captain_scoring_enabled', e.target.checked)} />
                    <span className="toggle-track"></span>
                  </label>
                </div>
                <div className="d-flex align-items-center justify-content-between mt-3">
                  <div>
                    <span>7s Captain Scoring</span>
                    <div style={{ fontSize: '.7rem', color: '#6e7681' }}>Double 7s captain's score in reserve 7s comp</div>
                  </div>
                  <label className="settings-toggle mb-0">
                    <input type="checkbox" checked={form.sevens_captain_enabled} onChange={e => setField('sevens_captain_enabled', e.target.checked)} />
                    <span className="toggle-track"></span>
                  </label>
                </div>
                <hr className="my-3" style={{ borderColor: '#21262d' }} />
                <div className="d-flex align-items-center justify-content-between">
                  <span style={{ fontSize: '.75rem', color: '#484f58' }}>Sync AFL game schedule (bounce times + results) from Squiggle</span>
                  <button type="button" className="sync-scores-btn" disabled={!is_commissioner} onClick={syncSchedule}>
                    <i className="bi bi-cloud-download"></i>Sync Schedule
                  </button>
                </div>
              </div>
            </div>
          </fieldset>

          {is_commissioner && (
            <div className="d-flex gap-2 mb-4">
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                <i className="bi bi-check-lg me-1"></i>{saving ? 'Saving...' : 'Save Settings'}
              </button>
              <Link to={`/leagues/${leagueId}`} className="btn btn-outline-secondary">Cancel</Link>
            </div>
          )}

          {is_commissioner && (
            <div className="text-center mt-4 mb-3">
              <Link to={`/leagues/${leagueId}/commissioner`} className="btn btn-outline-warning btn-sm">
                <i className="bi bi-shield-lock me-1"></i>Commissioner Hub
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
