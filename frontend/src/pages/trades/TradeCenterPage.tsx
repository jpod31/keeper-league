import { useParams, Link, useSearchParams } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Team { id: number; name: string }

interface TradeSummary {
  id: number
  status: string
  proposer_team: Team | null
  recipient_team: Team | null
  asset_count: number
  proposed_at: string | null
}

interface TradeCenterData {
  league: { id: number; name: string; trade_window_open: boolean }
  user_team: Team | null
  is_commissioner: boolean
  tab: string
  incoming: TradeSummary[]
  outgoing: TradeSummary[]
  history: TradeSummary[]
}

function TradeRow({ trade, leagueId }: { trade: TradeSummary; leagueId: string }) {
  return (
    <Link to={`/leagues/${leagueId}/trades/${trade.id}`} className="trade-card">
      <div className="d-flex justify-content-between align-items-center">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <strong style={{ fontSize: '.9rem' }}>{trade.proposer_team?.name}</strong>
            <i className="bi bi-arrow-left-right" style={{ color: '#484f58', fontSize: '.75rem' }}></i>
            <strong style={{ fontSize: '.9rem' }}>{trade.recipient_team?.name}</strong>
          </div>
          <div style={{ fontSize: '.75rem', color: '#8b949e' }}>
            {trade.asset_count} player(s) · {trade.proposed_at}
          </div>
        </div>
        <span className={`status-pill status-${trade.status}`}>{trade.status}</span>
      </div>
    </Link>
  )
}

export function TradeCenterPage() {
  const { leagueId } = useParams()
  const [searchParams] = useSearchParams()
  const tab = (searchParams.get('tab') || 'incoming') as 'incoming' | 'outgoing' | 'history'
  const { data, loading } = useFetch<TradeCenterData>(`/leagues/${leagueId}/trades?format=json&tab=${tab}`)

  if (loading) return <Spinner text="Loading trades..." />
  if (!data) return <p className="text-danger">Failed to load trades</p>

  const { league, user_team, incoming, outgoing, history } = data
  const currentTrades = tab === 'incoming' ? incoming : tab === 'outgoing' ? outgoing : history
  const pendingCount = incoming.filter(t => t.status === 'pending').length

  return (
    <div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link>
          {user_team && <>{' / '}<Link to={`/leagues/${leagueId}/team/${user_team.id}`}>My Team</Link></>}
          {' / '}Trades
        </div>
        <div className="d-flex justify-content-between align-items-start">
          <div className="d-flex align-items-center gap-3">
            <Link to={user_team ? `/leagues/${leagueId}/team/${user_team.id}` : `/leagues/${leagueId}`}
              className="btn btn-sm btn-outline-secondary" style={{ padding: '4px 10px' }}>
              <i className="bi bi-arrow-left"></i>
            </Link>
            <h2 className="mb-0">Trade Center</h2>
          </div>
          {user_team && (
            <Link to={`/leagues/${leagueId}/trades/propose`} className="btn btn-primary">
              <i className="bi bi-arrow-left-right me-1"></i>Propose Trade
            </Link>
          )}
        </div>
      </div>

      {!league.trade_window_open && (
        <div className="alert alert-warning d-flex align-items-center gap-2" style={{ borderColor: 'rgba(210,153,34,.3)' }}>
          <i className="bi bi-exclamation-triangle"></i> Trade window is currently closed.
        </div>
      )}

      <div className="league-subnav">
        <Link to={`/leagues/${leagueId}/trades?tab=incoming`} className={`league-subtab${tab === 'incoming' ? ' active' : ''}`}>
          <i className="bi bi-inbox"></i>Incoming
          {pendingCount > 0 && (
            <span className="badge" style={{ background: '#f85149', fontSize: '.55rem', marginLeft: 4, borderRadius: 8 }}>{pendingCount}</span>
          )}
        </Link>
        <Link to={`/leagues/${leagueId}/trades?tab=outgoing`} className={`league-subtab${tab === 'outgoing' ? ' active' : ''}`}>
          <i className="bi bi-send"></i>Outgoing
        </Link>
        <Link to={`/leagues/${leagueId}/trades?tab=history`} className={`league-subtab${tab === 'history' ? ' active' : ''}`}>
          <i className="bi bi-clock-history"></i>History
        </Link>
      </div>

      {currentTrades.length > 0 ? (
        currentTrades.map(t => <TradeRow key={t.id} trade={t} leagueId={leagueId!} />)
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <i className="bi bi-arrow-left-right" style={{ fontSize: '1.5rem' }}></i>
          </div>
          <h4>No {tab} trades</h4>
          <p>
            {tab === 'incoming' ? 'No one has proposed a trade to you yet.'
              : tab === 'outgoing' ? "You haven't proposed any trades."
              : 'No completed trades to show.'}
          </p>
        </div>
      )}
    </div>
  )
}
