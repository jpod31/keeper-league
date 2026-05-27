import { useParams, Link, useNavigate } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { RowsSkeleton } from '../../components/ui/RowsSkeleton'

interface Team {
  id: number
  name: string
  logo_url?: string | null
  owner?: string | null
}

interface PlayerAsset {
  player_id: number | null
  name: string
  position: string
  sc_avg: number
  afl_team: string
  age?: number
}

interface PickAsset {
  id: number | null
  year: number | null
  round_number: number | null
  original_team_id: number | null
  original_team: string | null
  from_team_id: number
  is_own: boolean
}

interface Comment {
  user_name: string
  user_initial: string
  comment: string
  created_at: string | null
}

interface Trade {
  id: number
  status: string
  proposer_team: Team | null
  recipient_team: Team | null
  proposed_at: string | null
  review_deadline: string | null
  responded_at: string | null
  intended_period: string | null
  notes: string | null
  veto_reason: string | null
}

interface TradeDetailData {
  league: { id: number; name: string; trade_window_open: boolean }
  team_logos: Record<string, string>
  trade: Trade
  giving: PlayerAsset[]
  receiving: PlayerAsset[]
  giving_picks: PickAsset[]
  receiving_picks: PickAsset[]
  comments: Comment[]
  is_commissioner: boolean
  is_recipient: boolean
  is_proposer: boolean
}

function aflInitials(name: string): string {
  if (!name) return '·'
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 3).toUpperCase()
}

