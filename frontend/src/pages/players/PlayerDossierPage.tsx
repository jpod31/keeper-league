import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, LineChart,
} from 'recharts'
import { useKeptFetch } from '../../hooks/useFetch'
import { useLeague } from '../../contexts/LeagueContext'
import { usePageState, useGoBack } from '../../lib/pageMemory'
import { club, clubVars, ratingTier } from '../../lib/clubs'
import { TeamBadge } from '../../components/ui/TeamBadge'
import { Spinner } from '../../components/ui/Spinner'
import './player-dossier.css'

// The full player page: card pop-up, "More details", then this. Everything
// comes from one endpoint (models/player_dossier.py); the scoring profile,
// projection, opponent splits and similar players reuse the team-page
// endpoints, which only look at the player.

interface StatLabel { key: string; label: string; name?: string }
type StatRow = Record<string, number | null | undefined>
interface SeasonRow extends StatRow { year: number; games: number; sc_max: number | null; sc_min: number | null; goals_total: number; sc_100s: number }
interface RoundRow extends StatRow { round: number }
interface Bio {
  id: number; name: string; afl_team: string; position: string; position_expected: boolean
  role: string | null; role_detail: string | null; age: number | null; dob: string | null; height_cm: number | null
  career_games: number; games_played: number; sc_avg: number | null; sc_avg_prev: number | null
  rating: number | null; potential: number | null; rating_start: number | null
  rating_rank: number | null; listed_count: number; grade: string | null; afl_best22: boolean | null
  keeper_value: number | null; list_status: string; left_afl_year: number | null; joined_year: number | null
  draft: { pick: number | null; year: number | null; type: string | null; father_son: boolean | null; academy: boolean | null; international: boolean | null }
  injury: { type: string | null; return: string | null; severity: string } | null
  role_data: { cba_pct: number | null; cba_trend: number | null; kick_in_pct: number | null; kick_in_playon_pct: number | null; kick_ins: number | null }
  photo_url: string | null
}
interface Stint {
  team_id: number; team: string; coach: string; method: string; acquired_at: string | null; is_active: boolean
  left: string | null; left_at: string | null; left_to: string | null
  pick_number: number | null; draft_round: number | null; draft_label: string | null; draft_year: number | string; draft_type: string | null
}
interface KRound { year: number; round: number; team_id: number; team: string | null; slot: string | null; named: boolean; captain: boolean; vice_captain: boolean; emergency: boolean; sc: number | null; banked: number | null; bye: boolean }
interface KSummary { rounds_on_list: number; named: number; named_played: number; not_named: number; not_named_played: number; captain: number; vice_captain: number; emergency: number; avg_named: number | null; avg_not_named: number | null; banked: number; byes: number }
interface Dossier {
  player: Bio
  years: { afl_year: number; stats_year: number; stats_are_last_season: boolean }
  ratings: { seasons: { season: number; rating: number | null; potential: number | null }[]; changes: { at: string | null; old_rating: number | null; new_rating: number | null; old_potential: number | null; new_potential: number | null }[] }
  stat_labels: StatLabel[]
  seasons: SeasonRow[]
  rounds: Record<string, RoundRow[]>
  career: { games: number; seasons: number; goals: number; disposals: number; sc_avg: number | null; sc_best: number | null; sc_100s: number; first_year: number | null }
  afl_clubs: { season: number; club: string; list_type: string | null; games: number }[]
  state_league: { season: number; competition: string; team: string; matches: number; disposals: number | null; marks: number | null; goals: number | null; tackles: number | null; hitouts: number | null; clearances: number | null; fantasy_avg: number | null }[]
  keeper: { owner: { team_id: number; team: string } | null; stints: Stint[]; rounds: KRound[]; seasons: (KSummary & { year: number })[]; totals: KSummary }
  splits: { named: StatRow & { games: number }; not_named: StatRow & { games: number } }
  benchmarks: { has_data: boolean; position: string; cohort: number; metrics: { key: string; label: string; value: number; percentile: number; of: number }[] }
}
interface Scoring { has_data: boolean; games: number; median: number; ceiling: number; floor: number; consistency: number; boom_pct: number; bust_pct: number }
interface Projection { has_data: boolean; next_season: number; next_season_low: number; next_season_high: number; next_age: number | null }
interface Splits { has_data: boolean; overall_avg: number; opponents: { key: string; avg: number; games: number; diff: number }[] }
interface Similar { has_data: boolean; similar: { player_id: number; name: string; position: string; afl_team: string; sc_avg: number; rating: number | null; age: number | null }[] }

