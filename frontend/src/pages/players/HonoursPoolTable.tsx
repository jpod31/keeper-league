import { useMemo } from 'react'
import { usePageState } from '../../lib/pageMemory'
import { Emblem, emblemLabel, type Kind, type Tier } from '../../components/honours/Emblem'

// The pool's Honours view (Lucas, 2026-11-26: "maybe another toggle in player
// pool... and some icons that carry with them in the player pool in general").
// Data: /api/leagues/<id>/honours/summary (models/player_honours.py summary()).

export interface HonourIcon { kind: Kind; tier: Tier; step: number | null; seven: boolean; times: number; name: string }
export interface HonourSummary {
  points: number; flags: number; medals: number; champs: number; allleague: number; sevens: number
  icons: HonourIcon[]
}

/** His honours as small emblems beside his name, best first. */
export function HonourIcons({ s, max = 4, size = 20 }: { s?: HonourSummary; max?: number; size?: number }) {
  if (!s || !s.icons.length) return null
  return (
    <span className="hon-icons" title={s.icons.map(i => emblemLabel(i)).join(', ')}>
      {s.icons.slice(0, max).map((i, n) => <Emblem key={n} kind={i.kind} tier={i.tier} step={i.step} size={size} />)}
    </span>
  )
}

interface Row { id: number; name: string; position?: string; owner_team?: string | null; afl_team?: string }
type Key = 'points' | 'flags' | 'medals' | 'champs' | 'allleague' | 'sevens' | 'name'

export function HonoursPoolTable({ players, honours, onOpen }: { players: Row[]; honours: Record<string, HonourSummary>; onOpen: (id: number) => void }) {
  const [sort, setSort] = usePageState<Key>('honSort', 'points')
  const rows = useMemo(() => {
    const out = players.filter(p => honours[String(p.id)]).map(p => ({ p, h: honours[String(p.id)] }))
    out.sort((a, b) => sort === 'name' ? a.p.name.localeCompare(b.p.name) : (b.h[sort] - a.h[sort]) || (b.h.points - a.h.points))
    return out
  }, [players, honours, sort])
  const th = (k: Key, label: string, cls = 'n') => (
    <th className={`${cls}${sort === k ? ' sorted' : ''}`} onClick={() => setSort(k)} role="button">{label}</th>
  )
  if (!rows.length) return <p className="hon-empty">No player in this list has an honour yet.</p>
  return (
    <div className="hon-wrap">
      <table className="hon-table">
        <thead><tr>
          {th('name', 'Player', '')}<th>Club</th>{th('points', 'HoF pts')}{th('flags', 'Flags')}{th('medals', 'Keeper Medals')}
          {th('champs', 'Club champs')}{th('allleague', 'All-League')}{th('sevens', '7s')}<th>Cabinet</th>
        </tr></thead>
        <tbody>
          {rows.map(({ p, h }) => (
            <tr key={p.id} onClick={() => onOpen(p.id)}>
              <td><span className={`pos-badge badge-${(p.position || 'MID').split('/')[0].toLowerCase()}`}>{(p.position || 'MID').split('/')[0]}</span> <b>{p.name}</b></td>
              <td>{p.owner_team || 'Free agent'}</td>
              <td className="n"><b>{h.points}</b></td>
              <td className="n">{h.flags || '-'}</td>
              <td className="n">{h.medals || '-'}</td>
              <td className="n">{h.champs || '-'}</td>
              <td className="n">{h.allleague || '-'}</td>
              <td className="n">{h.sevens || '-'}</td>
              <td><span className="hon-strip">{h.icons.map((i, n) => <Emblem key={n} kind={i.kind} tier={i.tier} step={i.step} size={26} title={emblemLabel(i)} />)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