function teamInitials(name: string): string {
  if (!name) return '·'
  const words = name.split(/\s+/).filter(Boolean).slice(0, 2)
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function StaticPlayerCard({ player, logoUrl, side }: {
  player: PlayerAsset; logoUrl?: string | null; side: 'out' | 'in'
}) {
  const positions = (player.position || 'MID').split('/')
  const primary = positions[0]
  return (
    <div className={`tr-card tr-card-${primary} tr-card-${side}`} style={{ cursor: 'default' }}>
      <div className="tr-card-top">
        <div className="tr-card-logo">
          {logoUrl
            ? <img src={logoUrl} alt="" />
            : <span className="tr-card-logo-placeholder">{aflInitials(player.afl_team)}</span>}
        </div>
        <div className="tr-card-pos">
          {positions.map(p => <span key={p} className={`pos-badge pos-${p}`}>{p}</span>)}
        </div>
      </div>
      <div className="tr-card-name">{player.name}</div>
      <div className="tr-card-meta">
        <span className="tr-card-sc">{player.sc_avg ? Math.round(player.sc_avg) : '—'}</span>
        {player.age ? <span className="tr-card-age">{player.age}y</span> : <span />}
      </div>
    </div>
  )
}

function StaticPickCard({ pick, side }: { pick: PickAsset; side: 'out' | 'in' }) {
  return (
    <div className={`tr-pick tr-pick-${side}`} style={{ cursor: 'default' }}>
      <div className="tr-pick-year">{pick.year} draft</div>
      <div className="tr-pick-round">Round {pick.round_number}</div>
      {!pick.is_own && pick.original_team && (
        <div className="tr-pick-orig">via {pick.original_team}</div>
      )}
    </div>
  )
}

export function TradeDetailPage() {
  const { leagueId, tradeId } = useParams()
  const navigate = useNavigate()
  const { data, loading, refetch } = useFetch<TradeDetailData>(`/leagues/${leagueId}/trades/${tradeId}?format=json`)
  const [comment, setComment] = useState('')
  const [vetoReason, setVetoReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <RowsSkeleton rows={6} />
  if (!data) return <p className="text-danger">Failed to load trade</p>

  const { league, trade, giving, receiving, giving_picks, receiving_picks, comments, team_logos,
    is_commissioner, is_recipient, is_proposer } = data
  const status = trade.status || 'pending'

  const giveSc = giving.reduce((s, p) => s + (p.sc_avg || 0), 0)
  const recvSc = receiving.reduce((s, p) => s + (p.sc_avg || 0), 0)
  const scDelta = recvSc - giveSc
  const rosterDelta = receiving.length - giving.length

  async function respondAction(action: 'accept' | 'reject' | 'cancel') {
    if (action === 'accept' && !confirm('Accept this trade?')) return
    setBusy(true); setError(null)
    try {
      const form = new FormData()
      form.set('action', action)
      const res = await fetch(`/leagues/${leagueId}/trades/${tradeId}/respond`, {
        method: 'POST', body: form, credentials: 'include', redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      if (action === 'cancel') navigate(`/leagues/${leagueId}/trades`)
      else refetch()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function vetoAction() {
    if (!confirm('Veto this trade?')) return
    setBusy(true); setError(null)
    try {
      const form = new FormData()
      form.set('reason', vetoReason)
      const res = await fetch(`/leagues/${leagueId}/trades/${tradeId}/veto`, {
        method: 'POST', body: form, credentials: 'include', redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      refetch()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    setBusy(true); setError(null)
    try {
      const form = new FormData()
      form.set('comment', comment)
      const res = await fetch(`/leagues/${leagueId}/trades/${tradeId}/comment`, {
        method: 'POST', body: form, credentials: 'include', redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      setComment('')
      refetch()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link>
          {' / '}<Link to={`/leagues/${leagueId}/trades`}>Trades</Link>
          {' / '}#{trade.id}
        </div>
        <div className="d-flex justify-content-between align-items-start">
          <div className="d-flex align-items-center gap-3">
            <Link to={`/leagues/${leagueId}/trades`} className="btn btn-sm btn-outline-secondary" style={{ padding: '4px 10px' }}>
              <i className="bi bi-arrow-left"></i>
            </Link>
            <h2 className="mb-0">Trade #{trade.id}</h2>
          </div>
          <span className={`tr-center-card-status tr-status-${status}`} style={{ fontSize: '.75rem' }}>{status}</span>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

      {status === 'agreed' && (
        <div className="tr-window-banner tr-window-banner-closed" style={{ marginBottom: 16 }}>
          <div className="tr-window-banner-icon" style={{ background: 'rgba(88,166,255,.15)', color: '#79c0ff' }}>
            <i className="bi bi-check-circle-fill"></i>
          </div>
          <div className="tr-window-banner-body">
            <div className="tr-window-banner-title">Both teams agreed</div>
            <div className="tr-window-banner-sub">This trade will auto-execute when the trade window opens.</div>
          </div>
        </div>
      )}

      {/* Deal poster */}
      <div className="tr-deal" style={{ marginBottom: 20 }}>
        <div className="tr-deal-header">
          <div className="tr-deal-title">The deal</div>
          <div className="tr-deal-balance">
            <span><b>{giving.length + giving_picks.length}</b> ↔ <b>{receiving.length + receiving_picks.length}</b></span>
            <span style={{ color: '#484f58' }}>·</span>
            <span className={rosterDelta > 0 ? 'tr-bal-pos' : rosterDelta < 0 ? 'tr-bal-neg' : ''}>
              {trade.proposer_team?.name?.split(' ')[0]} roster {rosterDelta > 0 ? '+' : ''}{rosterDelta}
            </span>
            {(giving.length > 0 || receiving.length > 0) && (
              <>
                <span style={{ color: '#484f58' }}>·</span>
                <span className={scDelta > 0 ? 'tr-bal-pos' : scDelta < 0 ? 'tr-bal-neg' : ''}>
                  SC {scDelta > 0 ? '+' : ''}{Math.round(scDelta)}
                </span>
              </>
            )}
          </div>
          <span />
        </div>

        <div className="tr-deal-grid">
          {/* Proposer side (out, red) */}
          <div className="tr-deal-side tr-deal-side-out" style={{ minHeight: 'unset' }}>
            <div className="tr-deal-side-label">sends</div>
            <div className="tr-deal-side-team" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="tr-team-chip-logo">
                {trade.proposer_team?.logo_url
                  ? <img src={trade.proposer_team.logo_url} alt="" />
                  : teamInitials(trade.proposer_team?.name || '')}
              </span>
              {trade.proposer_team?.name}
            </div>
            {giving.length === 0 && giving_picks.length === 0 ? (
              <div className="tr-deal-empty">Nothing</div>
            ) : (
              <div className="tr-deck" style={{ marginTop: 6 }}>
                {giving.map(p => (
                  <StaticPlayerCard key={`p${p.player_id}`} player={p} side="out"
                    logoUrl={team_logos[p.afl_team || '']} />
                ))}
                {giving_picks.map(pk => (
                  <StaticPickCard key={`pk${pk.id}`} pick={pk} side="out" />
                ))}
              </div>
            )}
          </div>

          <div className="tr-deal-arrow"><i className="bi bi-arrow-left-right"></i></div>

          {/* Recipient side (in, green) */}
          <div className="tr-deal-side tr-deal-side-in" style={{ minHeight: 'unset' }}>
            <div className="tr-deal-side-label">sends</div>
            <div className="tr-deal-side-team" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="tr-team-chip-logo">
                {trade.recipient_team?.logo_url
                  ? <img src={trade.recipient_team.logo_url} alt="" />
                  : teamInitials(trade.recipient_team?.name || '')}
              </span>
              {trade.recipient_team?.name}
            </div>
            {receiving.length === 0 && receiving_picks.length === 0 ? (
              <div className="tr-deal-empty">Nothing</div>
            ) : (
              <div className="tr-deck" style={{ marginTop: 6 }}>
                {receiving.map(p => (
                  <StaticPlayerCard key={`p${p.player_id}`} player={p} side="in"
                    logoUrl={team_logos[p.afl_team || '']} />
                ))}
                {receiving_picks.map(pk => (
                  <StaticPickCard key={`pk${pk.id}`} pick={pk} side="in" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta + notes */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-4" style={{ fontSize: '.8rem', color: '#8b949e' }}>
            <span><i className="bi bi-clock me-1"></i>Proposed {trade.proposed_at}</span>
            {trade.review_deadline && status === 'pending' && (
              <span><i className="bi bi-hourglass-split me-1"></i>Deadline {trade.review_deadline}</span>
            )}
            {trade.responded_at && (
              <span><i className="bi bi-check-circle me-1"></i>Responded {trade.responded_at}</span>
            )}
            {trade.intended_period && (
              <span>
                <i className="bi bi-calendar-event me-1"></i>
                {trade.intended_period === 'midseason' ? 'Mid-season' : 'End of season'}
              </span>
            )}
          </div>
          {trade.notes && (
            <div className="mt-3 p-3" style={{ background: '#21262d', borderRadius: 8, fontSize: '.85rem' }}>
              <i className="bi bi-chat-quote me-1" style={{ color: '#8b949e' }}></i> "{trade.notes}"
            </div>
          )}
          {trade.veto_reason && (
            <div className="mt-3 p-3" style={{ background: 'rgba(248,81,73,.1)', borderRadius: 8, border: '1px solid rgba(248,81,73,.2)', fontSize: '.85rem', color: '#f85149' }}>
              <i className="bi bi-exclamation-triangle me-1"></i> Veto: {trade.veto_reason}
            </div>
          )}
        </div>
      </div>

      {status === 'pending' && (
        <div className="d-flex flex-wrap gap-2 mb-4">
          {is_recipient && (
            <>
              <button className="btn btn-primary" onClick={() => respondAction('accept')} disabled={busy}>
                <i className="bi bi-check-lg me-1"></i>Accept
              </button>
              <button className="btn btn-outline-secondary" style={{ borderColor: '#f85149', color: '#f85149' }} onClick={() => respondAction('reject')} disabled={busy}>
                <i className="bi bi-x-lg me-1"></i>Reject
              </button>
            </>
          )}
          {is_proposer && (
            <button className="btn btn-outline-secondary" onClick={() => respondAction('cancel')} disabled={busy}>
              Cancel Trade
            </button>
          )}
          {is_commissioner && (
            <div className="d-flex gap-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Veto reason (optional)"
                style={{ minWidth: 150, flex: 1 }}
                value={vetoReason}
                onChange={e => setVetoReason(e.target.value)}
              />
              <button
                className="btn btn-outline-secondary btn-sm"
                style={{ borderColor: '#f85149', color: '#f85149' }}
                onClick={vetoAction}
                disabled={busy}
              >
                Veto
              </button>
            </div>
          )}
        </div>
      )}

      {/* Comments */}
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-chat-dots me-2" style={{ color: '#8b949e' }}></i>
            Comments {comments.length > 0 && <span className="text-secondary" style={{ fontSize: '.75rem', fontWeight: 500 }}>({comments.length})</span>}
          </h5>
        </div>
        <div className="card-body">
          {comments.length > 0 ? comments.map((c, i) => (
            <div key={i} className="mb-3 pb-3" style={{ borderBottom: '1px solid #21262d' }}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span
                  className="d-inline-flex align-items-center justify-content-center rounded-circle"
                  style={{ width: 24, height: 24, background: '#21262d', fontSize: '.65rem', fontWeight: 600 }}
                >{c.user_initial}</span>
                <strong style={{ fontSize: '.85rem' }}>{c.user_name}</strong>
                <small style={{ color: '#484f58' }}>{c.created_at}</small>
              </div>
              <p className="mb-0 ms-4" style={{ fontSize: '.85rem' }}>{c.comment}</p>
            </div>
          )) : (
            <p className="text-secondary mb-3" style={{ fontSize: '.85rem' }}>No comments yet.</p>
          )}

          <form className="d-flex gap-2" onSubmit={submitComment}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Add a comment..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-outline-primary btn-sm" style={{ whiteSpace: 'nowrap' }} disabled={busy}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
