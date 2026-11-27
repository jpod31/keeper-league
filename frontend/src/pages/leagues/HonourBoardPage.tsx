import { useState, type CSSProperties } from 'react'
import { useParams, Link } from 'react-router'
import { useKeptFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'
import { TeamBadge } from '../../components/ui/TeamBadge'
import { useOpenPlayer } from '../../components/squad/PlayerPopup'
import { usePageState } from '../../lib/pageMemory'
import { clubVars } from '../../lib/clubs'
import { Emblem, type Kind, type Tier } from '../../components/honours/Emblem'

// The Honour Board (League > Honours). Lucas, 2026-11-27: "we just want
// honour boards for players that have that badge, and the year they earnt
// them in ... and colour changes for multi year winnings". One board per
// honour, every holder with his years, his metal set by how many he has won.
// Data: models/player_honours.py honour_boards() and board(). Styles: .hb2-*.

interface P { id: number; name: string; position: string; afl_team: string; photo_url?: string | null }
interface Holder extends P { team: string; times: number; years: number[]; tier: Tier; detail: string }
interface Board { key: string; kind: Kind; name: string; step: number | null; seven: boolean; points: number; holders: Holder[] }
interface Season {
  year: number; complete: boolean
  all_league: Record<string, (P & { avg: number; games: number; team: string })[]>
  records: {
    top_score: { score: number; team: string; round: number; player: P } | null
    top_season: { points: number; team: string; player: P } | null
    top_club_round: { score: number; team: string; round: number } | null
  }
}
interface Data {
  boards: Board[]
  seasons: Season[]
  hall: { line: number; legend: number; race: (P & { points: number; emblems: { kind: Kind; tier: Tier; seven: boolean; step: number | null }[] })[]
    table: { name: string; points: number | string; kind: Kind; seven: boolean }[] }
  coming: (P & { team: string; games: number; step: number; to_go: number })[]
}

const HOW: Record<string, string> = {
  keepermedal: "The league's best and fairest. Every match gives 3, 2 and 1 votes to the three best players on the ground.",
  flag: 'Played 12 or more games for the club on top of the ladder after the last round. There are no finals.',
  champion: "A club's best and fairest. After every round the club's five best get 5, 4, 3, 2 and 1 votes.",
  allleague: 'Named in the best 23 of the season, from players with 12 or more games.',
  rising: 'The most Keeper Medal votes by a player aged 21 or under.',
  triple: 'The Flag, the Keeper Medal and a Club Champion, all in one career.',
  siren: 'Won a match on his own: without what he scored over a replacement, his club loses.',
  medal7: 'The 7s best and fairest: 3, 2 and 1 votes to the best three on the ground each 7s match.',
  flag7: 'Played 8 or more 7s games for the club on top of the 7s ladder.',
  calledup: "Started the season in his club's 7s, then played 8 or more games in its 23.",
  clubgames: 'Games for one club, counting only games in the side that scored.',
  hof: 'Every honour carries points across a career. 100 points gets a player in.',
  legend: '250 points, or two Keeper Medals and the Hall of Fame.',
}
const TIER_WORD: Record<Tier, string> = { gold: 'Gold', plat: 'Platinum', ruby: 'Ruby', sapph: 'Sapphire', black: 'Black', silver: 'Silver', bronze: 'Bronze' }
const SHOW = 8

function Face({ p, size = 44 }: { p: P; size?: number }) {
  const [bad, setBad] = useState(false)
  return (
    <span className="hb2-face" style={{ ...clubVars(p.afl_team), width: size, height: size } as CSSProperties}>
      {p.photo_url && !bad ? <img src={p.photo_url} alt="" onError={() => setBad(true)} /> : <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7" /><path d="M6 40c1-9 7-14 14-14s13 5 14 14z" /></svg>}
    </span>
  )
}
function Pos({ p }: { p: string }) {
  const k = (p || 'MID').split('/')[0]
  return <span className={`pos-badge badge-${k.toLowerCase()}`}>{k}</span>
}

function BoardCard({ b, open }: { b: Board; open: (id: number) => void }) {
  const [all, setAll] = useState(false)
  const shown = all ? b.holders : b.holders.slice(0, SHOW)
  return (
    <article className={`hb2-board${b.seven ? ' seven' : ''}`}>
      <header className="hb2-bh">
        <Emblem kind={b.kind} tier={b.kind === 'legend' ? 'black' : b.kind === 'siren' ? 'bronze' : b.kind === 'clubgames' ? (b.step === 50 ? 'silver' : b.step === 150 ? 'plat' : b.step === 200 ? 'black' : 'gold') : 'gold'} step={b.step} size={60} />
        <div className="hb2-bt">
          <h3>{b.name}</h3>
          <p>{b.kind === 'clubgames' ? `${b.step} games for one club, counting games in the side that scored.` : HOW[b.kind]}</p>
        </div>
        <div className="hb2-count"><b>{b.holders.length}</b><span>{b.holders.length === 1 ? 'Holder' : 'Holders'}</span></div>
      </header>
      {b.holders.length === 0 ? (
        <div className="hb2-empty">No one yet.{b.points ? ` Worth ${b.points} Hall of Fame points.` : ''}</div>
      ) : (
        <ol className="hb2-list">
          {shown.map(h => (
            <li key={h.id} className={`hb2-h t-${h.tier}`}>
              <button type="button" onClick={() => open(h.id)}>
                <Face p={h} />
                <span className="hb2-who">
                  <span className="hb2-nm"><b>{h.name}</b><Pos p={h.position} /></span>
                  <span className="hb2-club">{h.team ? <TeamBadge name={h.team} size={22} /> : h.afl_team}</span>
                </span>
                <span className="hb2-won">
                  <b>{h.years.length ? h.years.join(', ') : 'Inducted'}</b>
                  <span>{h.times > 1 ? `${h.times} times, ${TIER_WORD[h.tier]}` : TIER_WORD[h.tier]}</span>
                </span>
                <Emblem kind={b.kind} tier={h.tier} step={b.step} size={40} />
              </button>
            </li>
          ))}
        </ol>
      )}
      {b.holders.length > SHOW && (
        <button type="button" className="hb2-more" onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${b.holders.length}`}</button>
      )}
    </article>
  )
}

type View = 'boards' | 'allleague' | 'hall' | 'records'

export function HonourBoardPage() {
  const { leagueId } = useParams()
  const { data, loading, error } = useKeptFetch<Data>(`/api/leagues/${leagueId}/honours/board`)
  const [view, setView] = usePageState<View>('view', 'boards')
  const [year, setYear] = usePageState<number | null>('year', null)
  const openPlayer = useOpenPlayer()

  if (loading && !data) return <Spinner />
  if (error || !data) return <div className="kx-page"><p>The honour board could not be loaded.</p></div>
  const named = data.seasons.filter(s => Object.keys(s.all_league || {}).length)
  const season = named.find(s => s.year === year) || named[0]
  const recSeason = data.seasons.find(s => s.year === year) || data.seasons[0]
  const views: [View, string][] = [['boards', 'Honour boards'], ['allleague', 'All-League 23'], ['hall', 'Hall of Fame'], ['records', 'Records']]
  const Name = ({ p }: { p: P }) => <button type="button" className="hb2-link" onClick={() => openPlayer(p.id)}>{p.name}</button>

  return (
    <div className="kx-page hb2">
      <div className="d-none d-lg-block"><LeagueSubnav active="honours" leagueId={leagueId!} /></div>
      <div className="page-breadcrumb d-none d-lg-block"><Link to={`/leagues/${leagueId}`}>League</Link> / Honours</div>
      <header className="hb2-head">
        <h2>Honour Board</h2>
        <div className="hb2-views" role="tablist">
          {views.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}
        </div>
      </header>

      {view === 'boards' && (
        <>
          <div className="hb2-legend" aria-label="What the colours mean">
            {(['gold', 'plat', 'ruby', 'sapph', 'black'] as Tier[]).map((t, i) => (
              <span key={t} className={`t-${t}`}><i />{i === 4 ? '5 or more' : i === 0 ? 'Won once' : `${i + 1} times`}</span>
            ))}
          </div>
          <div className="hb2-boards">
            {data.boards.map(b => <BoardCard key={b.key} b={b} open={openPlayer} />)}
          </div>
        </>
      )}

      {view === 'allleague' && (
        season ? (
          <section className="hb2-sheet">
            <header className="hb2-sheet-h">
              <Emblem kind="allleague" tier="gold" size={60} />
              <div className="hb2-bt"><h3>All-League 23, {season.year}</h3><p>{HOW.allleague}</p></div>
              {named.length > 1 && (
                <div className="hb2-years">{named.map(s => <button key={s.year} type="button" className={s.year === season.year ? 'on' : ''} onClick={() => setYear(s.year)}>{s.year}</button>)}</div>
              )}
            </header>
            {([['DEF', 'Defence'], ['MID', 'Midfield'], ['RUC', 'Ruck'], ['FWD', 'Forwards'], ['FLEX', 'Flex']] as [string, string][]).map(([k, label]) => {
              const rows = season.all_league[k] || []
              if (!rows.length) return null
              return (
                <div key={k} className="hb2-line">
                  <span className="hb2-lab">{label}</span>
                  <div className="hb2-three">
                    {rows.map(p => (
                      <button key={p.id} type="button" className="hb2-slot" onClick={() => openPlayer(p.id)}>
                        <Face p={p} size={48} />
                        <span className="hb2-who"><b>{p.name}</b><span className="hb2-nm"><Pos p={p.position} /><TeamBadge name={p.team} size={22} showName={false} /></span></span>
                        <span className="hb2-stat"><b>{p.avg}</b><span>Avg</span></span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        ) : <div className="hb2-empty">Named when the first season is done.</div>
      )}

      {view === 'hall' && (
        <div className="hb2-hall">
          <section className="hb2-board">
            <header className="hb2-bh">
              <Emblem kind="hof" tier="gold" size={60} />
              <div className="hb2-bt"><h3>The race to the Hall of Fame</h3><p>{HOW.hof} Legend at {data.hall.legend}.</p></div>
              <div className="hb2-count"><b>{data.boards.find(b => b.kind === 'hof')?.holders.length ?? 0}</b><span>Inducted</span></div>
            </header>
            <div className="hb2-race">
              {data.hall.race.map((p, i) => (
                <div key={p.id} className="hb2-track">
                  <Face p={p} />
                  <span className="hb2-who"><Name p={p} /><span className="hb2-ems">{p.emblems.slice(0, 7).map((e, n) => <Emblem key={n} kind={e.kind} tier={e.tier} step={e.step} size={24} />)}</span></span>
                  <span className="hb2-bar"><i style={{ width: Math.min(100, p.points / (data.hall.line * 1.2) * 100) + '%' }} /><em style={{ left: (100 / 1.2) + '%' }}>{i === 0 && <small>Hall of Fame, {data.hall.line}</small>}</em></span>
                  <span className="hb2-stat"><b>{p.points}</b><span>Points</span></span>
                </div>
              ))}
            </div>
          </section>
          <section className="hb2-board">
            <header className="hb2-bh hb2-bh-sm"><div className="hb2-bt"><h3>What each honour is worth</h3></div></header>
            <table className="hb2-tbl"><thead><tr><th>Honour</th><th className="n">Points</th></tr></thead><tbody>
              {data.hall.table.map(r => <tr key={r.name}><td><span className="hb2-nm"><Emblem kind={r.kind} tier="gold" step={r.kind === 'clubgames' ? 50 : null} size={30} />{r.name}</span></td><td className="n">{r.points}</td></tr>)}
            </tbody></table>
          </section>
        </div>
      )}

      {view === 'records' && recSeason && (
        <div className="hb2-records">
          {recSeason.records.top_score && (
            <div className="hb2-rec"><span className="hb2-lab">Highest score</span><b>{recSeason.records.top_score.score}</b>
              <span className="hb2-nm"><Face p={recSeason.records.top_score.player} size={32} /><Name p={recSeason.records.top_score.player} /></span>
              <span>{recSeason.records.top_score.team}, round {recSeason.records.top_score.round}, {recSeason.year}</span></div>
          )}
          {recSeason.records.top_season && (
            <div className="hb2-rec"><span className="hb2-lab">Most points in a season</span><b>{recSeason.records.top_season.points.toLocaleString()}</b>
              <span className="hb2-nm"><Face p={recSeason.records.top_season.player} size={32} /><Name p={recSeason.records.top_season.player} /></span>
              <span>{recSeason.records.top_season.team}, {recSeason.year}</span></div>
          )}
          {recSeason.records.top_club_round && (
            <div className="hb2-rec"><span className="hb2-lab">Highest club score</span><b>{recSeason.records.top_club_round.score.toLocaleString()}</b>
              <span className="hb2-nm"><TeamBadge name={recSeason.records.top_club_round.team} size={32} /></span>
              <span>Round {recSeason.records.top_club_round.round}, {recSeason.year}</span></div>
          )}
          <section className="hb2-board hb2-wide">
            <header className="hb2-bh hb2-bh-sm"><Emblem kind="clubgames" tier="silver" step={50} size={44} /><div className="hb2-bt"><h3>Next milestones</h3><p>The closest to their next club games milestone.</p></div></header>
            <table className="hb2-tbl"><thead><tr><th>Player</th><th>Club</th><th className="n">Games</th><th className="n">Milestone</th><th className="n">To go</th></tr></thead><tbody>
              {data.coming.map(p => <tr key={p.id + p.team}><td><span className="hb2-nm"><Face p={p} size={30} /><Name p={p} /></span></td><td><TeamBadge name={p.team} size={24} /></td><td className="n">{p.games}</td><td className="n">{p.step}</td><td className="n">{p.to_go}</td></tr>)}
            </tbody></table>
          </section>
        </div>
      )}
    </div>
  )
}
