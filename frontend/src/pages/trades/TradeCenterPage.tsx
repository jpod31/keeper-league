import { useParams, Link, useSearchParams } from 'react-router'
import { useEffect, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { TradeCenterSkeleton } from '../../components/ui/TradeCenterSkeleton'

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
  completed: TradeSummary[]
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

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', agreed: 'Agreed', accepted: 'Accepted',
  rejected: 'Rejected', cancelled: 'Cancelled', vetoed: 'Vetoed', expired: 'Expired',
}

function sideScTotal(assets: TradeAsset[]): number {
  return Math.round(assets.reduce((s, a) => s + (a.sc_avg || 0), 0))
}

function TradeCard({ trade, leagueId, teamLogos }: {
  trade: TradeSummary; leagueId: string; teamLogos: Record<string, string>
}) {
  const status = trade.status || 'pending'
  const propSc = sideScTotal(trade.from_proposer)
  const recSc = sideScTotal(trade.from_recipient)
  // Net from the proposer's perspective: positive = they receive more SC value.
  const net = recSc - propSc
  return (
    <Link to={`/leagues/${leagueId}/trades/${trade.id}`} className={`tr-center-card tr-card-${status}`}>
      <span className="tr-card-stripe" aria-hidden></span>
      <div className="tr-center-card-top">
        <div className="tr-center-card-teams">
          <TeamChip team={trade.proposer_team} teamLogos={teamLogos} />
          <i className="bi bi-arrow-left-right" style={{ color: '#484f58', fontSize: '.85rem' }}></i>
          <TeamChip team={trade.recipient_team} teamLogos={teamLogos} />
        </div>
        <span className={`tr-center-card-status tr-status-${status}`}>{STATUS_LABEL[status] || status}</span>
      </div>
      <div className="tr-center-card-grid">
        <div className="tr-center-card-side">
          <div className="tr-side-label">
            <span>{trade.proposer_team?.name || 'Proposer'} sends</span>
            {propSc > 0 && <span className="tr-side-sc">{propSc} SC</span>}
          </div>
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
          <div className="tr-side-label">
            <span>{trade.recipient_team?.name || 'Recipient'} sends</span>
            {recSc > 0 && <span className="tr-side-sc">{recSc} SC</span>}
          </div>
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
        {(propSc > 0 || recSc > 0) && (
          <>
            <span>·</span>
            <span className={`tr-net${net > 0 ? ' tr-net-pos' : net < 0 ? ' tr-net-neg' : ''}`}>
              <i className="bi bi-bar-chart-steps me-1"></i>
              {net === 0 ? 'Even SC' : `${net > 0 ? '+' : ''}${net} SC ${net > 0 ? 'to ' + (trade.proposer_team?.name || 'proposer') : 'to ' + (trade.recipient_team?.name || 'recipient')}`}
            </span>
          </>
        )}
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
  const tab = (searchParams.get('tab') || 'pending') as 'pending' | 'completed' | 'history'
  const { data, loading } = useFetch<TradeCenterData>(`/leagues/${leagueId}/trades?format=json&tab=${tab}`)

  // Countdown re-render
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <TradeCenterSkeleton />
  if (!data) return <p className="text-danger">Failed to load trades</p>

  const { league, user_team, incoming, outgoing, completed, history, team_logos } = data
  const pendingIncoming = incoming.length
  const pendingOutgoing = outgoing.length
  const pendingTotal = pendingIncoming + pendingOutgoing
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
          <div className="tr-hero-tile-label">Your completed</div>
          <div className="tr-hero-tile-value">{completed.length}</div>
          <div className="tr-hero-tile-sub">accepted deals this season</div>
        </div>
      </div>

      {/* Dedicated tab class (.tr-tabs) — NOT .league-subnav, which is
          hidden on desktop as duplicate section nav. These are in-page
          content tabs and must stay visible everywhere. Each tab carries
          its own accent identity (amber / green / sapphire). */}
      <div className="tr-tabs">
        <Link to={`/leagues/${leagueId}/trades?tab=pending`} className={`tr-tab tr-tab-pending${tab === 'pending' ? ' active' : ''}`}>
          <span className="tr-tab-ic"><i className="bi bi-hourglass-split"></i></span>
          <span className="tr-tab-body">
            <span className="tr-tab-label">Pending</span>
            <span className="tr-tab-sub">{pendingTotal > 0 ? `${pendingTotal} active` : 'no offers'}</span>
          </span>
        </Link>
        <Link to={`/leagues/${leagueId}/trades?tab=completed`} className={`tr-tab tr-tab-completed${tab === 'completed' ? ' active' : ''}`}>
          <span className="tr-tab-ic"><i className="bi bi-check-circle-fill"></i></span>
          <span className="tr-tab-body">
            <span className="tr-tab-label">Completed</span>
            <span className="tr-tab-sub">{completed.length > 0 ? `${completed.length} of yours` : 'your deals'}</span>
          </span>
        </Link>
        <Link to={`/leagues/${leagueId}/trades?tab=history`} className={`tr-tab tr-tab-history${tab === 'history' ? ' active' : ''}`}>
          <span className="tr-tab-ic"><i className="bi bi-clock-history"></i></span>
          <span className="tr-tab-body">
            <span className="tr-tab-label">League history</span>
            <span className="tr-tab-sub">{history.length > 0 ? `${history.length} all-time` : 'all trades'}</span>
          </span>
        </Link>
      </div>

      {/* ── PENDING: your incoming + outgoing offers (private to parties) ── */}
      {tab === 'pending' && (
        pendingTotal > 0 ? (
          <>
            {incoming.length > 0 && (
              <>
                <div className="tr-section-head"><i className="bi bi-inbox"></i> Incoming · {incoming.length}</div>
                {incoming.map(t => <TradeCard key={t.id} trade={t} leagueId={leagueId!} teamLogos={team_logos} />)}
              </>
            )}
            {outgoing.length > 0 && (
              <>
                <div className="tr-section-head"><i className="bi bi-send"></i> Outgoing · {outgoing.length}</div>
                {outgoing.map(t => <TradeCard key={t.id} trade={t} leagueId={leagueId!} teamLogos={team_logos} />)}
              </>
            )}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><i className="bi bi-hourglass"></i></div>
            <h4>No pending trades</h4>
            <p>No active offers in or out right now. Only you and the other team can see a pending offer.</p>
            {user_team && (
              <Link to={`/leagues/${leagueId}/trades/propose`} className="btn btn-primary btn-sm mt-2">
                <i className="bi bi-plus-lg me-1"></i>Propose a trade
              </Link>
            )}
          </div>
        )
      )}

      {/* ── COMPLETED: your accepted deals ── */}
      {tab === 'completed' && (
        completed.length > 0 ? (
          completed.map(t => <TradeCard key={t.id} trade={t} leagueId={leagueId!} teamLogos={team_logos} />)
        ) : (
          <div className="empty-state positive">
            <div className="empty-icon"><i className="bi bi-check-circle"></i></div>
            <h4>No completed trades yet</h4>
            <p>Deals you've successfully made this season will show here.</p>
          </div>
        )
      )}

      {/* ── LEAGUE HISTORY: all accepted trades (public ledger) ── */}
      {tab === 'history' && (
        history.length > 0 ? (
          history.map(t => <TradeCard key={t.id} trade={t} leagueId={leagueId!} teamLogos={team_logos} />)
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><i className="bi bi-clock-history"></i></div>
            <h4>No trades yet</h4>
            <p>Completed trades across the whole league will appear here as they happen.</p>
          </div>
        )
      )}
    </div>
  )
}
