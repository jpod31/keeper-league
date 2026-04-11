import { useParams, useSearchParams } from 'react-router'
import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface ComparePlayer {
  id: number
  name: string
  position: string
  afl_team: string
  age: number | null
  sc_avg: number | null
  games_played: number | null
  rating: number | null
  l3: number | null
  l5: number | null
  // Additional fields from analytics
  draft_score?: number
  potential?: number
  injury_severity?: string | null
}

interface AllPlayer { id: number; name: string; position: string; afl_team: string; sc_avg: number }

interface CompareData {
  league: { id: number; name: string }
  selected_ids: number[]
  players: ComparePlayer[]
  all_players: AllPlayer[]
}

export function PlayerComparePage() {
  const { leagueId } = useParams()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    const q = params.getAll('p').map(p => `p=${p}`).join('&')
    api<CompareData>(`/leagues/${leagueId}/players/compare?format=json${q ? `&${q}` : ''}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [leagueId, params])

  if (loading) return <Spinner text="Loading comparison..." />
  if (!data) return <p className="text-danger">Failed to load comparison</p>

  function addPlayer(id: number) {
    const ids = data!.selected_ids.slice()
    if (ids.length >= 4 || ids.includes(id)) return
    ids.push(id)
    const next = new URLSearchParams()
    ids.forEach(p => next.append('p', String(p)))
    setParams(next)
    setSearch('')
  }

  function removePlayer(id: number) {
    const ids = data!.selected_ids.filter(x => x !== id)
    const next = new URLSearchParams()
    ids.forEach(p => next.append('p', String(p)))
    setParams(next)
  }

  const searchResults = search.trim().length > 1
    ? data.all_players.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 10)
    : []

  const fields: { key: keyof ComparePlayer; label: string; format?: (v: unknown) => string }[] = [
    { key: 'position', label: 'Position' },
    { key: 'afl_team', label: 'AFL Team' },
    { key: 'age', label: 'Age' },
    { key: 'games_played', label: 'Games' },
    { key: 'sc_avg', label: 'SC Avg', format: v => typeof v === 'number' ? v.toFixed(1) : '—' },
    { key: 'l3', label: 'L3', format: v => typeof v === 'number' ? v.toFixed(0) : '—' },
    { key: 'l5', label: 'L5', format: v => typeof v === 'number' ? v.toFixed(0) : '—' },
    { key: 'rating', label: 'Rating' },
  ]

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-people-fill me-2" style={{ color: '#58a6ff' }}></i>Player Compare</h2>
        <div className="text-secondary" style={{ fontSize: '.85rem' }}>Side-by-side comparison of up to 4 players</div>
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="position-relative">
            <input
              type="text"
              className="form-control"
              placeholder="Search for a player to add..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              disabled={data.selected_ids.length >= 4}
            />
            {searchResults.length > 0 && (
              <div className="list-group position-absolute mt-1" style={{ zIndex: 5, width: '100%' }}>
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="list-group-item list-group-item-action"
                    onClick={() => addPlayer(p.id)}
                  >
                    <strong>{p.name}</strong> <span className="text-secondary">· {p.position} · {p.afl_team} · {p.sc_avg?.toFixed(0)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {data.players.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5 text-secondary">
            <i className="bi bi-people" style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }}></i>
            Search for players above to compare them side-by-side.
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body p-0">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Stat</th>
                  {data.players.map(p => (
                    <th key={p.id}>
                      <div className="d-flex justify-content-between align-items-start">
                        <div>
                          <strong>{p.name}</strong>
                          <div className="text-secondary" style={{ fontSize: '.7rem' }}>{p.afl_team}</div>
                        </div>
                        <button className="btn btn-sm btn-link text-danger p-0" onClick={() => removePlayer(p.id)} style={{ fontSize: '.8rem' }}>
                          <i className="bi bi-x"></i>
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fields.map(f => (
                  <tr key={f.key}>
                    <td className="text-secondary" style={{ fontSize: '.75rem' }}>{f.label}</td>
                    {data.players.map(p => {
                      const val = p[f.key]
                      return (
                        <td key={p.id} style={{ fontFamily: 'monospace' }}>
                          {f.format ? f.format(val) : (val ?? '—')}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
