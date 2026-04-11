import { useParams, Link } from 'react-router'
import { useState, useEffect } from 'react'
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
  }
  is_commissioner: boolean
  has_active_draft: boolean
  has_preseason: boolean
}

export function SettingsPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<SettingsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // Form state — a subset of general fields that are easy to wire up
  const [form, setForm] = useState({
    name: '', num_teams: 0, squad_size: 0, draft_type: 'snake',
    pick_timer_secs: 60, delist_minimum: 0,
    def_count: 0, mid_count: 0, fwd_count: 0, ruc_count: 0, flex_count: 0,
    num_fixture_rounds: 18, finals_teams: 4,
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
          def_count: d.league.on_field_slots.DEF || 5,
          mid_count: d.league.on_field_slots.MID || 7,
          fwd_count: d.league.on_field_slots.FWD || 5,
          ruc_count: d.league.on_field_slots.RUC || 1,
          flex_count: d.league.flex_count || 1,
          num_fixture_rounds: d.season_config.num_regular_rounds,
          finals_teams: d.season_config.finals_teams,
          ssp_enabled: d.season_config.ssp_enabled,
          ssp_cutoff_round: d.season_config.ssp_cutoff_round,
          ssp_slots: d.season_config.ssp_slots,
        })
      })
      .finally(() => setLoading(false))
  }, [leagueId])

  if (loading) return <Spinner text="Loading settings..." />
  if (!data) return <p className="text-danger">Failed to load settings</p>

  const { league, is_commissioner, has_active_draft } = data

  async function save() {
    if (!is_commissioner) return
    setSaving(true)
    setMsg(null)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => {
        if (typeof v === 'boolean') {
          if (v) fd.append(k, 'on')
        } else {
          fd.append(k, String(v))
        }
      })
      const res = await fetch(`/leagues/${leagueId}/settings`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
        redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      setMsg({ kind: 'success', text: 'League settings updated.' })
    } catch (e) {
      setMsg({ kind: 'error', text: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const disabled = !is_commissioner

  return (
    <>
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
          <div
            className="alert d-flex align-items-center gap-2 mb-3"
            style={{ background: 'rgba(210,153,34,.1)', border: '1px solid rgba(210,153,34,.2)', borderRadius: 10, fontSize: '.85rem' }}
          >
            <i className="bi bi-lock-fill" style={{ color: '#d29922' }}></i>
            <span style={{ color: '#c9d1d9' }}>
              Some settings are locked while a draft session is active.
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
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-sliders me-2" style={{ color: '#8b949e' }}></i>General
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">League Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">
                    Max Teams {has_active_draft && <i className="bi bi-lock-fill" style={{ color: '#d29922', fontSize: '.7rem' }} title="Locked — draft is active"></i>}
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min={2}
                    max={18}
                    value={form.num_teams}
                    onChange={e => setForm({ ...form, num_teams: Number(e.target.value) })}
                    disabled={has_active_draft}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">
                    Squad Size {has_active_draft && <i className="bi bi-lock-fill" style={{ color: '#d29922', fontSize: '.7rem' }}></i>}
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min={5}
                    max={60}
                    value={form.squad_size}
                    onChange={e => setForm({ ...form, squad_size: Number(e.target.value) })}
                    disabled={has_active_draft}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Positions Allocated</label>
                  <div
                    className="form-control"
                    style={{ background: '#21262d', fontWeight: 600, fontSize: '.85rem' }}
                  >
                    {(() => {
                      const total = form.def_count + form.mid_count + form.fwd_count + form.ruc_count + form.flex_count
                      const ok = total <= form.squad_size
                      return <span style={{ color: ok ? '#3fb950' : '#f85149' }}>{total} / {form.squad_size}</span>
                    })()}
                  </div>
                  <div className="form-text" style={{ color: '#484f58', fontSize: '.7rem' }}>
                    On-field + flex must fit within squad size
                  </div>
                  {(() => {
                    const total = form.def_count + form.mid_count + form.fwd_count + form.ruc_count + form.flex_count
                    if (total > form.squad_size) {
                      return (
                        <div style={{ marginTop: 6, padding: '6px 10px', background: 'rgba(248,81,73,.12)', border: '1px solid rgba(248,81,73,.4)', borderRadius: 6, color: '#f85149', fontSize: '.75rem', fontWeight: 600 }}>
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          Total positions exceed squad size by {total - form.squad_size}
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
                <div className="col-md-4">
                  <label className="form-label">
                    Draft Type {has_active_draft && <i className="bi bi-lock-fill" style={{ color: '#d29922', fontSize: '.7rem' }}></i>}
                  </label>
                  <select
                    className="form-select"
                    value={form.draft_type}
                    onChange={e => setForm({ ...form, draft_type: e.target.value })}
                    disabled={has_active_draft}
                  >
                    <option value="snake">Snake</option>
                    <option value="linear">Linear</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Trade Window</label>
                  <div className="mt-1">
                    {league.scoring_type ? (
                      <span className="badge" style={{ background: data.league.trade_window_open ? '#238636' : '#484f58' }}>
                        {data.league.trade_window_open ? 'Open' : 'Closed'}
                      </span>
                    ) : null}
                    <span className="text-secondary" style={{ fontSize: '.7rem', display: 'block', marginTop: 4 }}>
                      Configured below in Mid-Season &amp; Off-Season
                    </span>
                  </div>
                </div>
                <div className="col-md-4">
                  <label className="form-label">Pick Timer (s)</label>
                  <input
                    type="number"
                    className="form-control"
                    min={30}
                    max={600}
                    value={form.pick_timer_secs}
                    onChange={e => setForm({ ...form, pick_timer_secs: Number(e.target.value) })}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Min Delists</label>
                  <input
                    type="number"
                    className="form-control"
                    min={0}
                    max={15}
                    value={form.delist_minimum}
                    onChange={e => setForm({ ...form, delist_minimum: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* On-Field Formation */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-diagram-3 me-2" style={{ color: '#8b949e' }}></i>On-Field Formation
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-2 mb-2">
                <div className="col-3">
                  <label className="form-label" style={{ fontSize: '.75rem', color: '#58a6ff' }}>DEF</label>
                  <input type="number" className="form-control form-control-sm" min={1} max={10}
                    value={form.def_count}
                    onChange={e => setForm({ ...form, def_count: Number(e.target.value) })} />
                </div>
                <div className="col-3">
                  <label className="form-label" style={{ fontSize: '.75rem', color: '#bc8cff' }}>MID</label>
                  <input type="number" className="form-control form-control-sm" min={1} max={12}
                    value={form.mid_count}
                    onChange={e => setForm({ ...form, mid_count: Number(e.target.value) })} />
                </div>
                <div className="col-3">
                  <label className="form-label" style={{ fontSize: '.75rem', color: '#f0883e' }}>FWD</label>
                  <input type="number" className="form-control form-control-sm" min={1} max={10}
                    value={form.fwd_count}
                    onChange={e => setForm({ ...form, fwd_count: Number(e.target.value) })} />
                </div>
                <div className="col-3">
                  <label className="form-label" style={{ fontSize: '.75rem', color: '#3fb950' }}>RUC</label>
                  <input type="number" className="form-control form-control-sm" min={1} max={3}
                    value={form.ruc_count}
                    onChange={e => setForm({ ...form, ruc_count: Number(e.target.value) })} />
                </div>
              </div>
              <div className="row g-2">
                <div className="col-4">
                  <label className="form-label" style={{ fontSize: '.75rem', color: '#d29922' }}>
                    <i className="bi bi-lightning-charge me-1"></i>FLEX Slots
                  </label>
                  <input type="number" className="form-control form-control-sm" min={0} max={10}
                    value={form.flex_count}
                    onChange={e => setForm({ ...form, flex_count: Number(e.target.value) })} />
                  <div className="form-text" style={{ color: '#484f58', fontSize: '.65rem' }}>
                    Sidebar scoring slots — any position eligible.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Fixtures */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-calendar-week me-2" style={{ color: '#8b949e' }}></i>Fixtures
              </h5>
            </div>
            <div className="card-body">
              <div className="row g-3 align-items-end">
                <div className="col-md-4">
                  <label className="form-label">Regular Season Rounds</label>
                  <input type="number" className="form-control form-control-sm" min={1} max={24}
                    value={form.num_fixture_rounds}
                    onChange={e => setForm({ ...form, num_fixture_rounds: Number(e.target.value) })} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Finals Format</label>
                  <select className="form-select form-select-sm"
                    value={form.finals_teams}
                    onChange={e => setForm({ ...form, finals_teams: Number(e.target.value) })}>
                    <option value={0}>No Finals</option>
                    <option value={4}>Top 4 (3 wks)</option>
                    <option value={6}>Top 6 (4 wks)</option>
                    <option value={8}>Top 8 (4 wks)</option>
                  </select>
                </div>
                {is_commissioner && (
                  <div className="col-md-4">
                    <button
                      type="button"
                      className="btn btn-outline-warning btn-sm w-100"
                      onClick={async () => {
                        if (!confirm('Regenerate fixtures? This replaces the existing season schedule.')) return
                        try {
                          const res = await fetch(`/leagues/${leagueId}/regenerate-fixtures`, {
                            method: 'POST', credentials: 'include', redirect: 'manual',
                          })
                          if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
                          setMsg({ kind: 'success', text: 'Fixtures regenerated.' })
                        } catch (e) {
                          setMsg({ kind: 'error', text: (e as Error).message })
                        }
                      }}
                    >
                      <i className="bi bi-arrow-repeat me-1"></i>Generate Fixtures
                    </button>
                  </div>
                )}
              </div>
              <div className="form-text mt-2" style={{ color: '#484f58', fontSize: '.7rem' }}>
                AFL season has 24 rounds. Regular season + finals weeks must not exceed this.
              </div>
            </div>
          </div>

          {/* SSP */}
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-bandaid me-2" style={{ color: '#58a6ff' }}></i>
                SSP (Supplemental Selection Period)
              </h5>
            </div>
            <div className="card-body">
              <div className="mb-3 d-flex align-items-center gap-2">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="ssp_enabled"
                  checked={form.ssp_enabled}
                  onChange={e => setForm({ ...form, ssp_enabled: e.target.checked })}
                />
                <label htmlFor="ssp_enabled" className="form-label mb-0" style={{ fontSize: '.85rem' }}>Enable SSP</label>
              </div>
              {form.ssp_enabled && (
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>Open Until Round</label>
                    <input type="number" className="form-control form-control-sm" min={1} max={24}
                      value={form.ssp_cutoff_round}
                      onChange={e => setForm({ ...form, ssp_cutoff_round: Number(e.target.value) })} />
                    <div className="form-text" style={{ fontSize: '.7rem' }}>
                      SSP is open post-draft until this round begins
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" style={{ fontSize: '.75rem' }}>LTIL Slots</label>
                    <input type="number" className="form-control form-control-sm" min={0} max={5}
                      value={form.ssp_slots}
                      onChange={e => setForm({ ...form, ssp_slots: Number(e.target.value) })} />
                    <div className="form-text" style={{ fontSize: '.7rem' }}>
                      Max long-term injury replacements per team per season
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {is_commissioner && (
            <div className="mt-3 mb-4">
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                <i className="bi bi-check-lg me-1"></i>{saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </fieldset>

        {/* Link out to advanced settings (scoring config, mid-season, etc) */}
        <div className="card mt-4">
          <div className="card-body">
            <h6 className="fw-bold mb-2" style={{ fontSize: '.9rem' }}>Advanced Configuration</h6>
            <p className="text-secondary mb-3" style={{ fontSize: '.8rem' }}>
              Scoring system, mid-season draft, delist periods, and trade modes.
            </p>
            <a
              href={`/leagues/${leagueId}/settings`}
              className="btn btn-outline-secondary btn-sm"
            >
              <i className="bi bi-gear me-1"></i>Open Full Settings
            </a>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
