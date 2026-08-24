/**
 * Season Review slides.
 *
 * Each slide is a pure function of the review payload plus the viewer's
 * team id. The shell (SeasonReview.tsx) owns ordering, theming and
 * navigation; slides only draw. A slide that has nothing to say returns
 * `null` from its `enabled` predicate and is dropped from the deck, so a
 * league with no 7s comp or no draft never shows an empty card.
 */

import type { ReactNode } from 'react'
import {
  CountUp, Crest, ClubMark, PlayerRow, Tile, Pos, Head,
  PositionArc, ScoreBars, Ring, CompareBars, Confetti, initials,
} from './bits'
import type { SeasonReviewData } from './types'

export interface SlideCtx {
  d: SeasonReviewData
  teamId: number | null
}

export interface SlideDef {
  key: string
  name: string
  theme: [string, string, string]   // --sr-a, --sr-b, --sr-c
  enabled: (c: SlideCtx) => boolean
  render: (c: SlideCtx) => ReactNode
}

const ord = (n: number) =>
  n + (['th', 'st', 'nd', 'rd'][((n % 100) - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th')

/* ═══ 1 · Cover ═══════════════════════════════════════════════════ */

const intro: SlideDef = {
  key: 'intro', name: 'Intro',
  theme: ['#7c5cff', '#ff5fa2', '#1a0b3d'],
  enabled: () => true,
  render: ({ d }) => (
    <div className="sr-inner" style={{ textAlign: 'center' }}>
      <div className="sr-eyebrow sr-rise" style={{ marginBottom: 18 }}>{d.league.name}</div>
      <div className="sr-mega sr-grad sr-pop">{d.year}</div>
      <h1
        className="sr-h1 sr-rise"
        style={{ marginTop: 14, fontSize: 'clamp(1.6rem,4.6vw,3rem)', animationDelay: '160ms' }}
      >
        Season in Review
      </h1>
      <p
        className="sr-sub sr-rise"
        style={{ margin: '14px auto 0', textAlign: 'center', animationDelay: '280ms' }}
      >
        {d.league.rounds} rounds. {d.cover.matches} matches. {d.cover.players_used} players named.
        Every selection, every bench howler, every ton — wrapped up.
      </p>
      <div
        className="sr-pill sr-rise"
        style={{ marginTop: 26, animationDelay: '400ms' }}
      >
        <i className="bi bi-play-fill" /> Press next to begin
      </div>
    </div>
  ),
}

/* ═══ 2 · The season by numbers ═══════════════════════════════════ */

const numbers: SlideDef = {
  key: 'numbers', name: 'By the numbers',
  theme: ['#38bdf8', '#4f7cff', '#04213d'],
  enabled: () => true,
  render: ({ d }) => (
    <div className="sr-inner">
      <Head
        eyebrow="The season"
        title={<>By the</>}
        accentWord="numbers"
        sub={`Everything ${d.league.name} put on the board in ${d.year}.`}
      />
      <div className="sr-grid sr-g4">
        <Tile value={<CountUp to={d.cover.total_points} />} label="Points scored" accent
              sub="across every 23 in the league" delay={0} />
        <Tile value={<CountUp to={d.cover.players_used} />} label="Players named"
              sub="different men picked in a 23" delay={80} />
        <Tile value={<CountUp to={d.cover.matches} />} label="Matches played"
              sub={`${d.cover.rounds} rounds of football`} delay={160} />
        <Tile value={<CountUp to={d.cover.top_round?.score ?? 0} />} label="Highest round"
              sub={d.cover.top_round ? `${d.cover.top_round.team} · R${d.cover.top_round.round}` : ''}
              delay={240} />
      </div>

      <div className="sr-grid sr-g3" style={{ marginTop: 14 }}>
        <div className="sr-card sr-tile sr-rise" style={{ animationDelay: '320ms' }}>
          <div className="sr-tile-v"><CountUp to={d.bench.total} /></div>
          <div className="sr-label sr-tile-l">Points left on benches</div>
          <div className="sr-tile-s">the league's collective what-if</div>
        </div>
        <div className="sr-card sr-tile sr-rise" style={{ animationDelay: '380ms' }}>
          <div className="sr-tile-v"><CountUp to={d.records.tons.reduce((a, t) => a + t.tons, 0)} /></div>
          <div className="sr-label sr-tile-l">Tons from the top 12</div>
          <div className="sr-tile-s">100+ scores by the season's best</div>
        </div>
        <div className="sr-card sr-tile sr-rise" style={{ animationDelay: '440ms' }}>
          <div className="sr-tile-v"><CountUp to={d.movement.trades.length + d.movement.delists.length} /></div>
          <div className="sr-label sr-tile-l">List changes</div>
          <div className="sr-tile-s">{d.movement.trades.length} trades · {d.movement.delists.length} delistings</div>
        </div>
      </div>
    </div>
  ),
}

/* ═══ 3 · Final ladder ════════════════════════════════════════════ */

const ladder: SlideDef = {
  key: 'ladder', name: 'The ladder',
  theme: ['#ffc43c', '#ff8a3d', '#2c1704'],
  enabled: ({ d }) => d.ladder.length > 0,
  render: ({ d, teamId }) => {
    const champ = d.ladder[0]
    return (
      <div className="sr-inner">
        <Confetti count={60} />
        <Head
          eyebrow={`${d.year} · Final standings`}
          title={<>{champ.name}</>}
          accentWord="took it"
          sub={`${champ.wins}–${champ.losses}${champ.draws ? `–${champ.draws}` : ''} with ${champ.percentage}% and ${champ.points_for.toLocaleString()} points for.`}
        />
        <div className="sr-lad">
          {d.ladder.map((r, i) => (
            <div
              key={r.team_id}
              className={`sr-lad-row sr-rise${r.pos === 1 ? ' champ' : ''}${r.team_id === teamId ? ' you' : ''}`}
              style={{ '--row': r.accent, animationDelay: `${i * 70}ms` } as React.CSSProperties}
            >
              <span className="sr-lad-fill" style={{ width: `${(r.ladder_points / Math.max(1, d.ladder[0].ladder_points)) * 100}%` }} />
              <span className="sr-lad-pos">{r.pos}</span>
              <Crest name={r.name} logo={r.logo_url} accent={r.accent} />
              <div className="sr-lad-body">
                <div className="sr-lad-name">
                  {r.pos === 1 && <i className="bi bi-trophy-fill sr-crown" />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  {r.team_id === teamId && <span className="sr-pill">You</span>}
                </div>
                <div className="sr-lad-owner">{r.owner}</div>
              </div>
              <div className="sr-lad-nums">
                <div className="sr-lad-num"><b>{r.wins}–{r.losses}{r.draws ? `–${r.draws}` : ''}</b><span>W–L</span></div>
                <div className="sr-lad-num"><b>{r.percentage}%</b><span>Pct</span></div>
                <div className="sr-lad-num"><b>{r.points_for.toLocaleString()}</b><span>For</span></div>
                <div className="sr-lad-num"><b>{r.ladder_points}</b><span>Pts</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
}

/* ═══ 4 · Your season ═════════════════════════════════════════════ */

const you: SlideDef = {
  key: 'you', name: 'Your season',
  theme: ['#4ade80', '#22d3ee', '#052e1c'],
  enabled: ({ d }) => !!d.you,
  render: ({ d }) => {
    const y = d.you!
    const played = y.wins + y.losses + y.draws
    return (
      <div className="sr-inner">
        <Head
          eyebrow="Your season"
          title={<>{y.name} finished</>}
          accentWord={`${ord(y.position ?? 0)}`}
          sub={`${y.wins} wins from ${played} games, ${y.percentage}% percentage, ${y.points_for.toLocaleString()} points for — ${y.pf_rank === 1 ? 'the most in the league' : `${ord(y.pf_rank ?? 0)} for scoring`}.`}
        />
        <div className="sr-split">
          <div className="sr-grid sr-g2">
            <Tile value={<><CountUp to={y.wins} />–<CountUp to={y.losses} /></>} label="Record" accent />
            <Tile value={<CountUp to={y.avg_score} />} label="Average score"
                  sub={`${y.points_for.toLocaleString()} for the year`} delay={70} />
            <Tile value={<CountUp to={y.best_round?.score ?? 0} />} label="Best round"
                  sub={y.best_round ? `Round ${y.best_round.round}` : ''} delay={140} />
            <Tile value={<CountUp to={y.worst_round?.score ?? 0} />} label="Worst round"
                  sub={y.worst_round ? `Round ${y.worst_round.round}` : ''} delay={210} />
            <Tile value={<CountUp to={y.best_streak} />} label="Longest win streak"
                  sub="consecutive victories" delay={280} />
            <Tile value={<CountUp to={y.squad_size} />} label="Players used"
                  sub="named in your 23 at least once" delay={350} />
          </div>
          <div className="sr-card sr-card-hi sr-card-pad sr-pop"
               style={{ display: 'grid', placeItems: 'center', minHeight: 260 }}>
            <Ring
              pct={Math.min(1, (y.percentage || 0) / 140)}
              value={`${y.percentage}%`}
              label="percentage"
              accent={y.accent}
            />
            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <div style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.66)' }}>
                <b style={{ color: '#fff' }}>{y.points_for.toLocaleString()}</b> for
                {' · '}
                <b style={{ color: '#fff' }}>{y.points_against.toLocaleString()}</b> against
              </div>
              <div className="sr-label" style={{ marginTop: 8 }}>
                {y.points_for >= y.points_against ? 'Scored more than you conceded' : 'Conceded more than you scored'}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
}

/* ═══ 5 · The climb ═══════════════════════════════════════════════ */

const arc: SlideDef = {
  key: 'arc', name: 'The climb',
  theme: ['#22d3ee', '#7c5cff', '#052736'],
  enabled: ({ d }) => d.arc.rounds.length > 1,
  render: ({ d, teamId }) => {
    const mine = d.arc.teams.find(t => t.team_id === teamId)
    const start = mine?.positions[0]
    const end = mine?.positions[mine.positions.length - 1]
    const moved = start != null && end != null ? start - end : 0
    return (
      <div className="sr-inner">
        <Head
          eyebrow="Round by round"
          title={<>The</>}
          accentWord="climb"
          sub={mine
            ? `You sat ${ord(start!)} after round ${d.arc.rounds[0]} and finished ${ord(end!)}${moved > 0 ? ` — up ${moved} ${moved === 1 ? 'spot' : 'spots'}` : moved < 0 ? ` — down ${Math.abs(moved)}` : ' — never moved'}.`
            : 'Every team’s ladder position, week by week.'}
        />
        <div className="sr-card sr-card-pad sr-rise" style={{ padding: '14px 16px 6px' }}>
          <div className="sr-label" style={{ marginBottom: 6 }}>Ladder position by round</div>
          <PositionArc
            rounds={d.arc.rounds}
            teams={d.arc.teams}
            highlight={teamId}
            maxPos={d.ladder.length || d.arc.teams.length}
          />
        </div>
        {mine && (
          <div className="sr-card sr-card-pad sr-rise" style={{ marginTop: 12, animationDelay: '160ms' }}>
            <div className="sr-label" style={{ marginBottom: 6 }}>
              Your round score vs the league average
            </div>
            <ScoreBars
              rounds={d.arc.rounds}
              scores={mine.scores}
              leagueAvg={d.arc.league_avg}
              accent={mine.accent}
            />
            <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
              <span className="sr-pill good">
                {mine.scores.filter((s, i) => s >= (d.arc.league_avg[i] || 0)).length} rounds above average
              </span>
              <span className="sr-pill bad">
                {mine.scores.filter((s, i) => s > 0 && s < (d.arc.league_avg[i] || 0)).length} rounds below
              </span>
            </div>
          </div>
        )}
      </div>
    )
  },
}

/* ═══ 6 · Your MVP ════════════════════════════════════════════════ */

const mvp: SlideDef = {
  key: 'mvp', name: 'Your MVP',
  theme: ['#ffd666', '#ff9d3d', '#2e1e02'],
  enabled: ({ d }) => !!d.you && d.you.top_players.length > 0,
  render: ({ d }) => {
    const y = d.you!
    const top = y.top_players[0]
    return (
      <div className="sr-inner">
        <Head
          eyebrow="Your most valuable"
          title={<>Nobody carried you like</>}
          accentWord={top.name}
          sub={`${(top.points ?? 0).toLocaleString()} points from ${top.played} games at ${top.avg} a week, and you named him in the 23 ${top.selections} weeks out of ${d.league.rounds}.`}
        />
        <div className="sr-hero sr-pop" style={{ '--sr-club': top.club_bg, '--sr-club-fg': top.club_fg } as React.CSSProperties}>
          <ClubMark p={top} size="hero" />
          <div className="sr-hero-body">
            <div className="sr-hero-name">{top.name}</div>
            <div className="sr-hero-meta">
              <Pos code={top.position} /> {top.afl_team}
              {top.age ? ` · ${top.age}yo` : ''}
              {top.rating ? ` · ${top.rating} rated` : ''}
            </div>
            <div className="sr-hero-stats">
              <div className="sr-hero-stat"><b>{top.avg}</b><span className="sr-label">Average</span></div>
              <div className="sr-hero-stat"><b>{top.played}</b><span className="sr-label">Games</span></div>
              <div className="sr-hero-stat"><b>{top.selections}</b><span className="sr-label">In the 23</span></div>
              <div className="sr-hero-stat"><b>{top.best}</b><span className="sr-label">Best (R{top.best_round})</span></div>
            </div>
          </div>
          <div className="sr-hero-big">
            <b><CountUp to={top.points ?? 0} /></b>
            <span className="sr-label">Points for you</span>
          </div>
        </div>

        <div className="sr-card-title" style={{ padding: '20px 2px 8px' }}>
          <i className="bi bi-bar-chart-fill" /> The rest of your top scorers
        </div>
        <div className="sr-grid sr-g2">
          {y.top_players.slice(1, 7).map((p, i) => (
            <PlayerRow
              key={p.id}
              p={p}
              rank={i + 2}
              value={(p.points ?? 0).toLocaleString()}
              valueLabel="points"
              meta={`${p.afl_team} · ${p.avg} avg · ${p.played} games`}
              delay={i * 60}
            />
          ))}
        </div>
      </div>
    )
  },
}

/* ═══ 7 · Most times in the 23 ════════════════════════════════════ */

const ironmen: SlideDef = {
  key: 'ironmen', name: 'In the 23',
  theme: ['#fb7185', '#f97316', '#320a12'],
  enabled: ({ d }) => d.ever_present.league.length > 0,
  render: ({ d, teamId }) => {
    const lead = d.ever_present.league[0]
    const mine = teamId ? (d.ever_present.per_team[String(teamId)] || []) : []
    return (
      <div className="sr-inner">
        <Head
          eyebrow={`Most times named · ${d.ever_present.max_rounds} rounds`}
          title={<>The</>}
          accentWord="undroppables"
          sub="Not AFL games — selections. How many rounds a coach in this league refused to leave them out of the 23."
        />
        <div className="sr-split">
          <div>
            <div className="sr-card-title" style={{ padding: '0 2px 8px' }}>
              <i className="bi bi-shield-fill-check" /> League leaders
            </div>
            <div className="sr-stack">
              {d.ever_present.league.slice(0, 8).map((p, i) => (
                <PlayerRow
                  key={`${p.team_id}-${p.id}`}
                  p={p}
                  rank={i + 1}
                  value={p.selections}
                  valueLabel={`of ${d.ever_present.max_rounds}`}
                  meta={`${p.afl_team} · picked by ${p.team_name}`}
                  delay={i * 55}
                />
              ))}
            </div>
          </div>
          <div>
            {mine.length > 0 && (
              <>
                <div className="sr-card-title" style={{ padding: '0 2px 8px' }}>
                  <i className="bi bi-person-badge-fill" /> Your ever-presents
                </div>
                <div className="sr-stack">
                  {mine.map((p, i) => (
                    <PlayerRow
                      key={p.id}
                      p={p}
                      rank={i + 1}
                      value={p.selections}
                      valueLabel="weeks"
                      meta={`${p.afl_team} · ${(p.points ?? 0).toLocaleString()} pts`}
                      delay={i * 55}
                    />
                  ))}
                </div>
              </>
            )}
            <div className="sr-card sr-card-hi sr-card-pad sr-rise"
                 style={{ marginTop: mine.length ? 14 : 0, animationDelay: '260ms' }}>
              <div className="sr-label">Never once left out</div>
              <div className="sr-h2" style={{ marginTop: 6 }}>
                {d.ever_present.perfect.length === 0
                  ? 'Nobody survived every week'
                  : `${d.ever_present.perfect.length} ${d.ever_present.perfect.length === 1 ? 'player' : 'players'}`}
              </div>
              <p className="sr-sub" style={{ fontSize: '.76rem', marginTop: 4 }}>
                {d.ever_present.perfect.length === 0
                  ? `${lead.name} came closest — ${lead.selections} of ${d.ever_present.max_rounds} weeks in ${lead.team_name}'s 23.`
                  : d.ever_present.perfect.map(p => `${p.name} (${p.team_name})`).join(', ')}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  },
}

/* ═══ 8 · The Best 23 ═════════════════════════════════════════════ */

const LINE_COLOUR: Record<string, string> = {
  DEF: '#6bb2ff', MID: '#7fe0a6', RUC: '#ffb45f', FWD: '#ff7d8f', FLEX: '#c99cff',
}
const LINE_NAME: Record<string, string> = {
  DEF: 'Backline', MID: 'Midfield', RUC: 'Ruck', FWD: 'Forwards', FLEX: 'Flex',
}

const best23: SlideDef = {
  key: 'best23', name: 'The Best 23',
  theme: ['#4ade80', '#facc15', '#04231a'],
  enabled: ({ d }) => d.best_23.lines.some(l => l.players.length > 0),
  render: ({ d }) => (
    <div className="sr-inner">
      <Head
        eyebrow={`${d.year} · Team of the year`}
        title={<>The league's</>}
        accentWord="Best 23"
        sub="Ranked on points delivered while actually named in someone's 23, slotted into the position they filled most often."
      />
      <div className="sr-field-wrap sr-rise">
        {d.best_23.lines.filter(l => l.players.length > 0).map((line, li) => (
          <div className="sr-line" key={line.code} style={{ color: LINE_COLOUR[line.code] || '#fff' }}>
            <div className="sr-line-h">
              <b>{LINE_NAME[line.code] || line.code}</b>
              <hr />
              <b style={{ opacity: .6 }}>{line.players.length}</b>
            </div>
            <div className="sr-line-players">
              {line.players.map((p, i) => (
                <PlayerRow
                  key={p.id}
                  p={p}
                  value={(p.points ?? 0).toLocaleString()}
                  valueLabel={`${p.avg} avg`}
                  meta={p.afl_team}
                  delay={li * 90 + i * 40}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="sr-card sr-card-pad sr-rise" style={{ marginTop: 12, animationDelay: '280ms' }}>
        <div className="sr-label" style={{ marginBottom: 10 }}>Representation by club</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {d.best_23.reps.map(r => (
            <span key={r.team_id} className="sr-row" style={{ padding: '6px 10px' }}>
              <Crest name={r.name} accent={r.accent} size="sm" />
              <span className="sr-row-t" style={{ fontSize: '.74rem' }}>{r.name}</span>
              <span className="sr-row-v" style={{ color: r.accent }}>{r.count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  ),
}

/* ═══ 9 · Record book ═════════════════════════════════════════════ */

const records: SlideDef = {
  key: 'records', name: 'Record book',
  theme: ['#f43f5e', '#a855f7', '#2c0716'],
  enabled: ({ d }) => d.records.highest.length > 0,
  render: ({ d }) => {
    const hi = d.records.highest[0]
    const lo = d.records.lowest[0]
    const blow = d.records.blowouts[0]
    const close = d.records.nailbiters[0]
    return (
      <div className="sr-inner">
        <Head
          eyebrow="Record book"
          title={<>The season's</>}
          accentWord="extremes"
          sub={`${hi.name} put up ${hi.score.toLocaleString()} in round ${hi.round} — the biggest week anyone had.`}
        />
        <div className="sr-grid sr-g4">
          <Tile value={<CountUp to={hi.score} />} label="Highest team score" accent
                sub={`${hi.name} · R${hi.round}`} />
          <Tile value={<CountUp to={lo.score} />} label="Lowest team score"
                sub={`${lo.name} · R${lo.round}`} delay={70} />
          <Tile value={<CountUp to={blow?.margin ?? 0} />} label="Biggest margin"
                sub={blow ? `${blow.winner} d. ${blow.loser} · R${blow.round}` : ''} delay={140} />
          <Tile value={<CountUp to={close?.margin ?? 0} />} label="Closest game"
                sub={close ? `${close.winner} d. ${close.loser} · R${close.round}` : ''} delay={210} />
        </div>

        <div className="sr-split" style={{ marginTop: 16 }}>
          <div>
            <div className="sr-card-title" style={{ padding: '0 2px 8px' }}>
              <i className="bi bi-fire" /> Biggest individual games
            </div>
            <div className="sr-stack">
              {d.records.single_scores.slice(0, 6).map((p, i) => (
                <PlayerRow
                  key={`${p.id}-${p.round}`}
                  p={p}
                  rank={i + 1}
                  value={p.score}
                  valueLabel={`R${p.round}`}
                  meta={`${p.afl_team} · named by ${p.team_name}`}
                  delay={i * 55}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="sr-card-title" style={{ padding: '0 2px 8px' }}>
              <i className="bi bi-graph-up" /> Most tons (100+)
            </div>
            <div className="sr-stack">
              {d.records.tons.slice(0, 6).map((p, i) => (
                <PlayerRow
                  key={p.id}
                  p={p}
                  rank={i + 1}
                  value={p.tons}
                  valueLabel="tons"
                  meta={`${p.afl_team}${p.monsters ? ` · ${p.monsters} × 150+` : ''}`}
                  delay={i * 55}
                />
              ))}
            </div>
          </div>
        </div>

        {d.records.shootouts[0] && (
          <div className="sr-card sr-card-hi sr-card-pad sr-rise" style={{ marginTop: 14 }}>
            <div className="sr-label">Highest-scoring match of the year</div>
            <div className="sr-h2" style={{ marginTop: 6 }}>
              {d.records.shootouts[0].home} {d.records.shootouts[0].home_score.toLocaleString()}
              {' – '}
              {d.records.shootouts[0].away_score.toLocaleString()} {d.records.shootouts[0].away}
            </div>
            <div className="sr-tile-s">
              Round {d.records.shootouts[0].round} · {d.records.shootouts[0].combined.toLocaleString()} points combined
            </div>
          </div>
        )}
      </div>
    )
  },
}

/* ═══ 10 · Head to head ═══════════════════════════════════════════ */

const h2h: SlideDef = {
  key: 'h2h', name: 'Head to head',
  theme: ['#a78bfa', '#38bdf8', '#180b38'],
  enabled: ({ d }) => d.h2h.matrix.length > 1,
  render: ({ d, teamId }) => {
    const mine = d.h2h.matrix.find(r => r.team_id === teamId)
    const names = d.h2h.matrix.map(r => r.name)
    return (
      <div className="sr-inner">
        <Head
          eyebrow="Rivalries"
          title={<>Head to</>}
          accentWord="head"
          sub={d.h2h.closest
            ? `${d.h2h.closest.a} and ${d.h2h.closest.b} could not be split — ${d.h2h.closest.a_wins}–${d.h2h.closest.b_wins} at an average margin of ${d.h2h.closest.avg_margin}.`
            : undefined}
        />

        {mine && (
          <div className="sr-grid sr-g5" style={{ marginBottom: 16 }}>
            {mine.cells.map((c, i) => c && (
              <div key={c.opp_id} className="sr-card sr-card-pad sr-rise"
                   style={{ animationDelay: `${i * 60}ms`, textAlign: 'center' }}>
                <div className="sr-label" style={{
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.opp}</div>
                <div style={{
                  fontSize: '1.6rem', fontWeight: 900, marginTop: 6, letterSpacing: '-.03em',
                  color: c.w > c.l ? '#8fe6b4' : c.w < c.l ? '#ff9aa4' : '#ffd88a',
                }}>
                  {c.w}–{c.l}{c.d ? `–${c.d}` : ''}
                </div>
                <div className="sr-tile-s">{c.for.toLocaleString()} for · {c.against.toLocaleString()} against</div>
              </div>
            ))}
          </div>
        )}

        <div className="sr-card sr-card-pad sr-rise" style={{ animationDelay: '200ms' }}>
          <div className="sr-label" style={{ marginBottom: 10 }}>Every rivalry · row team's record</div>
          <div className="sr-tbl-wrap">
            <table className="sr-mx">
              <thead>
                <tr>
                  <th className="rowh" />
                  {names.map(n => <th key={n}>{initials(n)}</th>)}
                </tr>
              </thead>
              <tbody>
                {d.h2h.matrix.map(row => (
                  <tr key={row.team_id}>
                    <th className="rowh">
                      <span className="sr-mx-name">
                        <Crest name={row.name} accent={row.accent} size="sm" />
                        {row.name}
                      </span>
                    </th>
                    {row.cells.map((c, i) => (
                      <td key={i} className={
                        !c ? 'self' : c.w > c.l ? 'win' : c.w < c.l ? 'loss' : 'even'
                      }>
                        {c ? `${c.w}–${c.l}` : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sr-grid sr-g2" style={{ marginTop: 14 }}>
          {d.h2h.lopsided && (
            <div className="sr-card sr-card-pad sr-rise">
              <div className="sr-label">Most one-sided</div>
              <div className="sr-h2" style={{ marginTop: 6 }}>
                {d.h2h.lopsided.b_wins > d.h2h.lopsided.a_wins ? d.h2h.lopsided.b : d.h2h.lopsided.a}
                {' owned '}
                {d.h2h.lopsided.b_wins > d.h2h.lopsided.a_wins ? d.h2h.lopsided.a : d.h2h.lopsided.b}
              </div>
              <div className="sr-tile-s">
                {Math.max(d.h2h.lopsided.a_wins, d.h2h.lopsided.b_wins)}–
                {Math.min(d.h2h.lopsided.a_wins, d.h2h.lopsided.b_wins)} · avg margin {d.h2h.lopsided.avg_margin}
              </div>
            </div>
          )}
          {d.h2h.closest && (
            <div className="sr-card sr-card-pad sr-rise" style={{ animationDelay: '80ms' }}>
              <div className="sr-label">Closest rivalry</div>
              <div className="sr-h2" style={{ marginTop: 6 }}>
                {d.h2h.closest.a} v {d.h2h.closest.b}
              </div>
              <div className="sr-tile-s">
                {d.h2h.closest.a_wins}–{d.h2h.closest.b_wins}
                {d.h2h.closest.draws ? `–${d.h2h.closest.draws}` : ''} · avg margin {d.h2h.closest.avg_margin}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  },
}

/* ═══ 11 · The bench ══════════════════════════════════════════════ */

const bench: SlideDef = {
  key: 'bench', name: 'The bench',
  theme: ['#fb923c', '#f43f5e', '#2b0f14'],
  enabled: ({ d }) => d.bench.table.length > 0,
  render: ({ d, teamId }) => {
    const mine = d.bench.table.find(t => t.team_id === teamId)
    const worst = d.bench.worst[0]
    return (
      <div className="sr-inner">
        <Head
          eyebrow="Selection regrets"
          title={<>Points left on the</>}
          accentWord="bench"
          sub="Every week a benched player outscored the worst man in your 23, that gap was yours to lose. Here's the bill."
        />
        <div className="sr-split">
          <div className="sr-card sr-card-pad sr-rise">
            <div className="sr-label" style={{ marginBottom: 12 }}>Wasted points by coach</div>
            <CompareBars
              rows={d.bench.table.map(t => ({
                id: t.team_id, name: t.name, value: t.points, accent: t.accent,
              }))}
              highlight={teamId}
            />
            {mine && (
              <div className="sr-tile-s" style={{ marginTop: 12 }}>
                You averaged <b style={{ color: '#fff' }}>{mine.per_round}</b> wasted points a round.
              </div>
            )}
          </div>
          <div>
            <div className="sr-card-title" style={{ padding: '0 2px 8px' }}>
              <i className="bi bi-emoji-frown-fill" /> The worst calls of the year
            </div>
            <div className="sr-stack">
              {d.bench.worst.map((m, i) => (
                <PlayerRow
                  key={`${m.id}-${m.round}`}
                  p={m}
                  rank={i + 1}
                  value={`+${m.gap}`}
                  valueLabel="left out"
                  meta={`R${m.round} · ${m.score} on ${m.team_name}'s bench`}
                  delay={i * 60}
                />
              ))}
            </div>
            {worst && (
              <div className="sr-card sr-card-hi sr-card-pad sr-rise" style={{ marginTop: 12 }}>
                <div className="sr-label">The one that hurt most</div>
                <div className="sr-h2" style={{ marginTop: 6 }}>
                  {worst.team_name} benched {worst.name} for {worst.score}
                </div>
                <div className="sr-tile-s">Round {worst.round} · {worst.gap} points better than their worst starter</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  },
}

/* ═══ 12 · The 7s ═════════════════════════════════════════════════ */

const sevens: SlideDef = {
  key: 'sevens', name: 'Reserve 7s',
  theme: ['#2dd4bf', '#84cc16', '#04262a'],
  enabled: ({ d }) => d.sevens.ladder.length > 0,
  render: ({ d, teamId }) => {
    const p = d.sevens.premier
    return (
      <div className="sr-inner">
        <Head
          eyebrow="Reserve 7s"
          title={<>The seconds had a</>}
          accentWord="season too"
          sub={p ? `${p.name} won the 7s flag at ${p.wins}–${p.losses}${p.draws ? `–${p.draws}` : ''} with ${p.percentage}%.` : undefined}
        />
        <div className="sr-split">
          <div>
            <div className="sr-card-title" style={{ padding: '0 2px 8px' }}>
              <i className="bi bi-list-ol" /> 7s ladder
            </div>
            <div className="sr-lad">
              {d.sevens.ladder.map((r, i) => (
                <div
                  key={r.team_id}
                  className={`sr-lad-row sr-rise${r.pos === 1 ? ' champ' : ''}${r.team_id === teamId ? ' you' : ''}`}
                  style={{ '--row': r.accent, animationDelay: `${i * 60}ms` } as React.CSSProperties}
                >
                  <span className="sr-lad-pos">{r.pos}</span>
                  <Crest name={r.name} logo={r.logo_url} accent={r.accent} size="sm" />
                  <div className="sr-lad-body"><div className="sr-lad-name">{r.name}</div></div>
                  <div className="sr-lad-nums">
                    <div className="sr-lad-num"><b>{r.wins}–{r.losses}{r.draws ? `–${r.draws}` : ''}</b><span>W–L</span></div>
                    <div className="sr-lad-num"><b>{r.percentage}%</b><span>Pct</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="sr-card-title" style={{ padding: '0 2px 8px' }}>
              <i className="bi bi-stars" /> Top 7s scorers
            </div>
            <div className="sr-stack">
              {d.sevens.top_scorers.slice(0, 6).map((p2, i) => (
                <PlayerRow
                  key={`${p2.team_id}-${p2.id}`}
                  p={p2}
                  rank={i + 1}
                  value={(p2.points ?? 0).toLocaleString()}
                  valueLabel={`${p2.avg} avg`}
                  meta={`${p2.afl_team} · ${p2.team_name} · ${p2.played} games`}
                  delay={i * 55}
                />
              ))}
            </div>
            <div className="sr-card-title" style={{ padding: '16px 2px 8px' }}>
              <i className="bi bi-shield-fill-check" /> Most 7s selections
            </div>
            <div className="sr-grid sr-g2">
              {d.sevens.iron.slice(0, 4).map((p2, i) => (
                <PlayerRow
                  key={`i-${p2.team_id}-${p2.id}`}
                  p={p2}
                  value={p2.selections}
                  valueLabel="weeks"
                  meta={`${p2.afl_team} · ${p2.team_name}`}
                  delay={i * 55}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  },
}

/* ═══ 13 · Draft report ═══════════════════════════════════════════ */

const draft: SlideDef = {
  key: 'draft', name: 'Draft report',
  theme: ['#fbbf24', '#f472b6', '#2b1a05'],
  enabled: ({ d }) => d.draft.steals.length > 0,
  render: ({ d, teamId }) => {
    const heist = d.draft.steals[0]
    const bust = d.draft.busts[0]
    const mine = d.draft.best_by_team.find(t => t.team_id === teamId)
    return (
      <div className="sr-inner">
        <Head
          eyebrow={`Draft night · ${d.draft.total_picks} picks`}
          title={<>Who actually</>}
          accentWord="won the draft"
          sub={`${heist.team_name} took ${heist.name} at pick ${heist.pick}. He finished the year the ${ord(heist.value_rank)} most productive player drafted.`}
        />
        <div className="sr-grid sr-g2" style={{ marginBottom: 16 }}>
          <div className="sr-card sr-card-hi sr-card-pad sr-pop">
            <div className="sr-label"><i className="bi bi-gem" /> Heist of the draft</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
              <ClubMark p={heist} size="lg" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sr-h2">{heist.name}</div>
                <div className="sr-tile-s">
                  {heist.afl_team} · {heist.team_name} · pick #{heist.pick}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.7rem', fontWeight: 900, color: 'var(--sr-a)', lineHeight: 1 }}>
                  +{heist.surplus}
                </div>
                <div className="sr-label">spots of value</div>
              </div>
            </div>
          </div>
          {bust && (
            <div className="sr-card sr-card-pad sr-pop" style={{ animationDelay: '90ms' }}>
              <div className="sr-label"><i className="bi bi-emoji-dizzy" /> Never happened</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
                <ClubMark p={bust} size="lg" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sr-h2">{bust.name}</div>
                  <div className="sr-tile-s">
                    {bust.afl_team} · {bust.team_name} · pick #{bust.pick}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.7rem', fontWeight: 900, color: '#ff9aa4', lineHeight: 1 }}>
                    {bust.played}
                  </div>
                  <div className="sr-label">games in your 23</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {mine && (
          <div className="sr-card sr-card-pad sr-rise" style={{ marginBottom: 14 }}>
            <div className="sr-label" style={{ marginBottom: 10 }}>Your draft, judged</div>
            <div className="sr-grid sr-g3">
              <div>
                <span className="sr-pill gold">Best pick</span>
                <div className="sr-row-t" style={{ marginTop: 8 }}>{mine.best.name}</div>
                <div className="sr-row-s">#{mine.best.pick} · {(mine.best.points ?? 0).toLocaleString()} pts</div>
              </div>
              <div>
                <span className="sr-pill good">Biggest producer</span>
                <div className="sr-row-t" style={{ marginTop: 8 }}>{mine.top.name}</div>
                <div className="sr-row-s">#{mine.top.pick} · {(mine.top.points ?? 0).toLocaleString()} pts</div>
              </div>
              <div>
                <span className="sr-pill bad">One to forget</span>
                <div className="sr-row-t" style={{ marginTop: 8 }}>{mine.worst.name}</div>
                <div className="sr-row-s">#{mine.worst.pick} · {(mine.worst.points ?? 0).toLocaleString()} pts</div>
              </div>
            </div>
          </div>
        )}

        <div className="sr-split">
          <div>
            <div className="sr-card-title" style={{ padding: '0 2px 8px' }}>
              <i className="bi bi-arrow-up-right" /> Best value of the draft
            </div>
            <div className="sr-stack">
              {d.draft.steals.slice(0, 5).map((p, i) => (
                <PlayerRow key={p.id} p={p} rank={i + 1}
                  value={`#${p.pick}`} valueLabel={`${(p.points ?? 0).toLocaleString()} pts`}
                  meta={`${p.afl_team} · ${p.team_name}`} delay={i * 55} />
              ))}
            </div>
          </div>
          <div>
            <div className="sr-card-title" style={{ padding: '0 2px 8px' }}>
              <i className="bi bi-arrow-down-right" /> Early picks that didn't land
            </div>
            <div className="sr-stack">
              {d.draft.busts.slice(0, 5).map((p, i) => (
                <PlayerRow key={p.id} p={p} rank={i + 1}
                  value={`#${p.pick}`} valueLabel={`${(p.points ?? 0).toLocaleString()} pts`}
                  meta={`${p.afl_team} · ${p.team_name} · ${p.played} games`} delay={i * 55} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  },
}

/* ═══ 14 · The coaches ════════════════════════════════════════════ */

const coaches: SlideDef = {
  key: 'coaches', name: 'The coaches',
  theme: ['#818cf8', '#22d3ee', '#0f1035'],
  enabled: ({ d }) => d.coaches.length > 0,
  render: ({ d, teamId }) => {
    const best = [...d.coaches].sort((a, b) => b.efficiency - a.efficiency)[0]
    return (
      <div className="sr-inner">
        <Head
          eyebrow="Coach report card"
          title={<>How everyone actually</>}
          accentWord="coached"
          sub={`Selection efficiency is the share of a coach's available points that made it into the 23. ${best.name} led the league at ${best.efficiency}%.`}
        />
        <div className="sr-card sr-rise" style={{ padding: '4px 6px' }}>
          <div className="sr-tbl-wrap">
            <table className="sr-tbl">
              <thead>
                <tr>
                  <th>Coach</th>
                  <th>W–L</th>
                  <th>Avg</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>Swing</th>
                  <th>Churn</th>
                  <th>Wasted</th>
                  <th>Eff</th>
                  <th>Subs</th>
                  <th>7s</th>
                </tr>
              </thead>
              <tbody>
                {d.coaches.map(c => (
                  <tr key={c.team_id} className={c.team_id === teamId ? 'you' : ''}>
                    <td>
                      <span className="sr-mx-name">
                        <Crest name={c.name} logo={c.logo_url} accent={c.accent} size="sm" />
                        <span>
                          <b>{c.position}. {c.name}</b>
                          <span style={{ display: 'block', fontSize: '.6rem', color: 'rgba(255,255,255,.45)' }}>
                            {c.owner}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td><b>{c.wins}–{c.losses}{c.draws ? `–${c.draws}` : ''}</b></td>
                    <td>{c.avg_score.toLocaleString()}</td>
                    <td>{c.high.toLocaleString()}</td>
                    <td>{c.low.toLocaleString()}</td>
                    <td>±{c.swing}</td>
                    <td>{c.churn}</td>
                    <td>{c.bench_waste.toLocaleString()}</td>
                    <td style={{ color: c.team_id === best.team_id ? '#8fe6b4' : undefined }}>
                      <b>{c.efficiency}%</b>
                    </td>
                    <td>{c.subs_used}</td>
                    <td>{c.sevens_pos ? `${ord(c.sevens_pos)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="sr-grid sr-g3" style={{ marginTop: 14 }}>
          {d.coaches.slice(0, 3).map((c, i) => c.best_player && (
            <div key={c.team_id} className="sr-card sr-card-pad sr-rise"
                 style={{ animationDelay: `${i * 80}ms` }}>
              <div className="sr-label" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Crest name={c.name} logo={c.logo_url} accent={c.accent} size="sm" />
                {c.name}'s best
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 10 }}>
                <ClubMark p={c.best_player} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sr-row-t">{c.best_player.name}</div>
                  <div className="sr-row-s">{c.best_player.afl_team} · {c.best_player.avg} avg</div>
                </div>
                <div className="sr-row-v" style={{ color: c.accent }}>
                  {(c.best_player.points ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  },
}

/* ═══ 15 · Awards ═════════════════════════════════════════════════ */

const awards: SlideDef = {
  key: 'awards', name: 'Awards',
  theme: ['#ffd666', '#a855f7', '#2a1c04'],
  enabled: ({ d }) => d.awards.length > 0,
  render: ({ d }) => (
    <div className="sr-inner">
      <Head
        eyebrow={`${d.year} · Night of nights`}
        title={<>The season</>}
        accentWord="awards"
        sub="Every one of these is a real extreme, computed from the season — no participation trophies."
      />
      <div className="sr-grid sr-g3">
        {d.awards.map((a, i) => (
          <div key={a.key} className="sr-aw sr-rise"
               style={{ '--row': a.accent, animationDelay: `${i * 55}ms` } as React.CSSProperties}>
            <div className="sr-aw-i"><i className={`bi ${a.icon}`} /></div>
            <div className="sr-aw-t">{a.title}</div>
            <div className="sr-aw-s">{a.sub}</div>
            <div className="sr-aw-w">
              <Crest name={a.team_name} logo={a.logo_url} accent={a.accent} size="sm" />
              <b>{a.team_name}</b>
              <span className="sr-aw-v">{a.value}</span>
            </div>
            <div className="sr-aw-d">{a.detail}</div>
          </div>
        ))}
      </div>
    </div>
  ),
}

/* ═══ 16 · Outro ══════════════════════════════════════════════════ */

const outro: SlideDef = {
  key: 'outro', name: 'Wrap',
  theme: ['#7c5cff', '#ff5fa2', '#1a0b3d'],
  enabled: () => true,
  render: ({ d }) => {
    const champ = d.ladder[0]
    return (
      <div className="sr-inner" style={{ textAlign: 'center' }}>
        <Confetti count={110} />
        <div className="sr-eyebrow sr-rise">That's {d.year}</div>
        <h2 className="sr-h1 sr-rise" style={{ animationDelay: '100ms' }}>
          <span className="sr-grad">{champ?.name}</span> are your premiers
        </h2>
        <p className="sr-sub sr-rise" style={{ margin: '12px auto 0', textAlign: 'center', animationDelay: '200ms' }}>
          {d.cover.total_points.toLocaleString()} points, {d.cover.matches} matches and{' '}
          {d.bench.total.toLocaleString()} points left on benches later — the {d.year} season is done.
        </p>
        <div className="sr-card sr-card-hi sr-card-pad sr-pop"
             style={{ maxWidth: 460, margin: '26px auto 0', textAlign: 'left' }}>
          <div className="sr-label">Next up</div>
          <div className="sr-h2" style={{ marginTop: 6 }}>Delistings and the off-season</div>
          <p className="sr-sub" style={{ fontSize: '.78rem', marginTop: 6 }}>
            Lists get cut, trades reopen and the {d.year + 1} draft order gets set.
            You can replay this review any time from the bottom of the league nav.
          </p>
        </div>
      </div>
    )
  },
}

export const SLIDES: SlideDef[] = [
  intro, numbers, ladder, you, arc, mvp, ironmen, best23,
  records, h2h, bench, sevens, draft, coaches, awards, outro,
]
