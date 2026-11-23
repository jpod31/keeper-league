import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import type { UniNode } from './StyleUniverse3D'
const StyleUniverse3D = lazy(() => import('./StyleUniverse3D'))

const CL_COLORS = ['#e0deea', '#bc8cff', '#f0883e', '#3fb950', '#ff6b9d', '#ffd23f', '#ececf6', '#ff5e57']

interface DeckData {
  universe: { has_data: boolean; nodes: UniNode[]; clusters: { id: number; name: string; n: number }[]; variance_explained: number; n_players: number; owned_count: number }
  outlook: { has_data: boolean; finals_pct: number; finals_n: number; n_teams: number; proj_wins: number; current_wins: number; remaining: number; seed_dist: number[]; median_seed: number; top_seed_pct: number; your_mean: number; your_sd: number; reason?: string }
  dna: { has_data: boolean; floor: number; median: number; ceiling: number; mean: number; sd: number; cv: number; eff_scorers: number; top3_share: number; fragility: number; n_starters: number; leverage: { id: number; name: string; pos: string; mean_share: number; swing: number; is_cap: boolean }[] }
}
interface Intel { has_data: boolean; team_metrics: { descriptor: string | null; avg_age: number; vorp_total: number; health: number | null } }

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    let raf = 0, start = 0
    const from = ref.current
    const step = (t: number) => {
      if (!start) start = t
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      setV(from + (target - from) * e)
      if (k < 1) raf = requestAnimationFrame(step)
      else ref.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

function Gauge({ pct, color, label }: { pct: number; color: string; label: string }) {
  const v = useCountUp(pct)
  const R = 52, C = 2 * Math.PI * R, off = C * (1 - v / 100)
  return (
    <div className="dk-gauge">
      <svg viewBox="0 0 130 130" width="130" height="130">
        <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(224,222,234,.12)" strokeWidth="9" />
        <circle cx="65" cy="65" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 65 65)"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        <text x="65" y="60" textAnchor="middle" className="dk-gauge-num" style={{ fill: color }}>{Math.round(v)}<tspan className="dk-gauge-pct">%</tspan></text>
        <text x="65" y="82" textAnchor="middle" className="dk-gauge-lbl">{label}</text>
      </svg>
    </div>
  )
}

function Kpi({ value, suffix, label, sub, color, decimals = 0 }: { value: number; suffix?: string; label: string; sub?: string; color: string; decimals?: number }) {
  const v = useCountUp(value)
  return (
    <div className="dk-kpi" style={{ ['--gc' as string]: color } as React.CSSProperties}>
      <div className="dk-kpi-val">{v.toFixed(decimals)}{suffix && <span className="dk-kpi-suf">{suffix}</span>}</div>
      <div className="dk-kpi-lbl">{label}</div>
      {sub && <div className="dk-kpi-sub">{sub}</div>}
    </div>
  )
}

