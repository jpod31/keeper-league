import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'
import { useWishlist } from '../../hooks/useWishlist'
import { WishlistStar } from '../../components/ui/WishlistStar'

interface RatingChange {
  player_id: number
  player_name: string
  afl_team: string
  position: string
  old_rating: number
  new_rating: number
  delta: number
  changed_at: string | null
}

interface SeasonMover {
  id: number
  name: string
  afl_team: string
  position: string
  rating: number
  rating_start: number
  delta: number
}

interface RatingsData {
  league: { id: number; name: string }
  last_update_date: string | null
  last_update: RatingChange[]
  season_movers: SeasonMover[]
}

function deltaBadge(delta: number) {
  if (delta > 0) return <span className="badge" style={{ background: 'rgba(63,185,80,.15)', color: '#3fb950' }}>+{delta}</span>
  if (delta < 0) return <span className="badge" style={{ background: 'rgba(248,81,73,.15)', color: '#f85149' }}>{delta}</span>
  return <span className="text-secondary">—</span>
}

export function PlayerRatingsPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<RatingsData>(`/leagues/${leagueId}/player-ratings?format=json`)
  const wishlist = useWishlist(leagueId)

  if (loading) return <Spinner text="Loading ratings..." />
  if (!data) return <p className="text-danger">Failed to load ratings</p>

  return (
    <div>
      <div className="d-none d-lg-block"><PlayersSubnav active="ratings" leagueId={leagueId!} /></div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{data.league.name}</Link> / Players / Ratings
        </div>
        <h2><i className="bi bi-star me-2" style={{ color: '#d29922' }}></i>Player Ratings</h2>
        {data.last_update_date && (
          <div className="text-secondary" style={{ fontSize: '.85rem' }}>
            Last updated: {new Date(data.last_update_date).toLocaleString()}
          </div>
        )}
      </div>

      <div className="row g-4">
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Latest Update</h5>
              <div className="text-secondary" style={{ fontSize: '.75rem' }}>{data.last_update.length} changes</div>
            </div>
            <div className="card-body p-0" style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table className="table table-sm mb-0">
                <thead><tr><th style={{ width: 30 }} aria-label="Watchlist"></th><th>Player</th><th>Pos</th><th className="text-end">Old</th><th className="text-end">New</th><th className="text-end">Δ</th></tr></thead>
                <tbody>
                  {data.last_update.map(r => (
                    <tr key={`${r.player_id}-${r.changed_at}`}>
                      <td className="text-center" style={{ padding: 0, verticalAlign: 'middle' }}>
                        <WishlistStar wishlist={wishlist} playerId={r.player_id} playerName={r.player_name} />
                      </td>
                      <td><strong>{r.player_name}</strong><div className="text-secondary" style={{ fontSize: '.7rem' }}>{r.afl_team}</div></td>
                      <td><span className={`pos-badge pos-${r.position}`}>{r.position}</span></td>
                      <td className="text-end">{r.old_rating}</td>
                      <td className="text-end"><strong>{r.new_rating}</strong></td>
                      <td className="text-end">{deltaBadge(r.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.last_update.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon"><i className="bi bi-stars"></i></div>
                  <h4>No recent changes</h4>
                  <p>Player ratings update periodically — check back after the next refresh.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>Season Movers</h5>
              <div className="text-secondary" style={{ fontSize: '.75rem' }}>{data.season_movers.length} players</div>
            </div>
            <div className="card-body p-0" style={{ maxHeight: 600, overflowY: 'auto' }}>
              <table className="table table-sm mb-0">
                <thead><tr><th style={{ width: 30 }} aria-label="Watchlist"></th><th>Player</th><th>Pos</th><th className="text-end">Start</th><th className="text-end">Now</th><th className="text-end">Δ</th></tr></thead>
                <tbody>
                  {data.season_movers.slice(0, 50).map(p => (
                    <tr key={p.id}>
                      <td className="text-center" style={{ padding: 0, verticalAlign: 'middle' }}>
                        <WishlistStar wishlist={wishlist} playerId={p.id} playerName={p.name} />
                      </td>
                      <td><strong>{p.name}</strong><div className="text-secondary" style={{ fontSize: '.7rem' }}>{p.afl_team}</div></td>
                      <td><span className={`pos-badge pos-${p.position}`}>{p.position}</span></td>
                      <td className="text-end">{p.rating_start}</td>
                      <td className="text-end"><strong>{p.rating}</strong></td>
                      <td className="text-end">{deltaBadge(p.delta)}</td>
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
