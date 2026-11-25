import { useParams, Link, useSearchParams } from 'react-router'
import { useEffect, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { TradeCenterSkeleton } from '../../components/ui/TradeCenterSkeleton'
import { TeamCrest } from '../../components/draft/TeamCrest'

interface Team { id: number; name: string; logo_url?: string | null; logo: string | null; accent: string }

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
    trade_window_label: string | null
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

function fmtCountdown(closeAt: string | null): string | null {
  if (!closeAt) return null
  const ms = new Date(closeAt).getTime() - Date.now()
  // Expired: render nothing. A "closed" chip beside an "open" banner is worse
  // than no chip at all.
  if (ms <= 0) return null
  const days = Math.floor(ms / 86400000)
  const hours = Math.floor((ms % 86400000) / 3600000)
  const mins = Math.floor((ms % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
}

function posPrimary(pos?: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}

function Asset({ asset }: { asset: TradeAsset }) {
  if (asset.kind === 'pick') {
    return <li className="tx-asset"><span className="tx-pick">PICK</span><span className="tx-asset-n">{asset.name}</span></li>
  }
  const pos = posPrimary(asset.position)
  return (
    <li className="tx-asset">
      <span className={`pos-badge badge-${pos.toLowerCase()}`}>{pos}</span>
      <span className="tx-asset-n">{asset.name}</span>
      {asset.sc_avg != null && asset.sc_avg > 0 && <span className="tx-asset-sc">{Math.round(asset.sc_avg)}</span>}
    </li>
  )
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', agreed: 'Agreed', accepted: 'Done',
  rejected: 'Rejected', cancelled: 'Cancelled', vetoed: 'Vetoed', expired: 'Expired',
  withdrawn: 'Withdrawn',
}
const STATUS_TONE: Record<string, string> = { pending: ' due', agreed: ' due', accepted: ' ok' }

function Side({ team, assets }: { team: Team | null; assets: TradeAsset[] }) {
  return (
    <div className="tx-side">
      <div className="tx-team"><TeamCrest team={team ?? undefined} size={28} />{team?.name || 'Unknown'} gives</div>
      {assets.length === 0
        ? <div className="tx-nothing">Nothing</div>
        : <ul className="tx-assets">{assets.map((a, i) => <Asset key={i} asset={a} />)}</ul>}
    </div>
  )
}

function TradeRow({ trade, leagueId }: { trade: TradeSummary; leagueId: string }) {
  const status = trade.status || 'pending'
  return (
    <Link to={`/leagues/${leagueId}/trades/${trade.id}`} className="tx">
      <Side team={trade.proposer_team} assets={trade.from_proposer} />
      <Side team={trade.recipient_team} assets={trade.from_recipient} />
      <div className="tx-foot">
        <span className={`sq-chip${STATUS_TONE[status] || ''}`}>{STATUS_LABEL[status] || status}</span>
        <span className="tx-when">{trade.proposed_at || ''}</span>
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

  const { league, user_team, incoming, outgoing, completed, history } = data
  const pendingTotal = incoming.length + outgoing.length
  const countdown = fmtCountdown(league.trade_close_at)
  const tabs = [
    { key: 'pending', label: 'Pending', n: pendingTotal },
    { key: 'completed', label: 'Yours', n: completed.length },
    { key: 'history', label: 'Whole league', n: history.length },
  ]
  const list = (rows: TradeSummary[]) => rows.map(t => <TradeRow key={t.id} trade={t} leagueId={leagueId!} />)

  return (
    <div className="kx-page tx-page">
      <div className="kx-head">
        <h2>Trades</h2>
        <div className="kx-head-side">
          <span className={`sq-chip${league.trade_window_open ? ' ok' : ''}`}>
            {league.trade_window_open ? `Window open${countdown ? `, ${countdown}` : ''}` : 'Window closed'}
          </span>
          <Link to={`/leagues/${leagueId}/trade-block`} className="kx-btn">Trade block</Link>
          {user_team && <Link to={`/leagues/${leagueId}/trades/propose`} className="kx-btn kx-btn-gold">New trade</Link>}
        </div>
      </div>

      <div className="sn-tabs" role="tablist">
        {tabs.map(t => (
          <Link key={t.key} role="tab" aria-selected={tab === t.key} to={`/leagues/${leagueId}/trades?tab=${t.key}`}
            className={`sn-tab${tab === t.key ? ' on' : ''}`}>{t.label}<b>{t.n}</b></Link>
        ))}
      </div>

      {tab === 'pending' && (pendingTotal === 0
        ? <p className="tx-none">No offers waiting, in or out.</p>
        : <>
          {incoming.length > 0 && <><h3 className="tx-h">Offers to you</h3>{list(incoming)}</>}
          {outgoing.length > 0 && <><h3 className="tx-h">Offers you sent</h3>{list(outgoing)}</>}
        </>)}
      {tab === 'completed' && (completed.length === 0 ? <p className="tx-none">You have not made a trade yet.</p> : list(completed))}
      {tab === 'history' && (history.length === 0 ? <p className="tx-none">No trades in this league yet.</p> : list(history))}
    </div>
  )
}
