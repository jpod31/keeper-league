import { useParams, Link } from 'react-router'
import { useKeptFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'
import { TeamBadge } from '../../components/ui/TeamBadge'
import { useOpenPlayer } from '../../components/squad/PlayerPopup'
import { usePageState } from '../../lib/pageMemory'
import { Emblem, type Kind, type Tier } from '../../components/honours/Emblem'

// The Honour Board (Lucas, 2026-11-27: "where is the badges summary area that I
// asked for"): every season's winners, the All-League 23, the Hall of Fame
// race, each club's board and the records. Data: models/player_honours.py board().
// Styles: .hb-* in static/style.css.

interface P { id: number; name: string; position: string; afl_team: string }
interface Won extends P { team: string; detail: string; value: number | null; round: number | null }
interface Season {
  year: number; complete: boolean
  flag: { team: string; team_id: number; wins: number; losses: number; players: (P & { games: number })[] } | null
  medal: (P & { votes: number })[]
  honours: Partial<Record<Kind, Won[]>>
  all_league: Record<string, (P & { avg: number; games: number; team: string })[]>
  sevens: {
    flag: { team: string; team_id: number; wins: number; losses: number; players: (P & { games: number })[] } | null
    medal: (P & { votes: number })[]
    called_up: (P & { games: number })[]
  }
  records: {
    top_score: { score: number; team: string; round: number; player: P } | null
    top_season: { points: number; team: string; player: P } | null
    top_club_round: { score: number; team: string; round: number } | null
  }
}
interface Board {
  seasons: Season[]
  hall: { line: number; legend: number; race: (P & { points: number; emblems: { kind: Kind; tier: Tier; seven: boolean; step: number | null }[] })[]
    table: { name: string; points: number | string; kind: Kind; seven: boolean }[] }
  coming: (P & { team: string; games: number; step: number; to_go: number })[]
  clubs: { team_id: number; team: string; honours: (P & { kind: Kind; name: string; year: number | null; detail: string; seven: boolean; step: number | null })[] }[]
}

type Tab = 'season' | 'allleague' | 'hall' | 'clubs' | 'records'

function Pos({ p }: { p: string }) {
  const k = (p || 'MID').split('/')[0]
  return <span className={`pos-badge badge-${k.toLowerCase()}`}>{k}</span>
}

export function HonourBoardPage() {
  const { leagueId } = useParams()
  const { data, loading, error } = useKeptFetch<Board>(`/api/leagues/${leagueId}/honours/board`)
  const [tab, setTab] = usePageState<Tab>('tab', 'season')
  const [year, setYear] = usePageState<number | null>('year', null)
  const openPlayer = useOpenPlayer()

  if (loading && !data) return <Spinner />
  if (error || !data) return <div className="kx-page"><p>The honour board could not be loaded.</p></div>
  const season = data.seasons.find(s => s.year === year) || data.seasons[0]
  const Name = ({ p }: { p: P }) => <button type="button" className="hb-name" onClick={() => openPlayer(p.id)}>{p.name}</button>

  const tabs: [Tab, string][] = [['season', 'Season'], ['allleague', 'All-League 23'], ['hall', 'Hall of Fame'], ['clubs', 'Clubs'], ['records', 'Records']]

  return (
    <div className="kx-page hb">
      <div className="d-none d-lg-block"><LeagueSubnav active="honours" leagueId={leagueId!} /></div>
      <div className="page-breadcrumb d-none d-lg-block"><Link to={`/leagues/${leagueId}`}>League</Link> / Honours</div>
      <div className="kx-head">
        <h2>Honour Board</h2>
        {data.seasons.length > 1 && (
          <div className="sn-years" role="group" aria-label="Season">
            {data.seasons.map(s => <button key={s.year} type="button" className={`sn-year${s.year === season?.year ? ' on' : ''}`} onClick={() => setYear(s.year)}>{s.year}</button>)}
          </div>
        )}
      </div>
      <div className="hb-tabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'season' && season && (
        <div className="hb-body">
          {!season.complete && <p className="hb-note">The {season.year} season is still going. Season honours are given when the last round is done; The Siren counts as it happens.</p>}
          <section className="hb-cabinet">
            {season.flag && (
              <div className="hb-trophy">
                <Emblem kind="flag" tier="gold" size={84} />
                <div><span className="hb-lab">The Flag</span><b><TeamBadge name={season.flag.team} size={22} /></b><span>{season.flag.wins}-{season.flag.losses}, top of the ladder</span></div>
              </div>
            )}
            {(season.honours.keepermedal || []).map(w => (
              <div className="hb-trophy" key={'m' + w.id}><Emblem kind="keepermedal" tier="gold" size={84} />
                <div><span className="hb-lab">Keeper Medal</span><b><Name p={w} /></b><span>{w.team}, {w.detail}</span></div></div>
            ))}
            {(season.honours.rising || []).map(w => (
              <div className="hb-trophy" key={'r' + w.id}><Emblem kind="rising" tier="gold" size={84} />
                <div><span className="hb-lab">Rising Star</span><b><Name p={w} /></b><span>{w.team}, {w.detail}</span></div></div>
            ))}
            {(season.honours.triple || []).map(w => (
              <div className="hb-trophy" key={'t' + w.id}><Emblem kind="triple" tier="gold" size={84} />
                <div><span className="hb-lab">Triple Crown</span><b><Name p={w} /></b><span>{w.detail}</span></div></div>
            ))}
            {season.sevens.flag && (
              <div className="hb-trophy"><Emblem kind="flag7" tier="gold" size={84} />
                <div><span className="hb-lab">7s Flag</span><b><TeamBadge name={season.sevens.flag.team} size={22} /></b><span>{season.sevens.flag.wins}-{season.sevens.flag.losses}, top of the 7s ladder</span></div></div>
            )}
            {(season.honours.medal7 || []).map(w => (
              <div className="hb-trophy" key={'s' + w.id}><Emblem kind="medal7" tier="gold" size={84} />
                <div><span className="hb-lab">7s Medal</span><b><Name p={w} /></b><span>{w.team}, {w.detail}</span></div></div>
            ))}
          </section>

          <div className="hb-grid">
            {(season.honours.champion || []).length > 0 && (
              <section className="hb-panel">
                <h3><Emblem kind="champion" tier="gold" size={34} />Club Champions</h3>
                <table className="hb-table"><tbody>
                  {season.honours.champion!.map(w => (
                    <tr key={w.id + w.team}><td><TeamBadge name={w.team} size={22} showName={false} /></td><td><Pos p={w.position} /> <Name p={w} /></td><td className="n">{w.value} votes</td></tr>
                  ))}
                </tbody></table>
                <p className="hb-foot">Each round the club's best five on points over replacement get 5, 4, 3, 2 and 1 votes.</p>
              </section>
            )}
            {season.medal.length > 0 && (
              <section className="hb-panel">
                <h3><Emblem kind="keepermedal" tier="gold" size={34} />Keeper Medal count</h3>
                <table className="hb-table"><tbody>
                  {season.medal.map((p, i) => <tr key={p.id}><td className="n">{i + 1}</td><td><Pos p={p.position} /> <Name p={p} /></td><td className="n">{p.votes}</td></tr>)}
                </tbody></table>
                <p className="hb-foot">3, 2 and 1 votes a match to the best three on the ground.</p>
              </section>
            )}
            {season.flag && (
              <section className="hb-panel hb-wide">
                <h3><Emblem kind="flag" tier="gold" size={34} />Premiership players, {season.flag.team}</h3>
                <div className="hb-chips">{season.flag.players.map(p => <span key={p.id}><Name p={p} /> {p.games}</span>)}</div>
                <p className="hb-foot">12 or more games in the side. The number is his games.</p>
              </section>
            )}
            {(season.honours.siren || []).length > 0 && (
              <section className="hb-panel hb-wide">
                <h3><Emblem kind="siren" tier="bronze" size={34} />The Siren</h3>
                <table className="hb-table"><tbody>
                  {season.honours.siren!.map(w => <tr key={w.id + '-' + w.round}><td><TeamBadge name={w.team} size={22} showName={false} /></td><td><Name p={w} /></td><td>{w.detail}</td></tr>)}
                </tbody></table>
                <p className="hb-foot">His club won, without his points over replacement they lose, and no more than two team-mates could say the same.</p>
              </section>
            )}
            {season.sevens.flag && (
              <section className="hb-panel">
                <h3><Emblem kind="flag7" tier="gold" size={34} />7s premiership, {season.sevens.flag.team}</h3>
                <div className="hb-chips">{season.sevens.flag.players.map(p => <span key={p.id}><Name p={p} /> {p.games}</span>)}</div>
                <p className="hb-foot">8 or more 7s games.</p>
              </section>
            )}
            {season.sevens.called_up.length > 0 && (
              <section className="hb-panel">
                <h3><Emblem kind="calledup" tier="gold" size={34} />Called Up</h3>
                <table className="hb-table"><tbody>
                  {season.sevens.called_up.map(p => <tr key={p.id}><td><Pos p={p.position} /> <Name p={p} /></td><td className="n">{p.games} games in the 23</td></tr>)}
                </tbody></table>
                <p className="hb-foot">Started in his club's 7s, then 8 or more games in its 23.</p>
              </section>
            )}
            {season.sevens.medal.length > 0 && (
              <section className="hb-panel">
                <h3><Emblem kind="medal7" tier="gold" size={34} />7s Medal count</h3>
                <table className="hb-table"><tbody>
                  {season.sevens.medal.map((p, i) => <tr key={p.id}><td className="n">{i + 1}</td><td><Pos p={p.position} /> <Name p={p} /></td><td className="n">{p.votes}</td></tr>)}
                </tbody></table>
              </section>
            )}
          </div>
        </div>
      )}

      {tab === 'allleague' && season && (
        <div className="hb-body">
          {Object.keys(season.all_league).length === 0 ? <p className="hb-note">Named when the {season.year} season is done.</p> : (
            <section className="hb-team">
              <p className="hb-note">The best 23 of {season.year} on points over replacement, 12 or more games, picked into real lines. Each is an All-League honour.</p>
              {([['DEF', 'Defence'], ['MID', 'Midfield'], ['RUC', 'Ruck'], ['FWD', 'Forwards'], ['FLEX', 'Flex']] as [string, string][]).map(([k, label]) => {
                const rows = season.all_league[k] || []
                if (!rows.length) return null
                const lines: typeof rows[] = []
                for (let i = 0; i < rows.length; i += 3) lines.push(rows.slice(i, i + 3))
                return (
                  <div key={k} className="hb-line">
                    <h4>{label}</h4>
                    {lines.map((ln, i) => (
                      <div key={i} className="hb-three">
                        {ln.map(p => (
                          <button key={p.id} type="button" className="hb-pl" onClick={() => openPlayer(p.id)}>
                            <span className="hb-pl-top"><Pos p={p.position} /><b>{p.name}</b></span>
                            <span className="hb-pl-nums"><b>{p.avg}</b> avg <b>{p.games}</b> games</span>
                            <span className="hb-pl-team"><TeamBadge name={p.team} size={18} /></span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })}
            </section>
          )}
        </div>
      )}

      {tab === 'hall' && (
        <div className="hb-body hb-grid">
          <section className="hb-panel hb-wide">
            <h3><Emblem kind="hof" tier="gold" size={34} />The race to the Hall of Fame</h3>
            <p className="hb-foot">{data.hall.line} points to get in. Legend at {data.hall.legend}, or two Keeper Medals and the Hall.</p>
            <div className="hb-race">
              {data.hall.race.map(p => (
                <div key={p.id} className="hb-race-row">
                  <span className="hb-race-name"><Name p={p} /></span>
                  <span className="hb-race-ems">{p.emblems.slice(0, 6).map((e, i) => <Emblem key={i} kind={e.kind} tier={e.tier} step={e.step} size={24} />)}</span>
                  <span className="hb-race-bar"><i style={{ width: Math.min(100, p.points / (data.hall.line * 1.2) * 100) + '%' }} /><em style={{ left: (100 / 1.2) + '%' }} /></span>
                  <b>{p.points}</b>
                </div>
              ))}
            </div>
          </section>
          <section className="hb-panel">
            <h3>What each honour is worth</h3>
            <table className="hb-table"><tbody>
              {data.hall.table.map(r => <tr key={r.name}><td><Emblem kind={r.kind} tier="gold" step={r.kind === 'clubgames' ? 50 : null} size={28} /></td><td>{r.name}</td><td className="n"><b>{r.points}</b></td></tr>)}
            </tbody></table>
          </section>
        </div>
      )}

      {tab === 'clubs' && (
        <div className="hb-body hb-grid">
          {data.clubs.map(c => (
            <section key={c.team_id} className="hb-panel">
              <h3><TeamBadge name={c.team} size={30} /></h3>
              {c.honours.length === 0 ? <p className="hb-foot">No honours yet.</p> : (
                <table className="hb-table"><tbody>
                  {c.honours.filter(h => h.kind !== 'flag' && h.kind !== 'flag7').map((h, i) => (
                    <tr key={i}><td><Emblem kind={h.kind} tier="gold" step={h.step} size={26} /></td><td>{h.kind === 'clubgames' ? (h.step === 100 ? 'Life Member' : `${h.step} club games`) : h.name}</td><td><Name p={h} /></td><td className="n">{h.year ?? ''}</td></tr>
                  ))}
                </tbody></table>
              )}
              {c.honours.some(h => h.kind === 'flag') && <p className="hb-foot">Premiership: {[...new Set(c.honours.filter(h => h.kind === 'flag').map(h => h.year))].join(', ')}</p>}
              {c.honours.some(h => h.kind === 'flag7') && <p className="hb-foot">7s premiership: {[...new Set(c.honours.filter(h => h.kind === 'flag7').map(h => h.year))].join(', ')}</p>}
            </section>
          ))}
        </div>
      )}

      {tab === 'records' && season && (
        <div className="hb-body hb-grid">
          <section className="hb-panel">
            <h3>Records, {season.year}</h3>
            <div className="hb-kv">
              {season.records.top_score && <div><b>{season.records.top_score.score}</b><span>Highest score: <Name p={season.records.top_score.player} />, {season.records.top_score.team}, round {season.records.top_score.round}</span></div>}
              {season.records.top_season && <div><b>{season.records.top_season.points.toLocaleString()}</b><span>Most points in the season: <Name p={season.records.top_season.player} />, {season.records.top_season.team}</span></div>}
              {season.records.top_club_round && <div><b>{season.records.top_club_round.score.toLocaleString()}</b><span>Highest club score: {season.records.top_club_round.team}, round {season.records.top_club_round.round}</span></div>}
            </div>
          </section>
          <section className="hb-panel">
            <h3><Emblem kind="clubgames" tier="silver" step={50} size={34} />Coming up</h3>
            <table className="hb-table"><tbody>
              {data.coming.map(p => <tr key={p.id + p.team}><td><Name p={p} /></td><td><TeamBadge name={p.team} size={20} showName={false} /></td><td className="n">{p.games} of {p.step}</td></tr>)}
            </tbody></table>
            <p className="hb-foot">The closest to the next club games milestone.</p>
          </section>
        </div>
      )}
    </div>
  )
}
