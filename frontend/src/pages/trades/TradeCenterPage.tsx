import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Trade {
  id: number
  proposer: string
  recipient: string
  status: string
  created: string
  players_out: string[]
  players_in: string[]
}

interface TradesData {
  incoming: Trade[]
  outgoing: Trade[]
  completed: Trade[]
}

export function TradeCenterPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<TradesData>(`/api/leagues/${leagueId}/trades`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-danger">Failed to load trades</p>

  const hasTrades = data.incoming.length > 0 || data.outgoing.length > 0 || data.completed.length > 0

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <h4 className="fw-bold" style={{ color: 'var(--kl-text-heading)' }}>Trade Center</h4>
        <Link to={`/leagues/${leagueId}/trades/propose`} className="btn btn-primary btn-sm">
          <i className="bi bi-plus-lg me-1"></i>Propose Trade
        </Link>
      </div>

      {!hasTrades && (
        <div className="empty-state" style={{ padding: '4rem 2rem' }}>
          <div className="empty-icon" style={{ width: 64, height: 64 }}>
            <i className="bi bi-arrow-left-right" style={{ fontSize: '1.5rem' }}></i>
          </div>
          <h4>No trades yet</h4>
          <p>Propose a trade to get started.</p>
        </div>
      )}

      {data.incoming.length > 0 && <TradeSection title="Incoming Proposals" icon="bi-inbox" trades={data.incoming} leagueId={leagueId!} />}
      {data.outgoing.length > 0 && <TradeSection title="Outgoing Proposals" icon="bi-send" trades={data.outgoing} leagueId={leagueId!} />}
      {data.completed.length > 0 && <TradeSection title="Trade History" icon="bi-clock-history" trades={data.completed} leagueId={leagueId!} />}
    </div>
  )
}

function TradeSection({ title, icon, trades, leagueId }: { title: string; icon: string; trades: Trade[]; leagueId: string }) {
  return (
    <div className="card mb-3">
      <div className="card-header d-flex align-items-center gap-2">
        <i className={`bi ${icon}`} style={{ color: 'var(--kl-accent-blue)' }}></i>
        <span className="fw-bold" style={{ fontSize: '.85rem' }}>{title}</span>
        <span className="badge" style={{ background: 'var(--kl-bg-elevated)', color: 'var(--kl-text-secondary)', fontSize: '.65rem' }}>{trades.length}</span>
      </div>
      <div className="card-body p-0">
        {trades.map(t => (
          <Link key={t.id} to={`/leagues/${leagueId}/trades/${t.id}`}
            className="d-flex align-items-center justify-content-between px-3 py-2 text-decoration-none"
            style={{ borderBottom: '1px solid var(--kl-border)' }}>
            <div>
              <div style={{ fontSize: '.85rem' }}>
                <span className="fw-bold" style={{ color: 'var(--kl-text-heading)' }}>{t.proposer}</span>
                <span style={{ color: 'var(--kl-text-faint)' }}> → </span>
                <span className="fw-bold" style={{ color: 'var(--kl-text-heading)' }}>{t.recipient}</span>
                <span className={`status-pill status-${t.status} ms-2`} style={{ fontSize: '.6rem' }}>{t.status}</span>
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--kl-text-secondary)' }}>
                {t.players_out.join(', ')} ↔ {t.players_in.join(', ')}
              </div>
            </div>
            <span style={{ fontSize: '.7rem', color: 'var(--kl-text-faint)' }}>{t.created}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
