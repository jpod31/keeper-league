import { useParams, Link, useNavigate } from 'react-router'
import { useState, useEffect, useMemo } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface Team { id: number; name: string; owner?: string; logo_url?: string | null }
interface Player {
  id: number; name: string; position: string; afl_team?: string
  sc_avg: number; age?: number; rating?: number | null
}
interface Pick {
  id: number
  year: number
  round_number: number
  original_team_id: number
  original_team: string
  is_own: boolean
}

interface ProposeData {
  league: { id: number; name: string }
  user_team: Team
  trade_window_open: boolean
  trade_close_at: string | null
  team_logos: Record<string, string>
  other_teams: Team[]
  my_players: Player[]
  my_picks: Pick[]
}

interface TeamAssets {
  players: Player[]
  picks: Pick[]
}

function posPrimary(pos: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}

function fmtSc(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return String(Math.round(n))
}

function aflInitials(name: string): string {
  if (!name) return '·'
  // Hawthorn → HAW, North Melbourne → NM
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 3).toUpperCase()
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

// ── Card components ─────────────────────────────────────────

function PlayerCard({
  player, state, logoUrl, onClick,
}: {
  player: Player
  state: 'idle' | 'out' | 'in'
  logoUrl?: string | null
  onClick: () => void
}) {
  const positions = (player.position || 'MID').split('/')
  const primary = positions[0]
  const stateClass = state === 'out' ? 'tr-card-out' : state === 'in' ? 'tr-card-in' : ''
  return (
    <div
      className={`tr-card tr-card-${primary} ${stateClass}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      {state !== 'idle' && (
        <div className="tr-card-check">{state === 'out' ? '−' : '+'}</div>
      )}
      <div className="tr-card-top">
        <div className="tr-card-logo">
          {logoUrl
            ? <img src={logoUrl} alt="" />
            : <span className="tr-card-logo-placeholder">{aflInitials(player.afl_team || '')}</span>}
        </div>
        <div className="tr-card-pos">
          {positions.map(p => (
            <span key={p} className={`pos-badge pos-${p}`}>{p}</span>
          ))}
        </div>
      </div>
      <div className="tr-card-name">{player.name}</div>
      <div className="tr-card-meta">
        <span className="tr-card-sc">{fmtSc(player.sc_avg)}</span>
        {player.age ? <span className="tr-card-age">{player.age}y</span> : <span />}
      </div>
    </div>
  )
}

function PickCard({
  pick, state, onClick, hideOwner,
}: {
  pick: Pick
  state: 'idle' | 'out' | 'in'
  onClick: () => void
  hideOwner?: boolean
}) {
  const stateClass = state === 'out' ? 'tr-pick-out' : state === 'in' ? 'tr-pick-in' : ''
  return (
    <div className={`tr-pick ${stateClass}`} onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
    >
      <div className="tr-pick-year">{pick.year} draft</div>
      <div className="tr-pick-round">Round {pick.round_number}</div>
      {!hideOwner && !pick.is_own && pick.original_team_id !== undefined && (
        <div className="tr-pick-orig">via {pick.original_team}</div>
      )}
    </div>
  )
}

function MiniChip({
  label, kind, sc, onRemove,
}: { label: string; kind: 'out' | 'in'; sc?: number | null; onRemove: () => void }) {
  return (
    <span
      className={`tr-mini tr-mini-${kind}`}
      onClick={(e) => { e.stopPropagation(); onRemove() }}
      role="button"
    >
      {label}
      {sc != null && <span className="tr-mini-sc">{fmtSc(sc)}</span>}
      <span className="tr-mini-x">×</span>
    </span>
  )
}

// ── Position grouping helper ────────────────────────────────

const POS_ORDER = ['DEF', 'MID', 'RUC', 'FWD'] as const

function groupByPosition(players: Player[]): Record<string, Player[]> {
  const out: Record<string, Player[]> = { DEF: [], MID: [], RUC: [], FWD: [] }
  for (const p of players) {
    const primary = posPrimary(p.position)
    if (primary in out) out[primary].push(p)
    else out.MID.push(p)
  }
  // Sort within position by SC avg desc
  for (const k of Object.keys(out)) out[k].sort((a, b) => (b.sc_avg || 0) - (a.sc_avg || 0))
  return out
}

// ── Main page ──────────────────────────────────────────────

export function TradeProposePage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<ProposeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [givePlayerIds, setGivePlayerIds] = useState<Set<number>>(new Set())
  const [givePickIds, setGivePickIds] = useState<Set<number>>(new Set())
  const [receivePlayerIds, setReceivePlayerIds] = useState<Set<number>>(new Set())
  const [receivePickIds, setReceivePickIds] = useState<Set<number>>(new Set())
  const [recipientId, setRecipientId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [period, setPeriod] = useState<'midseason' | 'offseason'>('midseason')

  const [theirAssets, setTheirAssets] = useState<TeamAssets | null>(null)
  const [loadingTheir, setLoadingTheir] = useState(false)

  // Countdown ticker — re-renders the banner every 60s so the countdown stays fresh
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    api<ProposeData>(`/leagues/${leagueId}/trades/propose?format=json`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [leagueId])

  useEffect(() => {
    if (!recipientId) { setTheirAssets(null); return }
    setLoadingTheir(true)
    setReceivePlayerIds(new Set())
    setReceivePickIds(new Set())
    Promise.all([
      api<Player[]>(`/leagues/${leagueId}/trades/api/roster/${recipientId}`),
      api<Pick[]>(`/leagues/${leagueId}/trades/api/picks/${recipientId}`),
    ])
      .then(([players, picks]) => setTheirAssets({ players, picks }))
      .catch(e => setError(e.message))
      .finally(() => setLoadingTheir(false))
  }, [recipientId, leagueId])

  // Derived state for the deal preview
  const givePlayers = useMemo(
    () => (data?.my_players ?? []).filter(p => givePlayerIds.has(p.id)),
    [data, givePlayerIds]
  )
  const receivePlayers = useMemo(
    () => (theirAssets?.players ?? []).filter(p => receivePlayerIds.has(p.id)),
    [theirAssets, receivePlayerIds]
  )
  const givePicks = useMemo(
    () => (data?.my_picks ?? []).filter(p => givePickIds.has(p.id)),
    [data, givePickIds]
  )
  const receivePicks = useMemo(
    () => (theirAssets?.picks ?? []).filter(p => receivePickIds.has(p.id)),
    [theirAssets, receivePickIds]
  )
  const outCount = givePlayers.length + givePicks.length
  const inCount = receivePlayers.length + receivePicks.length
  const giveSc = givePlayers.reduce((s, p) => s + (p.sc_avg || 0), 0)
  const recvSc = receivePlayers.reduce((s, p) => s + (p.sc_avg || 0), 0)
  const scDelta = recvSc - giveSc
  const rosterDelta = receivePlayers.length - givePlayers.length
  const hasAny = outCount > 0 || inCount > 0

  if (loading) return <Spinner text="Loading..." />
  if (error && !data) return <p className="text-danger">{error}</p>
  if (!data) return <p className="text-danger">Failed to load trade propose</p>

  const { league, user_team, trade_window_open, trade_close_at, team_logos, other_teams, my_players, my_picks } = data
  const recipientTeam = other_teams.find(t => t.id === recipientId) ?? null
  const countdown = fmtCountdown(trade_close_at)
  // Force `tick` reference so React tracks it as dep without lint complaint
  void tick

  function toggle(set: Set<number>, id: number, setter: (s: Set<number>) => void) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id); else next.add(id)
    setter(next)
  }

  function clearAll() {
    setGivePlayerIds(new Set())
    setGivePickIds(new Set())
    setReceivePlayerIds(new Set())
    setReceivePickIds(new Set())
  }

  async function submit() {
    if (!recipientId) { setError('Pick a team to trade with first.'); return }
    if (!hasAny) { setError('Add at least one player or pick to the deal.'); return }
    setSaving(true); setError(null)
    try {
      const form = new FormData()
      form.set('recipient_team_id', String(recipientId))
      form.set('intended_period', period)
      form.set('notes', notes)
      givePlayerIds.forEach(id => form.append('give_player_ids', String(id)))
      givePickIds.forEach(id => form.append('give_pick_ids', String(id)))
      receivePlayerIds.forEach(id => form.append('receive_player_ids', String(id)))
      receivePickIds.forEach(id => form.append('receive_pick_ids', String(id)))
      const res = await fetch(`/leagues/${leagueId}/trades/propose`, {
        method: 'POST', body: form, credentials: 'include', redirect: 'manual',
      })
      if (res.status >= 500) throw new Error(`Server error: ${res.status}`)
      navigate(`/leagues/${leagueId}/trades`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const myByPos = groupByPosition(my_players)
  const theirByPos = theirAssets ? groupByPosition(theirAssets.players) : null

  return (
    <div style={{ paddingBottom: hasAny ? 40 : 24 }}>
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}`}>{league.name}</Link>
          {' / '}<Link to={`/leagues/${leagueId}/trades`}>Trades</Link>
          {' / '}Propose
        </div>
        <div className="d-flex align-items-center gap-3">
          <Link to={`/leagues/${leagueId}/trades`} className="btn btn-sm btn-outline-secondary" style={{ padding: '4px 10px' }}>
            <i className="bi bi-arrow-left"></i>
          </Link>
          <h2 className="mb-0">Build a Trade</h2>
        </div>
      </div>

      {/* Window status banner */}
      {trade_window_open ? (
        <div className="tr-window-banner">
          <div className="tr-window-banner-icon"><i className="bi bi-unlock-fill"></i></div>
          <div className="tr-window-banner-body">
            <div className="tr-window-banner-title">Trade window open</div>
            <div className="tr-window-banner-sub">Uneven trades allowed — build whatever shape you want.</div>
          </div>
          {countdown && (
            <div className="tr-window-banner-countdown" title={`Closes ${new Date(trade_close_at!).toLocaleString()}`}>
              <i className="bi bi-clock me-1"></i>{countdown}
            </div>
          )}
        </div>
      ) : (
        <div className="tr-window-banner tr-window-banner-closed">
          <div className="tr-window-banner-icon"><i className="bi bi-info-circle-fill"></i></div>
          <div className="tr-window-banner-body">
            <div className="tr-window-banner-title">Trade window closed</div>
            <div className="tr-window-banner-sub">You can still propose — accepted trades auto-execute when the window opens.</div>
          </div>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── THE DEAL — sticky preview centerpiece ── */}
      <div style={{ position: 'sticky', top: 8, zIndex: 30, marginBottom: 22 }}>
        <div className="tr-deal">
          <div className="tr-deal-header">
            <div className="tr-deal-title">The deal</div>
            <div className="tr-deal-balance">
              <span><b>{outCount}</b> out · <b>{inCount}</b> in</span>
              <span className="text-secondary" style={{ color: '#484f58' }}>·</span>
              <span className={rosterDelta > 0 ? 'tr-bal-pos' : rosterDelta < 0 ? 'tr-bal-neg' : ''}>
                Roster {rosterDelta > 0 ? '+' : ''}{rosterDelta}
              </span>
              {(givePlayers.length > 0 || receivePlayers.length > 0) && (
                <>
                  <span className="text-secondary" style={{ color: '#484f58' }}>·</span>
                  <span className={scDelta > 0 ? 'tr-bal-pos' : scDelta < 0 ? 'tr-bal-neg' : ''}>
                    SC {scDelta > 0 ? '+' : ''}{Math.round(scDelta)}
                  </span>
                </>
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              {hasAny && (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearAll}
                  style={{ padding: '3px 10px', fontSize: '.74rem' }}>
                  Clear
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={submit}
                disabled={saving || !recipientId || !hasAny}
                style={{ padding: '6px 16px', fontSize: '.85rem', fontWeight: 700 }}
              >
                {saving ? 'Sending…' : <><i className="bi bi-send me-1"></i>Send proposal</>}
              </button>
            </div>
          </div>
          <div className="tr-deal-grid">
            <div className="tr-deal-side tr-deal-side-out">
              <div className="tr-deal-side-label">You send</div>
              <div className="tr-deal-side-team">{user_team.name}</div>
              {outCount === 0 ? (
                <div className="tr-deal-empty">Click cards below to send →</div>
              ) : (
                <div className="tr-deal-cards">
                  {givePlayers.map(p => (
                    <MiniChip key={p.id} label={p.name} kind="out" sc={p.sc_avg}
                      onRemove={() => toggle(givePlayerIds, p.id, setGivePlayerIds)} />
                  ))}
                  {givePicks.map(pk => (
                    <MiniChip key={pk.id} label={`${pk.year} R${pk.round_number}`} kind="out"
                      onRemove={() => toggle(givePickIds, pk.id, setGivePickIds)} />
                  ))}
                </div>
              )}
            </div>
            <div className="tr-deal-arrow"><i className="bi bi-arrow-left-right"></i></div>
            <div className="tr-deal-side tr-deal-side-in">
              <div className="tr-deal-side-label">You receive</div>
              <div className="tr-deal-side-team">{recipientTeam ? recipientTeam.name : 'Pick a team below'}</div>
              {inCount === 0 ? (
                <div className="tr-deal-empty">
                  {recipientTeam ? '← Click cards from their roster' : 'Choose a trade partner first'}
                </div>
              ) : (
                <div className="tr-deal-cards">
                  {receivePlayers.map(p => (
                    <MiniChip key={p.id} label={p.name} kind="in" sc={p.sc_avg}
                      onRemove={() => toggle(receivePlayerIds, p.id, setReceivePlayerIds)} />
                  ))}
                  {receivePicks.map(pk => (
                    <MiniChip key={pk.id} label={`${pk.year} R${pk.round_number}`} kind="in"
                      onRemove={() => toggle(receivePickIds, pk.id, setReceivePickIds)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Team picker — cards, not dropdown ── */}
      {!recipientId && (
        <div className="tr-panel mb-3">
          <div className="tr-panel-h">
            <div className="tr-panel-title">
              <span><i className="bi bi-people-fill me-2" style={{ color: '#79c0ff' }}></i>Choose a trade partner</span>
              <span className="text-secondary" style={{ fontSize: '.74rem', fontWeight: 500 }}>{other_teams.length} teams</span>
            </div>
            <div className="tr-panel-sub">Pick the team you want to send this trade to.</div>
          </div>
          <div className="tr-panel-body">
            <div className="tr-team-grid">
              {other_teams.map(t => (
                <button key={t.id} type="button" className="tr-team-pick"
                  onClick={() => setRecipientId(t.id)}>
                  <span className="tr-team-pick-logo">
                    {t.logo_url ? <img src={t.logo_url} alt="" /> : teamInitials(t.name)}
                  </span>
                  <span>
                    <div className="tr-team-pick-name">{t.name}</div>
                    <div className="tr-team-pick-owner">{t.owner}</div>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Show selected partner with a "change" button when set */}
      {recipientId && recipientTeam && (
        <div className="d-flex align-items-center justify-content-between mb-3 px-3 py-2"
          style={{ background: 'rgba(63,185,80,.06)', border: '1px solid rgba(63,185,80,.25)', borderRadius: 10 }}>
          <div className="d-flex align-items-center gap-2">
            <span className="tr-team-pick-logo" style={{ width: 28, height: 28, flex: '0 0 28px' }}>
              {recipientTeam.logo_url ? <img src={recipientTeam.logo_url} alt="" /> : teamInitials(recipientTeam.name)}
            </span>
            <div>
              <div style={{ fontSize: '.88rem', fontWeight: 600, color: '#f0f6fc' }}>{recipientTeam.name}</div>
              <div style={{ fontSize: '.72rem', color: '#8b949e' }}>Trading with {recipientTeam.owner}</div>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-outline-secondary"
            onClick={() => setRecipientId(null)} style={{ padding: '3px 10px', fontSize: '.76rem' }}>
            Change
          </button>
        </div>
      )}

      {/* ── Decks: your roster + their roster ── */}
      <div className="row g-3">
        {/* YOUR ROSTER */}
        <div className="col-lg-6">
          <div className="tr-panel">
            <div className="tr-panel-h tr-panel-h-out">
              <div className="tr-panel-title">
                <span><i className="bi bi-box-arrow-up-right me-2" style={{ color: '#f85149' }}></i>Your roster</span>
                <span className="text-secondary" style={{ fontSize: '.74rem', fontWeight: 500 }}>
                  {my_players.length + my_picks.length} assets
                </span>
              </div>
              <div className="tr-panel-sub">Click any card to add it to <strong style={{ color: '#ffb4ae' }}>You send</strong>.</div>
            </div>
            <div className="tr-panel-body">
              {POS_ORDER.map(pos => {
                const list = myByPos[pos]
                if (!list || list.length === 0) return null
                return (
                  <div key={pos}>
                    <div className="tr-section-h">
                      <span className="tr-section-h-label">
                        <span className={`pos-badge pos-${pos}`}>{pos}</span>
                        {pos === 'DEF' ? 'Defenders' : pos === 'MID' ? 'Midfielders' : pos === 'RUC' ? 'Rucks' : 'Forwards'}
                      </span>
                      <span className="tr-section-h-bar" />
                      <span className="tr-section-h-count">{list.length}</span>
                    </div>
                    <div className="tr-deck">
                      {list.map(p => (
                        <PlayerCard
                          key={p.id}
                          player={p}
                          state={givePlayerIds.has(p.id) ? 'out' : 'idle'}
                          logoUrl={team_logos[p.afl_team || '']}
                          onClick={() => toggle(givePlayerIds, p.id, setGivePlayerIds)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
              {my_picks.length > 0 && (
                <div>
                  <div className="tr-section-h">
                    <span className="tr-section-h-label"><i className="bi bi-ticket-perforated"></i>Draft picks</span>
                    <span className="tr-section-h-bar" />
                    <span className="tr-section-h-count">{my_picks.length}</span>
                  </div>
                  <div className="tr-deck">
                    {my_picks.map(pk => (
                      <PickCard
                        key={pk.id}
                        pick={pk}
                        state={givePickIds.has(pk.id) ? 'out' : 'idle'}
                        onClick={() => toggle(givePickIds, pk.id, setGivePickIds)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* THEIR ROSTER */}
        <div className="col-lg-6">
          <div className="tr-panel">
            <div className="tr-panel-h tr-panel-h-in">
              <div className="tr-panel-title">
                <span><i className="bi bi-box-arrow-in-down-left me-2" style={{ color: '#3fb950' }}></i>
                  {recipientTeam ? `${recipientTeam.name}'s roster` : 'Their roster'}
                </span>
                {theirAssets && (
                  <span className="text-secondary" style={{ fontSize: '.74rem', fontWeight: 500 }}>
                    {theirAssets.players.length + theirAssets.picks.length} assets
                  </span>
                )}
              </div>
              <div className="tr-panel-sub">
                {recipientTeam
                  ? <>Click any card to add it to <strong style={{ color: '#7ee787' }}>You receive</strong>.</>
                  : 'Pick a trade partner above to see their roster.'}
              </div>
            </div>
            <div className="tr-panel-body">
              {!recipientId ? (
                <div className="text-center" style={{ padding: '32px 20px', color: '#484f58' }}>
                  <i className="bi bi-people" style={{ fontSize: '2rem' }}></i>
                  <p className="mt-3 mb-0" style={{ fontSize: '.86rem' }}>Choose a team above to see their players</p>
                </div>
              ) : loadingTheir || !theirAssets || !theirByPos ? (
                <Spinner text="Loading roster..." />
              ) : (
                <>
                  {POS_ORDER.map(pos => {
                    const list = theirByPos[pos]
                    if (!list || list.length === 0) return null
                    return (
                      <div key={pos}>
                        <div className="tr-section-h">
                          <span className="tr-section-h-label">
                            <span className={`pos-badge pos-${pos}`}>{pos}</span>
                            {pos === 'DEF' ? 'Defenders' : pos === 'MID' ? 'Midfielders' : pos === 'RUC' ? 'Rucks' : 'Forwards'}
                          </span>
                          <span className="tr-section-h-bar" />
                          <span className="tr-section-h-count">{list.length}</span>
                        </div>
                        <div className="tr-deck">
                          {list.map(p => (
                            <PlayerCard
                              key={p.id}
                              player={p}
                              state={receivePlayerIds.has(p.id) ? 'in' : 'idle'}
                              logoUrl={team_logos[p.afl_team || '']}
                              onClick={() => toggle(receivePlayerIds, p.id, setReceivePlayerIds)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {theirAssets.picks.length > 0 && (
                    <div>
                      <div className="tr-section-h">
                        <span className="tr-section-h-label"><i className="bi bi-ticket-perforated"></i>Draft picks</span>
                        <span className="tr-section-h-bar" />
                        <span className="tr-section-h-count">{theirAssets.picks.length}</span>
                      </div>
                      <div className="tr-deck">
                        {theirAssets.picks.map(pk => (
                          <PickCard
                            key={pk.id}
                            pick={pk}
                            state={receivePickIds.has(pk.id) ? 'in' : 'idle'}
                            onClick={() => toggle(receivePickIds, pk.id, setReceivePickIds)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Optional note + period selector */}
      <div className="card mt-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-5">
              <label htmlFor="intended_period" className="form-label">Trade period</label>
              <select
                className="form-select form-select-sm"
                id="intended_period"
                value={period}
                onChange={e => setPeriod(e.target.value as 'midseason' | 'offseason')}
              >
                <option value="midseason">Mid-season</option>
                <option value="offseason">End of season</option>
              </select>
              <div className="form-text" style={{ fontSize: '.7rem', color: '#484f58' }}>
                Which trade window should this execute in.
              </div>
            </div>
            <div className="col-md-7">
              <label htmlFor="notes" className="form-label">
                Message <span className="text-secondary" style={{ fontSize: '.75rem' }}>(optional)</span>
              </label>
              <textarea
                className="form-control"
                id="notes"
                rows={2}
                placeholder="Add a note for the other manager..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
