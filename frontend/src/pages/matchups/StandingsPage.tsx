import { useParams, Link } from 'react-router'
import { useState, useMemo } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { StandingsSkeleton } from '../../components/ui/StandingsSkeleton'
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
/* Grid: # | Team | Status | PR | W-L | Form | Mov | PF | PA | % | Pts */
.lad-head, .lad-row {
  display: grid;
  grid-template-columns: 36px 1fr 130px 52px 76px 110px 64px 70px 70px 64px 56px;
  gap: 10px;
  align-items: center;
}
.lad-head {
  padding: 0 16px;
  font-size: .58rem;
  font-weight: 800;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: #6c7892;
  margin-bottom: 4px;
}
.lad-head > * { text-align: right; }
.lad-head > :nth-child(1), .lad-head > :nth-child(2), .lad-head > :nth-child(3) { text-align: left; }

/* Sortable header buttons */
.lad-head button.lad-sort {
  all: unset;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
  transition: color .14s ease;
  font: inherit;
  letter-spacing: inherit;
}
.lad-head button.lad-sort:hover { color: #b6c0d3; }
.lad-head .lad-sort-chev {
  font-size: .55rem;
  opacity: .25;
  transition: opacity .14s ease, color .14s ease;
}
.lad-head .lad-sort.active { color: #dde4f1; }
.lad-head .lad-sort.active .lad-sort-chev { opacity: 1; color: #82b3e4; }
.lad-head > :nth-child(n+4) .lad-sort {
  justify-content: flex-end;
  width: 100%;
}

.lad-row {
  position: relative;
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

/* Team column — just the name. Nothing else. */
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

/* W/L record column */
.lad-wl {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
  font-size: .82rem;
  font-weight: 700;
}
.lad-wl .w { color: #6db38a; }
.lad-wl .l { color: #d68a7e; }
.lad-wl .d { color: #c2932f; }
.lad-wl .sep { color: #4a5471; font-weight: 400; }

/* Status column — empty when no headline */
.lad-status { display: flex; align-items: center; }
.lad-status-empty { color: #4a5471; font-size: .68rem; }

/* Power-rank chip — distinct from the ladder rank cell. Top 3 get medal
   gradient + glow, everyone else gets a neutral chip. The small left-edge
   accent strip gives the chip its own identity vs a plain rounded box. */
.lad-pr { text-align: right; display: flex; justify-content: flex-end; align-items: center; }
.lad-pr-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 38px;
  height: 22px;
  padding: 0 9px 0 7px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-variant-numeric: tabular-nums;
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: -.02em;
  background: linear-gradient(135deg, rgba(110,130,180,.10), rgba(110,130,180,.02));
  border: 1px solid rgba(110,130,180,.22);
  color: #b6c0d3;
  position: relative;
}
.lad-pr-chip::before {
  content: "";
  width: 3px;
  height: 12px;
  background: currentColor;
  opacity: .55;
  border-radius: 2px;
}
.lad-pr-chip.tier-1 {
  background: linear-gradient(135deg, rgba(232,194,91,.28), rgba(232,194,91,.06));
  border-color: rgba(232,194,91,.55);
  color: #f0d27a;
  box-shadow: 0 0 14px -2px rgba(232,194,91,.4);
}
.lad-pr-chip.tier-2 {
  background: linear-gradient(135deg, rgba(204,210,222,.22), rgba(204,210,222,.06));
  border-color: rgba(204,210,222,.48);
  color: #e0e6f1;
}
.lad-pr-chip.tier-3 {
  background: linear-gradient(135deg, rgba(199,152,112,.24), rgba(199,152,112,.06));
  border-color: rgba(199,152,112,.5);
  color: #e0b48a;
}
.lad-pr-empty { color: #4a5471; font-size: .82rem; }

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

/* Mobile — compact 3-column layout */
@media (max-width: 768px) {
  .lad-head { display: none; }
  .lad-row {
    grid-template-columns: 28px 1fr auto;
    grid-template-rows: auto auto;
    gap: 8px 10px;
    padding: 12px 14px;
  }
  .lad-row > .lad-rank { grid-row: 1; grid-column: 1; }
  .lad-row > .lad-team-name { grid-row: 1; grid-column: 2; }
  .lad-row > .lad-num-strong { grid-row: 1; grid-column: 3; }
  .lad-row > .lad-status { grid-row: 2; grid-column: 2 / 4; justify-self: start; }
  .lad-row > .lad-form { grid-row: 2; grid-column: 1; justify-content: flex-start; }
  .lad-row > .lad-num:not(.lad-num-strong),
  .lad-row > .lad-pr,
  .lad-row > .lad-wl,
  .lad-row > .lad-momentum { display: none; }
}

/* Sevens mode — purple accent palette */
.lad-sevens .lad-form-dot.W { background: #8a6db8; }
.lad-sevens .lad-num-strong { color: #b39ed4; }
`

export interface StandingsPageProps {
  mode?: 'main' | 'sevens'
}

type SortField = 'pos' | 'name' | 'pr' | 'wins' | 'mov' | 'pf' | 'pa' | 'pct' | 'pts'
type SortDir = 'asc' | 'desc'

const DEFAULT_DIR: Record<SortField, SortDir> = {
  pos: 'asc',
  name: 'asc',
  pr: 'asc',
  wins: 'desc',
  mov: 'desc',
  pf: 'desc',
  pa: 'desc',
  pct: 'desc',
  pts: 'desc',
}

export function StandingsPage({ mode = 'main' }: StandingsPageProps = {}) {
  const { leagueId } = useParams()
  const isSevens = mode === 'sevens'
  const apiUrl = isSevens
    ? `/leagues/${leagueId}/reserve7s/standings?format=json`
    : `/leagues/${leagueId}/standings?format=json`
  const { data, loading } = useFetch<StandingsData>(apiUrl)
  const [sortField, setSortField] = useState<SortField>('pos')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function setSort(field: SortField) {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(DEFAULT_DIR[field])
    }
  }

  const standings = data?.standings ?? []
  const rankings = data?.rankings ?? []

  const rankingByTeam = useMemo(() => {
    const m: Record<number, Ranking> = {}
    for (const r of rankings) m[r.team_id] = r
    return m
  }, [rankings])

  const ladderPos = useMemo(() => {
    const m = new Map<number, number>()
    standings.forEach((s, i) => m.set(s.team_id, i + 1))
    return m
  }, [standings])

  const sortedStandings = useMemo(() => {
    const arr = [...standings]
    arr.sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      switch (sortField) {
        case 'pos':
          av = ladderPos.get(a.team_id) ?? 999
          bv = ladderPos.get(b.team_id) ?? 999
          break
        case 'name':
          av = (a.team?.name || '').toLowerCase()
          bv = (b.team?.name || '').toLowerCase()
          break
        case 'pr':
          av = rankingByTeam[a.team_id]?.rank ?? 999
          bv = rankingByTeam[b.team_id]?.rank ?? 999
          break
        case 'wins':
          av = a.wins * 1000 - a.losses
          bv = b.wins * 1000 - b.losses
          break
        case 'mov':
          av = rankingByTeam[a.team_id]?.movement ?? 0
          bv = rankingByTeam[b.team_id]?.movement ?? 0
          break
        case 'pf': av = a.points_for; bv = b.points_for; break
        case 'pa': av = a.points_against; bv = b.points_against; break
        case 'pct': av = a.percentage; bv = b.percentage; break
        case 'pts': av = a.ladder_points; bv = b.ladder_points; break
      }
      let cmp = 0
      if (typeof av === 'string' && typeof bv === 'string') cmp = av.localeCompare(bv)
      else cmp = (av as number) - (bv as number)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [standings, sortField, sortDir, ladderPos, rankingByTeam])

  if (loading) return <StandingsSkeleton />
  if (!data) return <p className="text-danger">Failed to load standings</p>

  // ranking_details / team_form / rankings are main-ladder extras; the
  // 7s standings endpoint doesn't send them. Default to empty so the
  // shared component doesn't crash on the 7s ladder (was a hard
  // TypeError → blank page, which read as "7s ladder doesn't work").
  const { finals_teams, scoring, user_team_id } = data
  const ranking_details = data.ranking_details ?? {}
  const team_form = data.team_form ?? {}
  const hasRankings = rankings.length > 0
  const scType = scoringTagType(scoring.label)
  const showFinalsCut = sortField === 'pos' && sortDir === 'asc' && finals_teams > 0

  const SortBtn = ({ field, children }: { field: SortField, children: React.ReactNode }) => {
    const active = sortField === field
    const chev = active ? (sortDir === 'asc' ? '▲' : '▼') : '▾'
    return (
      <button type="button" className={`lad-sort${active ? ' active' : ''}`} onClick={() => setSort(field)}>
        {children}<span className="lad-sort-chev">{chev}</span>
      </button>
    )
  }

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
            <SortBtn field="pos">#</SortBtn>
            <SortBtn field="name">Team</SortBtn>
            <span>Status</span>
            <SortBtn field="pr">PR</SortBtn>
            <SortBtn field="wins">W–L</SortBtn>
            <span>Form · 5</span>
            <SortBtn field="mov">Mov.</SortBtn>
            <SortBtn field="pf">{scoring.for_label}</SortBtn>
            <SortBtn field="pa">{scoring.against_label}</SortBtn>
            <SortBtn field="pct">{scoring.pct_label}</SortBtn>
            <SortBtn field="pts">Pts</SortBtn>
          </div>

          <div className="lad-wrap">
            {sortedStandings.map((s) => {
              const pos = ladderPos.get(s.team_id) ?? 0
              const rk = rankingByTeam[s.team_id]
              const detail = ranking_details[String(s.team_id)]
              const form = team_form[String(s.team_id)] || []
              const isMine = user_team_id != null && s.team_id === user_team_id
              const isFinalsCut = showFinalsCut && pos === finals_teams
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

                    <span className="lad-team-name">{s.team?.name}</span>

                    <span className="lad-status">
                      {headline ? (
                        <span className={`lad-pill lad-pill-${headlineCls}`}>{headline}</span>
                      ) : (
                        <span className="lad-status-empty">—</span>
                      )}
                    </span>

                    <span className="lad-pr">
                      {rk?.rank ? (
                        <span className={`lad-pr-chip${rk.rank <= 3 ? ` tier-${rk.rank}` : ''}`}>
                          {rk.rank}
                        </span>
                      ) : (
                        <span className="lad-pr-empty">—</span>
                      )}
                    </span>

                    <span className="lad-wl">
                      <span className="w">{s.wins}</span>
                      <span className="sep">–</span>
                      <span className="l">{s.losses}</span>
                      {s.draws > 0 && <><span className="sep">–</span><span className="d">{s.draws}</span></>}
                    </span>

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
                      {s.points_against > 0 ? Math.round(s.points_against) : '–'}
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
