import { useParams, Link } from 'react-router'
import { useState, useEffect, useMemo } from 'react'
import { api } from '../../lib/api'
import { Spinner } from '../../components/ui/Spinner'

interface Player {
  id: number
  name: string
  position: string
  afl_team: string
  age: number | null
  sc_avg: number
  injury_severity: string | null
}

interface TeamData {
  league: { id: number; name: string }
  team: { id: number; name: string; logo_url: string | null }
  afl_round: number
  year: number
  age_cutoff: number
  selected_ids: number[]
  captain_id: number | null
  locked_ids: number[]
  teams_playing: string[]
  players: Player[]
}

const S7T_CSS = `
.sevens-hero { padding:24px 20px 16px; margin-bottom:20px; background:linear-gradient(135deg, rgba(31,111,235,.08), rgba(188,140,255,.06)); border:1px solid #21262d; border-radius:12px; }
.sevens-hero-title { font-size:1.3rem; font-weight:700; color:#e6edf3; margin:0; }
.sevens-hero-sub { font-size:.8rem; color:#8b949e; margin-top:4px; }
.sevens-rule-badge { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:8px; font-size:.75rem; font-weight:600; background:rgba(188,140,255,.1); color:#bc8cff; border:1px solid rgba(188,140,255,.2); margin-top:10px; }
.sevens-counter { display:flex; gap:16px; margin-top:12px; flex-wrap:wrap; }
.sevens-counter-item { font-size:.75rem; color:#8b949e; }
.sevens-counter-item strong { color:#e6edf3; }
.sevens-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; }
@media (max-width:991px) { .sevens-grid { grid-template-columns:1fr; } }
.sevens-panel { background:#0d1117; border:1px solid #21262d; border-radius:10px; overflow:hidden; }
.sevens-panel-hdr { padding:12px 16px; border-bottom:1px solid #21262d; font-size:.8rem; font-weight:600; color:#e6edf3; display:flex; justify-content:space-between; align-items:center; }
.sevens-panel-body { padding:0; }
.sevens-player-row { display:flex; align-items:center; padding:10px 16px; gap:10px; border-bottom:1px solid #161b22; cursor:pointer; transition:background .1s; }
.sevens-player-row:last-child { border-bottom:none; }
.sevens-player-row:hover { background:#161b22; }
.sevens-player-row.selected { background:rgba(31,111,235,.08); }
.sevens-player-row.locked { opacity:.5; cursor:not-allowed; }
.sevens-player-name { flex:1; font-size:.82rem; font-weight:500; color:#c9d1d9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sevens-player-meta { font-size:.7rem; color:#6e7681; white-space:nowrap; }
.sevens-age-badge { font-size:.65rem; font-weight:700; padding:2px 6px; border-radius:4px; display:inline-block; min-width:32px; text-align:center; }
.age-young { background:rgba(63,185,80,.12); color:#3fb950; }
.age-senior { background:rgba(210,153,34,.12); color:#d29922; }
.sevens-sc { font-size:.75rem; font-weight:600; min-width:36px; text-align:right; }
.sevens-cap-star { cursor:pointer; font-size:.9rem; color:#30363d; transition:color .15s; }
.sevens-cap-star.active { color:#FFD700; text-shadow:0 0 6px rgba(255,215,0,.4); }
.sevens-cap-star:hover { color:#d29922; }
.sevens-check { width:18px; height:18px; border-radius:4px; border:2px solid #30363d; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .15s; }
.sevens-check.checked { background:#1f6feb; border-color:#1f6feb; }
.sevens-check.checked::after { content:'✓'; color:#fff; font-size:.7rem; font-weight:700; }
.sevens-lock-icon { color:#484f58; font-size:.75rem; }
.sevens-actions { display:flex; gap:10px; margin-top:16px; flex-wrap:wrap; }
.sevens-btn { padding:8px 20px; border-radius:8px; font-size:.8rem; font-weight:600; border:1px solid; cursor:pointer; transition:all .15s; }
.sevens-btn-primary { background:#1f6feb; border-color:#1f6feb; color:#fff; }
.sevens-btn-primary:hover:not(:disabled) { background:#388bfd; }
.sevens-btn-primary:disabled { opacity:.4; cursor:not-allowed; }
.sevens-btn-secondary { background:transparent; border-color:#30363d; color:#8b949e; text-decoration:none; display:inline-flex; align-items:center; }
.sevens-btn-secondary:hover { border-color:#484f58; color:#c9d1d9; }
.sevens-feedback { margin-top:10px; padding:8px 14px; border-radius:6px; font-size:.78rem; }
.sevens-feedback.error { background:rgba(248,81,73,.1); color:#f85149; border:1px solid rgba(248,81,73,.2); }
.sevens-feedback.success { background:rgba(63,185,80,.1); color:#3fb950; border:1px solid rgba(63,185,80,.2); }
.sevens-filter-bar { display:flex; gap:8px; padding:8px 16px; border-bottom:1px solid #21262d; }
.sevens-filter-input { flex:1; background:#0d1117; border:1px solid #30363d; border-radius:6px; padding:5px 10px; font-size:.75rem; color:#c9d1d9; outline:none; }
.sevens-filter-input:focus { border-color:#484f58; }
`

