import { useParams } from 'react-router'
import { useState, useEffect, useCallback } from 'react'
import { Spinner } from '../../components/ui/Spinner'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'

interface CompSeason { comp: string; season: number; count: number }

interface SLPlayer {
  id: number; player_name: string; competition: string; season: number
  team: string; age: number; matches: number; is_afl_listed: boolean
  player_id: number | null; afl_team: string | null; position: string | null
  sc_avg: number | null; rating: number | null
  kicks: number; handballs: number; disposals: number; marks: number
  goals: number; goals_avg: number; behinds: number; tackles: number; hitouts: number
  contested_possessions: number; uncontested_possessions: number
  clearances: number; inside_fifties: number; rebounds: number
  disposal_efficiency: number; intercepts: number; score_involvements: number
  frees_for: number; frees_against: number; contested_marks: number
  tackles_inside_50: number; dreamteam_avg: number
  total_possessions: number; kick_percentage: number
  contested_possession_rate: number; score_involvement_pct: number
}

interface PageData { players: SLPlayer[]; total: number; page: number; pages: number }

const STAT_COLS: [keyof SLPlayer, string, number][] = [
  ['disposals', 'DIS', 0], ['kicks', 'KCK', 0], ['handballs', 'HBL', 0],
  ['marks', 'MRK', 0], ['goals', 'GLS', 1], ['tackles', 'TKL', 0],
  ['hitouts', 'HO', 0], ['contested_possessions', 'CP', 0],
  ['clearances', 'CLR', 0], ['inside_fifties', 'I50', 0],
  ['intercepts', 'INT', 0], ['disposal_efficiency', 'DE%', 1],
  ['contested_marks', 'CM', 0], ['score_involvements', 'SI', 0],
  ['dreamteam_avg', 'FAN', 0],
]

const CSS = `
.scout-wrap { padding: 16px 20px 80px; max-width: 1200px; margin: 0 auto; }
.scout-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
.scout-filters select, .scout-filters input {
  background: #161b22; border: 1px solid #30363d; color: #c9d1d9; border-radius: 8px;
  padding: 7px 12px; font-size: .82rem; outline: none;
}
.scout-filters select:focus, .scout-filters input:focus { border-color: #58a6ff; }
.scout-filters label { font-size: .75rem; color: #8b949e; display: flex; align-items: center; gap: 4px; cursor: pointer; }
.scout-tbl { width: 100%; border-collapse: collapse; font-size: .78rem; }
.scout-tbl th { position: sticky; top: 0; background: #161b22; color: #8b949e; font-size: .65rem;
  text-transform: uppercase; letter-spacing: .4px; padding: 8px 6px; text-align: right;
  cursor: pointer; user-select: none; white-space: nowrap; border-bottom: 1px solid #21262d; }
.scout-tbl th:first-child, .scout-tbl th:nth-child(2), .scout-tbl th:nth-child(3) { text-align: left; }
.scout-tbl th:hover { color: #58a6ff; }
.scout-tbl th.sorted { color: #58a6ff; }
.scout-tbl td { padding: 7px 6px; border-bottom: 1px solid rgba(48,54,61,.3); color: #c9d1d9;
  text-align: right; font-variant-numeric: tabular-nums; }
.scout-tbl td:first-child, .scout-tbl td:nth-child(2), .scout-tbl td:nth-child(3) { text-align: left; }
.scout-tbl tr:hover td { background: rgba(88,166,255,.04); }
.scout-name { font-weight: 700; color: #f0f3f6; }
.scout-afl { font-size: .68rem; color: #58a6ff; margin-left: 6px; }
.scout-comp { font-size: .68rem; color: #8b949e; text-transform: uppercase; }
.scout-pagination { display: flex; justify-content: center; gap: 6px; margin-top: 16px; }
.scout-pagination button { background: #21262d; border: 1px solid #30363d; color: #c9d1d9;
  border-radius: 6px; padding: 5px 12px; font-size: .78rem; cursor: pointer; }
.scout-pagination button:disabled { opacity: .4; cursor: default; }
.scout-pagination button.active { background: #58a6ff; color: #0d1117; border-color: #58a6ff; }
.scout-listed { display: inline-block; background: rgba(63,185,80,.15); color: #3fb950;
  font-size: .6rem; padding: 1px 5px; border-radius: 4px; font-weight: 600; margin-left: 4px; }
.pos-pill { font-size: .6rem; padding: 1px 5px; border-radius: 4px; font-weight: 600; }
.pos-pill.def { background: rgba(88,166,255,.15); color: #58a6ff; }
.pos-pill.mid { background: rgba(188,140,255,.15); color: #bc8cff; }
.pos-pill.fwd { background: rgba(210,153,34,.15); color: #d29922; }
.pos-pill.ruc { background: rgba(63,185,80,.15); color: #3fb950; }
@media(max-width:768px) {
  .scout-tbl { font-size: .72rem; }
  .scout-tbl th, .scout-tbl td { padding: 6px 4px; }
  .scout-hide-mob { display: none; }
}
`

