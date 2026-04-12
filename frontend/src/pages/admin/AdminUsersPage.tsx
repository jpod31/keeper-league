import { Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface AdminUser {
  id: number
  username: string
  email: string
  display_name: string
  created_at: string | null
  is_admin: boolean
  team_count: number
  leagues: { id: number; name: string }[]
}

export function AdminUsersPage() {
  const { data, loading } = useFetch<{ users: AdminUser[] }>('/admin/users?format=json')

  if (loading) return <Spinner text="Loading users..." />
  if (!data) return <p className="text-danger">Failed to load users</p>

  return (
    <div>
      <div className="page-header">
        <h2><i className="bi bi-people me-2"></i>Users</h2>
        <Link to="/admin" className="btn btn-sm btn-outline-secondary">
          <i className="bi bi-arrow-left me-1"></i>Back
        </Link>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <table className="table table-sm mb-0">
            <thead>
              <tr>
                <th>#</th><th>Username</th><th>Display Name</th><th>Email</th>
                <th className="text-end">Teams</th><th>Leagues</th>
                <th>Joined</th><th>Admin</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map(u => (
                <tr key={u.id}>
                  <td style={{ color: '#484f58' }}>{u.id}</td>
                  <td><strong>{u.username}</strong></td>
                  <td>{u.display_name}</td>
                  <td className="text-secondary" style={{ fontSize: '.75rem' }}>{u.email}</td>
                  <td className="text-end">{u.team_count}</td>
                  <td className="text-secondary" style={{ fontSize: '.75rem' }}>
                    {u.leagues.map(lg => lg.name).join(', ') || '—'}
                  </td>
                  <td className="text-secondary" style={{ fontSize: '.7rem' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    {u.is_admin && <span className="badge bg-warning text-dark">admin</span>}
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
