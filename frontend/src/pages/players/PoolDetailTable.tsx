import { useEffect, useMemo, useRef } from 'react'
import { useKeptFetch } from '../../hooks/useFetch'
import { usePageState, useKeptScroll } from '../../lib/pageMemory'
import { ratingTier } from '../../lib/clubs'
import { TeamBadge } from '../../components/ui/TeamBadge'
import './pool-detail.css'

// The pool's "Detailed stats" view: every stat we hold as a season average,
// plus role, ratings and draft details, one sortable column each. The name
// stays pinned on the left while the rest scrolls sideways.

export interface PoolRow {
  id: number; name: string; afl_team: string; position: string; age: number | null
  rating: number | null; potential: number | null; owner_team: string | null; position_expected?: boolean
}
type Num = number | null | undefined
interface Detail {
  stats_year: number
  stats: { key: string; label: string }[]
  players: Record<string, Record<string, Num | string>>
}
interface Col { key: string; label: string; title: string; get: (p: PoolRow, d: Record<string, Num | string> | undefined) => Num | string; kind?: 'rt' | 'pot' | 'sc' | 'owner' | 'int' }

const FULL: Record<string, string> = {
  supercoach_score: 'SuperCoach', afl_fantasy_score: 'AFL Fantasy', disposals: 'Disposals', kicks: 'Kicks', handballs: 'Handballs',
  marks: 'Marks', goals: 'Goals', behinds: 'Behinds', tackles: 'Tackles', hitouts: 'Hitouts', contested_possessions: 'Contested possessions',
  uncontested_possessions: 'Uncontested possessions', clearances: 'Clearances', centre_clearances: 'Centre clearances',
  stoppage_clearances: 'Stoppage clearances', inside_fifties: 'Inside 50s', rebounds: 'Rebound 50s', metres_gained: 'Metres gained',
  score_involvements: 'Score involvements', goal_assists: 'Goal assists', intercepts: 'Intercepts', contested_marks: 'Contested marks',
  marks_inside_50: 'Marks inside 50', ground_ball_gets: 'Ground ball gets', pressure_acts: 'Pressure acts', one_percenters: 'One percenters',
  effective_disposals: 'Effective disposals', disposal_efficiency: 'Disposal efficiency %', clangers: 'Clangers', turnovers: 'Turnovers',
  frees_for: 'Frees for', frees_against: 'Frees against', bounces: 'Bounces', kick_ins: 'Kick-ins', time_on_ground_pct: 'Time on ground %',
}

function fmt(v: Num | string, kind?: Col['kind']) {
  if (v == null || v === '') return '-'
  if (typeof v === 'string') return v
  if (kind === 'int' || Number.isInteger(v)) return String(Math.round(v))
  return v.toFixed(1)
}

