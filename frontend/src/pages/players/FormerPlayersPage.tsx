import { useParams, Link } from 'react-router'
import { useMemo, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'
import { AcquiredHistory, type Stint } from '../../components/ui/PlayerHistory'
import { ratingTier } from '../../lib/clubs'

interface FormerPlayer {
  id: number
  name: string
  position: string
  afl_team: string
  age: number | null
  left_year: number | null
  rating: number | null
  potential: number | null
  games: number
  career_avg: number | null
  last_avg: number | null
  last_games: number
  last_year: number | null
  best_avg: number | null
  best_year: number | null
  first_year: number | null
  history: Stint[]
  times_listed: number
  first_pick: number | null
  drafted_by: string | null
  still_listed_by: string | null
}

interface FormerData {
  league: { id: number; name: string }
  players: FormerPlayer[]
  years: number[]
  teams: string[]
  team_logos: Record<string, string>
}

type SortKey = 'name' | 'club' | 'left' | 'age' | 'games' | 'career' | 'best' | 'last' | 'rating' | 'pick'
type Listed = 'all' | 'listed' | 'never'

const POSITIONS = ['DEF', 'MID', 'RUC', 'FWD']

/** Sort value for a column. Text columns ascend, numbers descend, on first click. */
function sortValue(p: FormerPlayer, key: SortKey): number | string {
  switch (key) {
    case 'name': return p.name.toLowerCase()
    case 'club': return p.afl_team.toLowerCase()
    case 'left': return p.left_year ?? 0
    case 'age': return p.age ?? 0
    case 'games': return p.games
    case 'career': return p.career_avg ?? -1
    case 'best': return p.best_avg ?? -1
    case 'last': return p.last_avg ?? -1
    case 'rating': return p.rating ?? -1
    // A pick is better the lower it is, so the "highest first" default has
    // to rank pick 1 above pick 200, and never-drafted last.
    case 'pick': return p.first_pick != null ? -p.first_pick : -100000
  }
}
const TEXT_KEYS: SortKey[] = ['name', 'club']

export function FormerPlayersPage() {
  const { leagueId } = useParams()
  const { data, loading, error } = useFetch<FormerData>(`/api/leagues/${leagueId}/former-players`)

  const [search, setSearch] = useState('')
  const [pos, setPos] = useState('')
  const [year, setYear] = useState<number | null>(null)
  const [club, setClub] = useState('')
  const [listed, setListed] = useState<Listed>('all')
  const [team, setTeam] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('games')
  const [asc, setAsc] = useState(false)

  const clubs = useMemo(
    () => (data ? [...new Set(data.players.map(p => p.afl_team).filter(Boolean))].sort() : []),
    [data],
  )

  const rows = useMemo(() => {
    if (!data) return []
    const needle = search.trim().toLowerCase()
    const out = data.players.filter(p => {
      if (needle && !p.name.toLowerCase().includes(needle)) return false
      if (pos && !(p.position || '').split('/').includes(pos)) return false
      if (year != null && p.left_year !== year) return false
      if (club && p.afl_team !== club) return false
      if (listed === 'listed' && p.times_listed === 0) return false
      if (listed === 'never' && p.times_listed > 0) return false
      if (team && !p.history.some(h => h.team === team)) return false
      return true
    })
    out.sort((a, b) => {
      const av = sortValue(a, sortKey), bv = sortValue(b, sortKey)
      const cmp = av < bv ? -1 : av > bv ? 1 : a.name.localeCompare(b.name)
      return asc ? cmp : -cmp
    })
    return out
  }, [data, search, pos, year, club, listed, team, sortKey, asc])

  function sortBy(key: SortKey) {
    if (key === sortKey) setAsc(a => !a)
    else { setSortKey(key); setAsc(TEXT_KEYS.includes(key)) }
  }

  if (loading) return <Spinner />
  if (error || !data) return <div className="kx-empty"><b>Former players could not be loaded</b>Refresh to try again.</div>

  const everListed = data.players.filter(p => p.times_listed > 0).length
  const stillListed = data.players.filter(p => p.still_listed_by).length
  const th = (key: SortKey, label: string, cls = '') => (
    <th className={`sortable ${cls}${sortKey === key ? ' sorted' : ''}`} onClick={() => sortBy(key)}>
      {label}{sortKey === key && <i className={`bi ${asc ? 'bi-caret-up-fill' : 'bi-caret-down-fill'}`} style={{ marginLeft: 5, fontSize: '.8125rem' }}></i>}
    </th>
  )
  const open = (p: FormerPlayer) => { window.location.href = `/player/${encodeURIComponent(p.name)}` }

  return (
    <div className="kx-page">
      <div className="d-none d-lg-block"><PlayersSubnav active="former" leagueId={leagueId!} /></div>

      <div className="page-breadcrumb d-none d-lg-block">
        <Link to={`/leagues/${leagueId}`}>{data.league.name}</Link> / Players / Former
      </div>
      <div className="kx-head">
        <h2>Former players</h2>
        <div className="kx-head-side">
          <span className="kx-count"><b>{rows.length}</b> of {data.players.length}</span>
        </div>
      </div>

      <div className="fp-summary">
        <div className="fp-stat"><div className="fp-stat-v">{data.players.length}</div><div className="fp-stat-l">Off AFL lists</div></div>
        <div className="fp-stat"><div className="fp-stat-v">{everListed}</div><div className="fp-stat-l">Were on a list in this league</div></div>
        <div className="fp-stat"><div className="fp-stat-v">{data.players.filter(p => p.first_pick != null).length}</div><div className="fp-stat-l">Were drafted here</div></div>
        <div className="fp-stat"><div className="fp-stat-v">{stillListed}</div><div className="fp-stat-l">Still on a list here</div></div>
      </div>

      <div className="kx-panel">
        <div className="kx-bar">
          <label className="kx-search">
            <i className="bi bi-search"></i>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search former players" aria-label="Search former players" />
          </label>
          <div className="kx-seg" role="group" aria-label="Position">
            <button type="button" className={pos === '' ? 'on' : ''} onClick={() => setPos('')}>All</button>
            {POSITIONS.map(p => (
              <button key={p} type="button" className={pos === p ? 'on' : ''} onClick={() => setPos(p)}>{p}</button>
            ))}
          </div>
          <div className="kx-seg" role="group" aria-label="In this league">
            <button type="button" className={listed === 'all' ? 'on' : ''} onClick={() => setListed('all')}>Everyone</button>
            <button type="button" className={listed === 'listed' ? 'on' : ''} onClick={() => setListed('listed')}>Listed here</button>
            <button type="button" className={listed === 'never' ? 'on' : ''} onClick={() => setListed('never')}>Never listed</button>
          </div>
          <select className="kx-select" value={year ?? ''} onChange={e => setYear(e.target.value ? Number(e.target.value) : null)} aria-label="Last season">
            <option value="">Any last season</option>
            {data.years.map(y => <option key={y} value={y}>Last season {y}</option>)}
          </select>
          <select className="kx-select" value={club} onChange={e => setClub(e.target.value)} aria-label="Last AFL club">
            <option value="">Any AFL club</option>
            {clubs.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="kx-select" value={team} onChange={e => setTeam(e.target.value)} aria-label="Was listed by">
            <option value="">Listed by anyone</option>
            {data.teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {rows.length === 0 ? (
          <div className="kx-empty"><b>Nobody matches</b>Loosen a filter to see more former players.</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="kx-scroll d-none d-lg-block">
              <table className="kx-table fp-table">
                <thead>
                  <tr>
                    {th('name', 'Player')}
                    <th>Pos</th>
                    {th('club', 'Last club')}
                    {th('left', 'Last year', 'ctr')}
                    {th('age', 'Age', 'ctr')}
                    {th('games', 'Games', 'num')}
                    {th('career', 'Career', 'num')}
                    {th('best', 'Best year', 'num')}
                    {th('last', 'Final year', 'num')}
                    {th('rating', 'Rtg', 'num')}
                    {th('pick', 'In this league')}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(p => (
                    <tr key={p.id} className="click" onClick={() => open(p)}>
                      <td>
                        <div className="kx-player">
                          {data.team_logos[p.afl_team] && <img src={data.team_logos[p.afl_team]} alt="" />}
                          <span className="kx-player-name">{p.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(p.position || '').split('/').filter(Boolean).map(x => (
                            <span key={x} className={`pos-badge badge-${x.toLowerCase()}`} style={{ padding: '2px 6px', fontSize: '.8125rem' }}>{x}</span>
                          ))}
                        </div>
                      </td>
                      <td>{p.afl_team}</td>
                      <td className="ctr kx-strong">{p.left_year ?? '-'}</td>
                      <td className="ctr">{p.age ?? '-'}</td>
                      <td className="num kx-strong">{p.games || '-'}</td>
                      <td className="num kx-strong">{p.career_avg != null ? p.career_avg.toFixed(1) : '-'}</td>
                      <td className="num">{p.best_avg != null ? <><b className="kx-strong">{p.best_avg.toFixed(1)}</b> ({p.best_year})</> : '-'}</td>
                      <td className="num">{p.last_avg != null ? <><b className="kx-strong">{p.last_avg.toFixed(1)}</b> ({p.last_year})</> : '-'}</td>
                      <td className="num">{p.rating != null ? <span className={`rt ${ratingTier(p.rating)}`}>{p.rating}</span> : '-'}</td>
                      <td onClick={e => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        {p.times_listed > 0
                          ? <AcquiredHistory history={p.history} fallback={null} />
                          : <span className="fp-never">Never listed</span>}
                        {p.still_listed_by && <span className="fp-still">Still on {p.still_listed_by}'s list</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="d-lg-none">
              {rows.map(p => (
                <div key={p.id} className="fp-card" onClick={() => open(p)}>
                  {data.team_logos[p.afl_team] ? <img src={data.team_logos[p.afl_team]} alt="" /> : <span style={{ width: 34 }} />}
                  <div className="fp-card-main">
                    <div className="fp-card-name">{p.name}</div>
                    <div className="fp-card-line">
                      {(p.position || '').split('/').filter(Boolean).map(x => (
                        <span key={x} className={`pos-badge badge-${x.toLowerCase()}`} style={{ padding: '2px 6px', fontSize: '.8125rem' }}>{x}</span>
                      ))}
                      <span>{p.afl_team}</span>
                      <span>Last season {p.left_year ?? '-'}</span>
                    </div>
                    <div className="fp-card-line">
                      <span><b className="kx-strong">{p.games}</b> games</span>
                      <span>Career <b className="kx-gold">{p.career_avg != null ? p.career_avg.toFixed(1) : '-'}</b></span>
                      <span>Rating <b className="kx-strong">{p.rating ?? '-'}</b></span>
                    </div>
                    <div className="fp-card-hist" onClick={e => e.stopPropagation()}>
                      {p.times_listed > 0
                        ? <AcquiredHistory history={p.history} fallback={null} />
                        : <span className="fp-never">Never listed in this league</span>}
                      {p.still_listed_by && <span className="fp-still">Still on {p.still_listed_by}'s list</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
