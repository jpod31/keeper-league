import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { useLeague } from '../../contexts/LeagueContext'
import { Spinner } from '../../components/ui/Spinner'

interface Player {
  id: number
  name: string
  position: string
  afl_team: string
  age: number
  sc_avg: number
  games: number
  is_captain: boolean
  is_vc: boolean
  tag: string
  tag_css: string
  injury: string | null
}

interface SquadData {
  team: { id: number; name: string; owner: string }
  players: Player[]
  roster_size: number
}

export function SquadPage() {
  const { leagueId, teamId } = useParams()
  const { league } = useLeague()
  const { data, loading } = useFetch<SquadData>(`/api/leagues/${leagueId}/team/${teamId}/squad`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-danger">Failed to load squad</p>

  const isOwnTeam = league?.user_team?.id === Number(teamId)
  const players = data.players

  // Compute summary stats (matching template logic)
  let totalSc = 0, scCount = 0, totalAge = 0, ageCount = 0
  const posCounts: Record<string, number> = { DEF: 0, MID: 0, FWD: 0, RUC: 0 }
  players.forEach(p => {
    if (p.sc_avg) { totalSc += p.sc_avg; scCount++ }
    if (p.age) { totalAge += p.age; ageCount++ }
    const primary = (p.position || 'MID').split('/')[0]
    if (primary in posCounts) posCounts[primary]++
  })
  const avgSc = scCount ? totalSc / scCount : 0
  const avgAge = ageCount ? totalAge / ageCount : 0

  return (
    <div>
      {/* ── Hero Header — matches squad.html ── */}
      <div className="squad-hero">
        <div className="squad-hero-inner">
          <div className="d-flex align-items-center gap-3">
            <div className="squad-logo-wrap">
              <div className="squad-logo-placeholder">{data.team.name.substring(0, 2).toUpperCase()}</div>
            </div>
            <div>
              <div className="squad-hero-crumb d-none d-lg-block">
                <Link to={`/leagues/${leagueId}`}>{league?.name}</Link> / {data.team.name}
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h2 className="squad-hero-title">{data.team.name}</h2>
                <span className="squad-hero-count d-none d-lg-inline">{players.length} players</span>
                {isOwnTeam && <span className="squad-hero-owner d-none d-lg-inline">Your Team</span>}
              </div>
            </div>
          </div>

          {/* Desktop pill actions */}
          <div className="squad-hero-actions d-none d-lg-flex">
            <Link to={`/leagues/${leagueId}/trades`} className="squad-pill squad-pill-manage text-decoration-none">
              <i className="bi bi-arrow-left-right"></i>Trades
            </Link>
            <Link to={`/leagues/${leagueId}/team/${teamId}/stats`} className="squad-pill squad-pill-stats text-decoration-none">
              <i className="bi bi-graph-up"></i>Stats
            </Link>
            <Link to={`/leagues/${leagueId}/team/${teamId}/analytics`} className="squad-pill squad-pill-manage text-decoration-none">
              <i className="bi bi-bar-chart-line"></i>Analytics
            </Link>
            {isOwnTeam && (
              <Link to={`/leagues/${leagueId}/reserve7s/team`} className="squad-pill squad-pill-manage text-decoration-none" style={{ color: '#bc8cff', borderColor: 'rgba(188,140,255,.3)' }}>
                <i className="bi bi-7-circle"></i>7s
              </Link>
            )}
            <span className="squad-pill squad-pill-list active">
              <i className="bi bi-table"></i>List
            </span>
          </div>
        </div>
      </div>

      {/* ── Mobile subnav ── */}
      <div className="mob-subnav d-lg-none">
        <span className="mob-subnav-item active"><i className="bi bi-table"></i><span>List</span></span>
        <Link to={`/leagues/${leagueId}/team/${teamId}/stats`} className="mob-subnav-item text-decoration-none">
          <i className="bi bi-graph-up"></i><span>Stats</span>
        </Link>
        <Link to={`/leagues/${leagueId}/team/${teamId}/analytics`} className="mob-subnav-item text-decoration-none">
          <i className="bi bi-bar-chart-line"></i><span>Analytics</span>
        </Link>
        {isOwnTeam && (
          <Link to={`/leagues/${leagueId}/reserve7s/team`} className="mob-subnav-item text-decoration-none" style={{ color: '#bc8cff' }}>
            <i className="bi bi-7-circle"></i><span>7s</span>
          </Link>
        )}
        <Link to={`/leagues/${leagueId}/trades`} className="mob-subnav-item text-decoration-none">
          <i className="bi bi-arrow-left-right"></i><span>Trades</span>
        </Link>
      </div>

      {/* ── Non-owner notice ── */}
      {!isOwnTeam && (
        <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2" style={{ background: 'rgba(139,148,158,.08)', border: '1px solid #30363d', borderRadius: 8, fontSize: '.85rem', color: '#8b949e' }}>
          <i className="bi bi-eye"></i>
          <span>Viewing <strong style={{ color: '#c9d1d9' }}>{data.team.name}</strong>'s squad (read-only)</span>
        </div>
      )}

      {/* ── Summary Stat Cards ── */}
      <div className="squad-stat-cards">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#3fb950' }}>{Math.round(totalSc)}</div>
          <div className="stat-label">Total SC Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#58a6ff' }}>{scCount ? avgSc.toFixed(1) : '-'}</div>
          <div className="stat-label">Avg SC / Player</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#d29922' }}>{ageCount ? avgAge.toFixed(1) : '-'}</div>
          <div className="stat-label">Avg Age</div>
        </div>
        <div className="stat-card">
          <div className="squad-pos-summary">
            {posCounts.DEF > 0 && <span className="squad-pos-chip squad-chip-def">DEF {posCounts.DEF}</span>}
            {posCounts.MID > 0 && <span className="squad-pos-chip squad-chip-mid">MID {posCounts.MID}</span>}
            {posCounts.FWD > 0 && <span className="squad-pos-chip squad-chip-fwd">FWD {posCounts.FWD}</span>}
            {posCounts.RUC > 0 && <span className="squad-pos-chip squad-chip-ruc">RUC {posCounts.RUC}</span>}
          </div>
          <div className="stat-label">Roster Makeup</div>
        </div>
      </div>

      {/* ── Mobile Squad Cards ── */}
      <div className="d-lg-none">
        <div className="d-flex justify-content-between align-items-center px-2 py-2">
          <span className="fw-bold" style={{ fontSize: '.85rem' }}>Squad Roster</span>
        </div>
        {players.map(p => {
          const primary = (p.position || 'MID').split('/')[0]
          return (
            <div key={p.id} className="squad-mob-card">
              {p.injury ? (
                <span className="status-dot status-dot-injured"></span>
              ) : (
                <span className="status-dot status-dot-taken"></span>
              )}
              <div className="squad-mob-logo" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#484f58' }}>
                <i className="bi bi-shield-fill" style={{ fontSize: '.7rem' }}></i>
              </div>
              <div className="squad-mob-info">
                <div className="squad-mob-name">
                  <span style={{ color: '#c9d1d9' }}>{p.name}</span>
                  {p.is_captain && <span className="squad-badge squad-badge-cap">C</span>}
                  {p.is_vc && <span className="squad-badge squad-badge-vc">VC</span>}
                </div>
                <div className="squad-mob-meta">
                  <span className={`pos-badge pos-${primary}`} style={{ fontSize: '.6rem', padding: '0 4px' }}>{primary}</span>
                  <span>{p.afl_team || '-'}</span>
                  {p.age > 0 && <span>Age {p.age}</span>}
                  {p.injury && <span className="squad-mob-injury"><i className="bi bi-bandaid-fill"></i> {p.injury}</span>}
                </div>
              </div>
              <div className="squad-mob-sc">
                {p.sc_avg ? <span className="squad-sc">{p.sc_avg.toFixed(1)}</span> : <span>-</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Desktop List View Table ── */}
      <div className="card d-none d-lg-block">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span className="fw-bold" style={{ fontSize: '.9rem' }}>Squad Roster</span>
        </div>
        <div className="card-body p-0" style={{ overflowX: 'auto' }}>
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th style={{ width: 40 }}>#</th>
                <th>Player</th>
                <th>Pos</th>
                <th>AFL Team</th>
                <th className="text-center">Age</th>
                <th className="text-center">Games</th>
                <th className="text-end">SC Avg</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => {
                const scVal = p.sc_avg || 0
                const scClass = scVal >= 100 ? 'squad-sc-elite' : scVal >= 80 ? 'squad-sc-good' : scVal >= 60 ? 'squad-sc-avg' : 'squad-sc-low'
                return (
                  <tr key={p.id}>
                    <td className="text-center">
                      {p.injury ? (
                        <span className="status-dot status-dot-injured"></span>
                      ) : (
                        <span className="status-dot status-dot-taken"></span>
                      )}
                    </td>
                    <td style={{ color: '#484f58' }}>{i + 1}</td>
                    <td>
                      <span className="fw-bold" style={{ color: '#c9d1d9' }}>{p.name}</span>
                      {p.is_captain && <span className="squad-badge squad-badge-cap">C</span>}
                      {p.is_vc && <span className="squad-badge squad-badge-vc">VC</span>}
                      {p.injury && <span style={{ marginLeft: 8, fontSize: '.7rem', color: '#f85149' }}><i className="bi bi-bandaid-fill me-1"></i>{p.injury}</span>}
                    </td>
                    <td>
                      {(p.position || 'MID').split('/').map(pos => (
                        <span key={pos} className={`pos-badge pos-${pos}`}>{pos}</span>
                      ))}
                    </td>
                    <td><span style={{ fontSize: '.8rem' }}>{p.afl_team || ''}</span></td>
                    <td className="text-center" style={{ color: '#8b949e' }}>{p.age || '-'}</td>
                    <td className="text-center" style={{ color: '#8b949e' }}>{p.games || '-'}</td>
                    <td className="text-end">
                      {scVal > 0 ? (
                        <span className={`squad-sc ${scClass}`}>{scVal.toFixed(0)}</span>
                      ) : '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
