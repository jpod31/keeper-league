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

const POS_ORDER = ['DEF', 'MID', 'RUC', 'FWD']

export function SquadPage() {
  const { leagueId, teamId } = useParams()
  const { league } = useLeague()
  const { data, loading } = useFetch<SquadData>(`/api/leagues/${leagueId}/team/${teamId}/squad`)

  if (loading) return <Spinner />
  if (!data) return <p className="text-danger">Failed to load squad</p>

  const isOwnTeam = league?.user_team?.id === Number(teamId)
  const players = data.players
  const totalSc = players.reduce((s, p) => s + (p.sc_avg || 0), 0)
  const avgSc = players.length ? totalSc / players.length : 0
  const avgAge = players.length ? players.reduce((s, p) => s + (p.age || 0), 0) / players.length : 0
  const posCounts = { DEF: 0, MID: 0, FWD: 0, RUC: 0 }
  players.forEach(p => {
    const pos = p.position?.split('/')[0]
    if (pos && pos in posCounts) (posCounts as Record<string, number>)[pos]++
  })

  return (
    <div>
      {/* Squad hero - matches squad.html */}
      <div className="squad-hero">
        <div className="squad-hero-inner">
          <div className="d-flex align-items-center gap-3">
            <div className="squad-logo-wrap">
              <div className="squad-logo-placeholder">{data.team.name.substring(0, 2).toUpperCase()}</div>
            </div>
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <h2 className="squad-hero-title">{data.team.name}</h2>
                <span className="squad-hero-count d-none d-lg-inline">{players.length} players</span>
                {isOwnTeam && <span className="squad-hero-owner d-none d-lg-inline">Your Team</span>}
              </div>
            </div>
          </div>

          {/* Desktop pills */}
          <div className="squad-hero-actions d-none d-lg-flex">
            {isOwnTeam && (
              <>
                <Link to={`/leagues/${leagueId}/trades`} className="squad-pill squad-pill-manage text-decoration-none">
                  <i className="bi bi-arrow-left-right"></i>Trades
                </Link>
                <Link to={`/leagues/${leagueId}/team/${teamId}/stats`} className="squad-pill squad-pill-stats text-decoration-none">
                  <i className="bi bi-graph-up"></i>Stats
                </Link>
                <Link to={`/leagues/${leagueId}/team/${teamId}/analytics`} className="squad-pill squad-pill-manage text-decoration-none">
                  <i className="bi bi-bar-chart-line"></i>Analytics
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile subnav */}
      <div className="mob-subnav d-lg-none">
        <span className="mob-subnav-item active"><i className="bi bi-table"></i><span>List</span></span>
        {isOwnTeam && (
          <>
            <Link to={`/leagues/${leagueId}/team/${teamId}/stats`} className="mob-subnav-item text-decoration-none">
              <i className="bi bi-graph-up"></i><span>Stats</span>
            </Link>
            <Link to={`/leagues/${leagueId}/team/${teamId}/analytics`} className="mob-subnav-item text-decoration-none">
              <i className="bi bi-bar-chart-line"></i><span>Analytics</span>
            </Link>
          </>
        )}
      </div>

      {/* Not own team notice */}
      {!isOwnTeam && (
        <div className="d-flex align-items-center gap-2 mb-3 px-3 py-2" style={{ background: 'var(--kl-bg-card)', borderRadius: 8, border: '1px solid var(--kl-border)', fontSize: '.82rem', color: 'var(--kl-text-secondary)' }}>
          <i className="bi bi-eye"></i>
          <span>Viewing <strong style={{ color: 'var(--kl-text-heading)' }}>{data.team.name}</strong>&apos;s squad (read-only)</span>
        </div>
      )}

      {/* Stat cards - matches squad.html */}
      <div className="squad-stat-cards">
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#3fb950' }}>{Math.round(totalSc).toLocaleString()}</div>
          <div className="stat-label">Total SC Value</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#58a6ff' }}>{avgSc.toFixed(1)}</div>
          <div className="stat-label">Avg SC / Player</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#d29922' }}>{avgAge.toFixed(1)}</div>
          <div className="stat-label">Avg Age</div>
        </div>
        <div className="stat-card">
          <div className="squad-pos-summary">
            <span className="squad-pos-chip squad-chip-def">DEF {posCounts.DEF}</span>
            <span className="squad-pos-chip squad-chip-mid">MID {posCounts.MID}</span>
            <span className="squad-pos-chip squad-chip-fwd">FWD {posCounts.FWD}</span>
            <span className="squad-pos-chip squad-chip-ruc">RUC {posCounts.RUC}</span>
          </div>
          <div className="stat-label">Roster Makeup</div>
        </div>
      </div>

      {/* Player list table (desktop) */}
      <div className="card d-none d-lg-block">
        <div className="card-header d-flex justify-content-between align-items-center">
          <span className="fw-bold" style={{ fontSize: '.85rem' }}>Roster</span>
          <span style={{ fontSize: '.75rem', color: '#8b949e' }}>{players.length} players</span>
        </div>
        <div className="card-body p-0">
          <table className="table table-hover mb-0">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>AFL Team</th>
                <th className="text-center">Age</th>
                <th className="text-end">SC Avg</th>
                <th className="text-center">Games</th>
                <th>Tag</th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className="fw-bold" style={{ color: '#c9d1d9' }}>{p.name}</span>
                    {p.is_captain && <span className="badge ms-1" style={{ background: '#d29922', fontSize: '.55rem' }}>C</span>}
                    {p.is_vc && <span className="badge ms-1" style={{ background: '#484f58', fontSize: '.55rem' }}>VC</span>}
                    {p.injury && <span className="ms-2" style={{ fontSize: '.7rem', color: '#f85149' }}><i className="bi bi-bandaid-fill me-1"></i>{p.injury}</span>}
                  </td>
                  <td><span className={`pos-badge pos-${p.position?.split('/')[0]}`} style={{ fontSize: '.65rem', padding: '1px 5px' }}>{p.position}</span></td>
                  <td style={{ color: '#8b949e', fontSize: '.78rem' }}>{p.afl_team}</td>
                  <td className="text-center" style={{ color: '#8b949e' }}>{p.age}</td>
                  <td className="text-end"><span className="fw-bold">{p.sc_avg?.toFixed(0) || '—'}</span></td>
                  <td className="text-center" style={{ color: '#8b949e' }}>{p.games}</td>
                  <td>{p.tag && <span className="profile-tag" style={p.tag_css ? { cssText: p.tag_css } as React.CSSProperties : undefined}>{p.tag}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: position grouped list */}
      <div className="d-lg-none mob-squad-list">
        {POS_ORDER.map(pos => {
          const posPlayers = players.filter(p => p.position?.startsWith(pos))
          if (!posPlayers.length) return null
          const bgColor = pos === 'DEF' ? 'rgba(26,63,102,.35)' : pos === 'MID' ? 'rgba(53,29,74,.35)' : pos === 'FWD' ? 'rgba(70,41,10,.35)' : 'rgba(29,61,46,.35)'
          const borderColor = pos === 'DEF' ? '#79c0ff' : pos === 'MID' ? '#d2a8ff' : pos === 'FWD' ? '#ffb471' : '#7ee787'

          return (
            <div className="mob-pos-group" key={pos}>
              <div className="mob-pos-header" style={{ background: bgColor, borderLeft: `3px solid ${borderColor}` }}>
                <span className="mob-pos-label" style={{ color: borderColor }}>{pos}</span>
                <span className="mob-pos-count">{posPlayers.length}</span>
              </div>
              {posPlayers.map(p => (
                <div className="mob-pos-row" key={p.id}>
                  <div className="mob-pos-info">
                    <div className="mob-pos-name">
                      {p.name}
                      {p.is_captain && <span className="mob-pos-badge mob-badge-cap">C</span>}
                      {p.is_vc && <span className="mob-pos-badge mob-badge-vc">VC</span>}
                    </div>
                    <div className="mob-pos-meta">
                      <span className={`pos-badge pos-${pos}`} style={{ fontSize: '.55rem', padding: '0 4px' }}>{p.position}</span>
                      <span>{p.afl_team}</span>
                      {p.injury && <span className="squad-mob-injury"><i className="bi bi-bandaid-fill"></i> {p.injury}</span>}
                    </div>
                  </div>
                  <div className="mob-pos-sc">
                    <span style={{ color: '#e6edf3', fontWeight: 700 }}>{p.sc_avg?.toFixed(0) || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