export function Reserve7sTeamPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [captainId, setCaptainId] = useState<number | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api<TeamData>(`/leagues/${leagueId}/reserve7s/team?format=json`)
      .then(d => {
        setData(d)
        setSelected(new Set(d.selected_ids))
        setCaptainId(d.captain_id)
      })
      .finally(() => setLoading(false))
  }, [leagueId])

  const sortedPlayers = useMemo(() => {
    if (!data) return []
    return [...data.players].sort((a, b) => (a.age || 99) - (b.age || 99))
  }, [data])

  const filteredPlayers = useMemo(() => {
    const needle = filter.toLowerCase().trim()
    if (!needle) return sortedPlayers
    return sortedPlayers.filter(p => p.name.toLowerCase().includes(needle))
  }, [sortedPlayers, filter])

  if (loading) return <Spinner text="Loading 7s team..." />
  if (!data) return <p className="text-danger">Failed to load 7s team</p>

  const { league, team, afl_round, age_cutoff, locked_ids } = data
  const lockedSet = new Set(locked_ids)
  const isYoung = (p: Player) => (p.age || 99) < age_cutoff

  const selectedPlayers = sortedPlayers.filter(p => selected.has(p.id))
  const youngCount = selectedPlayers.filter(isYoung).length
  const seniorCount = selectedPlayers.length - youngCount
  const canSave = selected.size === 7 && youngCount >= 5 && seniorCount <= 2

  function togglePlayer(p: Player) {
    if (lockedSet.has(p.id) && selected.has(p.id)) return
    const next = new Set(selected)
    if (next.has(p.id)) {
      next.delete(p.id)
      if (captainId === p.id) setCaptainId(null)
    } else {
      if (next.size >= 7) return
      if (!isYoung(p) && seniorCount >= 2) {
        setFeedback({ kind: 'error', text: 'Maximum 2 senior players allowed' })
        return
      }
      next.add(p.id)
    }
    setFeedback(null)
    setSelected(next)
  }

  function setCaptain(pid: number) {
    if (!selected.has(pid)) return
    setCaptainId(cur => cur === pid ? null : pid)
  }

  function autoFill() {
    const bySc = (a: Player, b: Player) => (b.sc_avg || 0) - (a.sc_avg || 0)
    const young = sortedPlayers.filter(isYoung).sort(bySc)
    const senior = sortedPlayers.filter(p => !isYoung(p)).sort(bySc)
    const next = new Set<number>()
    for (const p of young) { if (next.size >= 5) break; next.add(p.id) }
    for (const p of senior) { if (next.size >= 7) break; next.add(p.id) }
    for (const p of young) { if (next.size >= 7) break; if (!next.has(p.id)) next.add(p.id) }
    setSelected(next)
    let bestPid: number | null = null
    let bestSc = -1
    next.forEach(pid => {
      const p = sortedPlayers.find(pp => pp.id === pid)
      if (p && (p.sc_avg || 0) > bestSc) { bestSc = p.sc_avg || 0; bestPid = pid }
    })
    setCaptainId(bestPid)
    setFeedback({ kind: 'success', text: 'Auto-filled best 7 by SC average' })
  }

  async function save() {
    if (selected.size !== 7) return
    setSaving(true)
    try {
      const res = await fetch(`/leagues/${leagueId}/reserve7s/team/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_ids: [...selected],
          captain_id: captainId,
          afl_round: afl_round,
        }),
        credentials: 'include',
      })
      const d = await res.json().catch(() => ({}))
      if (d.ok) setFeedback({ kind: 'success', text: d.message || 'Lineup saved!' })
      else setFeedback({ kind: 'error', text: d.error || 'Failed to save' })
    } catch {
      setFeedback({ kind: 'error', text: 'Network error — try again' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <style>{S7T_CSS}</style>

      {/* Hero */}
      <div className="sevens-hero">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h2 className="sevens-hero-title">
              <i className="bi bi-7-circle me-2" style={{ color: '#bc8cff' }}></i>
              Reserve 7s — Round {afl_round}
            </h2>
            <div className="sevens-hero-sub">{team.name} — Select your 7 players</div>
            <div className="sevens-rule-badge">
              <i className="bi bi-info-circle"></i>
              Min 5 under-{age_cutoff} • Max 2 over-{age_cutoff}
            </div>
          </div>
          <div>
            <Link to={`/leagues/${leagueId}/team/${team.id}`} className="sevens-btn sevens-btn-secondary">
              <i className="bi bi-arrow-left me-1"></i>Back to Squad
            </Link>
          </div>
        </div>
        <div className="sevens-counter">
          <div className="sevens-counter-item">Selected: <strong>{selected.size}</strong>/7</div>
          <div className="sevens-counter-item">Under-{age_cutoff}: <strong>{youngCount}</strong></div>
          <div className="sevens-counter-item">Senior: <strong>{seniorCount}</strong>/2</div>
          <div className="sevens-counter-item">
            Captain: <strong>{captainId ? (sortedPlayers.find(p => p.id === captainId)?.name || '—') : '—'}</strong>
          </div>
        </div>
      </div>

      <div className="sevens-grid">
        {/* Selected */}
        <div className="sevens-panel">
          <div className="sevens-panel-hdr">
            <span><i className="bi bi-check-circle me-1" style={{ color: '#3fb950' }}></i>Selected 7</span>
            <span style={{ fontSize: '.7rem', color: '#484f58' }}>{selected.size}/7</span>
          </div>
          <div className="sevens-panel-body">
            {selectedPlayers.length === 0 ? (
              <div style={{ padding: '30px 16px', textAlign: 'center', color: '#484f58', fontSize: '.8rem' }}>
                Click players from the available list to add them
              </div>
            ) : (
              selectedPlayers.map(p => (
                <div key={p.id} className="sevens-player-row selected" style={{ cursor: 'default' }}>
                  <span className={`sevens-age-badge ${isYoung(p) ? 'age-young' : 'age-senior'}`}>
                    {p.age || '?'}
                  </span>
                  <span className="sevens-player-name">{p.name}</span>
                  <span className="sevens-player-meta">{p.afl_team}</span>
                  {p.id === captainId && (
                    <span style={{ color: '#FFD700', fontSize: '.7rem', fontWeight: 700 }}>CAPTAIN</span>
                  )}
                  <span className="sevens-sc" style={{ color: '#8b949e' }}>
                    {p.sc_avg > 0 ? Math.round(p.sc_avg) : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Available */}
        <div className="sevens-panel">
          <div className="sevens-panel-hdr">
            <span><i className="bi bi-people me-1"></i>Available Players</span>
            <span style={{ fontSize: '.7rem', color: '#484f58' }}>{data.players.length} on roster</span>
          </div>
          <div className="sevens-filter-bar">
            <input
              type="text"
              className="sevens-filter-input"
              placeholder="Search players..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
          </div>
          <div className="sevens-panel-body" style={{ maxHeight: 500, overflowY: 'auto' }}>
            {filteredPlayers.map(p => {
              const isSel = selected.has(p.id)
              const isLocked = lockedSet.has(p.id)
              const young = isYoung(p)
              return (
                <div
                  key={p.id}
                  className={`sevens-player-row${isSel ? ' selected' : ''}${isLocked ? ' locked' : ''}`}
                  onClick={() => togglePlayer(p)}
                >
                  <div className={`sevens-check${isSel ? ' checked' : ''}`}></div>
                  <span className={`sevens-age-badge ${young ? 'age-young' : 'age-senior'}`}>
                    {p.age || '?'}
                  </span>
                  <span className="sevens-player-name">{p.name}</span>
                  <span className="sevens-player-meta">{p.afl_team}</span>
                  <span className="sevens-player-meta">{(p.position || '').substring(0, 7)}</span>
                  <span
                    className="sevens-sc"
                    style={{
                      color: (p.sc_avg || 0) >= 80 ? '#3fb950'
                        : (p.sc_avg || 0) >= 60 ? '#58a6ff'
                        : '#6e7681',
                    }}
                  >
                    {p.sc_avg ? Math.round(p.sc_avg) : '—'}
                  </span>
                  {isLocked && <span className="sevens-lock-icon"><i className="bi bi-lock-fill"></i></span>}
                  <span
                    className={`sevens-cap-star${p.id === captainId ? ' active' : ''}`}
                    onClick={e => { e.stopPropagation(); setCaptain(p.id) }}
                    title="Set as captain"
                  >
                    ★
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="sevens-actions">
        <button className="sevens-btn sevens-btn-primary" onClick={save} disabled={!canSave || saving}>
          <i className="bi bi-check-lg me-1"></i>{saving ? 'Saving...' : 'Save 7s Lineup'}
        </button>
        <button className="sevens-btn sevens-btn-secondary" onClick={autoFill} type="button" style={{ background: 'transparent' }}>
          <i className="bi bi-magic me-1"></i>Auto-Fill Best 7
        </button>
      </div>
      {feedback && (
        <div className={`sevens-feedback ${feedback.kind}`}>{feedback.text}</div>
      )}
      <div style={{ display: 'none' }}>{league.name}</div>
    </div>
  )
}
