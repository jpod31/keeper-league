import { useParams, Link, useNavigate, useSearchParams } from 'react-router'
import { useMemo, useState } from 'react'
import { useFetch } from '../../hooks/useFetch'
import { Spinner } from '../../components/ui/Spinner'
import { LeagueSubnav } from '../../components/nav/LeagueSubnav'
import { TeamBadge } from '../../components/ui/TeamBadge'
import { ratingTier, rgbOf } from '../../lib/clubs'
import { useOpenPlayer } from '../../components/squad/PlayerPopup'

interface TeamCard { id: number; name: string; logo: string | null; accent: string }
interface LadderRow extends TeamCard {
  pos: number; wins: number; losses: number; draws: number
  points_for: number; points_against: number; pct: number; points: number
}
interface Match {
  id: number; status: string; is_final: boolean
  home_id: number; away_id: number; home: string; away: string
  home_score: number | null; away_score: number | null
}
interface SquadPlayer {
  id: number; name: string; afl_team: string; position: string
  age: number | null; rating: number | null; prev_avg: number | null
  acquired_via: string | null; draft_pick: number | null; draft_round: number | null
  is_former: boolean
}
interface DraftPick {
  pick: number; round: number; team_id: number; team: string
  player_id: number; player: string; position: string; afl_team: string
}
interface Draft { id: number; label: string; type: string; date: string | null; rounds: number; picks: DraftPick[] }
interface TradeRow { id: number; date: string | null; a_id: number; b_id: number; a: string; b: string; a_gets: string[]; b_gets: string[] }
interface DelistRow { team_id: number; team: string; player_id: number; player: string; position: string; period: string; date: string | null }

interface SeasonData {
  league: { id: number; name: string; season_year: number }
  year: number
  years: number[]
  is_current: boolean
  my_team_id: number | null
  teams: TeamCard[]
  ladder: LadderRow[]
  premier: LadderRow | null
  rounds: { round: number; matches: Match[] }[]
  squads: Record<string, SquadPlayer[]>
  has_squads: boolean
  drafts: Draft[]
  trades: TradeRow[]
  delists: DelistRow[]
  team_logos: Record<string, string>
}

type Tab = 'ladder' | 'results' | 'squads' | 'drafts' | 'trades' | 'delists'
const LINES: [string, string][] = [['DEF', 'Defenders'], ['MID', 'Midfielders'], ['RUC', 'Rucks'], ['FWD', 'Forwards']]

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

function TeamPicker({ teams, value, onChange, allLabel }: {
  teams: TeamCard[]; value: number | null; onChange: (id: number | null) => void; allLabel?: string
}) {
  return (
    <select className="kx-select" value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)} aria-label="Club">
      {allLabel && <option value="">{allLabel}</option>}
      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  )
}

