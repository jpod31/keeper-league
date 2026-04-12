import { useParams, Link, useNavigate } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface Team { id: number; name: string }

interface PlayerAsset {
  player_id: number | null
  name: string
  position: string
  sc_avg: number
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
  league: { id: number; name: string }
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

function posCode(pos: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}

export function TradeDetailPage() {
  const { leagueId, tradeId } = useParams()
  const navigate = useNavigate()
  const { data, loading, refetch } = useFetch<TradeDetailData>(`/leagues/${leagueId}/trades/${tradeId}?format=json`)
  const [comment, setComment] = useState('')
  const [vetoReason, setVetoReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner text="Loading trade..." />
  if (!data) return <p className="text-danger">Failed to load trade</p>

  const { league, trade, giving, receiving, giving_picks, receiving_picks, comments, is_commissioner, is_recipient, is_proposer } = data

  async function respondAction(action: 'accept' | 'reject' | 'cancel') {
    if (action === 'accept' && !confirm('Accept this trade?')) return
    setBusy(true)
    try {
      const form = new FormData()
      form.set('action', action)
      const res = await fetch(`/leagues/${leagueId}/trades/${tradeId}/respond`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      if (action === 'cancel') {
        navigate(`/leagues/${leagueId}/trades`)
      } else {
        refetch()
      }
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function vetoAction() {
    if (!confirm('Veto this trade?')) return
    setBusy(true)
    try {
      const form = new FormData()
      form.set('reason', vetoReason)
      const res = await fetch(`/leagues/${leagueId}/trades/${tradeId}/veto`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      refetch()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim()) return
    setBusy(true)
    try {
      const form = new FormData()
      form.set('comment', comment)
      const res = await fetch(`/leagues/${leagueId}/trades/${tradeId}/comment`, {
        method: 'POST',
        body: form,
        credentials: 'include',
        redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      setComment('')
      refetch()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function renderAssetTable(players: PlayerAsset[], picks: PickAsset[]) {
    return (
      <table className="table table-sm mb-0">
        <tbody>
          {players.map(a => (
            <tr key={`p-${a.player_id}`}>
              <td>
                <span className="text-decoration-none">
                  {a.name}
                </span>
              </td>
              <td><span className={`pos-badge pos-${posCode(a.position)}`}>{a.position}</span></td>
              <td className="text-end text-secondary">
                {a.sc_avg ? Math.round(a.sc_avg) : '-'}
              </td>
            </tr>
          ))}
          {picks.map(a => (
            <tr key={`pk-${a.id}`}>
              <td colSpan={2}>
                <i className="bi bi-ticket-perforated me-1" style={{ color: '#58a6ff' }}></i>
                {a.year} Round {a.round_number} Pick
                {!a.is_own && a.original_team && (
                  <span className="text-secondary" style={{ fontSize: '.75rem' }}>
                    {' '}(originally {a.original_team}'s)
                  </span>
                )}
              </td>
              <td className="text-end">
                <span className="badge" style={{ background: 'rgba(88,166,255,.15)', color: '#58a6ff', fontSize: '.65rem' }}>PICK</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
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
            <h2 className="mb-0">Trade Details</h2>
          </div>
          <span className={`status-pill status-${trade.status}`} style={{ fontSize: '.85rem' }}>{trade.status}</span>
        </div>
      </div>

      {trade.status === 'agreed' && (
        <div className="alert" style={{ background: 'rgba(88,166,255,.08)', border: '1px solid rgba(88,166,255,.25)', color: '#c9d1d9', marginBottom: '1.5rem' }}>
          <i className="bi bi-info-circle me-1" style={{ color: '#58a6ff' }}></i>
          Both teams have agreed to this trade. It will auto-execute when the trade window opens.
        </div>
      )}

      <div className="row g-4 mb-4">
        <div className="col-md-5">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <span style={{ color: '#f85149' }}><i className="bi bi-arrow-up-right me-1"></i></span>
                {trade.proposer_team?.name} sends
              </h5>
            </div>
            <div className="card-body p-0">
              {renderAssetTable(giving, giving_picks)}
            </div>
          </div>
        </div>

        <div className="col-md-2 d-flex align-items-center justify-content-center py-2 py-md-0">
          <i className="bi bi-arrow-down-up d-md-none" style={{ fontSize: '1.5rem', color: '#30363d' }}></i>
          <i className="bi bi-arrow-left-right d-none d-md-inline" style={{ fontSize: '2rem', color: '#30363d' }}></i>
        </div>

        <div className="col-md-5">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <span style={{ color: '#3fb950' }}><i className="bi bi-arrow-down-left me-1"></i></span>
                {trade.recipient_team?.name} sends
              </h5>
            </div>
            <div className="card-body p-0">
              {renderAssetTable(receiving, receiving_picks)}
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-4" style={{ fontSize: '.8rem', color: '#8b949e' }}>
            <span><i className="bi bi-clock me-1"></i>Proposed {trade.proposed_at}</span>
            {trade.review_deadline && trade.status === 'pending' && (
              <span><i className="bi bi-hourglass-split me-1"></i>Deadline {trade.review_deadline}</span>
            )}
            {trade.responded_at && (
              <span><i className="bi bi-check-circle me-1"></i>Responded {trade.responded_at}</span>
            )}
            {trade.intended_period && (
              <span>
                <i className="bi bi-calendar-event me-1"></i>
                {trade.intended_period === 'midseason' ? 'Mid-Season' : 'End of Season'}
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

      {trade.status === 'pending' && (
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

      <div className="card">
        <div className="card-header">
          <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
            <i className="bi bi-chat-dots me-2" style={{ color: '#8b949e' }}></i>Comments
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
