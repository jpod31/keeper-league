import { useParams, useNavigate } from 'react-router'
import { useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'

interface PositionSlot { position_code: string; count: number; is_bench: boolean }

interface League {
  id: number
  name: string
  status: string
  season_year: number
  scoring_type: string
  scoring_label: string
  num_teams: number
  squad_size: number
  on_field_count: number
  draft_type: string
  pick_timer_secs: number
  trade_window_open: boolean
  commissioner_name: string
  invite_code: string | null
  position_slots: PositionSlot[]
}

interface Team {
  id: number
  name: string
  owner: string
  draft_order: number | null
  is_mine: boolean
  roster_count: number
}

interface DashboardData {
  league: League
  user_team: Team | null
  teams: Team[]
  is_commissioner: boolean
  scoring_rules: Record<string, number | string>
  has_completed_onboarding: boolean
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  )
}

export function DashboardPage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const { data, loading } = useFetch<DashboardData>(`/leagues/${leagueId}?format=json`)
  const [copied, setCopied] = useState(false)
  const [joinName, setJoinName] = useState('')

  if (loading) return <Spinner text="Loading dashboard..." />
  if (!data) return <p className="text-danger">Failed to load dashboard</p>

  const { league, user_team, teams, scoring_rules, has_completed_onboarding } = data

  const inviteUrl = league.invite_code
    ? `${window.location.origin}/leagues/invite/${league.invite_code}`
    : ''

  function copyInvite() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  async function joinLeague(e: React.FormEvent) {
    e.preventDefault()
    const form = new FormData()
    form.set('team_name', joinName)
    const res = await fetch(`/leagues/${leagueId}/join`, { method: 'POST', body: form, credentials: 'include', redirect: 'manual' })
    if (res.status < 500) window.location.reload()
  }

  function openTeam(teamId: number) {
    navigate(`/leagues/${leagueId}/team/${teamId}`)
  }

  return (
    <div>
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-start">
          <div>
            <h2>{league.name}</h2>
            <div className="d-flex align-items-center gap-3 mt-1">
              <span className={`status-pill status-${league.status}`}>{league.status}</span>
              <span style={{ fontSize: '.8rem', color: '#8b949e' }}>
                {league.season_year} · {league.scoring_label} Scoring
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Teams */}
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-people me-2" style={{ color: '#8b949e' }}></i>Teams
                <span className="text-secondary fw-normal" style={{ fontSize: '.8rem' }}>
                  {' '}{teams.length}/{league.num_teams}
                </span>
              </h5>
            </div>
            {teams.length > 0 ? (
              <div className="card-body p-0">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Team</th>
                      <th>Owner</th>
                      <th className="text-end">Roster</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((t, i) => (
                      <tr key={t.id} style={{ cursor: 'pointer' }}
                        onClick={() => openTeam(t.id)}>
                        <td>
                          <span
                            className="d-inline-flex align-items-center justify-content-center rounded"
                            style={{
                              width: 28, height: 28, background: '#21262d',
                              fontSize: '.75rem', fontWeight: 600, borderRadius: 6,
                            }}
                          >
                            {t.draft_order || i + 1}
                          </span>
                        </td>
                        <td>
                          <strong>{t.name}</strong>
                          {t.is_mine && (
                            <span className="badge ms-1" style={{ background: 'rgba(88,166,255,.15)', color: '#58a6ff', fontSize: '.65rem' }}>
                              You
                            </span>
                          )}
                        </td>
                        <td style={{ color: '#8b949e' }}>{t.owner}</td>
                        <td className="text-end">
                          <span className="badge" style={{ background: '#21262d', color: '#8b949e' }}>
                            {t.roster_count}
                          </span>
                        </td>
                        <td style={{ width: 24, color: '#484f58' }}>
                          <i className="bi bi-chevron-right"></i>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-body text-center py-4">
                <p className="text-secondary mb-0">No teams have joined yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="col-lg-4">
          {/* Join form */}
          {!user_team && (
            <div className="card mb-3">
              <div className="card-body p-4">
                <h5 className="fw-bold mb-3" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-box-arrow-in-right me-2" style={{ color: '#3fb950' }}></i>Join League
                </h5>
                <form onSubmit={joinLeague}>
                  <div className="mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Your team name"
                      required
                      maxLength={120}
                      value={joinName}
                      onChange={e => setJoinName(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-100">Join League</button>
                </form>
              </div>
            </div>
          )}

          {/* Getting Started checklist */}
          {!has_completed_onboarding && (() => {
            const hasTeam = user_team != null
            const hasDraft = league.status !== 'setup'
            const renderItem = (done: boolean, label: string) => (
              <div className="d-flex align-items-center gap-2 py-1">
                <i
                  className={`bi ${done ? 'bi-check-circle-fill' : 'bi-circle'}`}
                  style={{ color: done ? 'var(--kl-accent-green)' : 'var(--kl-border-light)' }}
                ></i>
                <span style={done ? { textDecoration: 'line-through', color: 'var(--kl-text-secondary)' } : undefined}>
                  {label}
                </span>
              </div>
            )
            return (
              <div className="card mb-3">
                <div className="card-header">
                  <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                    <i className="bi bi-check2-square me-2" style={{ color: 'var(--kl-accent-green)' }}></i>
                    Getting Started
                  </h5>
                </div>
                <div className="card-body p-0">
                  <div className="px-3 py-2" style={{ fontSize: '.82rem' }}>
                    {renderItem(hasTeam, 'Join or create a league')}
                    {renderItem(hasDraft, 'Complete the draft')}
                    {renderItem(false, 'Set your lineup')}
                    {renderItem(false, 'Check gameday scores')}
                    {renderItem(false, 'Propose a trade')}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Invite Link */}
          {league.invite_code && (
            <div className="card mb-3">
              <div className="card-header">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-share me-2" style={{ color: '#d29922' }}></i>Invite Players
                </h5>
              </div>
              <div className="card-body">
                <p className="text-secondary mb-2" style={{ fontSize: '.8rem' }}>Share this link to invite others to your league:</p>
                <div className="input-group input-group-sm">
                  <input
                    type="text"
                    className="form-control"
                    readOnly
                    value={inviteUrl}
                    style={{ fontSize: '.75rem', background: '#0d1117', color: '#c9d1d9', borderColor: '#30363d' }}
                  />
                  <button
                    className={`btn ${copied ? 'btn-outline-success' : 'btn-outline-secondary'}`}
                    onClick={copyInvite}
                    title="Copy link"
                  >
                    <i className={`bi ${copied ? 'bi-check2' : 'bi-clipboard'}`}></i>
                  </button>
                </div>
                <div className="mt-2 text-center">
                  <span className="badge" style={{ background: '#21262d', color: '#8b949e', fontSize: '.7rem', letterSpacing: 1 }}>
                    {league.invite_code}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-info-circle me-2" style={{ color: '#8b949e' }}></i>Details
              </h5>
            </div>
            <div className="card-body">
              <InfoRow label="Commissioner" value={league.commissioner_name} />
              <InfoRow label="Squad Size" value={league.squad_size} />
              <InfoRow label="On-Field" value={league.on_field_count} />
              <InfoRow label="Draft Type" value={<span className="text-capitalize">{league.draft_type}</span>} />
              <InfoRow label="Pick Timer" value={`${league.pick_timer_secs}s`} />
              <InfoRow
                label="Trade Window"
                value={
                  league.trade_window_open ? (
                    <span style={{ color: '#3fb950' }}>
                      <i className="bi bi-circle-fill me-1" style={{ fontSize: '.5rem' }}></i>Open
                    </span>
                  ) : (
                    <span style={{ color: '#f85149' }}>
                      <i className="bi bi-circle-fill me-1" style={{ fontSize: '.5rem' }}></i>Closed
                    </span>
                  )
                }
              />
            </div>
          </div>

          {/* Positions */}
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                <i className="bi bi-diagram-3 me-2" style={{ color: '#8b949e' }}></i>Positions
              </h5>
            </div>
            <div className="card-body">
              {league.position_slots.map((slot, i) => (
                <div key={i} className="d-flex justify-content-between align-items-center py-1">
                  <span className={`pos-badge pos-${slot.position_code}`}>{slot.position_code}</span>
                  <span style={{ fontSize: '.85rem' }}>
                    {slot.count}
                    {slot.is_bench && <span className="text-secondary" style={{ fontSize: '.7rem' }}> (bench)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Scoring */}
          {league.scoring_type === 'custom' && Object.keys(scoring_rules).length > 0 && (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-calculator me-2" style={{ color: '#8b949e' }}></i>Scoring Rules
                </h5>
              </div>
              <div className="card-body">
                {Object.entries(scoring_rules).map(([stat, pts]) => (
                  <div key={stat} className="info-row">
                    <span className="info-label text-capitalize">{stat.replace(/_/g, ' ')}</span>
                    <span className="info-value">{pts} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {league.scoring_type === 'ultimate_footy' && Object.keys(scoring_rules).length > 0 && (
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>
                  <i className="bi bi-trophy me-2" style={{ color: '#d29922' }}></i>
                  UF Categories ({Object.keys(scoring_rules).length})
                </h5>
              </div>
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2">
                  {Object.keys(scoring_rules).map(stat => (
                    <span key={stat} className="badge" style={{ background: '#21262d', color: '#c9d1d9', fontWeight: 500, fontSize: '.75rem' }}>
                      {stat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
