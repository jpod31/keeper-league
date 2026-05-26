import { useParams, Link } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'

interface Team { id: number; name: string; logo_url?: string | null }

interface Standing {
  team_id: number
  team: Team | null
  wins: number
  losses: number
  draws: number
  ladder_points: number
  points_for: number
  points_against: number
  percentage: number
}

interface Ranking {
  rank: number
  movement: number
  team_id: number
  team: Team | null
  score: number
  afl_round: number
}

interface RankingDetail {
  headline: string
  avg_score: number
  league_avg: number
  pct_above: number
  best_round: number
  worst_round: number
  record: string
  form_wins: number
  form_losses: number
  form_total: number
}

interface ScoringContext {
  type: string
  label: string
  is_uf: boolean
  is_custom: boolean
  is_hybrid: boolean
  has_custom_rules: boolean
  score_label: string
  for_label: string
  against_label: string
  pct_label: string
}

interface StandingsData {
  standings: Standing[]
  finals_teams: number
  scoring: ScoringContext
  rankings: Ranking[]
  ranking_details: Record<string, RankingDetail>
  team_form: Record<string, string[]>
  user_team_id: number | null
}

// Stable deterministic team accent (matches LeagueShell palette)
const PALETTE: { hex: string; rgb: string }[] = [
  { hex: '#3a7dc4', rgb: '58,125,196' },
  { hex: '#b87f3d', rgb: '184,127,61' },
  { hex: '#8a6db8', rgb: '138,109,184' },
  { hex: '#3d8c63', rgb: '61,140,99' },
  { hex: '#c2932f', rgb: '194,147,47' },
  { hex: '#b85a4a', rgb: '184,90,74' },
  { hex: '#3d8a9c', rgb: '61,138,156' },
  { hex: '#9d5878', rgb: '157,88,120' },
]
function accentFor(id: number) {
  return PALETTE[(id || 0) % PALETTE.length]
}

function headlineSlug(h: string): string {
  return (h || 'Steady').toLowerCase().replace(/\s+/g, '')
}

function scoringTagType(label: string): string {
  const l = (label || '').toLowerCase()
  if (l.includes('supercoach')) return 'sc'
  if (l.includes('fantasy')) return 'af'
  if (l.includes('ultimate')) return 'uf'
  if (l.includes('hybrid')) return 'hybrid'
  return 'custom'
}

