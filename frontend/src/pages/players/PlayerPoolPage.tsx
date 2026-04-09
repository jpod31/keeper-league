import { useParams } from 'react-router'
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface PoolPlayer {
  id: number
  name: string
  position: string
  afl_team: string
  age: number
  sc_avg: number
  games: number
  owner: string | null
  tag: string
}

interface PoolData {
  players: PoolPlayer[]
  total: number
  page: number
  per_page: number
}

export function PlayerPoolPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortCol, setSortCol] = useState('sc_avg')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)

  const fetchPlayers = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), search, position: posFilter, status: statusFilter, sort: sortCol, dir: sortDir })
    api<PoolData>(`/api/leagues/${leagueId}/player-pool?${params}`)
      .then(setData)
      .finally(() => setLoading(false))
  }, [leagueId, page, search, posFilter, statusFilter, sortCol, sortDir])

  useEffect(() => { fetchPlayers() }, [fetchPlayers])

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
    setPage(1)
  }

  return (
    <div>
      <h4 className="fw-bold mb-3" style={{ color: 'var(--kl-text-heading)' }}>Player Pool</h4>

      {/* Filter bar */}
      <div className="filter-bar d-flex flex-wrap gap-2 mb-3">
        <input className="form-control form-control-sm" placeholder="Search players..."
          value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ maxWidth: 250, background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-primary)' }} />
        <select className="form-select form-select-sm" value={posFilter} onChange={e => { setPosFilter(e.target.value); setPage(1) }}
          style={{ width: 'auto', background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-secondary)' }}>
          <option value="">All Positions</option>
          <option value="DEF">DEF</option><option value="MID">MID</option>
          <option value="RUC">RUC</option><option value="FWD">FWD</option>
        </select>
        <select className="form-select form-select-sm" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          style={{ width: 'auto', background: 'var(--kl-bg-body)', borderColor: 'var(--kl-border)', color: 'var(--kl-text-secondary)' }}>
          <option value="all">All Players</option><option value="available">Available</option><option value="rostered">Rostered</option>
        </select>
        {data && <span className="pool-count align-self-center" style={{ fontSize: '.75rem', color: 'var(--kl-text-faint)' }}>{data.total} players</span>}
      </div>

      {loading && !data ? <Spinner /> : data && (
        <>
          {/* Desktop table */}
          <div className="card d-none d-lg-block">
            <div className="card-body p-0">
              <table className="table table-hover mb-0 pool-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>
                      Player {sortCol === 'name' && <i className={`bi bi-caret-${sortDir === 'desc' ? 'down' : 'up'}-fill sort-icon`}></i>}
                    </th>
                    <th>Pos</th>
                    <th>Team</th>
                    <th className="text-end" style={{ cursor: 'pointer' }} onClick={() => toggleSort('sc_avg')}>
                      SC Avg {sortCol === 'sc_avg' && <i className={`bi bi-caret-${sortDir === 'desc' ? 'down' : 'up'}-fill sort-icon`}></i>}
                    </th>
                    <th className="text-center" style={{ cursor: 'pointer' }} onClick={() => toggleSort('age')}>
                      Age {sortCol === 'age' && <i className={`bi bi-caret-${sortDir === 'desc' ? 'down' : 'up'}-fill sort-icon`}></i>}
                    </th>
                    <th className="text-center" style={{ cursor: 'pointer' }} onClick={() => toggleSort('games')}>
                      Games {sortCol === 'games' && <i className={`bi bi-caret-${sortDir === 'desc' ? 'down' : 'up'}-fill sort-icon`}></i>}
                    </th>
                    <th>Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map(p => (
                    <tr key={p.id}>
                      <td><span className="fw-bold" style={{ color: '#c9d1d9' }}>{p.name}</span></td>
                      <td><span className={`pos-badge pos-${p.position?.split('/')[0]}`} style={{ fontSize: '.65rem', padding: '1px 5px' }}>{p.position}</span></td>
                      <td style={{ color: '#8b949e', fontSize: '.78rem' }}>{p.afl_team}</td>
                      <td className="text-end fw-bold">{p.sc_avg?.toFixed(0) || '—'}</td>
                      <td className="text-center" style={{ color: '#8b949e' }}>{p.age}</td>
                      <td className="text-center" style={{ color: '#8b949e' }}>{p.games}</td>
                      <td>
                        {p.owner ? (
                          <span style={{ fontSize: '.75rem', color: '#8b949e' }}>{p.owner}</span>
                        ) : (
                          <span style={{ fontSize: '.75rem', color: '#3fb950' }}>Available</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="d-lg-none">
            {data.players.map(p => (
              <div key={p.id} className="d-flex align-items-center px-3 py-2" style={{ borderBottom: '1px solid var(--kl-border)' }}>
                <div style={{ flex: 1 }}>
                  <div className="fw-bold" style={{ fontSize: '.85rem', color: '#c9d1d9' }}>{p.name}</div>
                  <div style={{ fontSize: '.72rem', color: '#8b949e' }}>
                    <span className={`pos-badge pos-${p.position?.split('/')[0]}`} style={{ fontSize: '.55rem', padding: '0 4px', marginRight: 4 }}>{p.position}</span>
                    {p.afl_team} &middot; Age {p.age}
                    {p.owner && <span> &middot; {p.owner}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="fw-bold" style={{ color: '#e6edf3' }}>{p.sc_avg?.toFixed(0) || '—'}</div>
                  {!p.owner && <div style={{ fontSize: '.65rem', color: '#3fb950' }}>FA</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="d-flex align-items-center justify-content-between mt-3">
            <span style={{ fontSize: '.75rem', color: 'var(--kl-text-faint)' }}>Page {page}</span>
            <div className="d-flex gap-1">
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setPage(p => p + 1)} disabled={data.players.length < data.per_page}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
