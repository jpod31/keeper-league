import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'

interface Team { id: number; name: string; logo_url?: string | null }

interface Fixture {
  id: number
  home_team_id: number
  away_team_id: number
  home_team: Team | null
  away_team: Team | null
  home_score: number | null
  away_score: number | null
  status: string
}

interface ScoringContext {
  type: string
  label: string
  [k: string]: unknown
}

interface RoundData {
  afl_round: number
  fixtures: Fixture[]
  is_commissioner: boolean
  max_round: number
  scoring: ScoringContext
}

// CSS from templates/matchups/round.html <style> block
const RD_CSS = `
.rd-hdr { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #1e1d21; }
.rd-hdr-left { display:flex; align-items:center; gap:10px; }
.rd-hdr h3 { font-size:1.05rem; font-weight:700; color:#ebebee; margin:0; }
.rd-nav { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; border:1px solid #1e1d21; background:transparent; color:var(--kl-text-primary); text-decoration:none; transition:all .12s; font-size:.8125rem; }
.rd-nav:hover { border-color:#2a292f; color:var(--kl-text-primary); }
.rd-actions { display:flex; gap:6px; }
.rd-btn { font-size:.8125rem; padding:4px 10px; border-radius:6px; border:1px solid #1e1d21; background:transparent; color:var(--kl-text-primary); text-decoration:none; transition:all .12s; cursor:pointer; }
.rd-btn:hover { border-color:#2a292f; color:var(--kl-text-primary); }
.rd-btn-primary { border-color:rgba(236,236,246,.3); color:#ececf6; }
.rd-btn-primary:hover { border-color:#ececf6; background:rgba(236,236,246,.06); }
.rd-list { background:#0e0d0f; border:1px solid #1e1d21; border-radius:10px; overflow:hidden; }
.rd-row { display:grid; grid-template-columns:1fr auto 1fr auto; align-items:center; padding:14px 20px; border-bottom:1px solid #151518; transition:background .1s; position:relative; }
.rd-row:last-child { border-bottom:none; }
.rd-row:hover { background:rgba(21,21,24,.5); }
.rd-team { font-size:.85rem; font-weight:500; color:var(--kl-text-primary); text-decoration:none; transition:color .1s; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rd-team:hover { color:#ececf6; }
.rd-team-home { text-align:left; padding-right:12px; }
.rd-team-away { text-align:right; padding-left:12px; }
.rd-team.won { color:#ebebee; font-weight:700; }
.rd-centre { display:flex; align-items:center; justify-content:center; min-width:100px; }
.rd-sc { font-size:.95rem; font-weight:700; min-width:34px; text-align:center; font-variant-numeric:tabular-nums; }
.rd-sc.won { color:#3fb950; }
.rd-sc.lost { color:var(--kl-text-primary); }
.rd-sep { color:#1e1d21; margin:0 4px; font-weight:300; font-size:.8125rem; }
.rd-vs { font-size:.8125rem; font-weight:700; color:#2a292f; letter-spacing:1.5px; }
.rd-arrow { display:flex; align-items:center; justify-content:center; width:28px; color:#1e1d21; transition:color .1s; }
.rd-row:hover .rd-arrow { color:var(--kl-text-primary); }
.rd-arrow a { color:inherit; text-decoration:none; display:flex; }
.rd-win-bar { position:absolute; left:0; top:0; bottom:0; width:4px; border-radius:0 2px 2px 0; background:#3fb950; }
.rd-loss-bar { position:absolute; left:0; top:0; bottom:0; width:4px; border-radius:0 2px 2px 0; background:rgba(248,81,73,.4); }
`

function scoringTagType(label: string): string {
  const l = label.toLowerCase()
  if (l.includes('supercoach')) return 'sc'
  if (l.includes('fantasy')) return 'af'
  if (l.includes('ultimate')) return 'uf'
  if (l.includes('hybrid')) return 'hybrid'
  return 'custom'
}

export function RoundDetailPage() {
  const { leagueId, round } = useParams()
  const { data, loading } = useFetch<RoundData>(`/leagues/${leagueId}/fixture/${round}?format=json`)

  if (loading) return <Spinner text="Loading round..." />
  if (!data) return <p className="text-danger">Failed to load round</p>

  const { afl_round, fixtures, max_round, scoring: ctx } = data
  const scType = scoringTagType(ctx.label)

  return (
    <div>
      <style>{RD_CSS}</style>
      <LeagueSubnav active="fixture" leagueId={leagueId!} />

      <div className="page-header" style={{ marginTop: 0 }}>
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}/fixture?round=${afl_round}`}>Season</Link>
          {' / '}{afl_round === 0 ? 'Pre-Season' : `Round ${afl_round}`}
        </div>
      </div>

      <div className="rd-hdr">
        <div className="rd-hdr-left">
          {afl_round > 0 && (
            <Link to={`/leagues/${leagueId}/fixture/${afl_round - 1}`} className="rd-nav">
              <i className="bi bi-chevron-left"></i>
            </Link>
          )}
          <h3>{afl_round === 0 ? 'Pre-Season' : `Round ${afl_round}`}</h3>
          <span className="scoring-tag ms-2" data-type={scType}>{ctx.label}</span>
          {afl_round < max_round && (
            <Link to={`/leagues/${leagueId}/fixture/${afl_round + 1}`} className="rd-nav">
              <i className="bi bi-chevron-right"></i>
            </Link>
          )}
        </div>
        <div className="rd-actions">
          <Link to={`/leagues/${leagueId}/gameday?round=${afl_round}`} className="rd-btn">
            <i className="bi bi-broadcast me-1"></i>Live
          </Link>
        </div>
      </div>

      {fixtures.length > 0 ? (
        <div className="rd-list">
          {fixtures.map(f => {
            const homeWon = f.status === 'completed' && (f.home_score || 0) > (f.away_score || 0)
            const awayWon = f.status === 'completed' && (f.away_score || 0) > (f.home_score || 0)
            return (
              <div key={f.id} className="rd-row">
                {homeWon && <div className="rd-win-bar"></div>}
                {awayWon && <div className="rd-loss-bar"></div>}
                <Link to={`/leagues/${leagueId}/team/${f.home_team_id}`} className={`rd-team rd-team-home${homeWon ? ' won' : ''}`}>
                  {f.home_team?.name}
                </Link>
                <div className="rd-centre">
                  {f.status === 'completed' ? (
                    <>
                      <span className={`rd-sc${homeWon ? ' won' : ' lost'}`}>{Math.round(f.home_score || 0)}</span>
                      <span className="rd-sep">&ndash;</span>
                      <span className={`rd-sc${awayWon ? ' won' : ' lost'}`}>{Math.round(f.away_score || 0)}</span>
                    </>
                  ) : (
                    <span className="rd-vs">VS</span>
                  )}
                </div>
                <Link to={`/leagues/${leagueId}/team/${f.away_team_id}`} className={`rd-team rd-team-away${awayWon ? ' won' : ''}`}>
                  {f.away_team?.name}
                </Link>
                <div className="rd-arrow">
                  <Link to={`/leagues/${leagueId}/matchup/${f.id}`}>
                    <i className="bi bi-chevron-right" style={{ fontSize: '.8125rem' }}></i>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p style={{ color: 'var(--kl-text-primary)', fontSize: '.85rem' }}>No fixtures for this round.</p>
      )}
    </div>
  )
}
