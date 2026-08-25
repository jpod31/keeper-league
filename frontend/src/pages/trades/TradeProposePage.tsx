/**
 * Build a Trade.
 *
 * Structured as the three decisions you actually make, in order: who you're
 * trading with, what moves, then send it. The deal itself lives in a sticky
 * bar at the FOOT of the page — a cart, not a billboard — so an empty deal
 * costs one line instead of half the screen, and the rosters (the part you
 * came to read) sit above the fold.
 *
 * Balance is read in keeper-league terms: list size against the cap, scoring,
 * and the age of what you're swapping.
 */

import { useParams, Link, useNavigate, useSearchParams } from 'react-router'
import { useState, useEffect, useMemo, useRef } from 'react'
import { api } from '../../lib/api'
import { TradeProposeSkeleton } from '../../components/ui/TradeProposeSkeleton'
import './trade-propose.css'

interface Team {
  id: number; name: string; owner?: string; logo_url?: string | null
  roster_count?: number; record?: string | null; percentage?: number | null
}
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
  league: { id: number; name: string; squad_size?: number }
  user_team: Team
  trade_window_open: boolean
  trade_close_at: string | null
  trade_window_label: string | null
  team_logos: Record<string, string>
  other_teams: Team[]
  my_players: Player[]
  my_picks: Pick[]
}

interface TeamAssets { players: Player[]; picks: Pick[] }

type Side = 'out' | 'in'
type SortKey = 'sc' | 'rating' | 'age' | 'name'

const POS_ORDER = ['DEF', 'MID', 'RUC', 'FWD'] as const

