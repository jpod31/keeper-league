import { useParams, Link, useNavigate } from 'react-router'
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, LineChart, Line,
} from 'recharts'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { TeamMobSubnav } from '../../components/nav/TeamMobSubnav'

const posCode = (pos: string) => (pos || 'MID').split('/')[0].toUpperCase()
const HIST_COLOR: Record<string, string> = { '<60': '#ef6b5e', '60–79': '#d2884f', '80–99': '#5aa0ff', '100–119': '#4ec77a', '120+': '#a98bff' }
const ROLE_META: Record<string, { c: string; label: string }> = {
  field: { c: '#4ec77a', label: 'On field' }, bench: { c: '#6e7681', label: 'Benched' },
  emg: { c: '#e0a93f', label: 'Emergency (named)' }, emg_in: { c: '#a98bff', label: 'Emergency (subbed in)' },
  out: { c: '#30363d', label: 'Out / not selected' },
}
const consistencyLabel = (c: number) => c >= 80 ? 'Metronomic' : c >= 65 ? 'Reliable' : c >= 45 ? 'Streaky' : 'Volatile'

interface Identity {
  id: number; name: string; afl_team: string; position: string; age: number | null; height_cm: number | null
  career_games: number | null; sc_avg: number | null; sc_avg_prev: number | null; games_played: number | null
  rating: number | null; potential: number | null; injury_severity: string | null; injury_return_display: string | null
  round_scores: { round: number; sc: number }[]
}
interface UsageData {
  team_games: number; bench_rounds: number; out_rounds: number; captain_games: number; vc_games: number; captain_points: number
  emg_named: number; emg_activated: number; emg_points: number; points_banked: number; contribution_pct: number
  sevens_games: number; sevens_captain: number; sevens_points: number
  timeline: { round: number; role: string; score: number | null; captain: boolean; vc: boolean }[]
  career?: { year: number; team: string; logo: string | null; games: number; level: string }[]
}
interface ScoringData {
  has_data: boolean; games: number; median: number; ceiling: number; floor: number; consistency: number
  boom: number; bust: number; boom_pct: number; bust_pct: number; last5: number[]; hist: { bucket: string; count: number }[]
  fingerprint?: { has_data: boolean; per_game: Record<string, number>; archetype: string }
}
interface SplitRow { key: string; avg: number; games: number; diff: number }
interface SplitsData { has_data: boolean; overall_avg: number; games: number; opponents: SplitRow[]; venues: SplitRow[] }
interface ProjectionData {
  has_data: boolean; next_round: number; next_round_inputs: { last3: number; season: number; career: number }
  next_season: number; next_season_low: number; next_season_high: number; age_delta_pct: number; next_age: number | null
  season_trend: { year: number; avg: number }[]
}
interface BenchmarkData { has_data: boolean; position: string; cohort: number; metrics: { key: string; label: string; value: number; percentile: number; of: number }[] }
interface SimilarData { has_data: boolean; position: string; similar: { player_id: number; name: string; position: string; afl_team: string; sc_avg: number; rating: number | null; age: number | null; similarity: number }[] }

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card mb-4">
      <div className="card-header"><h5 className="mb-0 fw-bold" style={{ fontSize: '.95rem' }}>{title}
        {sub && <span className="text-secondary fw-normal ms-2" style={{ fontSize: '.72rem' }}>{sub}</span>}</h5></div>
      <div className="card-body">{children}</div>
    </div>
  )
}
function SplitList({ title, rows }: { title: string; rows: SplitRow[] }) {
  const maxAbs = Math.max(8, ...rows.map(r => Math.abs(r.diff)))
  return (
    <div className="split-col">
      <div className="split-col-title">{title}</div>
      {rows.length === 0 ? <div className="text-secondary" style={{ fontSize: '.75rem', padding: 6 }}>—</div> : rows.map(r => (
        <div key={r.key} className="split-row" title={`${r.key}: ${r.avg} avg over ${r.games} games`}>
          <span className="split-name">{r.key}</span>
          <span className="split-games">{r.games}g</span>
          <div className="split-track">
            <div className="split-fill" style={{ width: `${Math.abs(r.diff) / maxAbs * 50}%`, background: r.diff >= 0 ? '#4ec77a' : '#ef6b5e', marginLeft: r.diff >= 0 ? '50%' : `${50 - Math.abs(r.diff) / maxAbs * 50}%` }}></div>
            <div className="split-mid"></div>
          </div>
          <span className="split-avg">{r.avg}</span>
          <span className="split-diff" style={{ color: r.diff >= 0 ? '#4ec77a' : '#ef6b5e' }}>{r.diff >= 0 ? '+' : ''}{r.diff}</span>
        </div>
      ))}
    </div>
  )
}
function MiniForm({ form }: { form: { sc: number }[] }) {
  if (form.length < 2) return null
  const vals = form.map(f => f.sc), min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1
  const W = 84, H = 26
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / rng) * H}`).join(' ')
  return <svg width={W} height={H}><polyline points={pts} fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinejoin="round" /></svg>
}

export function PlayerProfilePage() {
  const { leagueId, teamId, playerId } = useParams()
  const navigate = useNavigate()
  const base = `/leagues/${leagueId}/team/${teamId}`
  const pbase = `${base}/player/${playerId}`
  const { data: id, loading } = useFetch<Identity>(`${base}/api/player/${playerId}?format=json`)
  const { data: u } = useFetch<UsageData>(`${pbase}/usage?format=json`)
  const { data: sc } = useFetch<ScoringData>(`${pbase}/scoring?format=json`)
  const { data: sp } = useFetch<SplitsData>(`${pbase}/splits?format=json`)
  const { data: pj } = useFetch<ProjectionData>(`${pbase}/projection?format=json`)
  const { data: bm } = useFetch<BenchmarkData>(`${pbase}/benchmarks?format=json`)
  const { data: sim } = useFetch<SimilarData>(`${pbase}/similar?format=json`)

  if (loading || !id) return <Spinner text="Loading player…" />
  const primary = posCode(id.position)
  const rolesPresent = u ? Array.from(new Set(u.timeline.map(t => t.role))) : []
  const trend = id.sc_avg != null && id.sc_avg_prev != null ? id.sc_avg - id.sc_avg_prev : null
  const form = (id.round_scores || []).slice(-5)

  return (
    <div>
      <TeamMobSubnav active="stats" leagueId={leagueId!} teamId={teamId!} />
      <div className="page-header">
        <div className="page-breadcrumb">
          <Link to={`/leagues/${leagueId}/team/${teamId}/stats`}>Stats</Link>{' / '}{id.name}
        </div>
      </div>

      {/* Identity + verdict */}
      <div className="pp-head card mb-4">
        <div className="pp-id">
          <div className="pp-name">
            {id.name}
            {id.injury_severity && <span className="tr-flag inj" style={{ marginLeft: 8 }}>{id.injury_return_display || id.injury_severity}</span>}
          </div>
          <div className="pp-sub">
            <span className={`pos-badge pos-${primary}`}>{id.position}</span>
            <span>{id.afl_team}</span>
            {id.age != null && <span>Age {id.age}</span>}
            {id.height_cm ? <span>{id.height_cm}cm</span> : null}
            {id.career_games != null && <span>{id.career_games} career games</span>}
          </div>
        </div>
        <div className="pp-verdict">
          <div className="pp-v">
            <div className="pp-v-num">{id.sc_avg != null ? id.sc_avg : '–'}</div>
            <div className="pp-v-lbl">SC avg{trend != null && <span style={{ color: trend >= 0 ? '#4ec77a' : '#ef6b5e', marginLeft: 4 }}>{trend >= 0 ? '+' : ''}{Math.round(trend)}</span>}</div>
          </div>
          <div className="pp-v">
            <div className="pp-v-num">{id.rating ?? '–'}<span className="pp-v-arrow">→{id.potential ?? '–'}</span></div>
            <div className="pp-v-lbl">rating / potential</div>
          </div>
          {sc?.has_data && <div className="pp-v"><div className="pp-v-num">{sc.consistency}</div><div className="pp-v-lbl">{consistencyLabel(sc.consistency)}</div></div>}
          {form.length >= 2 && <div className="pp-v pp-v-form"><MiniForm form={form} /><div className="pp-v-lbl">last {form.length}</div></div>}
        </div>
      </div>

      {/* Career strip */}
      {u?.career && u.career.length > 0 && (
        <div className="career-strip mb-4">
          {u.career.map((c, i) => (
            <div key={i} className={`career-yr${c.level === 'AFL' ? ' afl' : ''}`} title={`${c.year} · ${c.team} · ${c.games} games (${c.level})`}>
              <div className="career-yr-year">'{String(c.year).slice(-2)}</div>
              {c.logo ? <img src={c.logo} alt="" className="career-yr-logo" /> : <div className="career-yr-abbr">{c.team.slice(0, 3)}</div>}
              <div className="career-yr-games">{c.games}</div>
            </div>
          ))}
        </div>
      )}

      {/* Scoring profile */}
      {sc?.has_data && (
        <Section title="Scoring profile" sub={`${sc.games} games · median ${Math.round(sc.median)}`}>
          <div className="usage-tiles">
            <div className="usage-tile" style={{ ['--uc' as string]: '#a98bff' } as React.CSSProperties}><div className="usage-tile-val">{Math.round(sc.ceiling)}</div><div className="usage-tile-lbl">Ceiling</div><div className="usage-tile-sub">90th-pct game</div></div>
            <div className="usage-tile" style={{ ['--uc' as string]: '#ef6b5e' } as React.CSSProperties}><div className="usage-tile-val">{Math.round(sc.floor)}</div><div className="usage-tile-lbl">Floor</div><div className="usage-tile-sub">10th-pct game</div></div>
            <div className="usage-tile" style={{ ['--uc' as string]: '#4ec77a' } as React.CSSProperties}><div className="usage-tile-val">{sc.consistency}</div><div className="usage-tile-lbl">Consistency</div><div className="usage-tile-sub">{consistencyLabel(sc.consistency)}</div></div>
            <div className="usage-tile" style={{ ['--uc' as string]: '#5aa0ff' } as React.CSSProperties}><div className="usage-tile-val">{sc.boom_pct}<span className="usage-tile-unit">%</span></div><div className="usage-tile-lbl">Boom rate</div><div className="usage-tile-sub">{sc.boom} games 120+</div></div>
            <div className="usage-tile" style={{ ['--uc' as string]: '#d2884f' } as React.CSSProperties}><div className="usage-tile-val">{sc.bust_pct}<span className="usage-tile-unit">%</span></div><div className="usage-tile-lbl">Bust rate</div><div className="usage-tile-sub">{sc.bust} games ≤60</div></div>
          </div>
          <div className="usage-timeline-wrap">
            <div className="usage-section-title">Scoring range</div>
            <div className="scoring-range">
              <div className="scoring-range-fill" style={{ left: `${sc.floor / 150 * 100}%`, width: `${Math.max(2, (sc.ceiling - sc.floor) / 150 * 100)}%` }}></div>
              <div className="scoring-range-tick" style={{ left: `${sc.median / 150 * 100}%` }}></div>
            </div>
            <div className="scoring-range-axis"><span>0</span><span>50</span><span>100</span><span>150</span></div>
            {sc.last5.length > 0 && (
              <div className="scoring-last5">
                <span className="usage-section-title" style={{ margin: 0 }}>Last 5</span>
                {sc.last5.map((v, i) => <span key={i} className="scoring-last5-chip" style={{ background: v >= 120 ? '#a98bff' : v >= 100 ? '#4ec77a' : v >= 80 ? '#5aa0ff' : v >= 60 ? '#d2884f' : '#ef6b5e' }}>{v}</span>)}
              </div>
            )}
          </div>
          <div className="usage-timeline-wrap">
            <div className="usage-section-title">Score distribution</div>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={sc.hist} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
                <XAxis dataKey="bucket" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                <YAxis allowDecimals={false} tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                <Tooltip cursor={{ fill: 'rgba(110,130,180,.08)' }} contentStyle={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, fontSize: '.78rem' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>{sc.hist.map((h, i) => <Cell key={i} fill={HIST_COLOR[h.bucket] || '#5aa0ff'} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {sc.fingerprint?.has_data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="fp-archetype">{sc.fingerprint.archetype}</span>
              <span className="fp-mix">
                {[['Disp', 'disposals'], ['Mk', 'marks'], ['Tk', 'tackles'], ['Gl', 'goals'], ['HO', 'hitouts']]
                  .filter(([, k]) => (sc.fingerprint!.per_game[k] ?? 0) > 0)
                  .map(([lbl, k]) => <span key={k} className="fp-stat"><b>{sc.fingerprint!.per_game[k]}</b> {lbl}</span>)}
              </span>
            </div>
          )}
        </Section>
      )}

      {/* Matchup & venue splits */}
      {sp?.has_data && (
        <Section title="Matchup & venue splits" sub={`${sp.games} games · avg ${sp.overall_avg} · how they travel`}>
          <div className="split-cols">
            <SplitList title="By opponent" rows={sp.opponents} />
            <SplitList title="By venue" rows={sp.venues} />
          </div>
        </Section>
      )}

      {/* Projection */}
      {pj?.has_data && (
        <Section title="Projection" sub="form-weighted + age curve">
          <div className="proj-cards">
            <div className="proj-card" style={{ ['--uc' as string]: '#5aa0ff' } as React.CSSProperties}>
              <div className="proj-card-lbl">Next round</div><div className="proj-card-val">~{pj.next_round}</div>
              <div className="proj-card-sub">L3 {pj.next_round_inputs.last3} · Szn {pj.next_round_inputs.season} · Career {pj.next_round_inputs.career}</div>
            </div>
            <div className="proj-card" style={{ ['--uc' as string]: '#a98bff' } as React.CSSProperties}>
              <div className="proj-card-lbl">Next season</div><div className="proj-card-val">~{pj.next_season} <span className="proj-band">{pj.next_season_low}–{pj.next_season_high}</span></div>
              <div className="proj-card-sub">{pj.next_age ? `age ${pj.next_age} → ` : ''}<span style={{ color: pj.age_delta_pct > 0 ? '#4ec77a' : pj.age_delta_pct < 0 ? '#ef6b5e' : '#8b949e' }}>{pj.age_delta_pct > 0 ? '+' : ''}{pj.age_delta_pct}% age curve</span></div>
            </div>
          </div>
          {pj.season_trend.length > 1 && (
            <div className="usage-timeline-wrap">
              <div className="usage-section-title">Season SC average — career arc</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={pj.season_trend} margin={{ top: 8, right: 14, bottom: 0, left: -18 }}>
                  <XAxis dataKey="year" tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} stroke="#30363d" />
                  <Tooltip cursor={{ stroke: '#30363d' }} contentStyle={{ background: '#161d27', border: '1px solid rgba(110,130,180,.3)', borderRadius: 8, fontSize: '.78rem' }} />
                  <Line type="monotone" dataKey="avg" stroke="#58a6ff" strokeWidth={2} dot={{ r: 3, fill: '#58a6ff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      )}

      {/* Role & usage for your team */}
      {u && (u.team_games > 0 || u.timeline.length > 0) && (
        <Section title="Your usage" sub="how this team has deployed them">
          <div className="usage-tiles">
            <div className="usage-tile" style={{ ['--uc' as string]: '#4ec77a' } as React.CSSProperties}><div className="usage-tile-val">{u.team_games}</div><div className="usage-tile-lbl">Games for you</div><div className="usage-tile-sub">{u.bench_rounds} benched · {u.out_rounds} out</div></div>
            <div className="usage-tile" style={{ ['--uc' as string]: '#5aa0ff' } as React.CSSProperties}><div className="usage-tile-val">{Math.round(u.points_banked)}</div><div className="usage-tile-lbl">Points banked</div><div className="usage-tile-sub">{u.contribution_pct}% of your total</div></div>
            <div className="usage-tile" style={{ ['--uc' as string]: '#e0a93f' } as React.CSSProperties}><div className="usage-tile-val">{u.captain_games}<span className="usage-tile-unit">×C</span></div><div className="usage-tile-lbl">Captained</div><div className="usage-tile-sub">{u.captain_games > 0 ? `+${Math.round(u.captain_points)} bonus` : `${u.vc_games}× VC`}</div></div>
            {u.sevens_games > 0 && <div className="usage-tile" style={{ ['--uc' as string]: '#bc8cff' } as React.CSSProperties}><div className="usage-tile-val">{u.sevens_games}</div><div className="usage-tile-lbl">7s games</div><div className="usage-tile-sub">{u.sevens_captain}× C · {Math.round(u.sevens_points)} pts</div></div>}
          </div>
          {u.timeline.length > 0 && (
            <div className="usage-timeline-wrap">
              <div className="usage-section-title">Season usage — round by round</div>
              <div className="usage-ribbon">
                {u.timeline.map(t => {
                  const meta = ROLE_META[t.role] || ROLE_META.out
                  return (
                    <div key={t.round} className="usage-cell" title={`R${t.round} · ${meta.label}${t.score != null ? ` · ${t.score}` : ''}`}>
                      <div className="usage-cell-round">R{t.round}</div>
                      <div className="usage-cell-box" style={{ background: meta.c, opacity: t.role === 'out' ? 0.5 : 1 }}>{t.score != null ? Math.round(t.score) : ''}{t.captain && <span className="usage-cell-c">C</span>}</div>
                    </div>
                  )
                })}
              </div>
              <div className="usage-legend">
                {rolesPresent.map(r => { const meta = ROLE_META[r] || ROLE_META.out; return <span key={r} className="usage-legend-item"><span className="usage-legend-dot" style={{ background: meta.c }}></span>{meta.label}</span> })}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Benchmarks */}
      {bm?.has_data && (
        <Section title={`vs other ${bm.position}s`} sub={`${bm.cohort} in pool · percentile`}>
          {bm.metrics.map(m => {
            const c = m.percentile >= 80 ? '#4ec77a' : m.percentile >= 55 ? '#5aa0ff' : m.percentile >= 30 ? '#d2884f' : '#ef6b5e'
            return (
              <div key={m.key} className="bm-row">
                <div className="bm-label">{m.label}</div>
                <div className="bm-track"><div className="bm-fill" style={{ width: `${m.percentile}%`, background: c }}></div></div>
                <div className="bm-val">{m.value}</div>
                <div className="bm-pct" style={{ color: c }}>{m.percentile}<span className="bm-pct-th">th</span></div>
              </div>
            )
          })}
        </Section>
      )}

      {/* Similar players */}
      {sim?.has_data && sim.similar.length > 0 && (
        <Section title="Plays like" sub={`nearest ${sim.position}s by profile`}>
          {sim.similar.map(s => (
            <button key={s.player_id} className="sim-row" style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none' }}
              onClick={() => navigate(`${base}/player/${s.player_id}`)}>
              <div className="sim-bar-wrap"><div className="sim-bar" style={{ width: `${s.similarity}%` }}></div></div>
              <div className="sim-name">{s.name}<span className="sim-meta">{posCode(s.position)} · {s.afl_team}</span></div>
              <div className="sim-stats">{s.sc_avg} SC{s.rating != null ? ` · ${s.rating} rtg` : ''}{s.age != null ? ` · ${s.age}y` : ''}</div>
              <div className="sim-pct">{s.similarity}%</div>
            </button>
          ))}
        </Section>
      )}
      <div style={{ height: 20 }} />
    </div>
  )
}