export function CommandDeck({ leagueId, teamId, descriptor }: { leagueId: string; teamId: string; descriptor: string | null }) {
  const navigate = useNavigate()
  const open = (id: number) => navigate(`/leagues/${leagueId}/team/${teamId}/player/${id}`)
  const { data: deck, loading } = useFetch<DeckData>(`/leagues/${leagueId}/team/${teamId}/deck?format=json`)
  const { data: intel } = useFetch<Intel>(`/leagues/${leagueId}/team/${teamId}/squad-intel?format=json`)

  if (loading || !deck) return <div style={{ padding: 50, textAlign: 'center' }}><Spinner /><div className="text-secondary mt-2" style={{ fontSize: '.85rem' }}>Working it out</div></div>

  const u = deck.universe, o = deck.outlook, d = deck.dna
  const desc = descriptor || intel?.team_metrics?.descriptor || 'Squad analysis'
  const live = !!o?.has_data && o.remaining > 0

  // your style mix (owned per cluster)
  const mix: { name: string; n: number; cluster: number }[] = []
  if (u?.has_data) {
    const m = new Map<number, { name: string; n: number; cluster: number }>()
    u.nodes.filter(n => n.owned).forEach(n => {
      const e = m.get(n.cluster) || { name: n.archetype, n: 0, cluster: n.cluster }; e.n++; m.set(n.cluster, e)
    })
    mix.push(...[...m.values()].sort((a, b) => b.n - a.n))
  }

  // narrative beats
  const beats: string[] = []
  if (o?.has_data && o.remaining > 0) {
    const verdict = o.finals_pct >= 75 ? 'firmly in the finals picture' : o.finals_pct >= 45 ? 'on the bubble' : 'facing an uphill run'
    beats.push(`Across ${o.remaining} simulated rounds you land ${verdict}, **${o.finals_pct}%** of seasons see you play September, most often as the **${ordinal(o.median_seed)} seed**.`)
  }
  if (d?.has_data) {
    const consistency = d.cv <= 7 ? 'remarkably stable week to week' : d.cv <= 11 ? 'fairly steady' : 'high-variance, boom or bust'
    const reliance = d.top3_share >= 35 ? `top-heavy, **${d.top3_share}%** of output rides on three names` : `well spread (${d.eff_scorers} effective scorers, top-3 just ${d.top3_share}%)`
    beats.push(`Your weekly score is ${consistency} (±${d.sd}); scoring is ${reliance}. If your gun misses, you shed **${d.fragility}%** of output.`)
  }
  if (mix.length) {
    const top = mix.slice(0, 2).map(x => `${x.n}× ${x.name}`).join(' and ')
    beats.push(`Style-wise your squad leans on ${top}${u.has_data ? `, mapped from ${u.n_players} players across ${u.variance_explained}% of league style variance` : ''}.`)
  }

  return (
    <div className="dk-stage">
      {/* headline */}
      <div className="dk-headline">
        <div className="dk-headline-desc">{desc}</div>
      </div>

      {/* KPI strip */}
      <div className="dk-kpis">
        {live && <Kpi value={o.finals_pct} suffix="%" label="Finals chance" color="#e0deea" />}
        {live && <Kpi value={o.proj_wins} label="Projected wins" color="#e0deea" decimals={1} />}
        {d?.has_data && <Kpi value={d.median} label="Typical week" color="#e0deea" />}
        {d?.has_data && <Kpi value={d.ceiling} label="Best week" color="#e0deea" />}
        {d?.has_data && <Kpi value={d.floor} label="Worst week" color="#e0deea" />}
      </div>

      <div className="dk-grid">
        {/* HERO, style universe */}
        <div className="dk-universe">
          <div className="dk-panel-head"><span className="dk-panel-title">Playing styles</span></div>
          <div className="dk-universe-canvas">
            {u?.has_data
              ? <Suspense fallback={<div className="dk-loading"><Spinner /></div>}><StyleUniverse3D nodes={u.nodes} onSelect={open} /></Suspense>
              : <div className="dk-loading text-secondary">Not enough game data to map playing styles yet.</div>}
          </div>
          {u?.has_data && (
            <div className="dk-legend">
              {u.clusters.map(c => <span key={c.id} className="dk-legend-item"><span className="dk-legend-dot" style={{ background: CL_COLORS[c.id % CL_COLORS.length] }}></span>{c.name}</span>)}
            </div>
          )}
        </div>

        {/* Season outlook */}
        {live && (
          <div className="dk-panel dk-outlook">
            <div className="dk-panel-head"><span className="dk-panel-title">Season outlook</span></div>
            <div className="dk-outlook-body">
              <Gauge pct={o.finals_pct} color="#e0deea" label="FINALS" />
              <div className="dk-seed">
                <div className="dk-seed-title">Where you finish</div>
                <div className="dk-seed-bars">
                  {o.seed_dist.map((c, i) => {
                    const mx = Math.max(...o.seed_dist) || 1
                    const inFinals = i < o.finals_n
                    return <div key={i} className="dk-seed-col" title={`${ordinal(i + 1)}: ${Math.round(c / o.seed_dist.reduce((a, b) => a + b, 0) * 100)}%`}>
                      <div className="dk-seed-bar" style={{ height: `${c / mx * 100}%`, background: inFinals ? '#e0deea' : 'rgba(224,222,234,.3)' }}></div>
                      <div className="dk-seed-lbl">{i + 1}</div>
                    </div>
                  })}
                </div>
                <div className="dk-seed-foot">Finish first <b>{o.top_seed_pct}%</b>, most likely <b>{ordinal(o.median_seed)}</b></div>
              </div>
            </div>
          </div>
        )}

        {/* Squad DNA */}
        {d?.has_data && (
          <div className="dk-panel dk-dna">
            <div className="dk-panel-head"><span className="dk-panel-title">Where your score comes from</span></div>
            <div className="dk-range">
              <div className="dk-range-track">
                <div className="dk-range-fill"></div>
                <div className="dk-range-tick" style={{ left: '50%' }}><span>{d.median}</span></div>
              </div>
              <div className="dk-range-ends"><span>floor {d.floor}</span><span>ceiling {d.ceiling}</span></div>
            </div>
            <div className="dk-dna-stats">
              <div className="dk-dna-stat"><div className="dk-dna-v">{d.eff_scorers}</div><div className="dk-dna-l">players who carry it</div></div>
              <div className="dk-dna-stat"><div className="dk-dna-v">{d.top3_share}%</div><div className="dk-dna-l">from your top 3</div></div>
              <div className="dk-dna-stat"><div className="dk-dna-v">{d.fragility}%</div><div className="dk-dna-l">lost if your best is out</div></div>
            </div>
            <div className="dk-lev">
              <div className="dk-lev-title">Who carries the week</div>
              {d.leverage.slice(0, 5).map(l => (
                <button key={l.id} className="dk-lev-row" onClick={() => open(l.id)}>
                  <span className={`pos-dot pos-${l.pos}`}></span>
                  <span className="dk-lev-name">{l.name}{l.is_cap && <span className="pred-c">C</span>}</span>
                  <div className="dk-lev-track"><div className="dk-lev-bar" style={{ width: `${Math.min(100, l.mean_share / (d.leverage[0].mean_share || 1) * 100)}%` }}></div></div>
                  <span className="dk-lev-pct">{l.mean_share}%</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Narrative */}
        {beats.length > 0 && (
          <div className="dk-panel dk-story">
            <div className="dk-panel-head"><span className="dk-panel-title">In short</span></div>
            <div className="dk-story-body">
              {beats.map((b, i) => <p key={i} dangerouslySetInnerHTML={{ __html: b.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