export function ScoutingPage() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const [comps, setComps] = useState<CompSeason[]>([])
  const [comp, setComp] = useState('')
  const [season, setSeason] = useState<number | ''>('')
  const [aflOnly, setAflOnly] = useState(true)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('disposals')
  const [dir, setDir] = useState<'desc' | 'asc'>('desc')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/leagues/${leagueId}/state-league-stats/comps`)
      .then(r => r.json()).then(setComps).catch(() => {})
  }, [leagueId])

  const seasons = [...new Set(comps.map(c => c.season))].sort((a, b) => b - a)
  const compList = [...new Set(comps.map(c => c.comp))].sort()

  useEffect(() => {
    if (seasons.length && !season) setSeason(seasons[0])
  }, [comps])

  const fetchData = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (comp) params.set('comp', comp)
    if (season) params.set('season', String(season))
    params.set('afl_only', String(aflOnly))
    if (search) params.set('search', search)
    params.set('sort', sort)
    params.set('dir', dir)
    params.set('page', String(page))
    fetch(`/api/leagues/${leagueId}/state-league-stats?${params}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leagueId, comp, season, aflOnly, search, sort, dir, page])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleSort = (col: string) => {
    if (sort === col) setDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSort(col); setDir('desc') }
    setPage(1)
  }

  const fmt = (v: number | null, dec: number) => v == null ? '—' : dec ? v.toFixed(dec) : Math.round(v).toString()

  return (
    <>
      <style>{CSS}</style>
      <PlayersSubnav active="scouting" leagueId={leagueId!} />
      <div className="scout-wrap">
        <h5 style={{ color: '#f0f3f6', fontWeight: 800, marginBottom: 14, fontSize: '1.1rem' }}>
          <i className="bi bi-binoculars" style={{ marginRight: 8, color: '#58a6ff' }}></i>
          State League Scouting
        </h5>

        <div className="scout-filters">
          <select value={comp} onChange={e => { setComp(e.target.value); setPage(1) }}>
            <option value="">All Comps</option>
            {compList.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
          <select value={season} onChange={e => { setSeason(e.target.value ? Number(e.target.value) : ''); setPage(1) }}>
            <option value="">All Seasons</option>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input placeholder="Search player..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ minWidth: 160 }} />
          <label>
            <input type="checkbox" checked={aflOnly} onChange={e => { setAflOnly(e.target.checked); setPage(1) }} />
            AFL-listed only
          </label>
        </div>

        {loading ? <Spinner text="Loading state league stats..." /> : !data?.players.length ? (
          <p style={{ color: '#8b949e', textAlign: 'center', padding: 40 }}>No data found. Run the state league import first.</p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="scout-tbl">
                <thead>
                  <tr>
                    <th className={sort === 'player_name' ? 'sorted' : ''} onClick={() => toggleSort('player_name')}>Player</th>
                    <th className={sort === 'team' ? 'sorted' : ''} onClick={() => toggleSort('team')}>Team</th>
                    <th className={`scout-hide-mob ${sort === 'matches' ? 'sorted' : ''}`} onClick={() => toggleSort('matches')} style={{ textAlign: 'right' }}>GP</th>
                    {STAT_COLS.map(([key, label]) => (
                      <th key={key as string} className={`${sort === key ? 'sorted' : ''} scout-hide-mob`}
                        onClick={() => toggleSort(key as string)}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.players.map(p => (
                    <tr key={p.id}>
                      <td>
                        <span className="scout-name">{p.player_name}</span>
                        {p.position && <span className={`pos-pill ${(p.position.split('/')[0] || '').toLowerCase()}`}>{p.position}</span>}
                        {p.is_afl_listed && p.afl_team && <span className="scout-afl">{p.afl_team}</span>}
                        {!p.is_afl_listed && <span className="scout-listed" style={{ background: 'rgba(139,148,158,.15)', color: '#8b949e' }}>Unlisted</span>}
                      </td>
                      <td>
                        <span style={{ color: '#c9d1d9', fontSize: '.78rem' }}>{p.team}</span>
                        <span className="scout-comp" style={{ marginLeft: 4 }}>{p.competition.toUpperCase()}</span>
                      </td>
                      <td className="scout-hide-mob" style={{ textAlign: 'right' }}>{p.matches ?? '—'}</td>
                      {STAT_COLS.map(([key, , dec]) => (
                        <td key={key as string} className="scout-hide-mob">{fmt(p[key] as number, dec)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.pages > 1 && (
              <div className="scout-pagination">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                  const p = page <= 4 ? i + 1 : Math.min(page - 3 + i, data.pages)
                  return <button key={p} className={p === page ? 'active' : ''} onClick={() => setPage(p)}>{p}</button>
                })}
                <button disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            )}
            <p style={{ textAlign: 'center', color: '#484f58', fontSize: '.7rem', marginTop: 8 }}>
              {data.total} players · Page {data.page} of {data.pages}
            </p>
          </>
        )}
      </div>
    </>
  )
}
