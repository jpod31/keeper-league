import { useParams } from 'react-router'
import { useState, useMemo } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'

interface Entry {
  type: string
  description: string
  year: number | null
  date: string | null
}

interface ListChangesData {
  league: { id: number; name: string }
  list_changes: Entry[]
}

const LC_CSS = `
.lc-header { display:flex; align-items:center; gap:12px; margin-bottom:24px; }
.lc-header h2 { font-size:1.4rem; font-weight:700; color:#e6edf3; margin:0; }
.lc-header .lc-icon { width:44px; height:44px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.3rem; background:rgba(88,166,255,.12); color:#58a6ff; }
.lc-year-header { font-size:1.1rem; font-weight:700; color:#e6edf3; margin:20px 0 10px; padding-bottom:6px; border-bottom:1px solid #21262d; }
.lc-year-header:first-child { margin-top:0; }
.lc-timeline { position:relative; padding-left:28px; }
.lc-timeline::before { content:''; position:absolute; left:8px; top:0; bottom:0; width:2px; background:#21262d; }
.lc-entry { position:relative; padding:8px 0; border-bottom:1px solid rgba(33,38,45,.5); }
.lc-entry:last-child { border-bottom:none; }
.lc-dot { position:absolute; left:-22px; top:14px; width:10px; height:10px; border-radius:50%; }
.lc-dot-draft { background:#58a6ff; }
.lc-dot-supplemental { background:#f0883e; }
.lc-dot-trade { background:#bc8cff; }
.lc-dot-delist { background:#f85149; }
.lc-dot-ssp { background:#3fb950; }
.lc-dot-commissioner { background:#d29922; }
.lc-desc { font-size:.82rem; color:#c9d1d9; }
.lc-date { font-size:.7rem; color:#484f58; margin-top:2px; }
.lc-type-badge { display:inline-block; font-size:.65rem; font-weight:600; text-transform:uppercase; padding:2px 6px; border-radius:4px; margin-right:6px; }
.lc-badge-draft { background:rgba(88,166,255,.12); color:#58a6ff; }
.lc-badge-supplemental { background:rgba(240,136,62,.12); color:#f0883e; }
.lc-badge-trade { background:rgba(188,140,255,.12); color:#bc8cff; }
.lc-badge-delist { background:rgba(248,81,73,.12); color:#f85149; }
.lc-badge-ssp { background:rgba(63,185,80,.12); color:#3fb950; }
.lc-badge-commissioner { background:rgba(210,153,34,.12); color:#d29922; }
.lc-filter-bar { display:flex; gap:6px; margin-bottom:16px; flex-wrap:wrap; }
.lc-filter-btn { font-size:.72rem; padding:4px 10px; border-radius:12px; background:transparent; border:1px solid #30363d; color:#8b949e; cursor:pointer; transition:all .15s; }
.lc-filter-btn:hover { border-color:#58a6ff; color:#c9d1d9; }
.lc-filter-btn.active { background:rgba(88,166,255,.12); border-color:#58a6ff; color:#58a6ff; }
.lc-card { background:#0d1117; border:1px solid #21262d; border-radius:12px; overflow:hidden; }
.lc-card-header { display:flex; align-items:center; gap:10px; padding:16px 20px; border-bottom:1px solid #21262d; }
.lc-card-header h5 { margin:0; font-size:1rem; font-weight:600; color:#e6edf3; }
.lc-card-body { padding:16px 20px; }
.lc-empty { text-align:center; padding:40px 20px; color:#484f58; }
.lc-empty i { font-size:2rem; display:block; margin-bottom:10px; }
`

// (filter key, display label) — labels match the Jinja buttons exactly
const FILTERS: [string, string][] = [
  ['all', 'All'],
  ['draft', 'Draft'],
  ['supplemental', 'Supplemental'],
  ['trade', 'Trades'],
  ['delist', 'Delists'],
  ['ssp', 'SSP'],
  ['commissioner', 'Commissioner'],
]

export function ListChangesPage() {
  const { leagueId } = useParams()
  const { data, loading } = useFetch<ListChangesData>(`/leagues/${leagueId}/list-changes?format=json`)
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    if (!data) return []
    if (filter === 'all') return data.list_changes
    return data.list_changes.filter(e => e.type === filter)
  }, [data, filter])

  if (loading) return <Spinner text="Loading list changes..." />
  if (!data) return <p className="text-danger">Failed to load list changes</p>

  // Group by year
  const grouped: { year: number | null; entries: Entry[] }[] = []
  let currentYear: number | null | undefined = undefined
  for (const e of filtered) {
    if (e.year !== currentYear) {
      currentYear = e.year
      grouped.push({ year: e.year, entries: [e] })
    } else {
      grouped[grouped.length - 1].entries.push(e)
    }
  }

  return (
    <div>
      <style>{LC_CSS}</style>
      <LeagueSubnav active="changes" leagueId={leagueId!} />

      <div className="lc-header">
        <div className="lc-icon"><i className="bi bi-clock-history"></i></div>
        <h2>List Changes</h2>
      </div>

      <div className="lc-card">
        <div className="lc-card-header">
          <i className="bi bi-clock-history" style={{ color: '#58a6ff' }}></i>
          <h5>Transaction History</h5>
        </div>
        <div className="lc-card-body">
          {data.list_changes.length > 0 ? (
            <>
              <div className="lc-filter-bar">
                {FILTERS.map(([key, label]) => (
                  <button
                    key={key}
                    className={`lc-filter-btn${filter === key ? ' active' : ''}`}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {grouped.map((g, i) => (
                <div key={i}>
                  <div className="lc-year-header">{g.year || 'Unknown'}</div>
                  <div className="lc-timeline">
                    {g.entries.map((entry, j) => (
                      <div key={j} className="lc-entry">
                        <span className={`lc-dot lc-dot-${entry.type}`}></span>
                        <div>
                          <span className={`lc-type-badge lc-badge-${entry.type}`}>{entry.type}</span>
                          <span className="lc-desc">{entry.description}</span>
                        </div>
                        {entry.date && <div className="lc-date">{entry.date}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="lc-empty">
              <i className="bi bi-clock-history"></i>
              <p>No list changes recorded yet. Draft players, make trades, or delist to see history here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
