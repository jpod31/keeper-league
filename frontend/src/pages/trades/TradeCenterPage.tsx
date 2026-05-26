import { useParams, Link, useSearchParams } from 'react-router'
import { useEffect, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Team { id: number; name: string; logo_url?: string | null }

interface TradeAsset {
  kind: 'player' | 'pick' | 'unknown'
  name: string
  position?: string
  afl_team?: string
  sc_avg?: number
  year?: number
  round_number?: number
  from_team_id: number
}

interface TradeSummary {
  id: number
  status: string
  proposer_team: Team | null
  recipient_team: Team | null
  asset_count: number
  from_proposer: TradeAsset[]
  from_recipient: TradeAsset[]
  proposed_at: string | null
  proposed_at_iso: string | null
  intended_period?: string | null
}

interface TradeCenterData {
  league: {
    id: number
    name: string
    trade_window_open: boolean
    trade_close_at: string | null
  }
  user_team: Team | null
  is_commissioner: boolean
  tab: string
  team_logos: Record<string, string>
  incoming: TradeSummary[]
  outgoing: TradeSummary[]
  history: TradeSummary[]
}

function teamInitials(name: string): string {
  if (!name) return '·'
  const words = name.split(/\s+/).filter(Boolean).slice(0, 2)
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function fmtCountdown(closeAt: string | null): string | null {
  if (!closeAt) return null
  const close = new Date(closeAt)
  const now = new Date()
  const ms = close.getTime() - now.getTime()
  if (ms <= 0) return 'closed'
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function posPrimary(pos?: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}

function TeamChip({ team, teamLogos: _ }: { team: Team | null; teamLogos: Record<string, string> }) {
  if (!team) return <span className="text-secondary">?</span>
  return (
    <span className="tr-team-chip">
      <span className="tr-team-chip-logo">
        {team.logo_url ? <img src={team.logo_url} alt="" /> : teamInitials(team.name)}
      </span>
      <span>{team.name}</span>
    </span>
  )
}

function AssetChip({ asset }: { asset: TradeAsset }) {
  if (asset.kind === 'pick') {
    return (
      <span className="tr-asset-chip tr-asset-chip-pick">
        <i className="bi bi-ticket-perforated" style={{ fontSize: '.7rem', color: '#79c0ff' }}></i>
        {asset.name}
      </span>
    )
  }
  const pos = posPrimary(asset.position)
  return (
    <span className="tr-asset-chip">
      <span className={`tr-asset-chip-pos tr-asset-chip-pos-${pos}`}>{pos}</span>
      {asset.name}
      {asset.sc_avg != null && asset.sc_avg > 0 && (
        <span className="tr-asset-chip-sc">{Math.round(asset.sc_avg)}</span>
      )}
    </span>
  )
}

function TradeCard({ trade, leagueId, teamLogos }: {
  trade: TradeSummary; leagueId: string; teamLogos: Record<string, string>
}) {
  const status = trade.status || 'pending'
  return (
    <Link to={`/leagues/${leagueId}/trades/${trade.id}`} className="tr-center-card">
      <div className="tr-center-card-top">
        <div className="tr-center-card-teams">
          <TeamChip team={trade.proposer_team} teamLogos={teamLogos} />
          <i className="bi bi-arrow-left-right" style={{ color: '#484f58', fontSize: '.85rem' }}></i>
          <TeamChip team={trade.recipient_team} teamLogos={teamLogos} />
        </div>
        <span className={`tr-center-card-status tr-status-${status}`}>{status}</span>
      </div>
      <div className="tr-center-card-grid">
        <div className="tr-center-card-side">
          <div className="tr-side-label">{trade.proposer_team?.name || 'Proposer'} sends</div>
          {trade.from_proposer.length === 0 ? (
            <span className="text-secondary" style={{ fontSize: '.78rem', fontStyle: 'italic' }}>nothing</span>
          ) : (
            <div className="tr-asset-list">
              {trade.from_proposer.map((a, i) => <AssetChip key={i} asset={a} />)}
            </div>
          )}
        </div>
        <div className="tr-center-card-arrow"><i className="bi bi-arrow-left-right"></i></div>
        <div className="tr-center-card-side">
          <div className="tr-side-label">{trade.recipient_team?.name || 'Recipient'} sends</div>
          {trade.from_recipient.length === 0 ? (
            <span className="text-secondary" style={{ fontSize: '.78rem', fontStyle: 'italic' }}>nothing</span>
          ) : (
            <div className="tr-asset-list">
              {trade.from_recipient.map((a, i) => <AssetChip key={i} asset={a} />)}
            </div>
          )}
        </div>
      </div>
      <div className="tr-center-card-meta">
        <span><i className="bi bi-clock me-1"></i>{trade.proposed_at || '—'}</span>
        <span>·</span>
        <span><i className="bi bi-box-seam me-1"></i>{trade.asset_count} asset{trade.asset_count === 1 ? '' : 's'}</span>
        {trade.intended_period && (
          <>
            <span>·</span>
            <span>
              <i className="bi bi-calendar3 me-1"></i>
              {trade.intended_period === 'midseason' ? 'Mid-season' : 'End of season'}
            </span>
          </>
        )}
      </div>
    </Link>
  )
}

export function TradeCenterPage() {
  const { leagueId } = useParams()
  const [searchParams] = useSearchParams()
  const tab = (searchParams.get('tab') || 'incoming') as 'incoming' | 'outgoing' | 'history'
  const { data, loading } = useFetch<TradeCenterData>(`/leagues/${leagueId}/trades?format=json&tab=${tab}`)

  // Countdown re-render
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <Spinner text="Loading trades..." />
  if (!data) return <p className="text-danger">Failed to load trades</p>

  const { league, user_team, incoming, outgoing, history, team_logos } = data
  const currentTrades = tab === 'incoming' ? incoming : tab === 'outgoing' ? outgoing : history
  const pendingIncoming = incoming.filter(t => t.status === 'pending').length
  const pendingOutgoing = outgoing.filter(t => t.status === 'pending').length
  const completedCount = history.filter(t => t.status === 'accepted').length
  const countdown = fmtCountdown(league.trade_close_at)

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

      {/* Window banner */}
      {league.trade_window_open ? (
        <div className="tr-window-banner">
          <div className="tr-window-banner-icon"><i className="bi bi-unlock-fill"></i></div>
          <div className="tr-window-banner-body">
            <div className="tr-window-banner-title">Trade window open</div>
            <div className="tr-window-banner-sub">Send and accept proposals freely — even uneven trades.</div>
          </div>
          {countdown && (
            <div className="tr-window-banner-countdown" title={`Closes ${new Date(league.trade_close_at!).toLocaleString()}`}>
              <i className="bi bi-clock me-1"></i>{countdown}
            </div>
          )}
        </div>
      ) : (
        <div className="tr-window-banner tr-window-banner-closed">
          <div className="tr-window-banner-icon"><i className="bi bi-info-circle-fill"></i></div>
          <div className="tr-window-banner-body">
            <div className="tr-window-banner-title">Trade window closed</div>
            <div className="tr-window-banner-sub">Proposals are paused — they'll resume when the window reopens.</div>
          </div>
        </div>
      )}

      {/* Hero stat tiles */}
      <div className="tr-hero">
        <div className="tr-hero-tile tr-hero-tile-pending">
          <div className="tr-hero-tile-label">Pending in</div>
          <div className="tr-hero-tile-value">{pendingIncoming}</div>
          <div className="tr-hero-tile-sub">awaiting your response</div>
        </div>
        <div className="tr-hero-tile tr-hero-tile-outgoing">
          <div className="tr-hero-tile-label">Pending out</div>
          <div className="tr-hero-tile-value">{pendingOutgoing}</div>
          <div className="tr-hero-tile-sub">awaiting their response</div>
        </div>
        <div className="tr-hero-tile tr-hero-tile-history">
          <div className="tr-hero-tile-label">Completed</div>
          <div className="tr-hero-tile-value">{completedCount}</div>
          <div className="tr-hero-tile-sub">accepted trades this season</div>
        </div>
      </div>

      <div className="league-subnav">
        <Link to={`/leagues/${leagueId}/trades?tab=incoming`} className={`league-subtab${tab === 'incoming' ? ' active' : ''}`}>
          <i className="bi bi-inbox"></i>Incoming
          {pendingIncoming > 0 && (
            <span className="badge" style={{ background: '#f85149', fontSize: '.55rem', marginLeft: 4, borderRadius: 8 }}>{pendingIncoming}</span>
          )}
        </Link>
        <Link to={`/leagues/${leagueId}/trades?tab=outgoing`} className={`league-subtab${tab === 'outgoing' ? ' active' : ''}`}>
          <i className="bi bi-send"></i>Outgoing
          {pendingOutgoing > 0 && (
            <span className="badge" style={{ background: '#d29922', fontSize: '.55rem', marginLeft: 4, borderRadius: 8 }}>{pendingOutgoing}</span>
          )}
        </Link>
        <Link to={`/leagues/${leagueId}/trades?tab=history`} className={`league-subtab${tab === 'history' ? ' active' : ''}`}>
          <i className="bi bi-clock-history"></i>History
        </Link>
      </div>

      {currentTrades.length > 0 ? (
        currentTrades.map(t => <TradeCard key={t.id} trade={t} leagueId={leagueId!} teamLogos={team_logos} />)
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
          {tab !== 'history' && user_team && (
            <Link to={`/leagues/${leagueId}/trades/propose`} className="btn btn-primary btn-sm mt-2">
              <i className="bi bi-plus-lg me-1"></i>Propose a trade
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