// CSS — unified ladder + glass rows, equal weight across all positions.
// Mobile cards inherit the same row layout, just compacter.
const LAD_CSS = `
.lad-wrap { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.lad-head {
  display: grid;
  grid-template-columns: 36px 1fr 130px 84px 88px 84px 60px;
  gap: 12px;
  align-items: center;
  padding: 0 16px;
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #6c7892;
  margin-bottom: 4px;
}
.lad-head > * { text-align: right; }
.lad-head > :nth-child(1), .lad-head > :nth-child(2) { text-align: left; }

.lad-row {
  position: relative;
  display: grid;
  grid-template-columns: 36px 1fr 130px 84px 88px 84px 60px;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(15,22,36,.7);
  border: 1px solid rgba(110,130,180,.12);
  text-decoration: none;
  color: #dde4f1;
  transition: background .14s ease, border-color .14s ease, transform .14s ease;
}
.lad-row:hover {
  background: rgba(20,28,45,.8);
  border-color: rgba(110,130,180,.22);
  transform: translateX(2px);
  text-decoration: none;
}
.lad-row::before {
  /* Team-coloured 2px left edge stripe */
  content: "";
  position: absolute;
  left: 0; top: 16px; bottom: 16px;
  width: 2px;
  border-radius: 2px;
  background: var(--lad-accent, #97a3ba);
  opacity: .65;
}
.lad-row.mine {
  background: linear-gradient(90deg, rgba(var(--lad-accent-rgb, 122,155,196), .14), rgba(var(--lad-accent-rgb, 122,155,196), .04) 60%, transparent);
  border-color: rgba(var(--lad-accent-rgb, 122,155,196), .35);
}
.lad-row.mine::before { width: 3px; opacity: 1; }

/* Rank */
.lad-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px; height: 28px;
  border-radius: 8px;
  font-size: .82rem;
  font-weight: 800;
  color: #c0c7d4;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.06);
  font-variant-numeric: tabular-nums;
}
.lad-rank-1 { color: #e8c25b; border-color: rgba(232,194,91,.4); background: rgba(232,194,91,.08); }
.lad-rank-2 { color: #b6bdcc; border-color: rgba(182,189,204,.35); background: rgba(182,189,204,.06); }
.lad-rank-3 { color: #b8855d; border-color: rgba(184,133,93,.35); background: rgba(184,133,93,.06); }

/* Team column */
.lad-team {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.lad-team-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.lad-team-name {
  font-size: .92rem;
  font-weight: 700;
  color: #f0f4fc;
  letter-spacing: -.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lad-pill {
  display: inline-flex;
  align-items: center;
  font-size: .54rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid;
  white-space: nowrap;
}
.lad-pill-onfire, .lad-pill-dominant { color: #6db38a; border-color: rgba(109,179,138,.4); background: rgba(109,179,138,.1); }
.lad-pill-surging, .lad-pill-strong { color: #82b3e4; border-color: rgba(130,179,228,.4); background: rgba(130,179,228,.1); }
.lad-pill-steady { color: #9aa6bb; border-color: rgba(154,166,187,.3); background: rgba(154,166,187,.06); }
.lad-pill-underperforming, .lad-pill-struggling { color: #d68a7e; border-color: rgba(214,138,126,.35); background: rgba(214,138,126,.08); }
.lad-pill-sliding, .lad-pill-infreefall { color: #e07a6c; border-color: rgba(224,122,108,.45); background: rgba(224,122,108,.12); }

.lad-team-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: .68rem;
  color: #97a3ba;
  font-variant-numeric: tabular-nums;
}
.lad-team-sub b { color: #c8d0e0; font-weight: 600; }
.lad-team-sub .sep { width: 3px; height: 3px; border-radius: 50%; background: #4a5471; }
.lad-team-sub .pos { color: #6db38a; }
.lad-team-sub .neg { color: #d68a7e; }

/* Form sparkline (last N results) */
.lad-form {
  display: flex;
  gap: 3px;
  justify-content: flex-end;
}
.lad-form-dot {
  width: 6px;
  height: 18px;
  border-radius: 2px;
  background: rgba(255,255,255,.04);
}
.lad-form-dot.W { background: #3d8c63; }
.lad-form-dot.L { background: #b85a4a; }
.lad-form-dot.D { background: #c2932f; }

/* Momentum chip */
.lad-momentum {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
  font-size: .72rem;
  font-weight: 700;
  color: #97a3ba;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(255,255,255,.03);
  min-width: 56px;
}
.lad-momentum.up { color: #6db38a; background: rgba(61,140,99,.1); }
.lad-momentum.down { color: #d68a7e; background: rgba(184,90,74,.1); }
.lad-momentum.flat { color: #6c7892; }

/* Numeric columns */
.lad-num {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
  font-size: .92rem;
  font-weight: 600;
  color: #dde4f1;
  text-align: right;
}
.lad-num-strong { font-size: 1rem; font-weight: 800; color: #f0f4fc; }
.lad-num-muted { color: #97a3ba; }
.lad-num .unit {
  font-size: .68rem;
  font-weight: 500;
  color: #6c7892;
  margin-left: 2px;
}

.lad-record { display: inline-flex; gap: 4px; align-items: baseline; }
.lad-record .w { color: #6db38a; }
.lad-record .l { color: #d68a7e; }
.lad-record .d { color: #c2932f; }

/* Finals cut divider */
.lad-cut {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 4px 8px;
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(109,179,138,.65);
}
.lad-cut::before, .lad-cut::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(109,179,138,.35), transparent);
}
.lad-cut span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(61,140,99,.08);
  border: 1px solid rgba(61,140,99,.25);
}

/* Footer */
.lad-foot {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 16px 4px;
  font-size: .68rem;
  color: #6c7892;
}
.lad-foot .scoring-tag {
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(110,130,180,.25);
  background: rgba(15,22,36,.5);
  color: #b8c2d4;
}

/* Empty state */
.lad-empty { text-align: center; padding: 60px 20px; color: #4a5471; }
.lad-empty i { font-size: 2rem; display: block; margin-bottom: 12px; color: #38415a; }
.lad-empty h4 { color: #97a3ba; font-size: 1rem; font-weight: 600; margin: 0 0 4px; }
.lad-empty p { font-size: .82rem; margin: 0; }

/* Competition toggle */
.lad-comp-toggle {
  display: inline-flex;
  background: rgba(15,22,36,.5);
  border: 1px solid rgba(110,130,180,.18);
  border-radius: 999px;
  padding: 3px;
  margin-bottom: 16px;
}
.lad-comp-btn {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: .74rem;
  font-weight: 700;
  color: #97a3ba;
  text-decoration: none;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.lad-comp-btn:hover { color: #dde4f1; text-decoration: none; }
.lad-comp-btn.active {
  background: rgba(58,125,196,.18);
  color: #82b3e4;
}
.lad-sevens .lad-comp-btn.active {
  background: rgba(138,109,184,.18);
  color: #b39ed4;
}

/* Mobile — switch to stacked card per row */
@media (max-width: 768px) {
  .lad-head { display: none; }
  .lad-row {
    grid-template-columns: 28px 1fr auto;
    grid-template-rows: auto auto;
    gap: 8px 10px;
    padding: 12px 14px;
  }
  .lad-row > .lad-rank { grid-row: 1; grid-column: 1; }
  .lad-row > .lad-team { grid-row: 1; grid-column: 2; }
  .lad-row > .lad-num-strong { grid-row: 1; grid-column: 3; }
  .lad-row > .lad-form { grid-row: 2; grid-column: 1 / -1; justify-content: flex-start; }
  .lad-row > .lad-num:not(.lad-num-strong),
  .lad-row > .lad-momentum { display: none; }
}

/* Sevens mode — purple accent palette */
.lad-sevens .lad-form-dot.W { background: #8a6db8; }
.lad-sevens .lad-num-strong { color: #b39ed4; }
`

