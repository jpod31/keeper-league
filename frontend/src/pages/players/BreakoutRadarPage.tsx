import { useParams } from 'react-router'
import { useState, useEffect, useMemo } from 'react'
import { RowsSkeleton } from '../../components/ui/RowsSkeleton'
import { PlayersSubnav } from '../../components/nav/PlayersSubnav'
import { usePageState } from '../../lib/pageMemory'

interface RadarPlayer {
  id: number
  player_id: number | null
  name: string
  comp: string
  sl_team: string | null
  age: number | null
  matches: number
  sl_fantasy_avg: number
  sl_disposals: number
  sl_goals_avg: number
  is_afl_listed: boolean
  afl_team: string | null
  afl_sc_avg: number | null
  rating: number | null
  potential: number | null
  predicted_afl_sc: number
  breakout_probability: number
  draft_probability: number
  scouting_tag: string
}

interface RadarData { year: number; players: RadarPlayer[]; total: number }

const CSS = `
.br-wrap { padding: 16px 0; }
.br-hero { display:flex; align-items:center; gap:16px; margin-bottom:18px; padding:14px 20px; background:linear-gradient(135deg, rgba(63,185,80,.08), rgba(81,78,95,.06)); border:1px solid #1e1d21; border-radius:12px; }
.br-hero i { font-size:1.7rem; color:#3fb950; }
.br-hero-title { font-weight:800; font-size:1.1rem; color:#ebebee; margin:0; letter-spacing:-.01em; }
.br-hero-sub { color:var(--kl-text-primary); font-size:.8125rem; margin:2px 0 0; }
.br-filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; align-items:center; }
.br-chip { padding:5px 14px; border-radius:20px; border:1px solid #2a292f; color:var(--kl-text-primary); background:transparent; font-size:.8125rem; font-weight:600; cursor:pointer; transition:all .12s; }
.br-chip:hover { color:var(--kl-text-primary); border-color:#ececf6; }
.br-chip.active { color:#ececf6; border-color:#ececf6; background:rgba(236,236,246,.1); }
.br-chip.active.purple { color:#bc8cff; border-color:#bc8cff; background:rgba(188,140,255,.1); }
.br-table { width:100%; border-collapse:collapse; font-size:.82rem; }
.br-table th { text-align:left; padding:10px 12px; color:var(--kl-text-primary); font-weight:600; font-size:.8125rem; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid #1e1d21; cursor:pointer; user-select:none; white-space:nowrap; }
.br-table th:hover { color:var(--kl-text-primary); }
.br-table td { padding:10px 12px; border-bottom:1px solid #151518; color:var(--kl-text-primary); }
.br-table tr:hover { background:rgba(236,236,246,.04); }
.br-name { font-weight:600; color:#ebebee; }
.br-sub { font-size:.8125rem; color:var(--kl-text-primary); margin-top:2px; }
.br-tag { display:inline-block; padding:2px 8px; border-radius:4px; font-size:.8125rem; font-weight:700; margin-left:6px; }
.br-bar { display:inline-block; width:60px; height:6px; border-radius:3px; background:#1e1d21; vertical-align:middle; overflow:hidden; margin-right:6px; }
.br-bar-fill { height:100%; background:linear-gradient(90deg,#3fb950,#514e5f); transition:width .4s; }
.br-listed { color:#ececf6; background:rgba(236,236,246,.1); }
.br-unlisted { color:#d29922; background:rgba(210,153,34,.1); }
`

type SortKey = 'predicted_afl_sc' | 'breakout_probability' | 'sl_fantasy_avg' | 'age' | 'rating' | 'potential'