type Tab = 'overview' | 'stats' | 'ratings' | 'career' | 'keeper'
const TABS: [Tab, string][] = [['overview', 'Overview'], ['stats', 'AFL stats'], ['ratings', 'Ratings'], ['career', 'Career'], ['keeper', 'Keeper League']]
const POS_LETTER: Record<string, string> = { DEF: 'D', MID: 'M', RUC: 'R', FWD: 'F' }

const fmt = (v: number | null | undefined, dp = 1) => v == null ? '-' : Number.isInteger(v) ? String(v) : v.toFixed(dp)
const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]) }
const dateOf = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

function Silhouette() {
  return (
    <svg className="pd-sil" viewBox="0 0 240 240" aria-hidden="true">
      <circle cx="120" cy="92" r="46" />
      <path d="M30 240c4-58 44-92 90-92s86 34 90 92z" />
    </svg>
  )
}

function Photo({ url, name }: { url: string | null; name: string }) {
  const [bad, setBad] = useState(false)
  if (!url || bad) return <div className="pd-photo pd-photo-none"><Silhouette /></div>
  return <img className="pd-photo" src={url} alt={name} onError={() => setBad(true)} />
}

function ChartTip({ active, payload, label, unit }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string | number; unit?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="pd-tip">
      <div className="pd-tip-h">{label}</div>
      {payload.map(p => <div key={p.name} className="pd-tip-r"><i style={{ background: p.color }} />{p.name}<b>{fmt(p.value)}{unit || ''}</b></div>)}
    </div>
  )
}

function Panel({ title, right, children, wide }: { title: string; right?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`pd-panel${wide ? ' wide' : ''}`}>
      <header className="pd-panel-h"><h2>{title}</h2>{right}</header>
      {children}
    </section>
  )
}

function Big({ v, l, tone }: { v: React.ReactNode; l: string; tone?: 'up' | 'down' }) {
  return <div className="pd-big"><b className={tone || ''}>{v}</b><span>{l}</span></div>
}

function Meter({ label, value, max = 100, unit = '%', note, shown }: { label: string; value: number | null; max?: number; unit?: string; note?: string; shown?: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value / max * 100))
  return (
    <div className="pd-meter">
      <div className="pd-meter-top"><span>{label}</span><b>{shown ?? (value == null ? '-' : `${fmt(value)}${unit}`)}</b></div>
      <div className="pd-meter-bar"><i style={{ width: `${pct}%` }} /></div>
      {note && <div className="pd-meter-note">{note}</div>}
    </div>
  )
}