function posPrimary(pos: string): string {
  return (pos || 'MID').split('/')[0].toUpperCase()
}
function fmtSc(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return String(Math.round(n))
}
function teamInitials(name: string): string {
  if (!name) return '·'
  const w = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  if (w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase()
  return (w[0] || '·').slice(0, 2).toUpperCase()
}
function fmtCountdown(closeAt: string | null): string | null {
  if (!closeAt) return null
  const ms = new Date(closeAt).getTime() - Date.now()
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

/* ── Small pieces ──────────────────────────────────────────── */

function Crest({ team, size = 34 }: { team: Team; size?: number }) {
  const [failed, setFailed] = useState(false)
  const show = team.logo_url && !failed
  return (
    <span className="tp-crest" style={{ width: size, height: size, flex: `0 0 ${size}px` }}>
      {show
        ? <img src={team.logo_url!} alt="" onError={() => setFailed(true)} />
        : <span style={{ fontSize: size * 0.34 }}>{teamInitials(team.name)}</span>}
    </span>
  )
}

function ClubMark({ club, logos }: { club?: string; logos: Record<string, string> }) {
  const src = club ? logos[club] : undefined
  const [failed, setFailed] = useState(false)
  return (
    <span className="tp-club" title={club || ''}>
      {src && !failed
        ? <img src={src} alt="" onError={() => setFailed(true)} />
        : <i className="bi bi-shield-fill" />}
    </span>
  )
}

function AssetRow({
  player, pick, side, picked, logos, onToggle,
}: {
  player?: Player
  pick?: Pick
  side: Side
  picked: boolean
  logos: Record<string, string>
  onToggle: () => void
}) {
  const isPick = !!pick
  const pos = player ? posPrimary(player.position) : ''
  return (
    <button
      type="button"
      className={`tp-row${picked ? ` tp-row-picked tp-row-${side}` : ''}${isPick ? ' tp-row-pick' : ''}`}
      onClick={onToggle}
      aria-pressed={picked}
    >
      {isPick
        ? <span className="tp-club tp-club-pick"><i className="bi bi-ticket-perforated" /></span>
        : <ClubMark club={player!.afl_team} logos={logos} />}

      <span className="tp-row-body">
        <span className="tp-row-name">
          {isPick ? `${pick!.year} · Round ${pick!.round_number}` : player!.name}
        </span>
        <span className="tp-row-meta">
          {isPick
            ? (pick!.is_own ? 'Own pick' : `via ${pick!.original_team}`)
            : <>
                <span className={`tp-pos tp-pos-${pos}`}>{player!.position || pos}</span>
                <span className="tp-row-club">{player!.afl_team}</span>
              </>}
        </span>
      </span>

      {!isPick && (
        <span className="tp-row-stats">
          <span className="tp-stat"><b>{fmtSc(player!.sc_avg)}</b><i>SC</i></span>
          <span className="tp-stat"><b>{player!.rating ?? '—'}</b><i>RTG</i></span>
          <span className="tp-stat"><b>{player!.age || '—'}</b><i>AGE</i></span>
        </span>
      )}

      <span className={`tp-row-tick${picked ? ' on' : ''}`}>
        <i className={`bi ${picked ? (side === 'out' ? 'bi-dash-lg' : 'bi-plus-lg') : 'bi-plus'}`} />
      </span>
    </button>
  )
}

/* ── Asset board (one side) ────────────────────────────────── */

function AssetBoard({
  title, sub, side, team, players, picks, pickedPlayers, pickedPicks,
  logos, onTogglePlayer, onTogglePick, empty,
}: {
  title: string
  sub: string
  side: Side
  team?: Team | null
  players: Player[]
  picks: Pick[]
  pickedPlayers: Set<number>
  pickedPicks: Set<number>
  logos: Record<string, string>
  onTogglePlayer: (id: number) => void
  onTogglePick: (id: number) => void
  empty?: React.ReactNode
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<string>('ALL')
  const [sort, setSort] = useState<SortKey>('sc')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = players.filter(p => {
      if (filter !== 'ALL' && filter !== 'PICK' && posPrimary(p.position) !== filter) return false
      if (!needle) return true
      return p.name.toLowerCase().includes(needle)
        || (p.afl_team || '').toLowerCase().includes(needle)
    })
    list = [...list].sort((a, b) => {
      if (sort === 'sc') return (b.sc_avg || 0) - (a.sc_avg || 0)
      if (sort === 'rating') return (b.rating || 0) - (a.rating || 0)
      if (sort === 'age') return (a.age || 99) - (b.age || 99)
      return a.name.localeCompare(b.name)
    })
    return list
  }, [players, q, filter, sort])

  const showPicks = picks.length > 0 && (filter === 'ALL' || filter === 'PICK') && !q.trim()
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: players.length, PICK: picks.length }
    for (const p of POS_ORDER) c[p] = players.filter(x => posPrimary(x.position) === p).length
    return c
  }, [players, picks])

  return (
    <section className={`tp-board tp-board-${side}`}>
      <header className="tp-board-h">
        <div className="tp-board-title">
          {team && <Crest team={team} size={28} />}
          <div>
            <h3>{title}</h3>
            <p>{sub}</p>
          </div>
        </div>
        <span className="tp-board-count">{players.length + picks.length}</span>
      </header>

      {empty ?? (
        <>
          <div className="tp-board-tools">
            <label className="tp-search">
              <i className="bi bi-search" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search name or club"
                aria-label={`Search ${title}`}
              />
              {q && <button type="button" onClick={() => setQ('')} aria-label="Clear"><i className="bi bi-x" /></button>}
            </label>
            <select
              className="tp-sort"
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              aria-label="Sort by"
            >
              <option value="sc">Top SC</option>
              <option value="rating">Top rating</option>
              <option value="age">Youngest</option>
              <option value="name">A–Z</option>
            </select>
          </div>

          <div className="tp-chips">
            {(['ALL', ...POS_ORDER] as string[]).concat(picks.length ? ['PICK'] : []).map(f => (
              <button
                key={f}
                type="button"
                className={`tp-chip${filter === f ? ' on' : ''}`}
                onClick={() => setFilter(f)}
                disabled={counts[f] === 0}
              >
                {f === 'ALL' ? 'All' : f === 'PICK' ? 'Picks' : f}
                <span>{counts[f] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="tp-board-list">
            {shown.length === 0 && !showPicks && (
              <p className="tp-board-none">Nothing matches “{q}”.</p>
            )}
            {shown.map(p => (
              <AssetRow
                key={p.id} player={p} side={side} logos={logos}
                picked={pickedPlayers.has(p.id)}
                onToggle={() => onTogglePlayer(p.id)}
              />
            ))}
            {showPicks && picks.map(pk => (
              <AssetRow
                key={`pk-${pk.id}`} pick={pk} side={side} logos={logos}
                picked={pickedPicks.has(pk.id)}
                onToggle={() => onTogglePick(pk.id)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/* ── Page ──────────────────────────────────────────────────── */

export function TradeProposePage() {
  const { leagueId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const deepLinkWith = Number(searchParams.get('with')) || null
  const deepLinkFrom = Number(searchParams.get('from')) || null
  const deepLinkApplied = useRef(false)

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
  const [period, setPeriod] = useState<'midseason' | 'offseason'>('offseason')
  const [noteOpen, setNoteOpen] = useState(false)

  const [theirAssets, setTheirAssets] = useState<TeamAssets | null>(null)
  const [loadingTheir, setLoadingTheir] = useState(false)

  const [, setTick] = useState(0)
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
    if (deepLinkApplied.current || !data || !deepLinkFrom) return
    setRecipientId(deepLinkFrom)
  }, [data, deepLinkFrom])

  useEffect(() => {
    if (!recipientId) { setTheirAssets(null); return }
    setLoadingTheir(true)
    setReceivePlayerIds(new Set())
    setReceivePickIds(new Set())
    Promise.all([
      api<Player[]>(`/leagues/${leagueId}/trades/api/roster/${recipientId}`),
      api<Pick[]>(`/leagues/${leagueId}/trades/api/picks/${recipientId}`),
    ])
      .then(([players, picks]) => {
        setTheirAssets({ players, picks })
        // Deep-link from "trade for this player" elsewhere in the app lands
        // the player straight in the receive side once their list resolves.
        if (!deepLinkApplied.current && deepLinkWith
            && players.some(p => p.id === deepLinkWith)) {
          setReceivePlayerIds(new Set([deepLinkWith]))
        }
        deepLinkApplied.current = true
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingTheir(false))
  }, [recipientId, leagueId, deepLinkWith])

  function toggle(set: Set<number>, id: number, setter: (s: Set<number>) => void) {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
  }
  function clearAll() {
    setGivePlayerIds(new Set()); setGivePickIds(new Set())
    setReceivePlayerIds(new Set()); setReceivePickIds(new Set())
  }

  const givePlayers = useMemo(
    () => (data?.my_players || []).filter(p => givePlayerIds.has(p.id)), [data, givePlayerIds])
  const givePicks = useMemo(
    () => (data?.my_picks || []).filter(p => givePickIds.has(p.id)), [data, givePickIds])
  const receivePlayers = useMemo(
    () => (theirAssets?.players || []).filter(p => receivePlayerIds.has(p.id)), [theirAssets, receivePlayerIds])
  const receivePicks = useMemo(
    () => (theirAssets?.picks || []).filter(p => receivePickIds.has(p.id)), [theirAssets, receivePickIds])

  async function submit() {
    if (!recipientId) return
    setSaving(true); setError(null)
    const fd = new FormData()
    fd.set('recipient_team_id', String(recipientId))
    givePlayerIds.forEach(id => fd.append('give_player_ids', String(id)))
    receivePlayerIds.forEach(id => fd.append('receive_player_ids', String(id)))
    givePickIds.forEach(id => fd.append('give_pick_ids', String(id)))
    receivePickIds.forEach(id => fd.append('receive_pick_ids', String(id)))
    fd.set('notes', notes)
    fd.set('intended_period', period)
    try {
      const res = await fetch(`/leagues/${leagueId}/trades/propose`, {
        method: 'POST', body: fd, credentials: 'same-origin',
      })
      if (!res.ok) throw new Error(`Could not send the proposal (${res.status})`)
      navigate(`/leagues/${leagueId}/trades`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <TradeProposeSkeleton />
  if (error && !data) return <div className="container py-4"><div className="alert alert-danger">{error}</div></div>
  if (!data) return null

  const {
    league, user_team, other_teams, my_players, my_picks,
    team_logos, trade_window_open, trade_close_at, trade_window_label,
  } = data
  const recipientTeam = other_teams.find(t => t.id === recipientId) || null
  const countdown = fmtCountdown(trade_close_at)

  const outCount = givePlayers.length + givePicks.length
  const inCount = receivePlayers.length + receivePicks.length
  const hasAny = outCount + inCount > 0

  const sum = (a: Player[], f: (p: Player) => number) => a.reduce((t, p) => t + (f(p) || 0), 0)
  const avg = (a: Player[], f: (p: Player) => number) => a.length ? sum(a, f) / a.length : 0
  const scDelta = sum(receivePlayers, p => p.sc_avg) - sum(givePlayers, p => p.sc_avg)
  const ageDelta = avg(receivePlayers, p => p.age || 0) - avg(givePlayers, p => p.age || 0)
  const listNow = user_team.roster_count ?? my_players.length
  const listAfter = listNow - outCount + inCount

  const ownerLine = (t: Team) =>
    t.owner && t.owner.toLowerCase() !== t.name.toLowerCase() ? t.owner : null

  return (
    <div className="container py-3 tp-page">
      <div className="tp-top">
        <div className="tp-top-l">
          <Link to={`/leagues/${leagueId}/trades`} className="tp-back" aria-label="Back to trades">
            <i className="bi bi-arrow-left" />
          </Link>
          <div>
            <div className="tp-crumb">
              <Link to={`/leagues/${leagueId}`}>{league.name}</Link> / Trades
            </div>
            <h1>Build a trade</h1>
          </div>
        </div>
        <div className={`tp-window${trade_window_open ? ' open' : ''}`}>
          <i className={`bi ${trade_window_open ? 'bi-unlock-fill' : 'bi-lock-fill'}`} />
          <span>
            <b>{trade_window_label || (trade_window_open ? 'Trade window open' : 'Trade window closed')}</b>
            <em>
              {trade_window_open
                ? (countdown || 'open now')
                : 'Propose anyway — it executes when the window opens'}
            </em>
          </span>
        </div>
      </div>

      {error && <div className="alert alert-danger tp-alert">{error}</div>}

      {/* ── Step 1: partner ── */}
      {!recipientTeam ? (
        <section className="tp-partners">
          <header>
            <h2>Who are you trading with?</h2>
            <p>Pick a club to see their list. You can change it at any time.</p>
          </header>
          <div className="tp-partner-grid">
            {other_teams.map(t => (
              <button key={t.id} type="button" className="tp-partner" onClick={() => setRecipientId(t.id)}>
                <Crest team={t} size={40} />
                <span className="tp-partner-body">
                  <span className="tp-partner-name">{t.name}</span>
                  {ownerLine(t) && <span className="tp-partner-owner">{ownerLine(t)}</span>}
                </span>
                <span className="tp-partner-stats">
                  {t.record && <span><b>{t.record}</b><i>W–L</i></span>}
                  <span><b>{t.roster_count ?? '—'}</b><i>LIST</i></span>
                </span>
                <i className="bi bi-chevron-right tp-partner-go" />
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="tp-partner-bar">
          <Crest team={user_team} size={30} />
          <span className="tp-partner-bar-name">{user_team.name}</span>
          <i className="bi bi-arrow-left-right tp-partner-bar-swap" />
          <Crest team={recipientTeam} size={30} />
          <span className="tp-partner-bar-name">{recipientTeam.name}</span>
          {ownerLine(recipientTeam) && (
            <span className="tp-partner-bar-owner">{ownerLine(recipientTeam)}</span>
          )}
          <button type="button" className="tp-change" onClick={() => { setRecipientId(null); clearAll() }}>
            Change
          </button>
        </div>
      )}

      {/* ── Step 2: the boards ── */}
      <div className="tp-boards">
        <AssetBoard
          title="You send" sub={`${user_team.name} · click to add`}
          side="out" team={user_team}
          players={my_players} picks={my_picks}
          pickedPlayers={givePlayerIds} pickedPicks={givePickIds}
          logos={team_logos}
          onTogglePlayer={id => toggle(givePlayerIds, id, setGivePlayerIds)}
          onTogglePick={id => toggle(givePickIds, id, setGivePickIds)}
        />
        <AssetBoard
          title="You receive"
          sub={recipientTeam ? `${recipientTeam.name} · click to add` : 'Choose a club first'}
          side="in" team={recipientTeam}
          players={theirAssets?.players || []} picks={theirAssets?.picks || []}
          pickedPlayers={receivePlayerIds} pickedPicks={receivePickIds}
          logos={team_logos}
          onTogglePlayer={id => toggle(receivePlayerIds, id, setReceivePlayerIds)}
          onTogglePick={id => toggle(receivePickIds, id, setReceivePickIds)}
          empty={!recipientTeam ? (
            <div className="tp-board-empty">
              <i className="bi bi-people" />
              <p>Pick a club above to load their list</p>
            </div>
          ) : loadingTheir ? (
            <div className="tp-board-empty"><p>Loading their list…</p></div>
          ) : undefined}
        />
      </div>

      {/* ── Step 3: the deal ── */}
      <div className={`tp-deal${hasAny ? ' full' : ''}`}>
        <div className="tp-deal-inner">
          <div className="tp-deal-assets">
            <div className="tp-deal-side out">
              <span className="tp-deal-label">Out {outCount > 0 && <b>{outCount}</b>}</span>
              <div className="tp-deal-chips">
                {givePlayers.map(p => (
                  <button key={p.id} type="button" className="tp-deal-chip"
                    onClick={() => toggle(givePlayerIds, p.id, setGivePlayerIds)} title="Remove">
                    <ClubMark club={p.afl_team} logos={team_logos} />
                    {p.name}<i className="bi bi-x" />
                  </button>
                ))}
                {givePicks.map(pk => (
                  <button key={pk.id} type="button" className="tp-deal-chip"
                    onClick={() => toggle(givePickIds, pk.id, setGivePickIds)} title="Remove">
                    <span className="tp-club tp-club-pick"><i className="bi bi-ticket-perforated" /></span>
                    {pk.year} R{pk.round_number}<i className="bi bi-x" />
                  </button>
                ))}
                {outCount === 0 && <span className="tp-deal-hint">nothing yet</span>}
              </div>
            </div>
            <i className="bi bi-arrow-left-right tp-deal-swap" />
            <div className="tp-deal-side in">
              <span className="tp-deal-label">In {inCount > 0 && <b>{inCount}</b>}</span>
              <div className="tp-deal-chips">
                {receivePlayers.map(p => (
                  <button key={p.id} type="button" className="tp-deal-chip"
                    onClick={() => toggle(receivePlayerIds, p.id, setReceivePlayerIds)} title="Remove">
                    <ClubMark club={p.afl_team} logos={team_logos} />
                    {p.name}<i className="bi bi-x" />
                  </button>
                ))}
                {receivePicks.map(pk => (
                  <button key={pk.id} type="button" className="tp-deal-chip"
                    onClick={() => toggle(receivePickIds, pk.id, setReceivePickIds)} title="Remove">
                    <span className="tp-club tp-club-pick"><i className="bi bi-ticket-perforated" /></span>
                    {pk.year} R{pk.round_number}<i className="bi bi-x" />
                  </button>
                ))}
                {inCount === 0 && <span className="tp-deal-hint">nothing yet</span>}
              </div>
            </div>
          </div>

          <div className="tp-deal-balance">
            <span className="tp-bal">
              <b>{listNow}<i className="bi bi-arrow-right" />{listAfter}</b>
              <i>LIST{league.squad_size ? ` /${league.squad_size}` : ''}</i>
            </span>
            <span className={`tp-bal${scDelta > 0 ? ' pos' : scDelta < 0 ? ' neg' : ''}`}>
              <b>{scDelta > 0 ? '+' : ''}{Math.round(scDelta)}</b><i>SC</i>
            </span>
            <span className={`tp-bal${ageDelta < 0 ? ' pos' : ageDelta > 0 ? ' neg' : ''}`}>
              <b>{ageDelta > 0 ? '+' : ''}{ageDelta.toFixed(1)}</b><i>AGE</i>
            </span>
          </div>

          <div className="tp-deal-actions">
            <select
              className="tp-period" value={period}
              onChange={e => setPeriod(e.target.value as 'midseason' | 'offseason')}
              aria-label="Trade period"
            >
              <option value="offseason">End of season</option>
              <option value="midseason">Mid-season</option>
            </select>
            <button type="button" className={`tp-note-btn${notes ? ' has' : ''}`}
              onClick={() => setNoteOpen(o => !o)} title="Add a message">
              <i className="bi bi-chat-left-text" />
            </button>
            {hasAny && <button type="button" className="tp-clear" onClick={clearAll}>Clear</button>}
            <button
              type="button" className="tp-send"
              onClick={submit}
              disabled={saving || !recipientId || !hasAny}
            >
              {saving ? 'Sending…' : <><i className="bi bi-send-fill" />Send proposal</>}
            </button>
          </div>
        </div>

        {noteOpen && (
          <div className="tp-note">
            <textarea
              rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Add a message for the other manager…"
              aria-label="Message"
            />
          </div>
        )}
      </div>
    </div>
  )
}