export function PoolDetailTable({ leagueId, players, teamLogos, onOpen }: {
  leagueId: string; players: PoolRow[]; teamLogos: Record<string, string>; onOpen: (id: number) => void
}) {
  const { data, loading } = useKeptFetch<Detail>(`/api/leagues/${leagueId}/player-pool/detail`)
  const [sortKey, setSortKey] = usePageState('dsort', 'supercoach_score')
  const [dir, setDir] = usePageState<1 | -1>('ddir', -1)
  const [count, setCount] = usePageState('rows:detail', 80)
  const keepScroll = useKeptScroll('detail')
  const sentinel = useRef<HTMLTableRowElement>(null)

  const cols: Col[] = useMemo(() => {
    const stat = (data?.stats || []).map(s => ({
      key: s.key, label: s.label, title: FULL[s.key] || s.label,
      kind: s.key === 'supercoach_score' ? 'sc' as const : undefined,
      get: (_p: PoolRow, d: Record<string, Num | string> | undefined) => d?.[s.key],
    }))
    return [
      { key: 'owner', label: 'Club', title: 'Club in this league', kind: 'owner', get: p => p.owner_team || '' },
      { key: 'age', label: 'Age', title: 'Age', kind: 'int', get: p => p.age },
      { key: 'height_cm', label: 'HT', title: 'Height (cm)', kind: 'int', get: (_p, d) => d?.height_cm },
      { key: 'rating', label: 'RTG', title: 'Rating', kind: 'rt', get: p => p.rating },
      { key: 'potential', label: 'POT', title: 'Potential', kind: 'pot', get: p => p.potential },
      { key: 'games', label: 'GM', title: 'Games this season', kind: 'int', get: (_p, d) => d?.games },
      ...stat,
      { key: 'cba_pct', label: 'CBA%', title: 'Centre bounces attended', get: (_p, d) => d?.cba_pct },
      { key: 'kick_in_pct', label: 'KI SHARE', title: "Share of his club's kick-ins", get: (_p, d) => d?.kick_in_pct },
      { key: 'kick_in_playon_pct', label: 'KI PLAY ON', title: 'Kick-ins he played on from', get: (_p, d) => d?.kick_in_playon_pct },
      { key: 'career_games', label: 'CAREER', title: 'AFL games, career', kind: 'int', get: (_p, d) => d?.career_games },
      { key: 'draft_pick', label: 'PICK', title: 'AFL draft pick', kind: 'int', get: (_p, d) => (d?.draft_pick || null) },
      { key: 'draft_year', label: 'DRAFTED', title: 'AFL draft year', kind: 'int', get: (_p, d) => d?.draft_year },
    ]
  }, [data])

  const rows = useMemo(() => {
    const col: Pick<Col, 'get'> = sortKey === 'name' ? { get: p => p.name } : (cols.find(c => c.key === sortKey) || cols[0])
    const det = data?.players || {}
    const withV = players.map(p => ({ p, v: col.get(p, det[String(p.id)]) }))
    // Blanks sink to the bottom whichever way it sorts.
    withV.sort((a, b) => {
      const an = a.v == null || a.v === '', bn = b.v == null || b.v === ''
      if (an !== bn) return an ? 1 : -1
      if (an) return a.p.name.localeCompare(b.p.name)
      if (typeof a.v === 'string' || typeof b.v === 'string') return dir * String(a.v).localeCompare(String(b.v))
      return dir * ((a.v as number) - (b.v as number))
    })
    return withV.map(x => x.p)
  }, [players, data, cols, sortKey, dir])

  // Show more rows as the bottom comes into view.
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setCount(c => c + 80) }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [rows.length, count, setCount])

  function sortBy(k: string) {
    if (k === sortKey) setDir(d => (d === 1 ? -1 : 1))
    else { setSortKey(k); setDir(k === 'owner' || k === 'draft_pick' || k === 'age' ? 1 : -1) }
    setCount(80)
  }

  if (loading || !data) return <div className="pdt-loading">Loading every stat…</div>
  const det = data.players
  const shown = rows.slice(0, count)
  return (
    <div className="pdt">
      <div className="pdt-note">{data.stats_year} averages per game. Sort by any heading; open a player for his card.</div>
      <div className="pdt-box" ref={keepScroll}>
        <table className="pdt-table">
          <thead>
            <tr>
              <th className={`pin${sortKey === 'name' ? ' on' : ''}`} onClick={() => sortBy('name')}>Player{sortKey === 'name' && <span className="arr">{dir === -1 ? '↓' : '↑'}</span>}</th>
              {cols.map(c => (
                <th key={c.key} title={c.title} className={c.key === sortKey ? 'on' : ''} onClick={() => sortBy(c.key)} aria-sort={c.key === sortKey ? (dir === -1 ? 'descending' : 'ascending') : 'none'}>
                  {c.label}{c.key === sortKey && <span className="arr">{dir === -1 ? '↓' : '↑'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(p => {
              const d = det[String(p.id)]
              return (
                <tr key={p.id} onClick={() => onOpen(p.id)}>
                  <td className="pin">
                    <span className="pdt-name">
                      {teamLogos[p.afl_team] ? <img src={teamLogos[p.afl_team]} alt="" /> : <i />}
                      <span className="n">{p.name}</span>
                      <span className="pdt-pos">
                        {(p.position || 'MID').split('/').map(ps => <b key={ps} className={`pdt-dot pdt-${ps.toLowerCase()}${p.position_expected ? ' exp' : ''}`}>{ps[0]}</b>)}
                      </span>
                    </span>
                  </td>
                  {cols.map(c => {
                    const v = c.get(p, d)
                    if (c.kind === 'owner') return <td key={c.key} className="own">{p.owner_team ? <TeamBadge name={p.owner_team} size={22} showName={false} /> : <span className="fa">FA</span>}</td>
                    if (c.kind === 'rt') return <td key={c.key}><span className={`rt ${ratingTier(v as number)}`}>{fmt(v)}</span></td>
                    if (c.kind === 'pot') return <td key={c.key}><span className={`rt rt-line ${ratingTier(v as number)}`}>{fmt(v)}</span></td>
                    return <td key={c.key} className={`${c.kind === 'sc' ? 'sc' : ''}${c.key === sortKey ? ' on' : ''}`}>{fmt(v, c.kind)}</td>
                  })}
                </tr>
              )
            })}
            {count < rows.length && <tr ref={sentinel}><td colSpan={cols.length + 1} className="pdt-more">Loading more…</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
