import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'
import { TeamBadge } from '../../components/ui/TeamBadge'

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
.rd-list { border-top:1px solid var(--hair); }
.rd-row { display:grid; grid-template-columns:1fr auto 1fr 20px; align-items:center; gap:16px; padding:14px 8px; border-bottom:1px solid var(--hair); color:#ffffff; text-decoration:none; }
.rd-row:hover { background:rgba(255,255,255,.04); color:#ffffff; }
.rd-team { display:flex; align-items:center; gap:12px; min-width:0; font-size:1rem; font-weight:500; color:#ffffff; }
.rd-team-away { justify-content:flex-end; text-align:right; }
.rd-team-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
.rd-team.won .rd-team-name { font-weight:700; }
.rd-centre { display:grid; grid-template-columns:88px 64px 88px; align-items:center; justify-items:center; }
.rd-centre > .rd-mid:only-child { grid-column:1 / -1; }
.rd-sc { font-size:1.5rem; font-weight:500; letter-spacing:-.03em; line-height:1; font-variant-numeric:tabular-nums; color:#ffffff; }
.rd-sc:first-child { justify-self:end; }
.rd-sc:last-child { justify-self:start; }
.rd-sc.won { font-weight:800; }
.rd-mid { font-size:.8125rem; font-weight:600; color:#ffffff; }
.rd-live { display:inline-block; padding:2px 6px; border-radius:4px; background:#f85149; color:#050506; font-size:.8125rem; font-weight:800; letter-spacing:.04em; text-transform:uppercase; line-height:1.2; }
.rd-arrow { font-size:.8125rem; color:#ffffff; justify-self:end; }
@media (max-width: 600px) {
  .rd-row { gap:8px; padding:12px 2px; grid-template-columns:1fr auto 1fr; }
  .rd-arrow { display:none; }
  .rd-team { flex-direction:column; gap:6px; font-size:.8125rem; text-align:center; }
  .rd-team-away { flex-direction:column-reverse; }
  .rd-team-name { max-width:100%; }
  .rd-centre { grid-template-columns:auto 36px auto; }
  .rd-sc { font-size:1.25rem; }
}
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
          {' / '}{afl_round === 0 ? 'Opening Round' : `Round ${afl_round}`}
        </div>
      </div>

      <div className="rd-hdr">
        <div className="rd-hdr-left">
          {afl_round > 0 && (
            <Link to={`/leagues/${leagueId}/fixture/${afl_round - 1}`} className="rd-nav">
              <i className="bi bi-chevron-left"></i>
            </Link>
          )}
          <h3>{afl_round === 0 ? 'Opening Round' : `Round ${afl_round}`}</h3>
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
            const done = f.status === 'completed'
            const live = f.status === 'live'
            const hs = Math.round(f.home_score || 0), as = Math.round(f.away_score || 0)
            const homeUp = (done || live) && hs > as
            const awayUp = (done || live) && as > hs
            return (
              <Link key={f.id} to={`/leagues/${leagueId}/matchup/${f.id}`} className="rd-row">
                <span className={`rd-team rd-team-home${homeUp ? ' won' : ''}`}>
                  <TeamBadge name={f.home_team_id} size={32} showName={false} />
                  <span className="rd-team-name">{f.home_team?.name}</span>
                </span>
                <span className="rd-centre">
                  {done || live ? (
                    <>
                      <span className={`rd-sc${homeUp ? ' won' : ''}`}>{hs.toLocaleString()}</span>
                      <span className="rd-mid">{live ? <span className="rd-live">Live</span> : 'v'}</span>
                      <span className={`rd-sc${awayUp ? ' won' : ''}`}>{as.toLocaleString()}</span>
                    </>
                  ) : (
                    <span className="rd-mid">v</span>
                  )}
                </span>
                <span className={`rd-team rd-team-away${awayUp ? ' won' : ''}`}>
                  <span className="rd-team-name">{f.away_team?.name}</span>
                  <TeamBadge name={f.away_team_id} size={32} showName={false} />
                </span>
                <i className="bi bi-chevron-right rd-arrow"></i>
              </Link>
            )
          })}
        </div>
      ) : (
        <p style={{ color: 'var(--kl-text-primary)', fontSize: '.85rem' }}>No fixtures for this round.</p>
      )}
    </div>
  )
}