export interface StandingsPageProps {
  mode?: 'main' | 'sevens'
}

export function StandingsPage({ mode = 'main' }: StandingsPageProps = {}) {
  const { leagueId } = useParams()
  const isSevens = mode === 'sevens'
  const apiUrl = isSevens
    ? `/leagues/${leagueId}/reserve7s/standings?format=json`
    : `/leagues/${leagueId}/standings?format=json`
  const { data, loading } = useFetch<StandingsData>(apiUrl)

  if (loading) return <Spinner text="Loading standings..." />
  if (!data) return <p className="text-danger">Failed to load standings</p>

  const { standings, finals_teams, scoring, rankings, ranking_details, team_form, user_team_id } = data
  const hasRankings = rankings && rankings.length > 0
  const scType = scoringTagType(scoring.label)

  // Merge standings + rankings into one row per team, keyed by team_id
  const rankingByTeam: Record<number, Ranking> = {}
  for (const r of rankings || []) rankingByTeam[r.team_id] = r

  return (
    <div className={isSevens ? 'lad-sevens' : ''}>
      <style>{LAD_CSS}</style>
      <div className="d-none d-lg-block"><LeagueSubnav active="ladder" leagueId={leagueId!} /></div>

      <div className="lad-comp-toggle">
        {isSevens ? (
          <Link to={`/leagues/${leagueId}/standings`} className="lad-comp-btn">Main</Link>
        ) : (
          <span className="lad-comp-btn active">Main</span>
        )}
        {isSevens ? (
          <span className="lad-comp-btn active">7s</span>
        ) : (
          <Link to={`/leagues/${leagueId}/reserve7s/standings`} className="lad-comp-btn">7s</Link>
        )}
      </div>

      {standings.length === 0 ? (
        <div className="lad-empty">
          <i className="bi bi-bar-chart"></i>
          <h4>No teams yet</h4>
          <p>Teams will appear here once they join the league.</p>
        </div>
      ) : (
        <>
          <div className="lad-head">
            <span>#</span>
            <span>Team</span>
            <span>Form · 5</span>
            <span>Mov.</span>
            <span>{scoring.for_label}</span>
            <span>{scoring.pct_label}</span>
            <span>Pts</span>
          </div>

          <div className="lad-wrap">
            {standings.map((s, i) => {
              const pos = i + 1
              const rk = rankingByTeam[s.team_id]
              const detail = rk && ranking_details[String(s.team_id)]
              const form = team_form[String(s.team_id)] || []
              const isMine = user_team_id != null && s.team_id === user_team_id
              const isFinalsCut = finals_teams > 0 && pos === finals_teams
              const accent = accentFor(s.team_id)
              const movement = rk?.movement ?? 0
              const headline = detail?.headline
              const headlineCls = headlineSlug(headline || '')

              return (
                <div key={s.team_id}>
                  <Link
                    to={`/leagues/${leagueId}/team/${s.team_id}`}
                    className={`lad-row${isMine ? ' mine' : ''}`}
                    style={{
                      ['--lad-accent' as string]: accent.hex,
                      ['--lad-accent-rgb' as string]: accent.rgb,
                    } as React.CSSProperties}
                  >
                    <span className={`lad-rank${pos <= 3 ? ` lad-rank-${pos}` : ''}`}>{pos}</span>

                    <div className="lad-team">
                      <div className="lad-team-row">
                        <span className="lad-team-name">{s.team?.name}</span>
                        {headline && (
                          <span className={`lad-pill lad-pill-${headlineCls}`}>{headline}</span>
                        )}
                      </div>
                      <div className="lad-team-sub">
                        <span className="lad-record">
                          <span className="w">{s.wins}W</span>
                          <span className="l">{s.losses}L</span>
                          {s.draws > 0 && <span className="d">{s.draws}D</span>}
                        </span>
                        {detail && (
                          <>
                            <span className="sep"></span>
                            <span>Avg <b>{detail.avg_score}</b></span>
                            <span className="sep"></span>
                            <span className={detail.pct_above > 0 ? 'pos' : detail.pct_above < 0 ? 'neg' : ''}>
                              {detail.pct_above >= 0 ? '+' : ''}{detail.pct_above.toFixed(1)}% vs lge
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="lad-form">
                      {(form.length > 0 ? form : Array(5).fill('')).slice(-5).map((r, i) => (
                        <span key={i} className={`lad-form-dot ${r}`} title={r || 'No result'}></span>
                      ))}
                    </div>

                    <span className={`lad-momentum ${movement > 0 ? 'up' : movement < 0 ? 'down' : 'flat'}`}>
                      {movement > 0 && <><i className="bi bi-caret-up-fill" style={{ fontSize: '.6rem' }}></i>{movement}</>}
                      {movement < 0 && <><i className="bi bi-caret-down-fill" style={{ fontSize: '.6rem' }}></i>{Math.abs(movement)}</>}
                      {movement === 0 && <>—</>}
                    </span>

                    <span className="lad-num">
                      {s.points_for > 0 ? Math.round(s.points_for) : '–'}
                    </span>

                    <span className="lad-num">
                      {s.percentage > 0 ? (
                        <span
                          style={
                            s.percentage >= 110 ? { color: '#6db38a' }
                              : s.percentage < 90 ? { color: '#d68a7e' }
                                : undefined
                          }
                        >
                          {s.percentage.toFixed(1)}<span className="unit">%</span>
                        </span>
                      ) : '–'}
                    </span>

                    <span className="lad-num lad-num-strong">{s.ladder_points}</span>
                  </Link>

                  {isFinalsCut && (
                    <div className="lad-cut" key={`cut-${s.team_id}`}>
                      <span><i className="bi bi-trophy-fill"></i>Finals cut · top {finals_teams}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="lad-foot">
            <span>{hasRankings && rankings[0] ? `Round ${rankings[0].afl_round} · Form, momentum & headlines updated weekly` : ''}</span>
            <span className="scoring-tag" data-type={scType}>{scoring.label}</span>
          </div>
        </>
      )}
    </div>
  )
}
