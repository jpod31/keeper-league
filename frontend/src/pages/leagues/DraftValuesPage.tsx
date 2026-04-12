import { useParams } from 'react-router'
import { useState, useEffect } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface TopPlayer {
  id: number
  name: string
  afl_team: string
  position: string
  sc_avg: number | null
  age: number | null
  draft_score: number
}

interface DraftValuesData {
  league: { id: number; name: string }
  weights: Record<string, number>
  has_custom: boolean
  top_players: TopPlayer[]
}

const WEIGHT_LABELS: Record<string, string> = {
  sc_average: 'SC Average',
  age_factor: 'Age Factor',
  positional_scarcity: 'Positional Scarcity',
  trajectory: 'Trajectory',
  durability: 'Durability',
  rating_potential: 'Rating / Potential',
}

export function DraftValuesPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<DraftValuesData>(`/leagues/${leagueId}/draft-values?format=json`)
  const [weights, setWeights] = useState<Record<string, number>>({})
  const [preview, setPreview] = useState<TopPlayer[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (data) setWeights(data.weights)
  }, [data])

  useEffect(() => {
    if (!dirty) return
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(weights)) params.set(k, String(v))
    api<Array<{ name: string; afl_team: string; position: string; sc_avg: number; draft_score: number }>>(
      `/leagues/${leagueId}/draft-values/preview?${params}`
    ).then(list => {
      setPreview(list.map((p, i) => ({
        id: i,
        name: p.name,
        afl_team: p.afl_team,
        position: p.position,
        sc_avg: p.sc_avg,
        age: null,
        draft_score: p.draft_score,
      })))
    }).catch(() => setPreview(null))
  }, [weights, dirty, leagueId])

  if (loading) return <Spinner text="Loading draft values..." />
  if (!data) return <p className="text-danger">Failed to load draft values</p>

  function updateWeight(key: string, value: number) {
    setWeights(w => ({ ...w, [key]: value }))
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const fd = new FormData()
      for (const [k, v] of Object.entries(weights)) fd.set(k, String(v))
      await fetch(`/leagues/${leagueId}/draft-values`, { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' })
      alert('Draft values saved.')
      setDirty(false)
    } finally { setSaving(false) }
  }

  async function reset() {
    if (!confirm('Reset to league defaults?')) return
    const fd = new FormData()
    fd.set('action', 'reset')
    await fetch(`/leagues/${leagueId}/draft-values`, { method: 'POST', body: fd, credentials: 'same-origin', redirect: 'manual' })
    window.location.href = window.location.href
  }

  const displayPlayers = preview ?? data.top_players

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-sliders me-2" style={{ color: '#58a6ff' }}></i>Draft Values</h2>
        <div className="text-secondary" style={{ fontSize: '.85rem' }}>
          Tune the weights used to compute draft scores. {data.has_custom ? 'Using custom weights.' : 'Using league defaults.'}
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-5">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Weight Sliders</h5>
            </div>
            <div className="card-body">
              {Object.entries(weights).map(([key, value]) => (
                <div key={key} className="mb-3">
                  <div className="d-flex justify-content-between" style={{ fontSize: '.8rem' }}>
                    <label>{WEIGHT_LABELS[key] || key}</label>
                    <strong>{(value * 100).toFixed(0)}%</strong>
                  </div>
                  <input
                    type="range"
                    className="form-range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={value}
                    onChange={e => updateWeight(key, Number(e.target.value))}
                  />
                </div>
              ))}
              <div className="d-flex gap-2 mt-3">
                <button className="btn btn-primary flex-grow-1" disabled={!dirty || saving} onClick={save}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {data.has_custom && (
                  <button className="btn btn-outline-secondary" onClick={reset}>Reset</button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.9rem' }}>Top 20 Preview</h5>
            </div>
            <div className="card-body p-0">
              <table className="table table-sm mb-0">
                <thead><tr><th>#</th><th>Player</th><th>Team</th><th>Pos</th><th className="text-end">SC Avg</th><th className="text-end">Draft Score</th></tr></thead>
                <tbody>
                  {displayPlayers.map((p, i) => (
                    <tr key={`${p.name}-${p.afl_team}`}>
                      <td style={{ color: '#484f58' }}>{i + 1}</td>
                      <td><strong>{p.name}</strong></td>
                      <td className="text-secondary" style={{ fontSize: '.75rem' }}>{p.afl_team}</td>
                      <td><span className={`pos-badge pos-${p.position}`}>{p.position}</span></td>
                      <td className="text-end">{p.sc_avg?.toFixed(0) ?? '—'}</td>
                      <td className="text-end"><strong>{p.draft_score.toFixed(0)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