export function SeasonsPage() {
  const { leagueId, year: yearParam } = useParams()
  const openPlayer = useOpenPlayer()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const url = `/api/leagues/${leagueId}/seasons${yearParam ? `/${yearParam}` : ''}`
  const { data, loading, error } = useFetch<SeasonData>(url)

  const tab = (params.get('view') as Tab) || 'ladder'
  const setTab = (t: Tab) => setParams(t === 'ladder' ? {} : { view: t }, { replace: true })
  const [squadTeam, setSquadTeam] = useState<number | null>(null)
  const [draftTeam, setDraftTeam] = useState<number | null>(null)
  const [delistTeam, setDelistTeam] = useState<number | null>(null)

  const squadTeamId = data ? (squadTeam ?? data.my_team_id ?? data.teams[0]?.id ?? null) : null
  const squad = useMemo(
    () => (data && squadTeamId != null ? data.squads[String(squadTeamId)] || [] : []),
    [data, squadTeamId],
  )

  if (loading) return <Spinner />
  if (error || !data) return <div className="kx-empty"><b>That season could not be loaded</b>Pick another year or refresh.</div>

  const { year, years, my_team_id: me } = data
  const tabs: { key: Tab; label: string; n?: number }[] = [
    { key: 'ladder', label: 'Ladder' },
    { key: 'results', label: 'Results', n: data.rounds.length },
    { key: 'squads', label: 'Opening squads' },
    { key: 'drafts', label: 'Drafts', n: data.drafts.length },
    { key: 'trades', label: 'Trades', n: data.trades.length },
    { key: 'delists', label: 'Delistings', n: data.delists.length },
  ]

  return (
    <div className="kx-page">
      <div className="d-none d-lg-block"><LeagueSubnav active="seasons" leagueId={leagueId!} /></div>
      <div className="page-breadcrumb d-none d-lg-block">
        <Link to={`/leagues/${leagueId}`}>{data.league.name}</Link> / League / Seasons
      </div>

      <div className="kx-head">
        <h2>{year} season</h2>
        <div className="sn-years" role="group" aria-label="Season">
          {years.map(y => (
            <button key={y} type="button" className={`sn-year${y === year ? ' on' : ''}`}
              onClick={() => navigate(`/leagues/${leagueId}/seasons/${y}${tab === 'ladder' ? '' : `?view=${tab}`}`)}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {data.premier && (
        <div className="sn-premier" style={{ ['--tm' as string]: rgbOf(data.premier.accent) } as React.CSSProperties}>
          <TeamBadge team={data.premier} size={56} showName={false} />
          <div>
            <div className="sn-premier-l"><i className="bi bi-trophy-fill"></i> {year} premier</div>
            <div className="sn-premier-n">{data.premier.name}</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div className="kx-strong" style={{ fontSize: '1.125rem' }}>{data.premier.wins}-{data.premier.losses}{data.premier.draws ? `-${data.premier.draws}` : ''}</div>
            <div>{data.premier.pct.toFixed(1)}%</div>
          </div>
        </div>
      )}

      <div className="sn-tabs" role="tablist">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`sn-tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}{t.n ? <b>{t.n}</b> : null}
          </button>
        ))}
      </div>

      {/* ── Ladder ── */}
      {tab === 'ladder' && (
        <div className="kx-panel">
          {data.ladder.length === 0 ? (
            <div className="kx-empty"><b>No ladder yet</b>The {year} season has not had a round played.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="kx-table sn-ladder">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th><th>Club</th>
                    <th className="ctr">W</th><th className="ctr">L</th><th className="ctr">D</th>
                    <th className="num">For</th><th className="num">Against</th><th className="num">%</th><th className="num">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ladder.map(r => (
                    <tr key={r.id} className={r.id === me ? 'sn-me' : ''}>
                      <td><span className={`sn-pos${r.pos === 1 ? ' first' : ''}`}>{r.pos}</span></td>
                      <td className="kx-strong"><TeamBadge team={r} size={26} />{r.id === me ? ' (you)' : ''}</td>
                      <td className="ctr kx-strong">{r.wins}</td><td className="ctr">{r.losses}</td><td className="ctr">{r.draws}</td>
                      <td className="num">{r.points_for.toLocaleString()}</td>
                      <td className="num">{r.points_against.toLocaleString()}</td>
                      <td className="num">{r.pct.toFixed(1)}</td>
                      <td className="num kx-gold">{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {tab === 'results' && (
        <div className="kx-panel">
          {data.rounds.length === 0 ? (
            <div className="kx-empty"><b>No fixture</b>Nothing was scheduled for {year}.</div>
          ) : data.rounds.map(r => (
            <div key={r.round} className="sn-round">
              <div className="sn-round-h">{r.round === 0 ? 'Opening Round' : `Round ${r.round}`}</div>
              <div className="sn-matches">
                {r.matches.map(m => {
                  const done = m.status === 'completed' && m.home_score != null && m.away_score != null
                  const homeWon = done && m.home_score! > m.away_score!
                  const awayWon = done && m.away_score! > m.home_score!
                  return (
                    <Link key={m.id} to={`/leagues/${leagueId}/matchup/${m.id}`} className="sn-match">
                      <span className={`t${homeWon ? ' w' : ''}${m.home_id === me ? ' me' : ''}`}>{m.home}</span>
                      <span className={`s${homeWon ? ' w' : ''}`}>{done ? m.home_score!.toLocaleString() : ''}</span>
                      <span className={`t${awayWon ? ' w' : ''}${m.away_id === me ? ' me' : ''}`}>{m.away}</span>
                      <span className={`s${awayWon ? ' w' : ''}`}>{done ? m.away_score!.toLocaleString() : 'To play'}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Opening squads ── */}
      {tab === 'squads' && (
        <div className="kx-panel">
          {!data.has_squads ? (
            <div className="kx-empty">
              <b>No opening squads for {year}</b>
              {data.is_current
                ? 'They are recorded when the season starts.'
                : 'They were not recorded for this season.'}
            </div>
          ) : (
            <>
              <div className="kx-bar">
                <TeamPicker teams={data.teams} value={squadTeamId} onChange={setSquadTeam} />
                <span className="kx-count"><b>{squad.length}</b> players at the start of {year}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                {LINES.map(([code, label]) => {
                  const line = squad.filter(p => (p.position || 'MID').split('/')[0] === code)
                  if (!line.length) return null
                  return (
                    <div key={code}>
                      <div className="sn-line-h">
                        <span className={`pos-badge badge-${code.toLowerCase()}`} style={{ padding: '2px 7px', fontSize: '.8125rem' }}>{code}</span>
                        {label} <span>{line.length}</span>
                      </div>
                      <table className="kx-table">
                        <thead>
                          <tr>
                            <th>Player</th><th>Pos</th><th>Club then</th>
                            <th className="ctr">Age</th><th className="num">Rating</th>
                            <th className="num">{year - 1} avg</th><th>How he arrived</th>
                          </tr>
                        </thead>
                        <tbody>
                          {line.map(p => (
                            <tr key={p.id} className="click" onClick={() => openPlayer(p.id)}>
                              <td>
                                <div className="kx-player">
                                  {data.team_logos[p.afl_team] && <img src={data.team_logos[p.afl_team]} alt="" />}
                                  <span className="kx-player-name">{p.name}</span>
                                  {p.is_former && <span className="pl-mark pl-mark-off">OFF AFL LIST</span>}
                                </div>
                              </td>
                              <td>{p.position}</td>
                              <td>{p.afl_team}</td>
                              <td className="ctr">{p.age ?? '-'}</td>
                              <td className="num">{p.rating != null ? <span className={`rt ${ratingTier(p.rating)}`}>{p.rating}</span> : '-'}</td>
                              <td className="num kx-strong">{p.prev_avg != null ? p.prev_avg.toFixed(1) : '-'}</td>
                              <td>
                                {p.draft_pick != null
                                  ? `Pick ${p.draft_pick}, round ${p.draft_round}`
                                  : p.acquired_via === 'trade' ? 'Trade'
                                    : p.acquired_via === 'ssp' ? 'SSP signing'
                                      : p.acquired_via === 'supplemental' ? 'Supplemental draft'
                                        : p.acquired_via === 'commissioner' ? 'Commissioner move' : 'Draft'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Drafts ── */}
      {tab === 'drafts' && (
        data.drafts.length === 0 ? (
          <div className="kx-panel"><div className="kx-empty"><b>No drafts in {year}</b>Nothing was drafted this year.</div></div>
        ) : (
          <>
            <div className="kx-bar" style={{ border: 0, padding: '0 0 12px' }}>
              <TeamPicker teams={data.teams} value={draftTeam} onChange={setDraftTeam} allLabel="Every club" />
            </div>
            {data.drafts.map(d => {
              const picks = d.picks.filter(p => draftTeam == null || p.team_id === draftTeam)
              return (
                <div key={d.id} className="kx-panel" style={{ marginBottom: 14 }}>
                  <div className="kx-panel-head">
                    <h3>{d.label}</h3>
                    <span className="kx-count">{day(d.date)}, <b>{picks.length}</b> picks</span>
                  </div>
                  <div className="kx-scroll" style={{ maxHeight: '60vh' }}>
                    <table className="kx-table">
                      <thead><tr><th className="num" style={{ width: 60 }}>Pick</th><th className="ctr" style={{ width: 60 }}>Rd</th><th>Club</th><th>Player</th><th>Pos</th><th>AFL club</th></tr></thead>
                      <tbody>
                        {picks.map(p => (
                          <tr key={p.pick} className={p.team_id === me ? 'sn-me' : ''}>
                            <td className="num kx-gold">{p.pick}</td>
                            <td className="ctr">{p.round}</td>
                            <td className="kx-strong"><TeamBadge name={p.team_id} size={24} /></td>
                            <td>
                              <div className="kx-player">
                                {data.team_logos[p.afl_team] && <img src={data.team_logos[p.afl_team]} alt="" />}
                                <span className="kx-player-name">{p.player}</span>
                              </div>
                            </td>
                            <td>{p.position}</td>
                            <td>{p.afl_team}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </>
        )
      )}

      {/* ── Trades ── */}
      {tab === 'trades' && (
        <div className="kx-panel">
          {data.trades.length === 0 ? (
            <div className="kx-empty"><b>No trades in {year}</b>Nothing changed hands.</div>
          ) : data.trades.map(t => (
            <div key={t.id} className="sn-trade">
              <div className="sn-trade-date">{day(t.date)}</div>
              <div>
                <div className="sn-trade-team"><TeamBadge name={t.a_id} size={24} /> received</div>
                <ul>{(t.a_gets.length ? t.a_gets : ['Nothing']).map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
              <div>
                <div className="sn-trade-team"><TeamBadge name={t.b_id} size={24} /> received</div>
                <ul>{(t.b_gets.length ? t.b_gets : ['Nothing']).map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Delistings ── */}
      {tab === 'delists' && (
        <div className="kx-panel">
          {data.delists.length === 0 ? (
            <div className="kx-empty"><b>No delistings in {year}</b>Nobody was cut.</div>
          ) : (
            <>
              <div className="kx-bar">
                <TeamPicker teams={data.teams} value={delistTeam} onChange={setDelistTeam} allLabel="Every club" />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="kx-table">
                  <thead><tr><th>Player</th><th>Pos</th><th>Cut by</th><th>Window</th><th>Date</th></tr></thead>
                  <tbody>
                    {data.delists.filter(d => delistTeam == null || d.team_id === delistTeam).map((d, i) => (
                      <tr key={i} className={d.team_id === me ? 'sn-me' : ''}>
                        <td className="kx-strong">{d.player}</td>
                        <td>{d.position}</td>
                        <td><TeamBadge name={d.team_id} size={22} /></td>
                        <td>{d.period === 'midseason' ? 'Mid-season' : 'Off-season'}</td>
                        <td>{day(d.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