function StatTable({ labels, rows, first, firstLabel, extra }: {
  labels: StatLabel[]; rows: StatRow[]; first: (r: StatRow) => React.ReactNode; firstLabel: string
  extra?: { label: string; title: string; cell: (r: StatRow) => React.ReactNode }[]
}) {
  // Every stat we hold; a column with nothing in it for any row is left out.
  const cols = labels.filter(l => rows.some(r => r[l.key] != null))
  return (
    <div className="pd-tablebox">
      <table className="pd-table">
        <thead><tr>
          <th className="pin">{firstLabel}</th>
          {(extra || []).map(x => <th key={x.label} title={x.title} className="txt">{x.label}</th>)}
          {cols.map(c => <th key={c.key} title={c.name || c.label}>{c.label}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="pin">{first(r)}</td>
              {(extra || []).map(x => <td key={x.label} className="txt">{x.cell(r)}</td>)}
              {cols.map(c => <td key={c.key} className={c.key === 'supercoach_score' ? 'sc' : ''}>{fmt(r[c.key] as number | null)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PlayerDossierPage() {
  const { leagueId, playerId } = useParams()
  const navigate = useNavigate()
  const goBack = useGoBack(`/leagues/${leagueId}/player-pool`)
  const { league } = useLeague()
  const { data, loading } = useKeptFetch<Dossier>(`/api/leagues/${leagueId}/players/${playerId}/dossier`)
  const anyTeam = league?.user_team?.id ?? league?.teams?.[0]?.id
  const pbase = anyTeam ? `/leagues/${leagueId}/team/${anyTeam}/player/${playerId}` : null
  const { data: sc } = useKeptFetch<Scoring>(pbase && `${pbase}/scoring?format=json`)
  const { data: pj } = useKeptFetch<Projection>(pbase && `${pbase}/projection?format=json`)
  const { data: sp } = useKeptFetch<Splits>(pbase && `${pbase}/splits?format=json`)
  const { data: sim } = useKeptFetch<Similar>(pbase && `${pbase}/similar?format=json`)
  const [tab, setTab] = usePageState<Tab>('tab', 'overview')

  if (loading || !data) return <Spinner text="Loading player…" />
  const p = data.player
  const logos = league?.club_logos || {}
  const logo = logos[p.afl_team]
  const parts = p.name.split(' ')
  const first = parts[0], sur = parts.slice(1).join(' ') || p.name
  const positions = (p.position || 'MID').split('/')
  const sy = data.years.stats_year

  return (
    <div className="pd" style={clubVars(p.afl_team)}>
      <div className="pd-hero" style={{ ['--logo' as string]: logo ? `url("${logo}")` : 'none' } as React.CSSProperties}>
        <button type="button" className="pd-back" onClick={goBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>Back
        </button>
        <div className="pd-hero-photo"><Photo url={p.photo_url} name={p.name} /></div>
        <div className="pd-hero-id">
          <div className="pd-dots">
            {positions.map(ps => (
              <span key={ps} className={`pd-dot pd-dot-${ps.toLowerCase()}${p.position_expected ? ' expected' : ''}`} title={ps}>{POS_LETTER[ps] || ps[0]}</span>
            ))}
            {p.role_detail && <span className="pd-roletag">{p.role_detail}</span>}
          </div>
          <h1 className="pd-name"><span className="pd-first">{first}</span><span className="pd-sur">{sur}</span></h1>
          <div className="pd-club">
            {logo && <img src={logo} alt="" />}
            <span>{p.afl_team || 'No club'}</span>
            {p.list_status === 'former' && <span className="pd-flag">Off AFL lists{p.left_afl_year ? ` since ${p.left_afl_year + 1}` : ''}</span>}
            {p.injury && <span className="pd-flag">{p.injury.type || 'Injured'}{p.injury.return ? `, ${p.injury.return}` : ''}</span>}
          </div>
          <dl className="pd-facts">
            <div><dt>Age</dt><dd>{p.age ?? '-'}</dd></div>
            <div><dt>Height</dt><dd>{p.height_cm ? `${p.height_cm} cm` : '-'}</dd></div>
            <div><dt>AFL games</dt><dd>{Math.max(p.career_games || 0, data.career.games || 0)}</dd></div>
            <div><dt>Drafted</dt><dd>{draftShort(p)}</dd></div>
          </dl>
        </div>
        <div className="pd-hero-nums">
          <div className="pd-hn"><b>{p.sc_avg ? Math.round(p.sc_avg) : '-'}</b><span>{sy} avg</span></div>
          <div className="pd-hn"><b><span className={`rt ${ratingTier(p.rating)}`}>{p.rating ?? '-'}</span></b><span>Rating</span></div>
          <div className="pd-hn"><b><span className={`rt rt-line ${ratingTier(p.potential)}`}>{p.potential ?? '-'}</span></b><span>Potential</span></div>
          <div className="pd-hn pd-owner">
            {data.keeper.owner
              ? <><TeamBadge name={data.keeper.owner.team_id} size={30} showName={false} /><span>{data.keeper.owner.team}</span></>
              : <><b className="pd-free">Free</b><span>Not on a list here</span></>}
          </div>
        </div>
      </div>

      <nav className="pd-tabs" role="tablist" aria-label="Player sections">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>

      <div className="pd-body">
        {tab === 'overview' && <Overview d={data} sc={sc} pj={pj} sim={sim} onPlayer={id => navigate(`/leagues/${leagueId}/player/${id}`)} />}
        {tab === 'stats' && <Stats d={data} sp={sp} />}
        {tab === 'ratings' && <Ratings d={data} />}
        {tab === 'career' && <Career d={data} logos={logos} />}
        {tab === 'keeper' && <Keeper d={data} />}
      </div>
    </div>
  )
}

function draftShort(p: Bio) {
  const d = p.draft
  if (!d.year) return '-'
  if (d.pick) return `Pick ${d.pick}, ${d.year}`
  return `${d.year}${d.type ? ` ${d.type.toLowerCase()}` : ''}`
}

function draftLong(p: Bio) {
  const d = p.draft
  if (!d.year) return 'No draft details in the workbook.'
  const how = d.type ? `${d.type} Draft` : 'draft'
  const bits = [d.pick ? `Pick ${d.pick} in the ${d.year} ${how}` : `${d.year} ${how}`]
  if (d.father_son) bits.push('father-son')
  if (d.academy) bits.push('academy')
  if (d.international) bits.push('international')
  return bits.join(', ') + '.'
}

// ── Overview ────────────────────────────────────────────────────────
function Overview({ d, sc, pj, sim, onPlayer }: { d: Dossier; sc: Scoring | null; pj: Projection | null; sim: Similar | null; onPlayer: (id: number) => void }) {
  const p = d.player
  const sy = d.years.stats_year
  const rounds = (d.rounds[String(sy)] || []).filter(r => r.supercoach_score != null)
  const avg = rounds.length ? rounds.reduce((a, r) => a + (r.supercoach_score as number), 0) / rounds.length : 0
  const form = rounds.map(r => ({ r: `R${r.round}`, SC: r.supercoach_score }))
  const season = d.seasons.find(s => s.year === sy)
  const k = d.keeper.totals
  const rd = p.role_data
  const simPanel = sim?.has_data && sim.similar.length > 0 && (
        <Panel title="Plays like">
          <div className="pd-sim">
            {sim.similar.slice(0, 6).map(s => (
              <button key={s.player_id} type="button" className="pd-sim-row" style={clubVars(s.afl_team)} onClick={() => onPlayer(s.player_id)}>
                <i />
                <span className="n">{s.name}</span>
                <span className="v">{Math.round(s.sc_avg)}</span>
                <span className={`rt ${ratingTier(s.rating)}`}>{s.rating ?? '-'}</span>
              </button>
            ))}
          </div>
        </Panel>
      )
  return (
    <div className="pd-grid">
      <Panel title={`${sy} at a glance`} wide>
        <div className="pd-bigs">
          <Big v={p.sc_avg ? Math.round(p.sc_avg) : '-'} l="SuperCoach avg" />
          <Big v={season?.sc_max ?? '-'} l="Best score" />
          <Big v={season?.sc_100s ?? '-'} l="Tons" />
          <Big v={season?.games ?? 0} l="Games" />
          <Big v={p.sc_avg_prev ? Math.round(p.sc_avg_prev) : '-'} l={`${sy - 1} avg`} />
          <Big v={p.rating_rank ? ordinal(p.rating_rank) : '-'} l={`Rating rank of ${p.listed_count}`} />
        </div>
        {form.length > 0 && (
          <div className="pd-chart" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={form} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
                <XAxis dataKey="r" stroke="#ececf1" tick={{ fill: '#ececf1', fontSize: 13 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="#ececf1" tick={{ fill: '#ececf1', fontSize: 13 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
                <ReferenceLine y={avg} stroke="#ffffff" strokeDasharray="4 4" strokeOpacity={0.6} />
                <Bar isAnimationActive={false} dataKey="SC" fill="var(--pd-bar)" stroke="rgba(255,255,255,.35)" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <div className="pd-col">
      <Panel title="Role">
        <div className="pd-meters">
          <Meter label="Centre bounces attended" value={rd.cba_pct} note={rd.cba_trend != null && rd.cba_pct ? `${rd.cba_trend >= 0 ? 'Up' : 'Down'} ${Math.abs(rd.cba_trend)} over the last three games` : undefined} />
          <Meter label="Club's kick-ins he takes" value={rd.kick_in_pct} note={rd.kick_ins ? `${rd.kick_ins} taken, played on from ${fmt(rd.kick_in_playon_pct, 0)}%` : undefined} />
          {p.role_detail && <div className="pd-kv"><span>Workbook role</span><b>{p.role_detail}</b></div>}
          {p.grade && <div className="pd-kv"><span>Grade</span><b>{p.grade}</b></div>}
          {p.afl_best22 != null && <div className="pd-kv"><span>At his club</span><b>{p.afl_best22 ? 'Best 22' : 'Reserves'}</b></div>}
        </div>
      </Panel>

      <Panel title="In this league">
        <div className="pd-bigs pd-bigs-3">
          <Big v={k.named} l="Named in a side" />
          <Big v={k.captain} l="Captain" />
          <Big v={fmt(k.banked, 0)} l="Points banked" />
        </div>
        <div className="pd-vs">
          <div><span>Named</span><b>{fmt(k.avg_named)}</b></div>
          <div><span>Not named</span><b>{fmt(k.avg_not_named)}</b></div>
        </div>
      </Panel>
      {simPanel}
      </div>

      <div className="pd-col">
      <Panel title="Scoring profile">
        {sc?.has_data ? (
          <div className="pd-bigs pd-bigs-3">
            <Big v={Math.round(sc.median)} l="Typical score" />
            <Big v={Math.round(sc.ceiling)} l="Ceiling" />
            <Big v={Math.round(sc.floor)} l="Floor" />
            <Big v={`${Math.round(sc.consistency)}`} l="Consistency" />
            <Big v={`${Math.round(sc.boom_pct)}%`} l="Games 120+" />
            <Big v={`${Math.round(sc.bust_pct)}%`} l="Games under 70" />
          </div>
        ) : <p className="pd-empty">Not enough games to profile him yet.</p>}
        {pj?.has_data && (
          <div className="pd-proj">
            <span>Next season</span>
            <b>{Math.round(pj.next_season)}</b>
            <span>likely {Math.round(pj.next_season_low)} to {Math.round(pj.next_season_high)}{pj.next_age ? `, at ${pj.next_age}` : ''}</span>
          </div>
        )}
      </Panel>

      {d.benchmarks?.has_data && (
        <Panel title={`Against other ${d.benchmarks.position}s`}>
          <div className="pd-meters">
            {d.benchmarks.metrics.map(m => (
              <Meter key={m.key} label={m.label} value={m.percentile} shown={`${ordinal(Math.max(1, Math.round(m.percentile)))} percentile`} note={`${fmt(m.value)}, against ${m.of} players`} />
            ))}
          </div>
        </Panel>
      )}

      </div>
    </div>
  )
}

// ── AFL stats ───────────────────────────────────────────────────────
function Stats({ d, sp }: { d: Dossier; sp: Splits | null }) {
  const years = Object.keys(d.rounds).map(Number).sort((a, b) => b - a)
  const [year, setYear] = usePageState<number>('year', years[0] ?? d.years.stats_year)
  // Where a coach in this league had him each round.
  const kround = useMemo(() => {
    const m = new Map<string, KRound>()
    for (const r of d.keeper.rounds) m.set(`${r.year}-${r.round}`, r)
    return m
  }, [d.keeper.rounds])
  const bySeason = d.seasons.map(s => ({ y: String(s.year), Average: s.supercoach_score, Best: s.sc_max }))
  const rounds = d.rounds[String(year)] || []
  const seasonsDesc = [...d.seasons].sort((a, b) => b.year - a.year)
  return (
    <div className="pd-grid">
      <Panel title="SuperCoach by season" wide>
        {bySeason.length ? (
          <div className="pd-chart" style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={bySeason} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
                <XAxis dataKey="y" tick={{ fill: '#ececf1', fontSize: 13 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#ececf1', fontSize: 13 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,.05)' }} />
                <Bar isAnimationActive={false} dataKey="Average" fill="var(--pd-bar)" stroke="rgba(255,255,255,.35)" radius={[4, 4, 0, 0]} maxBarSize={34} />
                <Line isAnimationActive={false} dataKey="Best" stroke="#ffffff" strokeWidth={2} dot={{ r: 3, fill: '#ffffff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="pd-empty">No AFL games on record.</p>}
      </Panel>

      <Panel title="Season averages" wide right={<span className="pd-hint">Per game. Scroll sideways for every stat.</span>}>
        {seasonsDesc.length ? (
          <StatTable labels={d.stat_labels} rows={seasonsDesc} firstLabel="Season"
            first={r => <><b>{r.year}</b><span className="pd-sub">{r.games} gm</span></>} />
        ) : <p className="pd-empty">No AFL games on record.</p>}
      </Panel>

      <Panel title="Round by round" wide right={
        <div className="pd-years">
          {years.map(y => <button key={y} type="button" className={y === year ? 'on' : ''} onClick={() => setYear(y)}>{y}</button>)}
        </div>
      }>
        {rounds.length ? (
          <StatTable labels={d.stat_labels} rows={rounds} firstLabel="Round" first={r => <b>{r.round === 0 ? 'OR' : `R${r.round}`}</b>}
            extra={d.keeper.rounds.some(k => k.year === year) ? [{
              label: 'Keeper', title: 'Where a coach in this league had him that round',
              cell: r => {
                const k = kround.get(`${year}-${r.round}`)
                if (!k) return '-'
                const where = k.named ? (k.slot || 'Named') : k.emergency ? 'Emergency' : 'Bench'
                return <span className={k.named ? 'pd-kcell on' : 'pd-kcell'}>{where}{k.captain ? ', C' : k.vice_captain ? ', VC' : ''}</span>
              },
            }] : undefined} />
        ) : <p className="pd-empty">No games in {year}.</p>}
      </Panel>

      {sp?.has_data && sp.opponents.length > 0 && (
        <Panel title="Against each club" wide>
          <div className="pd-opps">
            {sp.opponents.map(o => (
              <div key={o.key} className="pd-opp" style={clubVars(o.key)}>
                <i />
                <span className="n">{o.key}</span>
                <span className="g">{o.games} gm</span>
                <b>{Math.round(o.avg)}</b>
                <span className={o.diff >= 0 ? 'up' : 'down'}>{o.diff >= 0 ? '+' : ''}{Math.round(o.diff)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  )
}

// ── Ratings ─────────────────────────────────────────────────────────
function Ratings({ d }: { d: Dossier }) {
  const p = d.player
  const rows = d.ratings.seasons
  const chart = rows.map(r => ({ y: String(r.season), Rating: r.rating, Potential: r.potential }))
  const firstR = rows.find(r => r.rating != null)
  const growth = firstR && p.rating != null ? p.rating - (firstR.rating as number) : null
  return (
    <div className="pd-grid">
      <Panel title="Rating and potential, season by season" wide>
        <div className="pd-bigs">
          <Big v={<span className={`rt ${ratingTier(p.rating)}`}>{p.rating ?? '-'}</span>} l="Rating now" />
          <Big v={<span className={`rt rt-line ${ratingTier(p.potential)}`}>{p.potential ?? '-'}</span>} l="Potential" />
          <Big v={p.potential != null && p.rating != null ? p.potential - p.rating : '-'} l="Room to grow" />
          <Big v={growth == null ? '-' : `${growth >= 0 ? '+' : ''}${growth}`} l={firstR ? `Since ${firstR.season}` : 'Growth'} tone={growth == null ? undefined : growth >= 0 ? 'up' : 'down'} />
          <Big v={p.rating_start != null && p.rating != null ? `${p.rating - p.rating_start >= 0 ? '+' : ''}${p.rating - p.rating_start}` : '-'} l="This season" />
          <Big v={p.rating_rank ? ordinal(p.rating_rank) : '-'} l={`Of ${p.listed_count} listed`} />
        </div>
        {chart.length > 1 ? (
          <div className="pd-chart" style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false} />
                <XAxis dataKey="y" tick={{ fill: '#ececf1', fontSize: 13 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: '#ececf1', fontSize: 13 }} tickLine={false} axisLine={false} width={44} domain={['dataMin - 3', 'dataMax + 2']} allowDecimals={false} />
                <Tooltip content={<ChartTip />} />
                <Line isAnimationActive={false} dataKey="Potential" stroke="#bc8cff" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: '#bc8cff' }} connectNulls />
                <Line isAnimationActive={false} dataKey="Rating" stroke="#ffffff" strokeWidth={3} dot={{ r: 4, fill: '#ffffff' }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="pd-empty">Only one season of ratings so far.</p>}
        <div className="pd-legend"><span><i className="l-r" />Rating</span><span><i className="l-p" />Potential</span></div>
      </Panel>

      <Panel title="Each season">
        <div className="pd-tablebox">
          <table className="pd-table pd-table-narrow">
            <thead><tr><th className="pin">Season</th><th>Rating</th><th>Change</th><th>Potential</th></tr></thead>
            <tbody>
              {[...rows].reverse().map((r, i, arr) => {
                const prev = arr[i + 1]?.rating
                const ch = r.rating != null && prev != null ? r.rating - prev : null
                return (
                  <tr key={r.season}>
                    <td className="pin"><b>{r.season}</b></td>
                    <td><span className={`rt ${ratingTier(r.rating)}`}>{r.rating ?? '-'}</span></td>
                    <td className={ch == null ? '' : ch > 0 ? 'up' : ch < 0 ? 'down' : ''}>{ch == null ? '-' : `${ch > 0 ? '+' : ''}${ch}`}</td>
                    <td><span className={`rt rt-line ${ratingTier(r.potential)}`}>{r.potential ?? '-'}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Changes on this site">
        {d.ratings.changes.length ? (
          <ul className="pd-changes">
            {[...d.ratings.changes].reverse().map((c, i) => {
              const up = (c.new_rating ?? 0) >= (c.old_rating ?? 0)
              return (
                <li key={i}>
                  <span className="when">{dateOf(c.at)}</span>
                  <span className="what"><span className={`rt ${ratingTier(c.old_rating)}`}>{c.old_rating ?? '-'}</span>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                    <span className={`rt ${ratingTier(c.new_rating)}`}>{c.new_rating ?? '-'}</span></span>
                  <span className={up ? 'up' : 'down'}>{up ? '+' : ''}{(c.new_rating ?? 0) - (c.old_rating ?? 0)}</span>
                </li>
              )
            })}
          </ul>
        ) : <p className="pd-empty">No rating changes recorded here yet.</p>}
      </Panel>
    </div>
  )
}

// ── Career ──────────────────────────────────────────────────────────
function Career({ d, logos }: { d: Dossier; logos: Record<string, string> }) {
  const p = d.player
  const c = d.career
  // One block per season, coloured by his club that year.
  const seasons = useMemo(() => {
    const m = new Map<number, { club: string; games: number; list: string | null }[]>()
    for (const r of d.afl_clubs) {
      const a = m.get(r.season) || []
      a.push({ club: r.club, games: r.games, list: r.list_type })
      m.set(r.season, a)
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [d.afl_clubs])
  // Clubs in the order he played for them.
  const clubs = useMemo(() => {
    const out: { club: string; from: number; to: number; games: number }[] = []
    for (const [y, rs] of seasons) for (const r of rs) {
      const last = out[out.length - 1]
      if (last && last.club === r.club) { last.to = y; last.games += r.games }
      else out.push({ club: r.club, from: y, to: y, games: r.games })
    }
    return out
  }, [seasons])
  return (
    <div className="pd-grid">
      <Panel title="AFL career" wide>
        <div className="pd-bigs">
          <Big v={c.games} l="Games on record" />
          <Big v={c.seasons} l="Seasons" />
          <Big v={c.goals} l="Goals" />
          <Big v={c.disposals.toLocaleString()} l="Disposals" />
          <Big v={fmt(c.sc_avg)} l="Career SC avg" />
          <Big v={c.sc_best ?? '-'} l="Career best" />
        </div>
        <p className="pd-line">{draftLong(p)}{c.first_year ? ` Game records from ${c.first_year}.` : ''}</p>
      </Panel>

      <Panel title="Clubs" wide>
        {clubs.length ? (
          <>
            <div className="pd-clubs">
              {clubs.map((k, i) => (
                <div key={i} className="pd-clubcard" style={clubVars(k.club)}>
                  {logos[k.club] && <img src={logos[k.club]} alt="" />}
                  <div><b>{k.club}</b><span>{k.from === k.to ? k.from : `${k.from} to ${k.to}`}, {k.games} games</span></div>
                </div>
              ))}
            </div>
            <div className="pd-years-strip">
              {seasons.map(([y, rs]) => (
                <div key={y} className="pd-ys" title={rs.map(r => `${r.club}, ${r.games} games${r.list ? `, ${r.list} list` : ''}`).join('; ')}
                  style={{ background: club(rs[0].club).a, ['--cb' as string]: club(rs[0].club).b } as React.CSSProperties}>
                  <span className="y">{String(y).slice(2)}</span>
                  <b>{rs.reduce((a, r) => a + r.games, 0)}</b>
                </div>
              ))}
            </div>
          </>
        ) : <p className="pd-empty">No list history on record.</p>}
      </Panel>

      {d.state_league.length > 0 && (
        <Panel title="State league and under 18s" wide>
          <div className="pd-tablebox">
            <table className="pd-table">
              <thead><tr><th className="pin">Season</th><th>Comp</th><th>Team</th><th>Games</th><th>Fantasy</th><th>DIS</th><th>M</th><th>G</th><th>T</th><th>HO</th><th>CLR</th></tr></thead>
              <tbody>
                {d.state_league.map((r, i) => (
                  <tr key={i}>
                    <td className="pin"><b>{r.season}</b></td><td>{r.competition}</td><td className="txt">{r.team}</td><td>{r.matches}</td>
                    <td className="sc">{fmt(r.fantasy_avg)}</td><td>{fmt(r.disposals)}</td><td>{fmt(r.marks)}</td><td>{fmt(r.goals)}</td>
                    <td>{fmt(r.tackles)}</td><td>{fmt(r.hitouts)}</td><td>{fmt(r.clearances)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}

// ── Keeper League ───────────────────────────────────────────────────
function Keeper({ d }: { d: Dossier }) {
  const k = d.keeper
  const t = k.totals
  const sn = d.splits
  const byYear = useMemo(() => {
    const m = new Map<number, KRound[]>()
    for (const r of k.rounds) { const a = m.get(r.year) || []; a.push(r); m.set(r.year, a) }
    return [...m.entries()].sort((a, b) => b[0] - a[0])
  }, [k.rounds])
  const splitKeys = d.stat_labels.filter(l => sn.named[l.key] != null || sn.not_named[l.key] != null)
  if (!k.stints.length && !k.rounds.length) {
    return <div className="pd-grid"><Panel title="Keeper League" wide><p className="pd-empty">No club in this league has had him on its list.</p></Panel></div>
  }
  return (
    <div className="pd-grid">
      <Panel title="His keeper career" wide>
        <div className="pd-bigs">
          <Big v={t.rounds_on_list} l="Rounds on a list" />
          <Big v={t.named} l="Named in a side" />
          <Big v={t.rounds_on_list ? `${Math.round(t.named / t.rounds_on_list * 100)}%` : '-'} l="Of his rounds" />
          <Big v={t.captain} l="Captain" />
          <Big v={t.vice_captain} l="Vice captain" />
          <Big v={fmt(t.banked, 0)} l="Points banked" />
        </div>
      </Panel>

      <Panel title="Clubs in this league" wide>
        <ol className="pd-stints">
          {k.stints.map((s, i) => (
            <li key={i} className={s.is_active ? 'now' : ''}>
              <TeamBadge name={s.team_id} size={34} showName={false} />
              <div className="pd-stint-main">
                <b>{s.team}</b>
                <span>{arrived(s)}</span>
                <span>{left(s)}</span>
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Named in the side, or not" wide>
        <div className="pd-split">
          <div className="pd-split-h"><span /> <b>Named</b><b>Not named</b></div>
          <div className="pd-split-r"><span>Games played</span><b>{sn.named.games}</b><b>{sn.not_named.games}</b></div>
          {splitKeys.map(l => {
            const a = sn.named[l.key] as number | null, b = sn.not_named[l.key] as number | null
            return (
              <div key={l.key} className="pd-split-r">
                <span>{l.name || l.label}</span>
                <b className={a != null && b != null && a > b ? 'hi' : ''}>{fmt(a)}</b>
                <b className={a != null && b != null && b > a ? 'hi' : ''}>{fmt(b)}</b>
              </div>
            )
          })}
        </div>
        <p className="pd-line">Named means a coach put him on the field (the best 22 and the flex). Not named means he was on a list that round but on the bench or not picked.</p>
      </Panel>

      {byYear.map(([y, rs]) => {
        const s = k.seasons.find(x => x.year === y)
        return (
          <Panel key={y} title={`${y}, round by round`} wide right={s && <span className="pd-hint">{s.rounds_on_list} rounds on a list, {s.named} named, {fmt(s.banked, 0)} banked{s.byes ? `, ${s.byes} bye${s.byes === 1 ? '' : 's'} left out` : ''}</span>}>
            <div className="pd-rounds">
              {rs.map(r => (
                r.bye ? (
                  <div key={`${r.team_id}-${r.round}`} className="pd-rd bye" title={`Round ${r.round}: his club had the bye`}>
                    <span className="rn">{r.round === 0 ? 'OR' : r.round}</span><b>BYE</b>
                  </div>
                ) : <div key={`${r.team_id}-${r.round}`} className={`pd-rd${r.named ? ' named' : ''}${r.captain ? ' cap' : ''}${r.vice_captain ? ' vc' : ''}`}
                  title={`Round ${r.round}, ${r.team || ''}: ${r.named ? `named${r.slot ? ` at ${r.slot}` : ''}` : r.emergency ? 'emergency' : 'not named'}${r.sc != null ? `, scored ${r.sc}` : ', did not play'}${r.banked != null ? `, banked ${r.banked}` : ''}`}>
                  <span className="rn">{r.round === 0 ? 'OR' : r.round}</span>
                  <b>{r.sc ?? '-'}</b>
                  {(r.captain || r.vice_captain) && <i>{r.captain ? 'C' : 'VC'}</i>}
                </div>
              ))}
            </div>
            <div className="pd-legend"><span><i className="l-named" />Named</span><span><i className="l-out" />On the list, not named</span><span><i className="l-cap" />Captain</span><span><i className="l-vc" />Vice captain</span><span><i className="l-bye" />Bye, not counted</span></div>
          </Panel>
        )
      })}
    </div>
  )
}

function arrived(s: Stint) {
  const when = s.acquired_at ? dateOf(s.acquired_at) : ''
  if (s.pick_number) return `Drafted, pick ${s.pick_number}${s.draft_label ? ` in the ${s.draft_label}` : ''}`
  if (s.method === 'trade') return `Traded in${when ? `, ${when}` : ''}`
  if (s.method === 'free_agent' || s.method === 'pickup') return `Picked up${when ? `, ${when}` : ''}`
  return `Joined${when ? ` ${when}` : ''}`
}
function left(s: Stint) {
  if (s.is_active) return 'On the list now'
  const when = s.left_at ? `, ${dateOf(s.left_at)}` : ''
  if (s.left === 'traded') return `Traded${s.left_to ? ` to ${s.left_to}` : ''}${when}`
  if (s.left === 'delisted') return `Delisted${when}`
  return 'Left the list'
}
