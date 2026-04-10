import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface ConfigData {
  available_stats: string[]
  default_scoring: Record<string, number>
  stat_categories: Record<string, string[]>
  scoring_presets: Record<string, { label: string; rules: Record<string, number> }>
  default_uf_categories: string[]
}

interface ScoringRule { stat: string; points: number }

const CREATE_CSS = `
.preset-btn { font-size: .75rem; padding: 4px 10px; }
.wiz-num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #1f6feb; color: #fff; font-size: .7rem; font-weight: 700; margin-right: .5rem; }
.uf-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 6px 12px; }
.uf-cat-item { display: flex; align-items: center; gap: 6px; font-size: .8rem; color: #c9d1d9; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background .15s; }
.uf-cat-item:hover { background: rgba(88,166,255,.06); }
.uf-cat-item input { margin: 0; }
.stat-category-header { font-size: .75rem; font-weight: 600; color: #58a6ff; text-transform: uppercase; letter-spacing: .5px; margin-top: .75rem; margin-bottom: .5rem; border-bottom: 1px solid #21262d; padding-bottom: .25rem; }
`

function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function CreateLeaguePage() {
  const navigate = useNavigate()
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Section 1 ──
  const [name, setName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [numTeams, setNumTeams] = useState(6)
  const [squadSize, setSquadSize] = useState(38)

  // ── Section 2 ──
  const [scoringType, setScoringType] = useState<'supercoach' | 'afl_fantasy' | 'custom' | 'hybrid' | 'ultimate_footy'>('supercoach')
  const [hybridBase, setHybridBase] = useState<'supercoach' | 'afl_fantasy'>('supercoach')
  const [hybridBaseWeight, setHybridBaseWeight] = useState(0.7)
  const [hybridCustomMode, setHybridCustomMode] = useState<'points' | 'percentage'>('points')
  const [scoringRules, setScoringRules] = useState<ScoringRule[]>([])
  const [ufCategories, setUfCategories] = useState<Set<string>>(new Set())

  // ── Section 3 ──
  const [draftType, setDraftType] = useState<'snake' | 'linear'>('snake')
  const [pickTimerSecs, setPickTimerSecs] = useState(120)
  const [draftScheduledDate, setDraftScheduledDate] = useState('')
  const [draftAutoRandomize, setDraftAutoRandomize] = useState(true)

  // ── Section 4 ──
  const [midSeasonDraftEnabled, setMidSeasonDraftEnabled] = useState(false)
  const [midSeasonDraftAfterRound, setMidSeasonDraftAfterRound] = useState(13)
  const [midSeasonDraftPicks, setMidSeasonDraftPicks] = useState(1)
  const [offseasonDelistMin, setOffseasonDelistMin] = useState(3)
  const [sspEnabled, setSspEnabled] = useState(true)

  // ── Section 5 ──
  const [defCount, setDefCount] = useState(5)
  const [midCount, setMidCount] = useState(7)
  const [fwdCount, setFwdCount] = useState(5)
  const [rucCount, setRucCount] = useState(1)
  const [flexCount, setFlexCount] = useState(1)

  // ── Collapse state for each wizard section ──
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    details: false, scoring: false, draft: false, season: false, roster: false,
  })

  useEffect(() => {
    api<ConfigData>('/leagues/create?format=json')
      .then(setConfig)
      .finally(() => setLoading(false))
  }, [])

  // Auto-load defaults when scoring type changes to custom
  useEffect(() => {
    if (!config) return
    if (scoringType === 'custom' && scoringRules.length === 0) {
      const rules = Object.entries(config.default_scoring).map(([stat, points]) => ({ stat, points }))
      setScoringRules(rules)
    }
    if (scoringType === 'ultimate_footy' && ufCategories.size === 0) {
      setUfCategories(new Set(config.default_uf_categories))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoringType, config])

  const customScoringPresets = useMemo(() => {
    if (!config) return []
    return Object.entries(config.scoring_presets).filter(([key]) => key !== 'uf_standard')
  }, [config])

  if (loading) return <Spinner text="Loading wizard..." />
  if (!config) return <p className="text-danger">Failed to load create form</p>

  function loadPreset(key: string) {
    if (!config) return
    if (key === '_defaults') {
      setScoringRules(Object.entries(config.default_scoring).map(([stat, points]) => ({ stat, points })))
    } else {
      const preset = config.scoring_presets[key]
      if (preset) {
        setScoringRules(Object.entries(preset.rules).map(([stat, points]) => ({ stat, points })))
      }
    }
  }

  function loadUfPreset(preset: 'standard' | 'all') {
    if (!config) return
    if (preset === 'standard') {
      setUfCategories(new Set(config.default_uf_categories))
    } else {
      // 'all': everything from stat_categories except Fantasy Scores
      const all = new Set<string>()
      Object.entries(config.stat_categories).forEach(([catName, stats]) => {
        if (catName !== 'Fantasy Scores') stats.forEach(s => all.add(s))
      })
      setUfCategories(all)
    }
  }

  function addRule() {
    setScoringRules(prev => [...prev, { stat: config!.available_stats[0] || '', points: 1 }])
  }

  function removeRule(idx: number) {
    setScoringRules(prev => prev.filter((_, i) => i !== idx))
  }

  function updateRule(idx: number, patch: Partial<ScoringRule>) {
    setScoringRules(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function toggleSection(section: string) {
    setCollapsed(prev => ({ ...prev, [section]: !prev[section] }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError('League name is required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('name', name)
      form.set('team_name', teamName)
      form.set('num_teams', String(numTeams))
      form.set('squad_size', String(squadSize))
      form.set('scoring_type', scoringType)
      if (scoringType === 'hybrid') {
        form.set('hybrid_base', hybridBase)
        form.set('hybrid_base_weight', String(hybridBaseWeight))
        form.set('hybrid_custom_mode', hybridCustomMode)
      }
      if (scoringType === 'custom' || scoringType === 'hybrid') {
        scoringRules.forEach(r => {
          form.append('stat_column', r.stat)
          form.append('points_per', String(r.points))
        })
      }
      if (scoringType === 'ultimate_footy') {
        ufCategories.forEach(c => form.append('uf_category', c))
      }
      form.set('draft_type', draftType)
      form.set('pick_timer_secs', String(pickTimerSecs))
      if (draftScheduledDate) form.set('draft_scheduled_date', draftScheduledDate)
      if (draftAutoRandomize) form.set('draft_auto_randomize', 'on')
      if (midSeasonDraftEnabled) form.set('mid_season_draft_enabled', 'on')
      form.set('mid_season_draft_after_round', String(midSeasonDraftAfterRound))
      form.set('mid_season_draft_picks', String(midSeasonDraftPicks))
      form.set('offseason_delist_min', String(offseasonDelistMin))
      if (sspEnabled) form.set('ssp_enabled', 'on')
      form.set('def_count', String(defCount))
      form.set('mid_count', String(midCount))
      form.set('fwd_count', String(fwdCount))
      form.set('ruc_count', String(rucCount))
      form.set('flex_count', String(flexCount))

      const res = await fetch('/leagues/create', {
        method: 'POST',
        body: form,
        credentials: 'include',
        redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      // The Flask route redirects to dashboard on success — we follow up by navigating to /leagues
      navigate('/leagues')
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  function SectionHeader({ id, num, label }: { id: string; num: number; label: string }) {
    const isCollapsed = collapsed[id]
    return (
      <div
        className="card-header d-flex align-items-center justify-content-between"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => toggleSection(id)}
      >
        <span><span className="wiz-num">{num}</span><span className="fw-bold" style={{ fontSize: '.9rem' }}>{label}</span></span>
        <i
          className="bi bi-chevron-down"
          style={{ color: '#8b949e', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .2s' }}
        ></i>
      </div>
    )
  }

  return (
    <div className="row justify-content-center">
      <style>{CREATE_CSS}</style>
      <div className="col-md-8">
        <div className="page-header">
          <div className="page-breadcrumb">
            <Link to="/leagues">Home</Link> / Create
          </div>
          <h2>Create a New League</h2>
        </div>

        {error && <div className="alert alert-danger" style={{ fontSize: '.85rem' }}>{error}</div>}

        <form onSubmit={submit}>
          {/* ═══ Section 1: League Details ═══ */}
          <div className="wiz-section mb-3">
            <div className="card">
              <SectionHeader id="details" num={1} label="League Details" />
              {!collapsed.details && (
                <div className="card-body">
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">League Name</label>
                    <input
                      type="text"
                      className="form-control"
                      id="name"
                      required
                      placeholder="e.g. Keeper Masters 2025"
                      maxLength={120}
                      autoFocus
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="team_name" className="form-label">Your Team Name</label>
                    <input
                      type="text"
                      className="form-control"
                      id="team_name"
                      required
                      placeholder="e.g. The Premiership Chasers"
                      maxLength={120}
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-6">
                      <label htmlFor="num_teams" className="form-label">Team Slots</label>
                      <input
                        type="number"
                        className="form-control"
                        id="num_teams"
                        min={2}
                        max={18}
                        value={numTeams}
                        onChange={e => setNumTeams(Number(e.target.value))}
                      />
                    </div>
                    <div className="col-6">
                      <label htmlFor="squad_size" className="form-label">Squad Size</label>
                      <input
                        type="number"
                        className="form-control"
                        id="squad_size"
                        min={18}
                        max={60}
                        value={squadSize}
                        onChange={e => setSquadSize(Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Section 2: Scoring ═══ */}
          <div className="wiz-section mb-3">
            <div className="card">
              <SectionHeader id="scoring" num={2} label="Scoring" />
              {!collapsed.scoring && (
                <div className="card-body">
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label htmlFor="scoring_type" className="form-label">Scoring Type</label>
                      <select
                        className="form-select"
                        id="scoring_type"
                        value={scoringType}
                        onChange={e => setScoringType(e.target.value as typeof scoringType)}
                      >
                        <option value="supercoach">SuperCoach</option>
                        <option value="afl_fantasy">AFL Fantasy</option>
                        <option value="custom">Custom</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="ultimate_footy">Ultimate Footy</option>
                      </select>
                    </div>
                    {scoringType === 'hybrid' && (
                      <div className="col-6">
                        <label htmlFor="hybrid_base" className="form-label">Hybrid Base</label>
                        <select
                          className="form-select"
                          id="hybrid_base"
                          value={hybridBase}
                          onChange={e => setHybridBase(e.target.value as typeof hybridBase)}
                        >
                          <option value="supercoach">SuperCoach</option>
                          <option value="afl_fantasy">AFL Fantasy</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {scoringType === 'hybrid' && (
                    <div className="card mb-3">
                      <div className="card-header">
                        <h6 className="mb-0 fw-bold" style={{ fontSize: '.85rem' }}>
                          <i className="bi bi-sliders me-2" style={{ color: '#bc8cff' }}></i>
                          Hybrid Weight Configuration
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="d-flex align-items-center gap-3 mb-3">
                          <label className="form-label mb-0" style={{ width: 160, flexShrink: 0 }}>Official Score Weight</label>
                          <input
                            type="range"
                            className="form-range flex-grow-1"
                            min={0}
                            max={1}
                            step={0.05}
                            value={hybridBaseWeight}
                            onChange={e => setHybridBaseWeight(Number(e.target.value))}
                          />
                          <span className="badge" style={{ background: '#21262d', minWidth: 50 }}>
                            {Math.round(hybridBaseWeight * 100)}%
                          </span>
                        </div>
                        <div className="d-flex gap-3 mb-2">
                          <div className="form-check">
                            <input
                              type="radio"
                              className="form-check-input"
                              id="mode_points"
                              checked={hybridCustomMode === 'points'}
                              onChange={() => setHybridCustomMode('points')}
                            />
                            <label className="form-check-label" htmlFor="mode_points">Flat Points</label>
                          </div>
                          <div className="form-check">
                            <input
                              type="radio"
                              className="form-check-input"
                              id="mode_percentage"
                              checked={hybridCustomMode === 'percentage'}
                              onChange={() => setHybridCustomMode('percentage')}
                            />
                            <label className="form-check-label" htmlFor="mode_percentage">Percentage Split</label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(scoringType === 'custom' || scoringType === 'hybrid') && (
                    <div className="card mb-3">
                      <div className="card-header d-flex justify-content-between align-items-center">
                        <h6 className="mb-0 fw-bold" style={{ fontSize: '.85rem' }}>
                          <i className="bi bi-sliders me-2" style={{ color: '#f0883e' }}></i>
                          {scoringType === 'hybrid' ? 'Bonus Rules' : 'Custom Scoring Rules'}
                        </h6>
                        <div className="d-flex gap-2">
                          {customScoringPresets.map(([key, preset]) => (
                            <button
                              key={key}
                              type="button"
                              className="btn btn-outline-secondary preset-btn"
                              onClick={() => loadPreset(key)}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="card-body">
                        {scoringRules.map((rule, idx) => (
                          <div key={idx} className="row g-2 mb-2 align-items-center">
                            <div className="col-6">
                              <select
                                className="form-select form-select-sm"
                                value={rule.stat}
                                onChange={e => updateRule(idx, { stat: e.target.value })}
                              >
                                {config!.available_stats.map(s => (
                                  <option key={s} value={s}>{titleCase(s)}</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-4">
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                value={rule.points}
                                step={0.5}
                                onChange={e => updateRule(idx, { points: Number(e.target.value) })}
                              />
                            </div>
                            <div className="col-2">
                              <button
                                type="button"
                                className="btn btn-outline-secondary btn-sm"
                                style={{ fontSize: '.7rem', padding: '2px 8px' }}
                                onClick={() => removeRule(idx)}
                              >
                                <i className="bi bi-x-lg"></i>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="card-footer" style={{ borderTopColor: '#30363d' }}>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={addRule}
                          style={{ fontSize: '.8rem' }}
                        >
                          <i className="bi bi-plus-lg me-1"></i>Add Rule
                        </button>
                      </div>
                    </div>
                  )}

                  {scoringType === 'ultimate_footy' && (
                    <div className="card mb-3">
                      <div className="card-header d-flex justify-content-between align-items-center">
                        <h6 className="mb-0 fw-bold" style={{ fontSize: '.85rem' }}>
                          <i className="bi bi-trophy me-2" style={{ color: '#d29922' }}></i>
                          Stat Categories to Compare
                        </h6>
                        <div className="d-flex gap-2">
                          <button type="button" className="btn btn-outline-secondary preset-btn" onClick={() => loadUfPreset('standard')}>
                            UF Standard
                          </button>
                          <button type="button" className="btn btn-outline-secondary preset-btn" onClick={() => loadUfPreset('all')}>
                            All Stats
                          </button>
                        </div>
                      </div>
                      <div className="card-body">
                        <p className="text-secondary mb-3" style={{ fontSize: '.8rem' }}>
                          Each selected stat = 1 point to the team with the higher total.
                        </p>
                        {Object.entries(config.stat_categories)
                          .filter(([catName]) => catName !== 'Fantasy Scores')
                          .map(([catName, stats]) => (
                            <div key={catName}>
                              <div className="stat-category-header">{catName}</div>
                              <div className="uf-cat-grid">
                                {stats.map(stat => (
                                  <label key={stat} className="uf-cat-item">
                                    <input
                                      type="checkbox"
                                      checked={ufCategories.has(stat)}
                                      onChange={e => {
                                        const next = new Set(ufCategories)
                                        if (e.target.checked) next.add(stat)
                                        else next.delete(stat)
                                        setUfCategories(next)
                                      }}
                                    />
                                    <span>{titleCase(stat)}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ═══ Section 3: Draft Configuration ═══ */}
          <div className="wiz-section mb-3">
            <div className="card">
              <SectionHeader id="draft" num={3} label="Draft Configuration" />
              {!collapsed.draft && (
                <div className="card-body">
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label htmlFor="draft_type" className="form-label">Draft Type</label>
                      <select
                        className="form-select"
                        id="draft_type"
                        value={draftType}
                        onChange={e => setDraftType(e.target.value as typeof draftType)}
                      >
                        <option value="snake">Snake</option>
                        <option value="linear">Linear</option>
                      </select>
                      <div className="form-text" style={{ color: '#484f58', fontSize: '.7rem' }}>
                        Snake reverses pick order each round. Linear keeps the same order.
                      </div>
                    </div>
                    <div className="col-6">
                      <label htmlFor="pick_timer_secs" className="form-label">Pick Timer</label>
                      <select
                        className="form-select"
                        id="pick_timer_secs"
                        value={pickTimerSecs}
                        onChange={e => setPickTimerSecs(Number(e.target.value))}
                      >
                        {[30, 60, 90, 120, 180, 300].map(secs => (
                          <option key={secs} value={secs}>
                            {secs}s{secs === 120 ? ' (default)' : ''}
                          </option>
                        ))}
                      </select>
                      <div className="form-text" style={{ color: '#484f58', fontSize: '.7rem' }}>
                        Time each manager gets per pick
                      </div>
                    </div>
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-6">
                      <label htmlFor="draft_scheduled_date" className="form-label">
                        Draft Date <span className="text-secondary" style={{ fontSize: '.75rem' }}>(optional)</span>
                      </label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        id="draft_scheduled_date"
                        value={draftScheduledDate}
                        onChange={e => setDraftScheduledDate(e.target.value)}
                      />
                      <div className="form-text" style={{ color: '#484f58', fontSize: '.7rem' }}>
                        Leave blank to schedule later
                      </div>
                    </div>
                    <div className="col-6 d-flex align-items-end">
                      <div className="form-check mb-3">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="draft_auto_randomize"
                          checked={draftAutoRandomize}
                          onChange={e => setDraftAutoRandomize(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="draft_auto_randomize">
                          Auto-randomize draft order
                        </label>
                        <div className="form-text" style={{ color: '#484f58', fontSize: '.7rem' }}>
                          Randomly assign pick order when session starts
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Section 4: Season Rules ═══ */}
          <div className="wiz-section mb-3">
            <div className="card">
              <SectionHeader id="season" num={4} label="Season Rules" />
              {!collapsed.season && (
                <div className="card-body">
                  <h6 className="fw-bold mb-3" style={{ fontSize: '.85rem', color: '#8b949e' }}>
                    <i className="bi bi-arrow-repeat me-2"></i>Mid-Season Rules
                  </h6>
                  <div className="form-check mb-2">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="mid_season_draft_enabled"
                      checked={midSeasonDraftEnabled}
                      onChange={e => setMidSeasonDraftEnabled(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="mid_season_draft_enabled">
                      Enable Mid-Season Draft
                    </label>
                  </div>
                  {midSeasonDraftEnabled && (
                    <div className="row g-3 mb-3">
                      <div className="col-6">
                        <label htmlFor="mid_season_draft_after_round" className="form-label" style={{ fontSize: '.75rem' }}>
                          After AFL Round
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          id="mid_season_draft_after_round"
                          min={1}
                          max={24}
                          value={midSeasonDraftAfterRound}
                          onChange={e => setMidSeasonDraftAfterRound(Number(e.target.value))}
                        />
                      </div>
                      <div className="col-6">
                        <label htmlFor="mid_season_draft_picks" className="form-label" style={{ fontSize: '.75rem' }}>
                          Picks per Team
                        </label>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          id="mid_season_draft_picks"
                          min={1}
                          max={10}
                          value={midSeasonDraftPicks}
                          onChange={e => setMidSeasonDraftPicks(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  )}

                  <hr style={{ borderColor: '#21262d', margin: '1rem 0' }} />

                  <h6 className="fw-bold mb-3" style={{ fontSize: '.85rem', color: '#8b949e' }}>
                    <i className="bi bi-snow me-2"></i>Off-Season Rules
                  </h6>
                  <div className="row g-3">
                    <div className="col-6">
                      <label htmlFor="offseason_delist_min" className="form-label" style={{ fontSize: '.75rem' }}>
                        Min Delists per Team
                      </label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        id="offseason_delist_min"
                        min={0}
                        max={15}
                        value={offseasonDelistMin}
                        onChange={e => setOffseasonDelistMin(Number(e.target.value))}
                      />
                    </div>
                    <div className="col-6">
                      <div className="form-check mt-4">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="ssp_enabled"
                          checked={sspEnabled}
                          onChange={e => setSspEnabled(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="ssp_enabled">
                          SSP (Injury Replacement)
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ Section 5: Roster & Lineup ═══ */}
          <div className="wiz-section mb-4">
            <div className="card">
              <SectionHeader id="roster" num={5} label="Roster & Lineup" />
              {!collapsed.roster && (
                <div className="card-body">
                  <h6 className="fw-bold mb-3" style={{ fontSize: '.85rem', color: '#8b949e' }}>
                    <i className="bi bi-diagram-3 me-2"></i>On-Field Formation
                  </h6>
                  <div className="row g-2 mb-3">
                    <div className="col">
                      <label className="form-label" style={{ fontSize: '.75rem', color: '#58a6ff' }}>DEF</label>
                      <input type="number" className="form-control form-control-sm" min={2} max={8}
                        value={defCount} onChange={e => setDefCount(Number(e.target.value))} />
                    </div>
                    <div className="col">
                      <label className="form-label" style={{ fontSize: '.75rem', color: '#bc8cff' }}>MID</label>
                      <input type="number" className="form-control form-control-sm" min={3} max={10}
                        value={midCount} onChange={e => setMidCount(Number(e.target.value))} />
                    </div>
                    <div className="col">
                      <label className="form-label" style={{ fontSize: '.75rem', color: '#f0883e' }}>FWD</label>
                      <input type="number" className="form-control form-control-sm" min={2} max={8}
                        value={fwdCount} onChange={e => setFwdCount(Number(e.target.value))} />
                    </div>
                    <div className="col">
                      <label className="form-label" style={{ fontSize: '.75rem', color: '#3fb950' }}>RUC</label>
                      <input type="number" className="form-control form-control-sm" min={1} max={3}
                        value={rucCount} onChange={e => setRucCount(Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="row g-2 mb-2">
                    <div className="col-4">
                      <label className="form-label" style={{ fontSize: '.75rem', color: '#d29922' }}>
                        <i className="bi bi-lightning-charge me-1"></i>FLEX
                      </label>
                      <input type="number" className="form-control form-control-sm" min={0} max={5}
                        value={flexCount} onChange={e => setFlexCount(Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="form-text" style={{ color: '#484f58', fontSize: '.75rem' }}>
                    Flex slots appear in the sidebar and score. Any position eligible.
                  </div>
                </div>
              )}
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-100 mb-4" style={{ padding: '.75rem' }} disabled={submitting}>
            <i className="bi bi-plus-lg me-1"></i>{submitting ? 'Creating...' : 'Create League'}
          </button>
        </form>
      </div>
    </div>
  )
}
