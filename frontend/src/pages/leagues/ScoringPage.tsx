import { useParams, Link } from 'react-router'
import { useState, useEffect } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { AdminSubnav } from '../../components/nav/AdminSubnav'

interface ScoringData {
  league: {
    id: number; name: string; scoring_type: string
    hybrid_base: string | null
    hybrid_base_weight: number | null
    hybrid_custom_mode: string | null
    is_commissioner: boolean
  }
  scoring_rules: Record<string, number>
  available_stats: string[]
  default_scoring: Record<string, number>
  stat_categories: Record<string, string>
  scoring_presets: Record<string, Record<string, number>>
  scoring_type_labels: Record<string, string>
  default_uf_categories: string[]
}

type Rule = { stat: string; points: number }

export function ScoringPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<ScoringData>(`/leagues/${leagueId}/scoring?format=json`)
  const [scoringType, setScoringType] = useState<string>('custom')
  const [rules, setRules] = useState<Rule[]>([])
  const [ufCats, setUfCats] = useState<string[]>([])
  const [hybridBase, setHybridBase] = useState('supercoach')
  const [hybridWeight, setHybridWeight] = useState(0.7)
  const [hybridMode, setHybridMode] = useState('points')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!data) return
    setScoringType(data.league.scoring_type || 'custom')
    setRules(Object.entries(data.scoring_rules).map(([stat, points]) => ({ stat, points })))
    setUfCats(data.league.scoring_type === 'ultimate_footy' ? Object.keys(data.scoring_rules) : data.default_uf_categories)
    setHybridBase(data.league.hybrid_base || 'supercoach')
    setHybridWeight(data.league.hybrid_base_weight ?? 0.7)
    setHybridMode(data.league.hybrid_custom_mode || 'points')
  }, [data])

  if (loading) return <Spinner text="Loading scoring..." />
  if (!data) return <p className="text-danger">Failed to load scoring</p>
  if (!data.league.is_commissioner) {
    return <div className="alert alert-warning">Only the commissioner can edit scoring rules.</div>
  }

  function loadPreset(name: string) {
    const preset = data!.scoring_presets[name]
    if (!preset) return
    setRules(Object.entries(preset).map(([stat, points]) => ({ stat, points })))
  }

  function addRule() { setRules(r => [...r, { stat: data!.available_stats[0] || 'kicks', points: 1 }]) }
  function removeRule(i: number) { setRules(r => r.filter((_, idx) => idx !== i)) }
  function updateRule(i: number, patch: Partial<Rule>) {
    setRules(r => r.map((x, idx) => idx === i ? { ...x, ...patch } : x))
  }

  function toggleUfCat(cat: string) {
    setUfCats(c => c.includes(cat) ? c.filter(x => x !== cat) : [...c, cat])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('scoring_type', scoringType)
      if (scoringType === 'hybrid') {
        fd.set('hybrid_base', hybridBase)
        fd.set('hybrid_base_weight', String(hybridWeight))
        fd.set('hybrid_custom_mode', hybridMode)
      }
      if (scoringType === 'ultimate_footy') {
        ufCats.forEach(c => fd.append('uf_category', c))
      } else if (scoringType === 'custom' || scoringType === 'hybrid') {
        rules.forEach(r => {
          fd.append('stat_column', r.stat)
          fd.append('points_per', String(r.points))
        })
      }
      const res = await fetch(`/leagues/${leagueId}/scoring`, {
        method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual',
      })
      if (res.status < 500) alert('Scoring updated.')
    } finally {
      setSaving(false)
    }
  }

  const labels = data.scoring_type_labels

  return (
    <div>
      <div className="d-none d-lg-block"><AdminSubnav active="scoring" leagueId={leagueId!} /></div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{data.league.name}</Link> / Admin / Scoring
        </div>
        <h2><i className="bi bi-calculator me-2" style={{ color: '#58a6ff' }}></i>Scoring Configuration</h2>
        <div className="text-secondary" style={{ fontSize: '.85rem' }}>Configure how player stats convert to fantasy points.</div>
      </div>

      <form onSubmit={save}>
        <div className="card mb-4">
          <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Scoring Type</h5></div>
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2">
              {Object.entries(labels).map(([key, label]) => (
                <label key={key} className={`btn btn-sm ${scoringType === key ? 'btn-primary' : 'btn-outline-secondary'}`}>
                  <input type="radio" name="scoring_type" value={key} checked={scoringType === key} onChange={() => setScoringType(key)} hidden />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {scoringType === 'hybrid' && (
          <div className="card mb-4">
            <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Hybrid Configuration</h5></div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '.8rem' }}>Base system</label>
                <select className="form-select form-select-sm" value={hybridBase} onChange={e => setHybridBase(e.target.value)}>
                  <option value="supercoach">SuperCoach</option>
                  <option value="afl_fantasy">AFL Fantasy</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '.8rem' }}>Base weight: {Math.round(hybridWeight * 100)}%</label>
                <input type="range" className="form-range" min={0} max={1} step={0.05} value={hybridWeight} onChange={e => setHybridWeight(Number(e.target.value))} />
              </div>
              <div className="mb-3">
                <label className="form-label" style={{ fontSize: '.8rem' }}>Custom mode</label>
                <select className="form-select form-select-sm" value={hybridMode} onChange={e => setHybridMode(e.target.value)}>
                  <option value="points">Points</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {scoringType === 'ultimate_footy' && (
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Ultimate Footy Categories</h5>
              <span className="text-secondary" style={{ fontSize: '.75rem' }}>{ufCats.length} selected</span>
            </div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2">
                {data.available_stats.map(stat => (
                  <label key={stat} className={`btn btn-sm ${ufCats.includes(stat) ? 'btn-primary' : 'btn-outline-secondary'}`}>
                    <input type="checkbox" checked={ufCats.includes(stat)} onChange={() => toggleUfCat(stat)} hidden />
                    {stat.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {(scoringType === 'custom' || scoringType === 'hybrid') && (
          <div className="card mb-4">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Stat Rules</h5>
              <div className="d-flex gap-2">
                <select className="form-select form-select-sm" onChange={e => { if (e.target.value) loadPreset(e.target.value); e.target.value = '' }} defaultValue="">
                  <option value="" disabled>Load preset…</option>
                  {Object.keys(data.scoring_presets).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addRule}>+ Add</button>
              </div>
            </div>
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <thead><tr><th>Stat</th><th style={{ width: 120 }}>Points</th><th style={{ width: 60 }}></th></tr></thead>
                <tbody>
                  {rules.map((r, i) => (
                    <tr key={i}>
                      <td>
                        <select className="form-select form-select-sm" value={r.stat} onChange={e => updateRule(i, { stat: e.target.value })}>
                          {data.available_stats.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="number" step="0.1" className="form-control form-control-sm" value={r.points} onChange={e => updateRule(i, { points: Number(e.target.value) })} />
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeRule(i)}><i className="bi bi-x"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Scoring'}
        </button>
      </form>
    </div>
  )
}