export function BreakoutRadarPage() {
  const { leagueId } = useParams()
  const [data, setData] = useState<RadarData | null>(null)
  const [loading, setLoading] = useState(true)
  const [comp, setComp] = usePageState('comp', '')
  const [listed, setListed] = usePageState<'any' | 'afl_only' | 'unlisted'>('listed', 'any')
  const [minProb, setMinProb] = usePageState('minProb', 0)
  const [sort, setSort] = usePageState<SortKey>('sort', 'predicted_afl_sc')
  const [dir, setDir] = usePageState<1 | -1>('dir', -1)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (comp) params.set('comp', comp)
    params.set('listed', listed)
    if (minProb) params.set('min_prob', String(minProb))
    fetch(`/api/leagues/${leagueId}/breakout-radar?${params}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [leagueId, comp, listed, minProb])

  const sorted = useMemo(() => {
    if (!data) return []
    const arr = [...data.players]
    arr.sort((a, b) => {
      const av = (a[sort] as number) ?? 0
      const bv = (b[sort] as number) ?? 0
      return (av - bv) * dir
    })
    return arr
  }, [data, sort, dir])

  function toggleSort(k: SortKey) {
    if (sort === k) setDir(d => (d === 1 ? -1 : 1))
    else { setSort(k); setDir(-1) }
  }

  if (loading) return <>
    <PlayersSubnav active="breakout" leagueId={leagueId!} />
    <RowsSkeleton rows={12} />
  </>

  return (
    <div className="br-wrap">
      <style>{CSS}</style>
      <PlayersSubnav active="breakout" leagueId={leagueId!} />
      <div className="page-header">
        <h2>Breakout radar</h2>
        <p className="pool-line">State league players trending toward a senior AFL game, from VFL, SANFL and WAFL form.</p>
      </div>

      <div className="br-filters">
        <span style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Comp:</span>
        {['', 'vfl', 'sanfl', 'wafl', 'nab'].map(c => (
          <button key={c || 'all'} className={`br-chip${comp === c ? ' active' : ''}`} onClick={() => setComp(c)}>
            {c ? c.toUpperCase() : 'All'}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: '#2a292f', margin: '0 6px' }}></span>
        <span style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Status:</span>
        <button className={`br-chip${listed === 'any' ? ' active' : ''}`} onClick={() => setListed('any')}>Any</button>
        <button className={`br-chip${listed === 'afl_only' ? ' active' : ''}`} onClick={() => setListed('afl_only')}>AFL-listed</button>
        <button className={`br-chip${listed === 'unlisted' ? ' active purple' : ''}`} onClick={() => setListed('unlisted')}>Unlisted / Draftable</button>
        <span style={{ width: 1, height: 20, background: '#2a292f', margin: '0 6px' }}></span>
        <label style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          Min breakout prob:
          <input type="range" min={0} max={90} step={10} value={minProb}
            onChange={e => setMinProb(Number(e.target.value))} style={{ width: 120 }} />
          <b style={{ minWidth: 30, color: minProb > 0 ? '#3fb950' : '#ececf1' }}>{minProb}%</b>
        </label>
      </div>

      {!sorted.length ? (
        <p style={{ color: 'var(--kl-text-primary)', padding: 40, textAlign: 'center' }}>
          No candidates match these filters yet.
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="br-table">
            <thead>
              <tr>
                <th>Player</th>
                <th onClick={() => toggleSort('age')}>Age</th>
                <th>Status</th>
                <th>Tag</th>
                <th onClick={() => toggleSort('sl_fantasy_avg')}>SL Fantasy</th>
                <th onClick={() => toggleSort('predicted_afl_sc')} style={{ color: '#3fb950' }}>Pred AFL SC ▼</th>
                <th onClick={() => toggleSort('breakout_probability')}>Breakout %</th>
                <th onClick={() => toggleSort('rating')}>Rating</th>
                <th onClick={() => toggleSort('potential')}>Pot.</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="br-name">{p.name}</div>
                    <div className="br-sub">
                      {p.comp}, {p.sl_team || '-'}, {p.matches} matches
                      {p.afl_team && <>, <b style={{ color: '#ececf6' }}>{p.afl_team}</b></>}
                    </div>
                  </td>
                  <td>{p.age ?? '-'}</td>
                  <td>
                    <span className={`br-tag ${p.is_afl_listed ? 'br-listed' : 'br-unlisted'}`}>
                      {p.is_afl_listed ? 'LISTED' : 'UNLISTED'}
                    </span>
                  </td>
                  <td style={{ fontSize: '.8125rem', color: 'var(--kl-text-primary)' }}>{p.scouting_tag || '-'}</td>
                  <td>{p.sl_fantasy_avg}</td>
                  <td style={{ fontWeight: 700, color: '#3fb950' }}>{p.predicted_afl_sc}</td>
                  <td>
                    <span className="br-bar">
                      <span className="br-bar-fill" style={{ width: `${p.breakout_probability}%` }} />
                    </span>
                    {p.breakout_probability}%
                  </td>
                  <td>{p.rating ?? '-'}</td>
                  <td>{p.potential ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default BreakoutRadarPage
