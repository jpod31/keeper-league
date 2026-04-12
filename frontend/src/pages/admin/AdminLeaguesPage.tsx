import { Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface AdminLeague {
  id: number
  name: string
  commissioner: string
  season_year: number
  status: string
  num_teams: number
  max_teams: number
  created_at: string | null
}

export function AdminLeaguesPage() {
  const { data, loading } = useFetch<{ leagues: AdminLeague[] }>('/admin/leagues?format=json')

  if (loading) return <Spinner text="Loading leagues..." />
  if (!data) return <p className="text-danger">Failed to load leagues</p>

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-trophy me-2"></i>Leagues</h2>
        <Link to="/admin" className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left me-1"></i>Back
        </Link>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>#</th><th>Name</th><th>Commissioner</th>
                <th>Year</th><th>Status</th>
                <th className="text-end">Teams</th><th>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.leagues.map(lg => (
                <tr key={lg.id}>
                  <td style={{ color: '#484f58' }}>{lg.id}</td>
                  <td>
                    <Link to={`/leagues/${lg.id}`} className="text-decoration-none">
                      <strong>{lg.name}</strong>
                    </Link>
                  </td>
                  <td>{lg.commissioner}</td>
                  <td>{lg.season_year}</td>
                  <td><span className="badge bg-secondary">{lg.status}</span></td>
                  <td className="text-end">{lg.num_teams}/{lg.max_teams}</td>
                  <td className="text-secondary" style={{ fontSize: '.7rem' }}>
                    {lg.created_at ? new Date(lg.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
